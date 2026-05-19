{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    flake-parts = {
      url = "github:hercules-ci/flake-parts";
    };
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = inputs@{ nixpkgs, flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [ "x86_64-linux" "aarch64-darwin" "x86_64-darwin" ];
      imports = [
        inputs.treefmt-nix.flakeModule
      ];
      perSystem = { system, config, pkgs, ... }:
        {
          devShells.default = pkgs.mkShell {
            packages = [ pkgs.nodejs_24 pkgs.jdk21 ];
            inputsFrom = [
              config.treefmt.build.devShell
            ];
            shellHook = ''
              export JAVA_HOME="${pkgs.jdk21.home}"
            '';
          };

          treefmt.config = {
            projectRootFile = "flake.nix";

            programs = {
              nixpkgs-fmt.enable = true;
              prettier.enable = true;
            };
          };
        };
    };
}

