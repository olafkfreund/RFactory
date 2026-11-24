---
status: approved
issue: 33
spec: spec/2026-11-24-33-rfactory-in-cluster.md
coders:
  1: agy     # the CI workflow: a large, mostly mechanical copy of CFactory's deploy.yml for two images
  2: codex   # bootstrap-secrets.sh: small, security-sensitive (format and switch checks, replace-not-apply, never printing)
  3: coder   # README and pod.sh notes: routine docs
  4: codex   # Kyverno rule, coverage alternation and probe list: three copies that must agree; small and tricky
  5: agy     # apps/rfactory manifests: a large, mechanical Deployment/Service/PVC/ConfigMap/NetworkPolicy set
  6: coder   # tunnel rule and secrets ledger: routine doc and config edits
reviewers:
  - codex    # a fresh read-only session (not the step-2/4 implementer) reviews both diffs against this plan
  - agy      # a fresh read-only session (not the step-1/5 implementer), second independent review
---

# Plan: run RFactory in the factory cluster

Self-contained: an implementer needs only this file and the files a step names.

## Corrections to the approved spec

Found in the plan reviews. Each corrects a detail the spec got wrong against the evidence; none changes a decision.

1. **oauth2-proxy client secret:** it is read from a **file** (`clientSecretFile`), not from `OAUTH2_PROXY_CLIENT_SECRET`, and the bind address is set in the alpha config (`server.bindAddress`), not with `--http-address`. With `--alpha-config`, the provider and server flags are refused. That is how both RFactory's `deploy/oauth2-proxy.yaml` and `cfactory-auth` already work.
2. **`rfactory-stt` probe:** a kubelet **`tcpSocket` probe on 8081**, not an exec probe. The STT image has no shell, `nc` or `node`, and whisper binds `0.0.0.0`. Step 10 confirms that the ingress policy does not block kubelet probes; if it does, the policy gets an `ipBlock` for the node address, recorded as a deviation.
3. **The cluster scope is a separate file** (`~/.config/rfactory/scope.cluster.json`, with the in-cluster CFactory URL). The p620 `scope.json` stays unchanged for the 7-day fallback.

## Decisions (from the approved spec; owner defaults accepted 2026-11-24)

- **Pod:**
  - One Deployment `rfactory` in namespace `factory`: `replicas` 0 at first, then 1, with `strategy: Recreate`, `enableServiceLinks: false` and `automountServiceAccountToken: false`. Label `app: rfactory`.
  - Pod `securityContext`: `fsGroup: 1000` and `seccompProfile: RuntimeDefault`.
  - Every container: an explicit numeric `runAsUser`, `runAsNonRoot: true`, `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]` and `readOnlyRootFilesystem: true`.
  - Images other than RFactory's are copied with their exact digests from the files named here:
    - `busybox` and `python:3.12-slim` from `apps/cfactory/manifests/manifests.yaml`;
    - `oauth2-proxy` from `apps/cfactory-auth/manifests/manifests.yaml`.

  | Container | uid | Port | Probe | Notes |
  |---|---|---|---|---|
  | init `seed-creds` | 1000 | | | busybox. Copies `/seed/claude-credentials.json` → `/var/lib/rfactory/claude-home/.claude/.credentials.json` (creates `.claude`). Otherwise as CFactory's. |
  | `oauth2-proxy` | 65532 | 4180 | HTTP `/ping` :4180 | Alpha config at `/etc/oauth2-proxy/config.yaml`. The client secret is a file at `/etc/oauth2-proxy/secrets/client-secret`; the cookie secret comes from env `OAUTH2_PROXY_COOKIE_SECRET` (`secretKeyRef`). |
  | `rfactory-web` | 1000 | 127.0.0.1:8080 | exec `node -e "require('net').connect(8080,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"` | env below |
  | `rfactory-stt` | 10001 | 0.0.0.0:8081 | `tcpSocket` 8081 | `STT_PORT=8081`. Limits 8 CPU and 2Gi; requests 1 CPU and 1Gi. |
  | `cred-sync` | 1000 | | | A byte-identical copy of CFactory's script and `preStop`. The `preStop` exec command stays on **one line**: `test_cred_sync.py` parses it. Env `CRED_SYNC_DEST=/var/lib/rfactory/claude-home/.claude/.credentials.json`. |

