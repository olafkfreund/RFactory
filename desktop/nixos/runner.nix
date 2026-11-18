# Host module for the desktop runner (#3 step 6). The owner imports it; deploy is owner-gated.
# Deviation 1: the runner is a privileged host service; VMs run as the unprivileged rfactory-vm user.
{ config, lib, pkgs, ... }:
let
  cfg = config.services.rfactory-runner;
  inherit (lib) mkOption mkEnableOption mkIf types;

  # Deviation 9: p620 has no nft on PATH, so the runner gets pkgs.nftables explicitly.
  runnerPath = with pkgs; [
    nftables iproute2 procps systemd cloud-hypervisor dnsmasq coreutils cryptsetup
    cfg.tapHelper
  ];

  # Limits live in config, not in runner code (step 5 trap).
  runnerConfig = pkgs.writeText "rfactory-runner.json" (builtins.toJSON {
    inherit (cfg) mtlsPort maxDesktops vcpu memMiB overlayGiB rateMbit egressBytes runtimeMaxSec
      guestRunner bootGraceMs protectedRanges dnsAllowlist scopeDomains scopePreviews upstreamResolvers;
    stateDir = "/var/lib/rfactory-desktop";
    runDir = "/run/rfactory-desktop";
    vmUser = "rfactory-vm";
    vmPath = lib.makeBinPath [ pkgs.coreutils pkgs.cloud-hypervisor ];
    dnsmasqBin = "${pkgs.dnsmasq}/bin/dnsmasq";
    rangesFile = "${cfg.src}/ranges/ranges.json";
  });

  # Per-VM tap setup hook: no bridge, one tap per VM, owned by the VM user.
  tapHelper = pkgs.writeShellApplication {
    name = "rfactory-tap";
    runtimeInputs = [ pkgs.iproute2 pkgs.procps pkgs.coreutils ];
    text = ''
      usage() { echo "usage: rfactory-tap up <tap> <host-ipv4>/<len> <host-ipv6>/<len> | down <tap>" >&2; exit 2; }
      [ $# -ge 2 ] || usage
      tap=$2
      [[ $tap =~ ^rfd[0-9a-z]{1,10}$ ]] || { echo "bad tap name" >&2; exit 2; }
      case $1 in
        up)
          [ $# -eq 4 ] || usage
          ip tuntap add dev "$tap" mode tap multi_queue user rfactory-vm
          ip addr add "$3" dev "$tap"
          ip -6 addr add "$4" dev "$tap" nodad
          ip link set "$tap" up
          # forwarding on this tap only; the per-VM nft table decides what passes
          sysctl -qw "net.ipv4.conf.$tap.forwarding=1" "net.ipv6.conf.$tap.forwarding=1"
          ;;
        down) ip link del "$tap" ;;
        *) usage ;;
      esac
    '';
  };

  # Base table: no per-VM rules here (the runner adds one table per VM from net.js).
  # Priority -10 runs before the per-VM tables; nothing from a tap reaches the host
  # except DNS and neighbour discovery, and tap-to-tap forwarding is dropped.
  baseRules = pkgs.writeText "rfactory-base.nft" ''
    table inet rfactory_base {
      chain input {
        type filter hook input priority -10; policy accept;
        iifname "rfd*" udp dport 53 accept
        iifname "rfd*" tcp dport 53 accept
        iifname "rfd*" icmpv6 type { nd-neighbor-solicit, nd-neighbor-advert } accept
        iifname "rfd*" drop
      }
      chain forward {
        type filter hook forward priority -10; policy accept;
        iifname "rfd*" oifname "rfd*" drop
      }
    }
  '';

