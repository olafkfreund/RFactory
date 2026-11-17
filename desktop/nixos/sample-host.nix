# Evaluation-only host that imports the runner module (#3 step 6). Never deployed.
{ ... }:
{
  imports = [ ./runner.nix ];
  system.stateVersion = "25.05";
  boot.loader.grub.enable = false;
  fileSystems."/" = { device = "none"; fsType = "tmpfs"; };
  networking.hostName = "desktop-runner-sample";
  networking.firewall.enable = true;
  services.rfactory-runner = {
    enable = true;
    # Runtime paths only; no secret is in the store.
    tlsCertFile = "/run/secrets/rfactory-runner-cert";
    tlsKeyFile = "/run/secrets/rfactory-runner-key";
    clientCaFile = "/run/secrets/rfactory-runner-ca";
    profileKeyFile = "/run/secrets/rfactory-profile-key";
  };
}
