---
status: draft
issue: 33
spec: spec/2026-11-24-33-rfactory-in-cluster.md
coders:
  1: agy     # the CI workflow: a large, mostly mechanical copy of CFactory's deploy.yml for two images
  2: codex   # bootstrap-secrets.sh: small, security-sensitive (format checks, replace-not-apply, never printing)
  3: coder   # README and pod.sh notes: routine docs
  4: codex   # Kyverno rule, coverage alternation and probe list: three copies that must agree; small and tricky
  5: agy     # apps/rfactory manifests: a large, mechanical Deployment/Service/PVC/ConfigMap/NetworkPolicy set
  6: coder   # tunnel rule, cred-sync test list, secrets ledger: routine edits across files
reviewers:
  - codex    # independent read-only review of both diffs against this plan
  - agy      # second independent read-only review
---

# Plan: run RFactory in the factory cluster

Self-contained: an implementer needs only this file.

## Decisions (from the approved spec; owner defaults accepted 2026-11-24)

- **Pod:**
  - One Deployment `rfactory` in namespace `factory`: `replicas` 0 at first, then 1, with `strategy: Recreate`, `enableServiceLinks: false` and `automountServiceAccountToken: false`.
  - Pod `securityContext`: `fsGroup: 1000` and `seccompProfile: RuntimeDefault`.
  - Every container: an explicit numeric `runAsUser`, `runAsNonRoot: true`, `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]` and `readOnlyRootFilesystem: true`.

  | Container | uid | Port | Notes |
  |---|---|---|---|
  | init `seed-creds` | 1000 | | busybox. Copies `/seed/claude-credentials.json` → `/var/lib/rfactory/claude-home/.claude/.credentials.json`. Same as CFactory's apart from the path. |
  | `oauth2-proxy` | 65532 | 4180 | `quay.io/oauth2-proxy/oauth2-proxy:v7.7.0@sha256:…`, the same pin as `cfactory-auth`. Probe `/ping`. |
  | `rfactory-web` | 1000 | 127.0.0.1:8080 | Exec probe: `node -e` opens a TCP connection to `127.0.0.1:8080`. |
  | `rfactory-stt` | 10001 | 0.0.0.0:8081 | `STT_PORT=8081`. Limits 8 CPU and 2Gi; requests 1 CPU and 1Gi. Exec probe on `127.0.0.1:8081`. |
  | `cred-sync` | 1000 | | Byte-identical vendored copy of CFactory's script, with its `preStop`. Writes into the claude-home `emptyDir`. |

- **Volumes:**
  - an `emptyDir` `claude-home` at `/var/lib/rfactory/claude-home`. The path is unchanged, so `brain.approved_hash = sha256("claude-cli|<version>|<realpath(home)>")` stays valid;
  - `emptyDir`s at `/tmp` for `rfactory-web` and `rfactory-stt`;
  - the PVC `rfactory-data` (`local-path`, 1Gi, RWO) at `/var/lib/rfactory/actions`;
  - the Secret `factory-cli-creds` (key `claude-credentials.json`) at `/seed`, for `seed-creds` and `cred-sync` only.