in
{
  options.services.rfactory-runner = {
    enable = mkEnableOption "the RFactory desktop runner";
    src = mkOption {
      type = types.path;
      default = ../.;
      description = "The repo's desktop/ directory (holds runner/runner.js).";
    };
    tapHelper = mkOption { type = types.package; default = tapHelper; internal = true; };
    mtlsPort = mkOption { type = types.port; default = 8443; description = "The only host port opened (TCP)."; };
    # Runtime paths as strings so secrets are never copied to the store.
    tlsCertFile = mkOption { type = types.str; description = "Runner server certificate (runtime path)."; };
    tlsKeyFile = mkOption { type = types.str; description = "Runner server key (runtime path, agenix or sops-nix)."; };
    clientCaFile = mkOption { type = types.str; description = "CA that signs the server's client certificate."; };
    profileKeyFile = mkOption { type = types.str; description = "Profile LUKS key (runtime path, agenix or sops-nix)."; };
    upstreamResolvers = mkOption { type = types.listOf types.str; default = [ "1.1.1.1" "9.9.9.9" ]; description = "Used only for allowlisted names; every VM has its own resolver."; };
    guestRunner = mkOption { type = types.str; description = "Runtime path of the guest's microvm-run (config.microvm.declaredRunner of desktop-guest)."; };
    bootGraceMs = mkOption { type = types.ints.unsigned; default = 45000; description = "Boot time allowed before the first heartbeat deadlines count."; };
    protectedRanges = mkOption { type = types.listOf types.str; default = [ ]; description = "Host addresses, cluster pod and service ranges and Factory hosts the guest must never reach (rule 2)."; };
    dnsAllowlist = mkOption {
      type = types.listOf types.str;
      default = [ "meet.google.com" "google.com" "gstatic.com" "googleapis.com" "slack.com" "slack-edge.com" "zoom.us" ];
      description = "Names every VM may resolve (the call platforms). Owner reviews this list; everything else gets no answer.";
    };
    scopeDomains = mkOption { type = types.attrsOf (types.listOf types.str); default = { }; description = "Extra resolvable names per scope."; };
    scopePreviews = mkOption { type = types.attrsOf (types.listOf types.str); default = { }; description = "Approved private ip:port previews per scope (never inside a protected range)."; };
    maxDesktops = mkOption { type = types.ints.positive; default = 3; description = "Spare counts toward this."; };
    vcpu = mkOption { type = types.ints.positive; default = 2; };
    memMiB = mkOption { type = types.ints.positive; default = 3072; };
    overlayGiB = mkOption { type = types.ints.positive; default = 4; };
    rateMbit = mkOption { type = types.ints.positive; default = 20; };
    egressBytes = mkOption { type = types.ints.positive; default = 1073741824; };
    runtimeMaxSec = mkOption { type = types.str; default = "3h"; };
  };

  config = mkIf cfg.enable {
    users.groups.rfactory-vm = { };
    users.users.rfactory-vm = {
      isSystemUser = true;
      group = "rfactory-vm";
      extraGroups = [ "kvm" ]; # /dev/kvm; without it the runner's create must refuse clearly
    };

    # The mTLS port is the only host port; taps reach DNS through the interface rule below.
    networking.firewall.allowedTCPPorts = [ cfg.mtlsPort ];
    networking.firewall.interfaces."rfd+" = { allowedUDPPorts = [ 53 ]; allowedTCPPorts = [ 53 ]; };

    systemd.services.rfactory-nft-base = {
      description = "RFactory desktop nft base table";
      wantedBy = [ "multi-user.target" ];
      before = [ "rfactory-runner.service" ];
      path = [ pkgs.nftables ];
      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
        ExecStart = "${pkgs.nftables}/bin/nft -f ${baseRules}";
        ExecStop = "${pkgs.nftables}/bin/nft delete table inet rfactory_base";
      };
    };

    systemd.services.rfactory-runner = {
      description = "RFactory desktop runner";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" "rfactory-nft-base.service" ];
      requires = [ "rfactory-nft-base.service" ];
      path = runnerPath;
      serviceConfig = {
        ExecStart = "${pkgs.nodejs_22}/bin/node ${cfg.src}/runner/runner.js --config ${runnerConfig}";
        # Secrets stay outside the store; the runner reads them from $CREDENTIALS_DIRECTORY.
        LoadCredential = [
          "tls-cert:${cfg.tlsCertFile}"
          "tls-key:${cfg.tlsKeyFile}"
          "client-ca:${cfg.clientCaFile}"
          "profile-key:${cfg.profileKeyFile}"
        ];
        StateDirectory = "rfactory-desktop";
        RuntimeDirectory = "rfactory-desktop";
        RuntimeDirectoryPreserve = true;
        Restart = "on-failure";
        # Hardening. Root is needed for taps, nft and transient system units.
        NoNewPrivileges = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        ProtectKernelModules = true;
        ProtectKernelLogs = true;
        ProtectControlGroups = true;
        ProtectClock = true;
        RestrictRealtime = true;
        LockPersonality = true;
        MemoryDenyWriteExecute = false; # node JIT
        RestrictAddressFamilies = [ "AF_UNIX" "AF_INET" "AF_INET6" "AF_NETLINK" ];
        CapabilityBoundingSet = [ "CAP_NET_ADMIN" "CAP_CHOWN" "CAP_DAC_OVERRIDE" "CAP_FOWNER" "CAP_SYS_ADMIN" ];
        ReadWritePaths = [ "/var/lib/rfactory-desktop" "/run/rfactory-desktop" ];
      };
    };
  };
}
