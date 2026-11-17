# Host module for the desktop runner (#3 step 6). The owner imports it; deploy is owner-gated.
# Deviation 1: the runner is a privileged host service; VMs run as the unprivileged rfactory-vm user.
{ config, lib, pkgs, ... }:
let
  cfg = config.services.rfactory-runner;
  inherit (lib) mkOption mkEnableOption mkIf types;

  # Deviation 9: p620 has no nft on PATH, so the runner gets pkgs.nftables explicitly.
  runnerPath = with pkgs; [
    nftables iproute2 systemd cloud-hypervisor dnsmasq coreutils cryptsetup
    cfg.tapHelper
  ];

  # Limits live in config, not in runner code (step 5 trap).
  runnerConfig = pkgs.writeText "rfactory-runner.json" (builtins.toJSON {
    inherit (cfg) mtlsPort maxDesktops vcpu memMiB overlayGiB rateMbit egressBytes runtimeMaxSec;
    stateDir = "/var/lib/rfactory-desktop";
    runDir = "/run/rfactory-desktop";
    dnsmasqConfDir = "/run/rfactory-desktop/dnsmasq.d";
    vmUser = "rfactory-vm";
    guestFlake = "${cfg.src}/..#nixosConfigurations.desktop-guest";
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

  dnsmasqConf = pkgs.writeText "rfactory-dnsmasq.conf" ''
    # Answers only names the runner lists in dnsmasq.d (platform and preview allowlists).
    bind-dynamic
    interface=rfd*
    except-interface=lo
    no-resolv
    no-hosts
    no-poll
    port=53
    ${lib.concatMapStringsSep "\n" (s: "server=${s}") cfg.upstreamResolvers}
    conf-dir=/run/rfactory-desktop/dnsmasq.d,*.conf
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
    upstreamResolvers = mkOption { type = types.listOf types.str; default = [ "1.1.1.1" "9.9.9.9" ]; };
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

    systemd.services.rfactory-dnsmasq = {
      description = "RFactory desktop resolver (nftset)";
      wantedBy = [ "multi-user.target" ];
      after = [ "rfactory-nft-base.service" ];
      partOf = [ "rfactory-runner.service" ];
      serviceConfig = {
        RuntimeDirectory = "rfactory-desktop/dnsmasq.d";
        RuntimeDirectoryPreserve = true;
        ExecStart = "${pkgs.dnsmasq}/bin/dnsmasq --keep-in-foreground --conf-file=${dnsmasqConf}";
        ExecReload = "${pkgs.coreutils}/bin/kill -HUP $MAINPID";
        Restart = "on-failure";
      };
    };

    systemd.services.rfactory-runner = {
      description = "RFactory desktop runner";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" "rfactory-nft-base.service" "rfactory-dnsmasq.service" ];
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
