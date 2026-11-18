# k2: the guest for KubeVirt. Imports default.nix (agent, Xvfb, openbox, Chromes) with rfactory.guest.kubevirt on:
# kernelBoot from a container image, a read-only erofs for /nix/store as the containerDisk, everything writable on tmpfs.
# The runner passes `rf.runner=<ClusterIP>` and `rf.proxy=<ip>:<port>` as kernel arguments (the `cmdline` output has the rest).
{ pkgs, lib, config, ... }:
let
  # The value of a kernel argument, or fail: the unit that needs it does not start without it.
  rfarg = pkgs.writeShellScript "rfarg" ''
    set -eu
    v=$(${pkgs.coreutils}/bin/tr ' ' '\n' < /proc/cmdline | ${pkgs.gnused}/bin/sed -n "s/^$1=//p" | ${pkgs.coreutils}/bin/head -n1)
    printf '%s\n' "$v" | ${pkgs.gnugrep}/bin/grep -Exq "$2" || { echo "bad or missing kernel argument $1" >&2; exit 1; }
    printf '%s\n' "$v"
  '';
  ip4 = "[0-9]{1,3}(\\.[0-9]{1,3}){3}";
  vnc = pkgs.writeShellScript "rfactory-vnc" ''
    set -eu
    runner=$(${rfarg} rf.runner '${ip4}')
    # Reverse VNC: x11vnc dials the runner (-rfbport 0: no listening port) and exits if the dial fails or the viewer goes; systemd restarts it.
    exec ${pkgs.x11vnc}/bin/x11vnc -display :0 -connect_or_exit "$runner:5900" -rfbport 0 -viewonly -nopw
  '';
  # DNS only at the proxy's resolver (the proxy's IP, port 53).
  resolver = pkgs.writeShellScript "rfactory-resolver" ''
    set -eu
    proxy=$(${rfarg} rf.proxy '${ip4}:[0-9]{1,5}')
    rm -f /etc/resolv.conf
    printf 'nameserver %s\n' "''${proxy%:*}" > /etc/resolv.conf
  '';
  toplevel = config.system.build.toplevel;
  closure = pkgs.writeClosure [ toplevel ];
  # The guest's /nix/store, read-only. Label rfroot is what fileSystems below mounts.
  erofs = pkgs.runCommand "rfactory-guest-store.erofs" { nativeBuildInputs = [ pkgs.erofs-utils ]; __structuredAttrs = true; unsafeDiscardReferences.out = true; } ''
    mkdir store
    cp -a $(sort -u ${closure}) store/
    mkfs.erofs -T 0 --all-root -zlz4hc -L rfroot $out store
  '';
  # Kernel arguments for kernelBoot.kernelArgs, before the runner adds rf.runner and rf.proxy.
  cmdline = pkgs.writeText "rfactory-guest-cmdline" (lib.concatStringsSep " " ([ "init=${toplevel}/init" ] ++ config.boot.kernelParams) + "\n");
  # unsafeDiscardReferences: the images must not pull the whole guest closure in through the cmdline's init= path.
  boot = pkgs.runCommand "rfactory-guest-boot" { __structuredAttrs = true; unsafeDiscardReferences.out = true; } ''
    mkdir -p $out/boot
    cp ${config.system.build.kernel}/${config.system.boot.loader.kernelFile} $out/boot/kernel
    cp ${config.system.build.initialRamdisk}/${config.system.boot.loader.initrdFile} $out/boot/initrd
    cp ${cmdline} $out/boot/cmdline
  '';
  disk = pkgs.runCommand "rfactory-guest-disk" { __structuredAttrs = true; unsafeDiscardReferences.out = true; } ''
    mkdir -p $out/disk
    cp ${erofs} $out/disk/disk.img
  '';
in
{
  imports = [ ./default.nix ];
  rfactory.guest.kubevirt = true;
  microvm.guest.enable = false;

  boot.loader.grub.enable = false;
  boot.kernelParams = [ "console=ttyS0" ];
  boot.initrd.availableKernelModules = [ "virtio_pci" "virtio_blk" "erofs" ];
  # Root is tmpfs: every writable path, /tmp included, lives in these 3 GiB (4 GiB with /dev/shm and /run). Only the store comes from the disk, read-only.
  fileSystems."/" = { device = "none"; fsType = "tmpfs"; options = [ "mode=755" "size=3G" ]; };
  fileSystems."/nix/store" = { device = "/dev/disk/by-label/rfroot"; fsType = "erofs"; options = [ "ro" ]; neededForBoot = true; };
  # Writable budget, 4 GiB at most: root 3G + /dev/shm 512M + /run 256M (the defaults are 50% and 25% of guest RAM).
  boot.devShmSize = "512M";
  boot.runSize = "256M";
  nix.enable = false;

  # DHCP on the masquerade NIC; the lease's DNS is ignored.
  networking.useNetworkd = true;
  systemd.network.networks."10-nic" = {
    matchConfig.Name = "en* eth*";
    networkConfig = { DHCP = "ipv4"; IPv6AcceptRA = false; LinkLocalAddressing = "no"; };
    dhcpV4Config.UseDNS = false;
  };
  # Inbound drops everything (the guest has no listeners either).
  networking.firewall = { enable = true; allowPing = false; allowedTCPPorts = [ ]; allowedUDPPorts = [ ]; };

  systemd.services = {
    rfactory-resolver = {
      wantedBy = [ "multi-user.target" ];
      before = [ "rfactory-agent.service" ];
      serviceConfig = { Type = "oneshot"; RemainAfterExit = true; ExecStart = resolver; };
    };
    x11vnc = {
      wantedBy = [ "multi-user.target" ];
      after = [ "xvfb.service" "network-online.target" ];
      wants = [ "network-online.target" ];
      unitConfig.StartLimitIntervalSec = 0; # never give up: the live view must come back whenever the runner does
      serviceConfig = { ExecStart = vnc; Restart = "always"; RestartSec = 1; };
    };
    rfactory-agent = {
      after = [ "rfactory-resolver.service" "network-online.target" ];
      wants = [ "network-online.target" ];
      requires = [ "rfactory-resolver.service" ];
      unitConfig.StartLimitIntervalSec = 0;
      serviceConfig.Restart = "always"; # the agent exits when its runner address is missing; the dial loop does not
    };
  };

  system.build.kubevirt = {
    inherit cmdline erofs;
    # Container images, loadable with `k3d image import` (docker archives).
    bootImage = pkgs.dockerTools.buildImage { name = "rfactory-guest-boot"; tag = "k2"; copyToRoot = boot; };
    diskImage = pkgs.dockerTools.buildImage { name = "rfactory-guest-disk"; tag = "k2"; copyToRoot = disk; };
  };
}
