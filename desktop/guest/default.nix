{ pkgs, lib, ... }:
let
  bridge = port: {
    wantedBy = [ "multi-user.target" ];
    serviceConfig.ExecStart = "${pkgs.socat}/bin/socat VSOCK-LISTEN:${toString port},fork TCP:127.0.0.1:${toString port}";
  };
  xenv = { DISPLAY = ":0"; };
  agent = pkgs.callPackage ./agent.nix { };
in
{
  system.stateVersion = "25.05";
  networking.hostName = "desktop-guest";

  microvm = {
    hypervisor = "cloud-hypervisor";
    vcpu = 2;
    mem = 3072;
    vsock.cid = 3; # runner assigns real CIDs per VM at create time (step 5)
    storeOnDisk = true; # erofs of the guest closure; no host store share (Deviation 2)
    writableStoreOverlay = null;
    shares = [ ];
    volumes = [ ];
    # empty 4 GiB overlay on tmpfs
  };
  fileSystems."/tmp" = { fsType = "tmpfs"; options = [ "size=4G" "mode=1777" ]; };

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
    # The guest agent and call worker; it listens on 127.0.0.1:5000 and starts the call Chrome after call-config.
    rfactory-agent = {
      wantedBy = [ "multi-user.target" ];
      after = [ "xvfb.service" ];
      path = [ pkgs.socat pkgs.cryptsetup pkgs.util-linux ];
      environment = xenv // { CHROME = "${pkgs.google-chrome}/bin/google-chrome-stable"; };
      serviceConfig.ExecStart = "${pkgs.nodejs_22}/bin/node ${agent}/desktop/guest/agent/index.js";
    };
    # vsock bridges, guest side listens on 5000 and 5900 only.
    vsock-vnc = bridge 5900;
    vsock-control = bridge 5000; # step 7's agent listens on 127.0.0.1:5000
  };
}