- **Secrets:** out of band, `defaultMode: 0440`, and each container mounts only its own keys (`items:`).

  | Secret | Keys → where |
  |---|---|
  | `rfactory-config` | `scope.json` → `/etc/rfactory/scope.json` (`RFACTORY_SCOPE_FILE`). `allowed-emails`, `approvers`, `admins` → env `RFACTORY_ALLOWED_EMAILS`, `RFACTORY_APPROVERS`, `RFACTORY_ADMINS` (`secretKeyRef`). |
  | `rfactory-keys` | `cfactory-read-key`, `cfactory-write-key` → `/run/rfactory/` (the paths `scope.json` names today; check with the owner's scope) |
  | `rfactory-stt-path` | `path` → `rfactory-stt` `/run/secrets/stt/path`; `rfactory-web` `/run/rfactory/stt-path` (`RFACTORY_STT_SECRET_FILE`) |
  | `oauth2-proxy-rfactory` | `client-secret`, `cookie-secret` → oauth2-proxy env `OAUTH2_PROXY_CLIENT_SECRET`, `OAUTH2_PROXY_COOKIE_SECRET` |
  | `rfactory-runner-client` | `client.crt`, `client.key`, `ca.crt` → `/run/rfactory/desktop-runner/` (`RFACTORY_RUNNER_CERT`, `_KEY`, `_CA`) |

- **rfactory-web env (not secret):** `RFACTORY_WRITES=on`, `RFACTORY_SHARES=on`, `RFACTORY_DESKTOP=1`, `RFACTORY_CALLS=1`, `RFACTORY_RUNNER_URL=https://rfactory-runner-api.rfactory-desktops.svc:8443`, `RFACTORY_STT_URL=http://127.0.0.1:8081`. `RFACTORY_COMMIT` comes from the image.
  - Each switch must agree with `scope.json` (`writes_enabled`, `shares_enabled`).
  - The scope's CFactory MCP URL becomes `http://cfactory.factory.svc.cluster.local:3111/mcp` (it is `https://cfactory-mcp.freundcloud.org.uk/mcp` today, which the tunnel routes to the same Service).
- **oauth2-proxy:**
  - **Alpha config** (a ConfigMap, after `cfactory-auth/manifests/alpha-config.yaml`):
    - provider `oidc`, client id `rfactory`;
    - `skipDiscovery: true`, issuer `https://keycloak.freundcloud.org.uk/realms/factory`;
    - `loginURL` `https://keycloak.freundcloud.org.uk/realms/factory/protocol/openid-connect/auth`;
    - `redeemURL` `http://keycloak.factory.svc.cluster.local:8080/realms/factory/protocol/openid-connect/token`;
    - `jwksURL` `http://keycloak.factory.svc.cluster.local:8080/realms/factory/protocol/openid-connect/certs`;
    - PKCE `S256`;
    - upstream `http://127.0.0.1:8080/` with a `timeout` of 60s;
    - inject request header `X-Forwarded-Email` from claim `email`;
    - no bearer pass-through.
  - **Flags:** `--reverse-proxy=true`, `--cookie-secure=true`, `--cookie-samesite=lax`, `--whitelist-domain=rfactory.freundcloud.org.uk`, `--redirect-url=https://rfactory.freundcloud.org.uk/oauth2/callback`, `--email-domain=*`, `--http-address=0.0.0.0:4180`.
  - Take every RFactory-specific setting (nonce, `skip_provider_button`, `pass_host_header`, and the rest) from RFactory's `deploy/oauth2-proxy.yaml` and `deploy/pod.sh` (`oauth2-proxy` flags) at the branch's `main`.
- **NetworkPolicy `rfactory-ingress`:** `podSelector: {app: rfactory}`, `policyTypes: [Ingress]`, ingress only TCP 4180 from `podSelector` matching the cloudflared pods (check its labels in `infra/cloudflared/cloudflared.yaml`). Egress is not restricted (owner item E).
- **Images:**
  - `ghcr.io/olafkfreund/rfactory-web` and `rfactory-stt`, `sha-<short>` tags, **public** packages, cosign keyless from `olafkfreund/RFactory/.github/workflows/deploy.yml@refs/heads/main`.
  - Kyverno patterns: `ghcr.io/olafkfreund/rfactory-web:*`, `…rfactory-web@*`, `…rfactory-stt:*`, `…rfactory-stt@*`, namespace `factory`, Rekor `https://rekor.sigstore.dev`.
- **Tunnel:** `rfactory.freundcloud.org.uk` → `http://rfactory.factory.svc.cluster.local:4180`. DNS and the Keycloak callback are manual (owner's OK).

## Branches and worktrees

- **RFactory:** `feat/33-rfactory-in-cluster` from `main`, after PR #32 (#16) merges and with these approved artifacts merged in. Steps 1–3, one worktree each: `RFactory-wt/33-stepN`.
- **factory-gitops:** `feat/33-rfactory` from `main`. Steps 4–6, worktrees `factory-gitops-wt-33-stepN`.
- The lead reviews each step against this plan, runs its checks and commits it. Implementers never stage, commit, push, deploy or restart, never run `kubectl apply`, and never read secret values.

## Steps

### Wave A (in parallel)

1. **CI workflow: `RFactory/.github/workflows/deploy.yml`** (new), modelled on `CFactory/.github/workflows/deploy.yml` (read it, read-only).
   - **Trigger:** push to `main`, plus `workflow_dispatch`. Permissions `contents: read`, `packages: write`, `id-token: write`. Concurrency per ref.
   - **Job `web`:**
     - buildx build `web/Containerfile` with context `.` and `--build-arg RFACTORY_COMMIT=${{ github.sha }}`;
     - push `ghcr.io/olafkfreund/rfactory-web:sha-<7>` with `GITHUB_TOKEN`;
     - Trivy `--severity HIGH,CRITICAL --ignore-unfixed --exit-code 1`;
     - `cosign sign --yes <image>@<digest>`, then `cosign verify` with the identity regexp above;
     - the signature-location assert: copy CFactory's `.github/scripts/assert-signature-location.sh` into `RFactory/.github/scripts/` with a header line naming its origin;
     - syft SPDX and CycloneDX attestations.
   - **Job `stt`:** the same, but the build is:
     - install Nix (`DeterminateSystems/nix-installer-action`, pinned by SHA);
     - `nix build .#image-stt --print-out-paths`;
     - `skopeo copy docker-archive:<out> docker://ghcr.io/olafkfreund/rfactory-stt:sha-<7>`;
     - the digest from `skopeo inspect`.
   - **Job `promote`** (needs both): clone `olafkfreund/factory-gitops` with `secrets.GITOPS_PAT`, then set both `newTag` values in `apps/rfactory/manifests/kustomization.yaml` to `sha-<7>`, commit `cd(rfactory): sha-<7> [skip ci]` and push. It is skipped with a notice when `GITOPS_PAT` is unset.
   - **Pin every action by commit SHA**, as CFactory does.
   - **Check:** `actionlint .github/workflows/deploy.yml` (from nixpkgs: `nix run nixpkgs#actionlint -- …`) is clean, and `bash -n` passes on the copied script.
   - **Traps:**
     - no API keys;
     - no `GHCR_PAT`: `GITHUB_TOKEN` with `packages: write` suffices for the repository's own packages;
     - the workflow must not run on PRs from forks with secrets.

2. **Secrets bootstrap: `RFactory/deploy/k8s/bootstrap-secrets.sh`** (new) and `deploy/k8s/bootstrap-secrets.test.sh` (new; a fake `kubectl` on `PATH` records its arguments and stdin).
   - **Inputs:** `$RFACTORY_CONFIG` (default `~/.config/rfactory`).
     - `scope.json`, `cfactory-read-key`, `cfactory-write-key`, `stt-path`, `keycloak-client-secret`, `oauth2-cookie-secret`;
     - `roles.env` (new, mode 600: `ALLOWED=`, `APPROVERS=`, `ADMINS=` comma lists);
     - `desktop-runner/{client.crt,client.key,ca.crt}`.
   - **Checks:** every file exists and is mode 600; the format checks are copied from `deploy/pod.sh`:
     - no trailing newline in the two Keycloak secrets;
     - a 16, 24 or 32-byte cookie secret;
     - `stt-path` matches `^[0-9a-f]{32}$`;
     - approvers and admins are a subset of `ALLOWED`;
     - `scope.json` parses with `writes_enabled` and `shares_enabled` present.
   - **Writes** the five Secrets in namespace `factory`:
     - `kubectl create secret generic <name> --from-file=… --dry-run=client -o yaml | kubectl replace --force -f -` when the Secret exists, `kubectl create -f -` when it does not;
     - then `kubectl annotate --overwrite secret <name> rotation.factory.dev/rotated-at=<UTC>`;
     - it never calls `kubectl apply` and never echoes a value.
   - **Then** `kubectl -n factory rollout restart deploy/rfactory`, unless `--no-restart` is passed.
   - **Flags:** `--dry-run` prints only the Secret names and key names it would write.
   - **Check:** `bash deploy/k8s/bootstrap-secrets.test.sh` passes. The test covers:
     - each format refusal;
     - replace vs create;
     - no `apply` in any recorded call;
     - no secret value on stdout or stderr;
     - the `--dry-run` output;
     - the restart.

     `shellcheck` is clean on both files.
   - **Traps:** `set -euo pipefail`; never `set -x`; values pass to `kubectl` only through `--from-file`.

3. **Docs: `RFactory/README.md`** and the `deploy/pod.sh` header.
   - README: a section "Deployment" covering:
     - the cluster is the deployment (link to this plan);
     - `bootstrap-secrets.sh` and `roles.env`;
     - a member change = edit `roles.env`, run the script, and the pod restarts;
     - re-seeding the shared Claude login and rolling `deploy/rfactory`;
     - `pod.sh` is a development path only.
   - The `pod.sh` header gets one comment line saying the same.
   - **Check:** the markdown renders. No secrets or addresses appear in the docs (`git grep -n '@gmail\|@freundcloud' README.md deploy/` prints nothing new).

### Wave B (factory-gitops; in parallel with wave A, landed only in the order of step 8)

4. **Kyverno:** `apps/kyverno-policies/manifests/verify-factory-image-signatures.yaml`, `require-first-party-signature-coverage.yaml` and the probe's `DEFAULT_IMAGES` in `apps/kyverno-runner-probe`.
   - **New rule `verify-rfactory-signature`:**
     - matches Pods in namespace `factory`;
     - `imageReferences` are the four patterns;
     - keyless attestor: issuer `https://token.actions.githubusercontent.com`, `subjectRegExp` `^https://github\.com/olafkfreund/RFactory/\.github/workflows/deploy\.yml@refs/heads/main$`, Rekor `https://rekor.sigstore.dev`;
     - it copies the CFactory rule's shape and comments style, and records that both packages are public.
   - **Coverage:** add both repositories to the `uncovered` alternation and to the probe list.
   - **Check:** `python3 apps/kyverno-policies/assert-signature-lists-agree.py` passes, and the repository's policy tests pass (`ls apps/kyverno-policies/tests`; run the suite the repository's CI runs, read from `.github/workflows`).
   - **Trap:** `:` and `@` paired (Factory#3664).

5. **App: `apps/rfactory/application.yaml`** (Argo Application: path `apps/rfactory/manifests`, namespace `factory`, automated prune and selfHeal; no `CreateNamespace`) and **`apps/rfactory/manifests/`:**
   - `kustomization.yaml`: resources, plus `images:` for both with `newTag` set to a placeholder the lead fills;
   - `manifests.yaml`: the Deployment exactly as in Decisions, with `replicas: 0`; Service `rfactory` (ClusterIP, 4180); PVC `rfactory-data`; NetworkPolicy `rfactory-ingress`;
   - `alpha-config.yaml`: the oauth2-proxy ConfigMap.

   `cred-sync` and `seed-creds` are copied from `apps/cfactory/manifests/manifests.yaml`, with the claude-home path changed; the script body is byte-identical. No Secret objects; the Secrets are referenced by name only.
   - **Check:**
     - `kubectl kustomize apps/rfactory/manifests` renders;
     - the render validates with `kubeconform -strict -ignore-missing-schemas` (`nix run nixpkgs#kubeconform`). Do not use `kubectl apply`, even with `--dry-run`;
     - `python3 .github/scripts/test_cred_sync.py` passes after step 6.
   - **Traps:**
     - no secret values;
     - no `kubectl apply`;
     - `readOnlyRootFilesystem` on every container;
     - the web probe must not use `httpGet` or `tcpSocket` (the app binds `127.0.0.1`).

6. **Glue:**
   - `infra/cloudflared/cloudflared.yaml`: the `rfactory.freundcloud.org.uk` rule, above the catch-all;
   - `.github/scripts/test_cred_sync.py`: add `"rfactory"` to `APPS`;
   - `docs/secrets-management.md`: ledger entries for the five Secrets (purpose, source `~/.config/rfactory` on p620, written by RFactory's `deploy/k8s/bootstrap-secrets.sh`, rotation), and `deploy/rfactory` in the list rolled after a `factory-cli-creds` re-seed.
   - **Check:** `python3 .github/scripts/test_cred_sync.py`, and the cloudflared config parses (YAML load).

### Lead steps, in order

7. **Reviews:** a fresh Opus agent, Codex and agy, read-only, each given this plan and both diffs. Fix the findings, with tests where code changed.
8. **Land in order** (each merge needs the owner's OK; announce on the bus):
   1. PR #32 (#16) is merged.
   2. The RFactory PR merges. CI publishes and signs both images. The owner makes both GHCR packages **public** (a UI setting). The lead checks anonymous reads of the manifest and of the `.sig` tag (`crane manifest` without auth), and `cosign verify`.
   3. The factory-gitops PR, with step 4 first in the same PR or before. The lead fills `newTag` with the published tag. Argo syncs with `replicas: 0`. Then the server-side dry runs: both promoted images are admitted (`kubectl -n factory create --dry-run=server` with a pod spec), and an unsigned and a wrong-signer image are refused.
9. **Owner's OK, bus announcement, then:**
   - `roles.env` is written (the two addresses) and `scope.json` updated (MCP URL);
   - `bootstrap-secrets.sh --no-restart`;
   - the `kcadm.sh` redirect URI and web origin on client `rfactory`;
   - `cloudflared tunnel route dns`.
10. **Start and migrate:**
    1. A commit sets `replicas: 1`.
    2. Once Ready, copy `rfactory-actions` from p620 (`podman volume export`) into the pod (`kubectl cp -c rfactory-web`).
    3. Check that the file list and SHA-256 sums match.
    4. `kubectl rollout restart`.
11. **Live checks:** the spec's Verification 1–8, against the hostname, using only the cluster instance. Results go into this plan.
12. **Cutover:** `deploy/pod.sh down` on p620 (bus first). The volume and image are kept 7 days. A follow-up issue covers the day-7 cleanup: remove the podman volume and images, and delete the `127.0.0.1` callback.
13. **PRs:** link the intent, spec and plan; say which steps agy, Codex and the coder did.

## Tests

| Where | Command | Expected |
|---|---|---|
| RFactory | `actionlint .github/workflows/deploy.yml` | clean |
| RFactory | `bash deploy/k8s/bootstrap-secrets.test.sh` | passes |
| RFactory | `shellcheck deploy/k8s/*.sh` | clean |
| RFactory | `cd core && npm test`; `cd web && npm test` | unchanged, 0 failures |
| factory-gitops | `python3 apps/kyverno-policies/assert-signature-lists-agree.py` | passes |
| factory-gitops | `python3 .github/scripts/test_cred_sync.py` | passes |
| factory-gitops | `kubectl kustomize apps/rfactory/manifests \| kubeconform -strict -ignore-missing-schemas` | valid |
| factory-gitops | the policy test suite from its CI | passes |
| Live | spec Verification 1–8 | all pass |

## Rollback

- **Before step 12:** set `replicas: 0` in git (or revert the factory-gitops PR). The p620 pod is still serving.
- **After step 12, within 7 days:** set `replicas: 0`, then run `deploy/pod.sh up` with the documented settings. Cluster records written in between are not copied back (accepted).
- **Images:** revert `newTag`. Kyverno and the tunnel rule are additive; reverting them removes RFactory's admission and route only.
