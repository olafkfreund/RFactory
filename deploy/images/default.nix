# Docker archives for `k3d image import` (k10). Pinned by digest in the manifests afterwards.
# runner, proxy and reaper run as uid 10001; the guard runs as root and gets NET_ADMIN from its manifest.
{ pkgs }:
let
  inherit (pkgs) lib;
  # Only the code these services load (runner needs guest/agent/share.js and the ranges); no tests.
  desktop = lib.cleanSourceWith { src = ../../desktop; filter = path: _: baseNameOf path != "node_modules" && !lib.hasSuffix ".test.js" path; };
  src = pkgs.runCommand "rfactory-desktop-src" { } ''
    mkdir -p $out/app/desktop/guest
    for d in runner ranges guard proxy reaper; do cp -r ${desktop}/$d $out/app/desktop/$d; done
    cp -r ${desktop}/guest/agent $out/app/desktop/guest/agent
  '';
  image = { name, entry, user, extra ? [ ] }: pkgs.dockerTools.buildLayeredImage {
    name = "rfactory/${name}";
    contents = [ pkgs.nodejs_22 src ] ++ extra;
    config = {
      Entrypoint = [ "${pkgs.nodejs_22}/bin/node" "/app/desktop/${entry}" ];
      User = user;
      WorkingDir = "/app/desktop";
      Env = [ "PATH=${lib.makeBinPath ([ pkgs.nodejs_22 ] ++ extra)}" ];
    };
  };
in
{
  image-runner = image { name = "runner"; entry = "runner/runner.js"; user = "10001:10001"; };
  image-proxy = image { name = "proxy"; entry = "proxy/proxy.js"; user = "10001:10001"; };
  image-reaper = image { name = "reaper"; entry = "reaper/reaper.js"; user = "10001:10001"; };
  image-guard = image { name = "guard"; entry = "guard/guard.js"; user = "0:0"; extra = [ pkgs.nftables pkgs.iproute2 ]; };
}
