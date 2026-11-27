{ pkgs, ... }:
let
  xenv = { DISPLAY = ":0"; };
  agent = pkgs.callPackage ./agent.nix { };
  # The control Chrome (pages from granted hosts) runs as this user, not root, with the Chrome sandbox on.
  # Unverified until a VM run: the guest kernel must allow unprivileged user namespaces.
  controlChrome = pkgs.writeShellScript "control-chrome" ''
    export HOME=/var/lib/rfchrome
    exec ${pkgs.util-linux}/bin/setpriv --reuid=990 --regid=990 --clear-groups ${pkgs.google-chrome}/bin/google-chrome-stable "$@"
  '';
  # The call Chrome runs as its own user, rfcall, so the Chrome sandbox can stay on.
  callChrome = pkgs.writeShellScript "call-chrome" ''
    export HOME=/var/lib/rfcall
    exec ${pkgs.util-linux}/bin/setpriv --reuid=991 --regid=991 --clear-groups ${pkgs.google-chrome}/bin/google-chrome-stable "$@"
  '';
in
{
  config = {
    system.stateVersion = "25.05";
    networking.hostName = "desktop-guest";

    users.groups.rfchrome.gid = 990;
    users.users.rfchrome = { isSystemUser = true; uid = 990; group = "rfchrome"; home = "/var/lib/rfchrome"; createHome = true; };
    users.groups.rfcall.gid = 991;
    users.users.rfcall = { isSystemUser = true; uid = 991; group = "rfcall"; home = "/var/lib/rfcall"; createHome = true; };

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
      # The guest agent and call worker; the guest dials the runner (kubevirt.nix).
      # It starts the call Chrome after call-config.
      rfactory-agent = {
        wantedBy = [ "multi-user.target" ];
        after = [ "xvfb.service" ];
        path = [ pkgs.socat pkgs.cryptsetup pkgs.util-linux pkgs.e2fsprogs ];
        environment = xenv // {
          # the call Chrome runs as rfcall with the Chrome sandbox on (#68; Meet refuses --no-sandbox)
          CHROME = "${callChrome}";
          CALL_UID = "991";
          CALL_GID = "991";
          CONTROL_CHROME = "${controlChrome}";
          CONTROL_UID = "990";
          CONTROL_GID = "990";
        };
        serviceConfig.ExecStart = "${pkgs.nodejs_22}/bin/node ${agent}/desktop/guest/agent/index.js";
      };
    };
  };
}
