{ pkgs, ... }:
{
  # allowUnfree for google-chrome only.
  nixpkgs.config.allowUnfreePredicate = pkg: (pkgs.lib.getName pkg) == "google-chrome";

  environment.systemPackages = [
    pkgs.google-chrome
    pkgs.nodejs_22
    pkgs.playwright-driver
    pkgs.cryptsetup
  ];
}
