{
  description = "RFactory desktop guest (#3)";

  inputs = {
    # Same revision nixarchy pins.
    nixpkgs.url = "github:NixOS/nixpkgs/e554fab72f81915600f3f449b786fd9af40439a5";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
    in
    {
      # The KubeVirt guest. Outputs below are docker archives for `k3d image import` and the kernel arguments.
      nixosConfigurations.desktop-guest-kubevirt = nixpkgs.lib.nixosSystem {
        inherit system;
        modules = [ ./desktop/guest/kubevirt.nix ./desktop/guest/chrome.nix ];
      };
      packages.${system} = (import ./deploy/images { pkgs = nixpkgs.legacyPackages.${system}; }) // {
        guest-kubevirt-boot-image = self.nixosConfigurations.desktop-guest-kubevirt.config.system.build.kubevirt.bootImage;
        guest-kubevirt-disk-image = self.nixosConfigurations.desktop-guest-kubevirt.config.system.build.kubevirt.diskImage;
        guest-kubevirt-cmdline = self.nixosConfigurations.desktop-guest-kubevirt.config.system.build.kubevirt.cmdline;
      };
    };
}