- **Volumes:**
  - an `emptyDir` `claude-home` at `/var/lib/rfactory/claude-home` (in `rfactory-web`, `seed-creds` and `cred-sync`). The path is unchanged, so `brain.approved_hash = sha256("claude-cli|<version>|<realpath(home)>")` stays valid;
  - `emptyDir`s at `/tmp` in `rfactory-web` and `rfactory-stt`;
  - the PVC `rfactory-data` (`local-path`, 1Gi, RWO) at `/var/lib/rfactory/actions`;
  - the Secret `factory-cli-creds` (`items: claude-credentials.json`) at `/seed`, for `seed-creds` and `cred-sync` only.
- **Secrets:** out of band, never in git. Secret volumes use `defaultMode: 0440` (readable through `fsGroup` 1000), and each container mounts only its own keys (`items:`).

  | Secret | Keys → where |
  |---|---|
  | `rfactory-config` | `scope.json` → `/etc/rfactory/scope.json` (`RFACTORY_SCOPE_FILE`). `allowed-emails`, `approvers`, `admins` → env `RFACTORY_ALLOWED_EMAILS`, `RFACTORY_APPROVERS`, `RFACTORY_ADMINS` (`secretKeyRef`). |
  | `rfactory-keys` | `cfactory-read-key`, `cfactory-write-key` → `/run/rfactory/` (the paths `scope.cluster.json` names) |
  | `rfactory-stt-path` | `path` → `rfactory-stt` `/run/secrets/stt/path` (its wrapper's path); `rfactory-web` `/run/rfactory/stt-path` (`RFACTORY_STT_SECRET_FILE`) |
  | `oauth2-proxy-rfactory` | `client-secret` → `oauth2-proxy` file; `cookie-secret` → env |
  | `rfactory-runner-client` | `client.crt`, `client.key`, `ca.crt` → `/run/rfactory/desktop-runner/` (`RFACTORY_RUNNER_CERT`, `RFACTORY_RUNNER_KEY`, `RFACTORY_RUNNER_CA`) |

- **rfactory-web env (not secret):**
  - `RFACTORY_WRITES=on`, `RFACTORY_SHARES=on`, `RFACTORY_DESKTOP=1`, `RFACTORY_CALLS=1`;
  - `RFACTORY_RUNNER_URL=https://rfactory-runner-api.rfactory-desktops.svc:8443`;
  - `RFACTORY_STT_URL=http://127.0.0.1:8081`;
  - `RFACTORY_INVESTIGATIONS` is **not** set (#18 turns it on after its own live test).

  `RFACTORY_COMMIT` and the voices come from the image. Each switch must agree with `scope.cluster.json` (`writes_enabled: true`, `shares_enabled: true`).
- **oauth2-proxy alpha config** (ConfigMap `rfactory-oauth2-proxy`, key `config.yaml`). It is RFactory's `deploy/oauth2-proxy.yaml` with the changes for a tunnelled host:

  ```yaml
  upstreamConfig:
    upstreams:
      - { id: rfactory-web, path: /, uri: "http://127.0.0.1:8080", timeout: 60s }
  server:
    bindAddress: "0.0.0.0:4180"
  providers:
    - id: keycloak
      provider: oidc
      clientID: rfactory
      clientSecretFile: /etc/oauth2-proxy/secrets/client-secret
      code_challenge_method: S256
      loginURL: https://keycloak.freundcloud.org.uk/realms/factory/protocol/openid-connect/auth
      redeemURL: http://keycloak.factory.svc.cluster.local:8080/realms/factory/protocol/openid-connect/token
      oidcConfig:
        issuerURL: https://keycloak.freundcloud.org.uk/realms/factory
        skipDiscovery: true
        jwksURL: http://keycloak.factory.svc.cluster.local:8080/realms/factory/protocol/openid-connect/certs
        emailClaim: email
        audienceClaims: [aud]
        insecureSkipNonce: false
  injectRequestHeaders:
    - name: X-Forwarded-Email
      values: [{ claim: email }]
  ```

  - Check every key name against `apps/cfactory-auth/manifests/alpha-config.yaml`, which runs this oauth2-proxy version; where the two differ, that file wins.
  - No bearer-token or `skipJwtBearerTokens` settings: RFactory does not take bearer tokens.
  - **Flags:** `--alpha-config=/etc/oauth2-proxy/config.yaml`, `--redirect-url=https://rfactory.freundcloud.org.uk/oauth2/callback`, `--email-domain=*`, `--cookie-secure=true`, `--cookie-samesite=lax`, `--reverse-proxy=true`, `--skip-provider-button=true`, `--whitelist-domain=rfactory.freundcloud.org.uk`.
  - `pass_host_header` is left at its default (on).
- **NetworkPolicy `rfactory-ingress`:** `podSelector: {matchLabels: {app: rfactory}}`, `policyTypes: [Ingress]`, ingress only TCP 4180 from `podSelector: {matchLabels: {app: cloudflared}}`. Egress is not restricted (owner item E).
- **Images:**
  - `ghcr.io/olafkfreund/rfactory-web` and `rfactory-stt`, tag `sha-<first 7 of GITHUB_SHA>`, **public** packages, cosign keyless from `olafkfreund/RFactory/.github/workflows/deploy.yml@refs/heads/main`.
  - Kyverno patterns: `ghcr.io/olafkfreund/rfactory-web:*`, `…rfactory-web@*`, `…rfactory-stt:*`, `…rfactory-stt@*`, namespace `factory`, Rekor `https://rekor.sigstore.dev`.
- **Tunnel:** `rfactory.freundcloud.org.uk` → `http://rfactory.factory.svc.cluster.local:4180`. DNS and the Keycloak callback are manual (owner's OK).
- **Kept:** the p620 load-balancer port `127.0.0.1:18443` stays for the desktop verify scripts.
- **kubectl context:** every cluster command uses `--context k3d-factory`. Nobody runs `kubectl apply`.

## Branches and worktrees

- **RFactory:** `feat/33-rfactory-in-cluster` from `main`, after PR #32 (#16) merges and with these approved artifacts merged in. Steps 1–3, one worktree each: `RFactory-wt/33-stepN`.
- **factory-gitops:** `feat/33-rfactory` from `main`. Steps 4–6, worktrees `factory-gitops-wt-33-stepN`.
- The lead reviews each step against this plan, runs its checks and commits it. Checks that need two steps together are run by the lead on the combined branch (marked **integration**).
- Implementers never stage, commit, push, deploy or restart, never run `kubectl apply`, and never read secret values.

## Steps

### Wave A (RFactory, in parallel)

1. **CI workflow: `RFactory/.github/workflows/deploy.yml`** (new), modelled on `CFactory/.github/workflows/deploy.yml` (read it; copy its action pins by SHA).
   - **Trigger:** push to `main`, plus `workflow_dispatch`. Every job has `if: github.ref == 'refs/heads/main'`, so a dispatch from another branch publishes nothing.
   - **Permissions:** `contents: read`, `packages: write`, `id-token: write`, `attestations: write`. Concurrency group per ref.
   - **Job `meta`:** outputs `tag=sha-${GITHUB_SHA::7}`. Both image jobs and `promote` use it.
   - **Job `web`:**
     - buildx build `web/Containerfile` with context `.` and `--build-arg RFACTORY_COMMIT=${{ github.sha }}`;
     - push `ghcr.io/olafkfreund/rfactory-web:<tag>` (login with `GITHUB_TOKEN`);
     - Trivy `--severity HIGH,CRITICAL --ignore-unfixed --exit-code 1`;
     - `cosign sign --yes <image>@<digest>`, using **CFactory's exact `sigstore/cosign-installer` pin**, which installs cosign v2 and writes legacy `.sig` tags. Kyverno reads those; cosign v3 would break this (Factory#804);
     - `cosign verify` with the identity regexp;
     - the signature-location assert: copy `CFactory/.github/scripts/assert-signature-location.sh` to `RFactory/.github/scripts/`, with a header line naming its origin;
     - syft SPDX and CycloneDX attestations, then a `cosign verify-attestation` self-test, as CFactory.
   - **Job `stt`:** the same, but the build is:
     - install Nix (`DeterminateSystems/nix-installer-action`, pinned by SHA);
     - `nix build .#image-stt --print-out-paths`;
     - `skopeo login ghcr.io -u ${{ github.actor }} --password-stdin` (`GITHUB_TOKEN`);
     - `skopeo copy --digestfile digest docker-archive:<out> docker://ghcr.io/olafkfreund/rfactory-stt:<tag>`.

     skopeo is preinstalled on `ubuntu-latest`.
   - **Job `promote`** (needs both):
     - skipped with a notice when `GITOPS_PAT` is unset;
     - clones `olafkfreund/factory-gitops`;
     - **skipped with a notice when `apps/rfactory/manifests/kustomization.yaml` does not exist yet**. Before step 8.3 the tags are filled by hand;
     - otherwise sets both `newTag` values to `<tag>`, commits `cd(rfactory): <tag> [skip ci]` and pushes, with CFactory's retry loop for concurrent pushes (Factory#527);
     - then re-reads the remote file and checks both pins.
   - **Check:** `nix run nixpkgs#actionlint -- .github/workflows/deploy.yml` is clean, and `bash -n .github/scripts/assert-signature-location.sh` passes.
   - **Traps:**
     - no API keys and no `GHCR_PAT`: `GITHUB_TOKEN` suffices for the repository's own packages;
     - no `pull_request` trigger.

2. **Secrets bootstrap: `RFactory/deploy/k8s/bootstrap-secrets.sh`** (new) and `deploy/k8s/bootstrap-secrets.test.sh` (new; a fake `kubectl` on `PATH` records its arguments and stdin).
   - **Inputs:** `$RFACTORY_CONFIG` (default `~/.config/rfactory`).
     - `scope.cluster.json`, `cfactory-read-key`, `cfactory-write-key`, `stt-path`, `keycloak-client-secret`, `oauth2-cookie-secret`;
     - `roles.env` (mode 600; lines `ALLOWED=`, `APPROVERS=`, `ADMINS=` with comma lists);
     - `desktop-runner/{client.crt,client.key,ca.crt}`.
   - **Flags:**
     - `--writes on|off` and `--shares on|off` (default `on`, matching the Deployment);
     - `--rotated`: the credentials were just rotated, so stamp today's date;
     - `--no-restart`;
     - `--dry-run`: print only the Secret and key names it would write.
   - **Checks, all before any write; a failure writes nothing:**
     - every file exists and is mode 600;
     - from `deploy/pod.sh`: no trailing newline in the two Keycloak secrets; a 16, 24 or 32-byte cookie secret; `stt-path` matches `^[0-9a-f]{32}$`;
     - approvers and admins are a subset of `ALLOWED`;
     - `scope.cluster.json` parses, and its `writes_enabled` and `shares_enabled` equal `--writes` and `--shares`.
   - **Writes** the five Secrets with `kubectl --context "${RFACTORY_KUBE_CONTEXT:-k3d-factory}" -n factory`:
     - the role lists are split from `roles.env` into three files (no trailing newline) in a `mktemp -d` directory with mode 700, removed by an `EXIT` trap;
     - `create secret generic <name> --from-file=… --dry-run=client -o yaml`, piped to `replace --force -f -` when the Secret exists, or to `create -f -` when it does not;
     - `annotate --overwrite secret <name> rotation.factory.dev/rotated-at=$(date -u +%Y-%m-%d)` **only** when the Secret is new or `--rotated` is passed. A role-only rerun keeps the existing date;
     - never `apply`, and never a value on stdout or stderr.
   - **Then** `kubectl … rollout restart deploy/rfactory`, unless `--no-restart`.
   - **Check:** `bash deploy/k8s/bootstrap-secrets.test.sh` passes. The test covers:
     - each format refusal, and a switch mismatch, each with zero writes;
     - replace vs create;
     - the date kept without `--rotated`;
     - no `apply` in any recorded call;
     - no secret value in the output;
     - `--dry-run`;
     - the restart.

     `nix run nixpkgs#shellcheck -- deploy/k8s/*.sh` is clean.
   - **Traps:** `set -euo pipefail`; never `set -x`; values pass to `kubectl` only through `--from-file`.

3. **Docs: `RFactory/README.md`** and the `deploy/pod.sh` header.
   - README section "Deployment":
     - the cluster is the deployment (link to this plan);
     - `bootstrap-secrets.sh`, `roles.env` and `scope.cluster.json`;
     - a member change: edit `roles.env`, run the script, the pod restarts;
     - re-seeding the shared Claude login, then `kubectl --context k3d-factory -n factory rollout restart deploy/rfactory`;
     - `pod.sh` is a development path only.
   - The `pod.sh` header gets one comment line saying the same.
   - **Check:** `git grep -nE '@(gmail|freundcloud)\.' README.md deploy/` shows nothing new.

### Wave B (factory-gitops, in parallel with wave A; landed in the order of step 8)

4. **Kyverno.**
   - `apps/kyverno-policies/manifests/verify-factory-image-signatures.yaml`: a new rule `verify-rfactory-signature`:
     - matches Pods in namespace `factory`;
     - `imageReferences` are the four patterns;
     - keyless attestor: issuer `https://token.actions.githubusercontent.com`, `subjectRegExp` `^https://github\.com/olafkfreund/RFactory/\.github/workflows/deploy\.yml@refs/heads/main$`, Rekor `https://rekor.sigstore.dev`;
     - it copies the CFactory rule's shape, and its comment records that both packages are public.
   - `apps/kyverno-policies/manifests/require-first-party-signature-coverage.yaml`: both repositories added to the `uncovered` alternation.
   - `apps/kyverno-runner-probe/manifests/manifests.yaml`: `DEFAULT_IMAGES` gets `ghcr.io/olafkfreund/rfactory-web:sha-PENDING` and `…rfactory-stt:sha-PENDING`. The real tags replace them in step 8.3.
   - If the policy CI has a rule inventory or test fixtures (read `.github/workflows` and `apps/kyverno-policies/tests`), add the new rule there the way the CFactory rule is.
   - **Check:** `python3 apps/kyverno-policies/assert-signature-lists-agree.py` passes, and the policy test suite its CI runs passes.
   - **Trap:** `:` and `@` paired (Factory#3664).

5. **App:**
   - `apps/rfactory/application.yaml`: an Argo Application, path `apps/rfactory/manifests`, namespace `factory`, automated prune and selfHeal, no `CreateNamespace`. The root app discovers `apps/**/application.yaml`;
   - `apps/rfactory/manifests/kustomization.yaml`: resources, plus `images:` for both with `newTag: sha-PENDING`;
   - `apps/rfactory/manifests/manifests.yaml`: the Deployment exactly as in Decisions, with `replicas: 0`; Service `rfactory` (ClusterIP, 4180); PVC `rfactory-data`; NetworkPolicy `rfactory-ingress`; ConfigMap `rfactory-oauth2-proxy`;
   - `.github/scripts/test_cred_sync.py`: `"rfactory"` added to `APPS`.

   No Secret objects; the Secrets are referenced by name only.
   - **Check:**
     - `kubectl kustomize apps/rfactory/manifests | nix run nixpkgs#kubeconform -- -strict -ignore-missing-schemas -` is valid;
     - `python3 .github/scripts/test_cred_sync.py` passes.
   - **Traps:**
     - no secret values;
     - `readOnlyRootFilesystem` on every container;
     - the web probe is the exec probe above, never `httpGet` or `tcpSocket`;
     - the `cred-sync` script body is byte-identical to CFactory's;
     - the `preStop` stays on one line.

6. **Glue:**
   - `infra/cloudflared/cloudflared.yaml`: the `rfactory.freundcloud.org.uk` rule, above the catch-all.
   - `docs/secrets-management.md`:
     - `## Inventory`: five rows (Secret, keys, consumer `rfactory`, rotation owner and mechanism `RFactory deploy/k8s/bootstrap-secrets.sh`, source `~/.config/rfactory` on p620), and `rfactory` added to `factory-cli-creds`' consumers;
     - `## Rotation ledger` (between the `rotation-ledger` markers): one row per new credential, in the existing `| Credential | Max age (days) | Last rotated | Expires |` format;
     - `deploy/rfactory` in the list rolled after a re-seed (`## Re-seeding the Claude OAuth credential`).
   - **Check:** `python3 scripts/rotation-ledger-check.py` passes (read how CI calls it), and the cloudflared config loads as YAML.

### Lead steps, in order

7. **Reviews:** a fresh Opus agent and fresh read-only Codex and agy sessions, each given this plan and both diffs. Then:
   - fix the findings, with tests where code changed;
   - run the **integration** checks on each combined branch: all the checks of steps 1–3 on RFactory; steps 4–6 together on factory-gitops, including `test_cred_sync.py` and `assert-signature-lists-agree.py`;
   - open both PRs, linking the intent, spec and plan and naming which steps agy, Codex and the coder did.
8. **Land in order.** Each merge needs the owner's OK and a bus announcement.
   1. PR #32 (#16) is merged.
   2. **The RFactory PR merges.**
      - CI publishes and signs both images; `promote` skips (no `apps/rfactory` yet).
      - **Trivy:** if it fails, bump the pinned package, or add a `.trivyignore` entry with the CVE, the reason and a review date. Never skip the gate.
      - **The owner makes both GHCR packages public** (a GitHub package setting).
      - The lead checks, without authentication: `crane manifest` for both tags and for their `sha256-<digest>.sig` tags. Then `cosign verify` with the identity regexp.
   3. **The factory-gitops PR merges**, with the published tag in both `newTag` values and in both `DEFAULT_IMAGES` entries. Argo syncs with `replicas: 0`. Then:
      - **Positive:** a server-side dry run of a pod in `factory` using each promoted image is admitted, and the Kyverno PolicyReport for that resource names `verify-rfactory-signature` with `pass`. `failurePolicy: Ignore` could otherwise admit it during a webhook outage.
      - **Negative:** a dry run whose image is that repository's own `.sig` artifact (`ghcr.io/olafkfreund/rfactory-web@<digest of the sha256-<digest>.sig manifest>`) is refused by `verify-rfactory-signature`. That artifact is public and in the rule's scope, and it is unsigned.
      - A wrong-signer image cannot exist in RFactory's repositories, so that case is covered by the pinned `subjectRegExp`, not by a test.
9. **Owner's OK and a bus announcement, then:**
   - `roles.env` is written (the owner's two addresses);
   - `scope.cluster.json` is made: a copy of `scope.json` with the CFactory MCP URL `http://cfactory.factory.svc.cluster.local:3111/mcp`, and the key and secret paths of the Decisions table;
   - `bootstrap-secrets.sh --rotated --no-restart`.

   **No DNS and no Keycloak callback yet**, so the cluster instance is not reachable while it starts.
10. **Start and migrate.** The p620 pod stays up but is not used from here on.
    1. A factory-gitops commit sets `replicas: 1`. Wait for Ready. Check that the kubelet probes pass under the ingress policy (correction 2).
    2. Copy the records:

       ```bash
       podman volume export rfactory-actions | kubectl --context k3d-factory -n factory exec -i deploy/rfactory -c rfactory-web -- tar xf - -C /var/lib/rfactory/actions
       ```

    3. Compare `sha256sum` of every file. On p620 use `podman unshare` over the volume path; in the pod, `find /var/lib/rfactory/actions -type f -exec sha256sum {} +`. The lists must be identical.
    4. `kubectl --context k3d-factory -n factory rollout restart deploy/rfactory`, then wait for Ready. The app recovers from the copied records.
11. **Expose (owner's OK, bus):**
    1. `kcadm.sh`: add the redirect URI `https://rfactory.freundcloud.org.uk/oauth2/callback` and the web origin to client `rfactory`.
    2. `cloudflared tunnel route dns <tunnel> rfactory.freundcloud.org.uk`.
    3. If the hostname still reaches the tunnel's catch-all, run `kubectl --context k3d-factory -n factory rollout restart deploy/cloudflared` (owner's OK; it briefly drops every Factory hostname).
12. **Live checks** against `https://rfactory.freundcloud.org.uk`, using only the cluster instance. Results go into this plan.
    1. **Login and roles:**
       - unauthenticated `GET /` → 302 to Keycloak `factory`;
       - each of the owner's addresses → 200;
       - a signed-in non-member → 403;
       - an approver can approve and a member cannot (403);
       - a forged `X-Forwarded-Email` is replaced by the signed-in identity;
       - an authenticated `POST` with the page's `Origin` passes the same-origin check.
    2. **Isolation:** from an unlabelled throwaway pod in `factory`, connections to the RFactory pod IP on 4180, 8080 and 8081 all fail (time out or are refused).
    3. **Hardened runtime:**
       - a standup is answered by the brain;
       - a spoken answer is made (Piper);
       - a question is transcribed (whisper);
       - no container logs `EROFS` or `EACCES`. If one does, add an `emptyDir` for that path and record it as a deviation.
    4. **Restart:** delete the pod. After it returns:
       - the role lists, switches and scope are in force;
       - the record checksums still match;
       - a brain turn works.
    5. **Images:** the running image digests carry RFactory's signature, and `GET /api/config` reports the deployed commit.
    6. **Calls and features**, with the runner reached over its Service, mTLS both ways. A request to the runner without the client certificate is refused, and the web app reaches it with one.
       - #3: a call in a desktop VM;
       - #12: a board share approved and shown;
       - #16: 5 of 5 Meet questions with own transcription;
       - #28: the standup and the review panel;
       - #18: later, once merged and switched on.
    7. **Secrets:**
       - no secret value or role-list address appears in either repository, in a `last-applied-configuration` annotation, or in container logs;
       - a member change through the script takes effect after the roll.
    8. **Argo:** the Application is `Synced` and `Healthy`, and a manual edit to the Deployment is reverted by self-heal.
13. **Cutover (owner's OK, bus):** `deploy/pod.sh down` on p620.
    - The volume, the images and `scope.json` are kept for 7 days.
    - A follow-up issue covers day 7: remove the podman volume and images, and delete the `127.0.0.1` callback.

## Tests

| Where | Command | Expected |
|---|---|---|
| RFactory | `nix run nixpkgs#actionlint -- .github/workflows/deploy.yml` | clean |
| RFactory | `bash deploy/k8s/bootstrap-secrets.test.sh` | passes |
| RFactory | `nix run nixpkgs#shellcheck -- deploy/k8s/*.sh` | clean |
| RFactory | `cd core && npm test`; `cd web && npm test` | unchanged, 0 failures |
| factory-gitops (integration) | `python3 apps/kyverno-policies/assert-signature-lists-agree.py` | passes |
| factory-gitops (integration) | `python3 .github/scripts/test_cred_sync.py` | passes |
| factory-gitops | `python3 scripts/rotation-ledger-check.py` | passes |
| factory-gitops | `kubectl kustomize apps/rfactory/manifests \| kubeconform -strict -ignore-missing-schemas -` | valid |
| factory-gitops | the policy test suite its CI runs | passes |
| Live | step 12, checks 1–8 | all pass |

## Rollback

- **Before step 11:** set `replicas: 0` in git, or revert the factory-gitops PR. Nothing is exposed, and the p620 pod is still serving.
- **Before step 13:** remove the DNS route and callback, and set `replicas: 0`. The p620 pod is still serving.
- **After step 13, within 7 days:**
  1. Set `replicas: 0` in git and wait for the pod to terminate.
  2. Then run `deploy/pod.sh up` with the documented settings. Its `scope.json` is unchanged (correction 3).
  3. Repoint the hostname or callback as needed.

  Cluster records written in between are not copied back (accepted).
- **Images:** revert `newTag`. The Kyverno rule and the tunnel rule are additive; reverting them removes only RFactory's admission and route.
