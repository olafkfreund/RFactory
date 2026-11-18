# Test-only additions for desktop-guest-probe (steps 2 and 15). Never in the production image.
{ pkgs, lib, ... }:
let
  # #1's Phase 0 spike, from its lockfile; probe image only
  spike = pkgs.buildNpmPackage {
    pname = "rfactory-spike";
    version = "0";
    src = lib.cleanSourceWith {
      src = ../../spike;
      filter =
        n: _:
        !(builtins.elem (baseNameOf n) [
          "node_modules"
          "out"
        ]);
    };
    npmDepsHash = "sha256-w/8+hvYX4mg2OG5JPZLoLFWuhbNedwNJexWg1yL1Tgc=";
    dontNpmBuild = true;
    # spike/package.json has no name/version, so `npm pack` (the default install) refuses it; copy instead
    installPhase = ''
      runHook preInstall
      mkdir -p $out && cp -r . $out/
      runHook postInstall
    '';
  };
in
{
  users.users.gate = {
    isNormalUser = true;
    uid = 1000;
  };

  # network identity: default.nix (the runner's per-VM cid and tap, the guest's address from its cid), the same as production

  # the probe owns vsock 5000 here; step 7's agent bridge would clash with it
  systemd.services.vsock-control.enable = lib.mkForce false;
  systemd.services.rfactory-probe = {
    wantedBy = [ "multi-user.target" ];
    path = [ pkgs.socat ]; # step 15: the vsock-send probe
    environment = {
      CHROME = "${pkgs.google-chrome}/bin/google-chrome-stable";
      NODE = "${pkgs.nodejs_22}/bin/node";
      SPIKE = "${spike}";
    };
    serviceConfig.ExecStart = "${pkgs.socat}/bin/socat VSOCK-LISTEN:5000,fork EXEC:${pkgs.writeShellScript "probe" "exec ${pkgs.nodejs_22}/bin/node ${./probe.js}"}";
  };
}
