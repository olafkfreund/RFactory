# The guest agent and the call worker (bot/run.js, same call library and pins as the pod), plan step 13c.
{ pkgs, lib }:
let
  clean = src: lib.cleanSourceWith { inherit src; filter = n: _: baseNameOf n != "node_modules"; };
  # bot/package-lock.json holds the same dependencies as spike/package-lock.json, so the hash is the spike lockfile's
  botModules = pkgs.buildNpmPackage {
    pname = "rfactory-bot";
    version = "0";
    src = clean ../../bot;
    npmDepsHash = "sha256-cmsWRZtGqf5c2XVoeqz2joSGlhwQNuDvIACLxf9OV4c="; # bot/package-lock.json, measured by the first p620 build
    dontNpmBuild = true;
    installPhase = ''
      runHook preInstall
      mkdir -p $out && cp -r . $out/
      runHook postInstall
    '';
  };
in
# The agent finds playwright-core and the call library through $out/node_modules.
pkgs.runCommand "rfactory-guest-agent" { } ''
  mkdir -p $out/core/src $out/desktop/runner $out/desktop/guest
  cp -r ${botModules} $out/bot
  chmod -R u+w $out/bot
  ln -s $out/bot/node_modules $out/node_modules
  cp ${../../core/src/redact.js} $out/core/src/redact.js
  cp ${../runner/protocol.js} $out/desktop/runner/protocol.js
  cp -r ${clean ./agent} $out/desktop/guest/agent
''
