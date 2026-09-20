{
  description = "Online e-book reader that supports Yomichan";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
      };
      version = "2.0.0";
      makeServer = { defaultPort ? "9010" }: with pkgs; writeShellScriptBin "ebook-reader-server-${version}" ''
        PORT=''${PORT:=${defaultPort}}
        if nc -z localhost $PORT >/dev/null 2>&1; then
          echo "Port $PORT already in use. Trying setting environment variable PORT to different value."
          exit 1
        fi
        echo "Starting web server on port $PORT..."
        xdg-open http://localhost:$PORT 2>/dev/null || true
        ${static-web-server}/bin/static-web-server -p $PORT -d ${self.packages.${system}.ebook-reader}
      '';
    in {
      packages.${system} = rec {
        default = ebook-reader-server;
        ebook-reader-server = makeServer {};
        ebook-reader = with pkgs; stdenv.mkDerivation (finalAttrs: {
          pname = "ebook-reader";
          inherit version;

          src = ./.;

          nativeBuildInputs = [
            nodejs
            pnpmConfigHook
            pnpm # At least required by pnpmConfigHook, if not other (custom) phases
          ];

          pnpmDeps = fetchPnpmDeps {
            inherit (finalAttrs) pname version src;
            fetcherVersion = 3;
            hash = "sha256-4fLxRRDoUSRCDb8+ZvIMnjc5vttJGE8lXyKFMrC/4x4=";
          };

          postInstall = ''
            pushd apps/web
            pnpm svelte-kit sync
            pnpm build
            cp -r build $out
            popd
          '';

          meta = {
            description = "Online e-book reader that supports Yomichan";
            homepage = "https://reader.ttsu.app";
            license = lib.licenses.bsd3;
          };
        });
      };
      devShells.${system}.default = with pkgs; mkShell {
        inputsFrom = [ self.packages.${system}.ebook-reader ];
      };
    };
}
