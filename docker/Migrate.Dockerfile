FROM postgres:17.6-bookworm

ARG TARGETARCH
# Same CLI as .github/workflows/ci.yml; verify official release archives before installation.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && case "$TARGETARCH" in \
         amd64) checksum=36d87b7fe6b4bcfe89ac47a4354e526cff22480224de426d7b370f6934556976 ;; \
         arm64) checksum=a7f7c771acd3a2a13938b5832029beb24787b165d5119ed57ad6e964f3593291 ;; \
         *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
       esac \
    && curl --fail --location --retry 3 \
         "https://github.com/supabase/cli/releases/download/v2.109.1/supabase_2.109.1_linux_${TARGETARCH}.tar.gz" -o /tmp/supabase.tar.gz \
    && echo "$checksum  /tmp/supabase.tar.gz" | sha256sum --check \
    && tar -xzf /tmp/supabase.tar.gz -C /usr/local/bin supabase \
    && rm -rf /var/lib/apt/lists/* /tmp/supabase.tar.gz

WORKDIR /workspace
COPY docker/migrate.sh docker/reconcile-migrations.sh docker/bootstrap-db.sql /runner/
ENTRYPOINT ["/bin/sh", "/runner/migrate.sh"]
