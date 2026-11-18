{ pkgs, lib, ... }:
let
  bridge = port: {
    wantedBy = [ "multi-user.target" ];
    serviceConfig.ExecStart = "${pkgs.socat}/bin/socat VSOCK-LISTEN:${toString port},fork TCP:127.0.0.1:${toString port}";
  };
  xenv = { DISPLAY = ":0"; };
  agent = pkgs.callPackage ./agent.nix { };
  # The control Chrome (pages from granted hosts) runs as this user, not root, with the Chrome sandbox on.
  # Unverified until a VM run: the guest kernel must allow unprivileged user namespaces.
  controlChrome = pkgs.writeShellScript "control-chrome" ''
    export HOME=/var/lib/rfchrome
    exec ${pkgs.util-linux}/bin/setpriv --reuid=990 --regid=990 --clear-groups ${pkgs.google-chrome}/bin/google-chrome-stable "$@"
  '';
  # One image serves every VM. The runner gives each VM its own cid and tap by rewriting the per-VM copy of microvm-run
  # (runner.js withExtraArgs: cid=3,socket=notify.vsock and tap=rfdguest are the placeholders), and the guest derives its
  # own addresses from its vsock CID at boot, the same plan as the runner's addrFor: a /30 at 10.77.<cid*4>.0 and fd77:<cid hex>::/64.
  mac = "02:00:00:00:00:01";
  vsockCid = pkgs.writeCBin "vsock-cid" ''
    #include <fcntl.h>
    #include <stdio.h>
    #include <sys/ioctl.h>
    int main(void) {
      unsigned int cid;
      int fd = open("/dev/vsock", O_RDONLY);
      /* IOCTL_VM_SOCKETS_GET_LOCAL_CID = _IO(7, 0xb9) */
      if (fd < 0 || ioctl(fd, 0x7b9, &cid) < 0) return 1;
      printf("%u\n", cid);
      return 0;
    }
  '';
  identity = pkgs.writeShellScript "rfactory-identity" ''
    set -eu
    PATH=${lib.makeBinPath [ pkgs.iproute2 pkgs.coreutils ]}
    cid=
    for _ in $(seq 50); do
      if cid=$(${vsockCid}/bin/vsock-cid 2>/dev/null); then break; fi
      cid=; sleep 0.2
    done
    [ -n "$cid" ] || { echo "no vsock cid" >&2; exit 1; }
    dev=
    for _ in $(seq 50); do
      for d in /sys/class/net/*; do
        if [ "$(cat "$d/address")" = ${mac} ]; then dev=$(basename "$d"); fi
      done
      if [ -n "$dev" ]; then break; fi
      sleep 0.2
    done
    [ -n "$dev" ] || { echo "no network interface" >&2; exit 1; }
    a=$((cid * 4 / 256)); b=$((cid * 4 % 256)); hex=$(printf %x "$cid")
    ip link set "$dev" up
    ip addr replace "10.77.$a.$((b + 2))/30" dev "$dev"
    ip route replace default via "10.77.$a.$((b + 1))" dev "$dev"
    ip -6 addr replace "fd77:$hex::2/64" dev "$dev" nodad
    ip -6 route replace default via "fd77:$hex::1" dev "$dev"
    rm -f /etc/resolv.conf # the host's per-VM resolver answers on the gateway addresses
    printf 'nameserver 10.77.%s.%s\nnameserver fd77:%s::1\n' "$a" "$((b + 1))" "$hex" > /etc/resolv.conf
  '';
in
{
  system.stateVersion = "25.05";
  networking.hostName = "desktop-guest";

  microvm = {
    hypervisor = "cloud-hypervisor";
    vcpu = 2;
    mem = 3072;
    vsock.cid = 3; # placeholder: the runner's per-VM copy of microvm-run swaps in the VM's own cid and socket
    interfaces = [ { type = "tap"; id = "rfdguest"; inherit mac; } ]; # placeholder tap name, swapped the same way
    storeOnDisk = true; # erofs of the guest closure; no host store share (Deviation 2)
    writableStoreOverlay = null;
    shares = [ ];
    volumes = [ ];
    # empty 4 GiB overlay on tmpfs
  };
  fileSystems."/tmp" = { fsType = "tmpfs"; options = [ "size=4G" "mode=1777" ]; };

  users.groups.rfchrome.gid = 990;
  users.users.rfchrome = { isSystemUser = true; uid = 990; group = "rfchrome"; home = "/var/lib/rfchrome"; createHome = true; };

  networking.useDHCP = false;
  networking.resolvconf.enable = false;

  # No SSH, no secrets.
  services.openssh.enable = false;

  systemd.services = {
    xvfb = {
      wantedBy = [ "multi-user.target" ];
      serviceConfig.ExecStart = "${pkgs.xorg-server}/bin/Xvfb :0 -screen 0 1280x800x24";
    };
    openbox = {
      wantedBy = [ "multi-user.target" ];
      after = [ "xvfb.service" ];
      environment = xenv;
      serviceConfig.ExecStart = "${pkgs.openbox}/bin/openbox";
    };
    x11vnc = {
      wantedBy = [ "multi-user.target" ];
      after = [ "xvfb.service" ];
      serviceConfig.ExecStart = "${pkgs.x11vnc}/bin/x11vnc -display :0 -localhost -rfbport 5900 -viewonly -nopw -forever";
    };
    rfactory-identity = {
      wantedBy = [ "multi-user.target" ];
      before = [ "rfactory-agent.service" ];
      serviceConfig = { Type = "oneshot"; RemainAfterExit = true; ExecStart = identity; };
    };
    # The guest agent and call worker; it listens on 127.0.0.1:5000 and starts the call Chrome after call-config.
    rfactory-agent = {
      wantedBy = [ "multi-user.target" ];
      after = [ "xvfb.service" "rfactory-identity.service" ];
      requires = [ "rfactory-identity.service" ];
      path = [ pkgs.socat pkgs.cryptsetup pkgs.util-linux pkgs.e2fsprogs ];
      environment = xenv // {
        CHROME = "${pkgs.google-chrome}/bin/google-chrome-stable"; # the call Chrome (root, --no-sandbox, Deviation 18)
        CONTROL_CHROME = "${controlChrome}";
        CONTROL_UID = "990";
        CONTROL_GID = "990";
      };
      serviceConfig.ExecStart = "${pkgs.nodejs_22}/bin/node ${agent}/desktop/guest/agent/index.js";
    };
    # vsock bridges, guest side listens on 5000 and 5900 only.
    vsock-vnc = bridge 5900;
    vsock-control = bridge 5000; # step 7's agent listens on 127.0.0.1:5000
  };
}
