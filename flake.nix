{
  description = "RFactory desktop guest (#3)";

  inputs = {
    # Same revisions nixarchy pins.
    nixpkgs.url = "github:NixOS/nixpkgs/e554fab72f81915600f3f449b786fd9af40439a5";
    microvm = {
      url = "github:microvm-nix/microvm.nix/fdfc1821a0eb76e44a13d206b72e6ca6961fbb7c";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, microvm }:
    let
      system = "x86_64-linux";
      mk = extra: nixpkgs.lib.nixosSystem {
        inherit system;
        modules = [
          microvm.nixosModules.microvm
          ./desktop/guest/default.nix
          ./desktop/guest/chrome.nix
        ] ++ extra;
      };
    in
    {
      nixosConfigurations.desktop-guest = mk [ ];
      # Test-only: adds rfactory-probe. Used by steps 2 and 15, never shipped.
      nixosConfigurations.desktop-guest-probe = mk [ ./desktop/guest/probe.nix ];

      # Host module for p620; the owner imports it (deploy is owner-gated).
      nixosModules.desktop-runner = ./desktop/nixos/runner.nix;
      # Evaluation only.
      nixosConfigurations.desktop-runner-sample = nixpkgs.lib.nixosSystem {
        inherit system;
        modules = [ ./desktop/nixos/sample-host.nix ];
      };
    };
}
