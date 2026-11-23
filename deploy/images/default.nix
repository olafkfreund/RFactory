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
  # rfactory-stt (#16): whisper-server on the multilingual small model; the request path is the secret.
  sttModel = pkgs.fetchurl {
    url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin";
    hash = "sha256-G+OpsgY4Z7k35k4ux0gzZKeZF+FX+pjF2UtcH//qmHs=";
  };
  sttRun = pkgs.writeShellScript "rfactory-stt" ''
    set -eu
    read -r secret < /run/secrets/stt/path || true
    case "$secret" in
      *[!0-9a-fA-F]* | "") echo "stt: secret is not hex" >&2; exit 1 ;;
    esac
    [ "''${#secret}" -eq 32 ] || { echo "stt: secret is not 32 characters" >&2; exit 1; }
    exec ${pkgs.whisper-cpp}/bin/whisper-server -m ${sttModel} -t 8 -ac 768 \
      --host 0.0.0.0 --port 8080 --inference-path "/inference/$secret"
  '';
in
{
  image-stt = pkgs.dockerTools.buildLayeredImage {
    name = "rfactory/stt";
    contents = [ pkgs.coreutils ]; # sha256sum for deploy/check-image-stt.sh
    config = {
      Entrypoint = [ "${sttRun}" ];
      User = "10001:10001";
      ExposedPorts."8080/tcp" = { };
      Env = [ "STT_MODEL=${sttModel}" ];
    };
  };
  image-runner = image { name = "runner"; entry = "runner/runner.js"; user = "10001:10001"; };
  image-proxy = image { name = "proxy"; entry = "proxy/proxy.js"; user = "10001:10001"; };
  image-reaper = image { name = "reaper"; entry = "reaper/reaper.js"; user = "10001:10001"; };
  image-guard = image { name = "guard"; entry = "guard/guard.js"; user = "0:0"; extra = [ pkgs.nftables pkgs.iproute2 ]; };
}
