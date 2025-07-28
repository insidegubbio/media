{
  description = "dev env for zipline";

  inputs = {
    # node 24.4.1, postgres 17
    nixpkgs.url = "github:nixos/nixpkgs/b527e89270879aaaf584c41f26b2796be634bc9d";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

        nodejs = pkgs.nodejs_24;
        postgres = pkgs.postgresql;
        psqlDir = ".psql_db/data";

        psqlUsername = "postgres";
        psqlPassword = "postgres";
      in
      {
        devShells.default = pkgs.mkShell {
          name = "zipline";

          buildInputs = [
            nodejs
            postgres

            pkgs.git
            pkgs.corepack
            pkgs.ffmpeg
          ];

          shellHook = ''
            export PGDATA="$PWD/${psqlDir}"
            export PGUSER="${psqlUsername}"
            export PGPASSWORD="${psqlPassword}"
            export PGPORT=5432

            if [ ! -d "$PGDATA" ]; then
              echo "Initializing PostgreSQL data directory at $PGDATA"
              initdb -D "$PGDATA" --username="$PGUSER" --pwfile=<(echo "$PGPASSWORD")
            fi

            # listen on localhost
            echo "host all all 127.0.0.1/32 password" >> "$PGDATA/pg_hba.conf"
            echo "host all all ::1/128 password" >> "$PGDATA/pg_hba.conf"
            sed -i "s/^#\?listen_addresses.*/listen_addresses = 'localhost'/" "$PGDATA/postgresql.conf"

            echo "Starting PostgreSQL..."
            pg_ctl -D "$PGDATA" -o "-p $PGPORT" -w start

            echo -e "PostgreSQL is ready at postgresql://$PGUSER:$PGPASSWORD@localhost:$PGPORT/postgres\n\n"

            stop_postgres() {
              echo "Stopping PostgreSQL..."
              pg_ctl -D "$PGDATA" stop
            }

            # trap pg to stop on exiting the dev shell
            trap stop_postgres EXIT

            # use zsh if zsh is available
            if command -v zsh >/dev/null 2>&1; then
              zsh
            else
              $SHELL
            fi

            exit
          '';
        };
      }
    );
}
