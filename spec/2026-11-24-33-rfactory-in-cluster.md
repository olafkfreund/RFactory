---
status: draft
issue: 33
intent: intent/2026-11-24-33-rfactory-in-cluster.md
---

# Spec: run RFactory in the factory cluster

## Design

### One pod, as today

RFactory runs as one Deployment, `rfactory`, in namespace **`factory`**, with `replicas: 1` and `strategy: Recreate`. There is one call manager, one action record on an RWO volume and one investigation slot, so two copies must never run at once.

The pod holds today's three containers plus CFactory's credential sidecar:

| Container | uid | Listens on | Role |
|---|---|---|---|
| `oauth2-proxy` | 65532 | `0.0.0.0:4180` | Keycloak login. The only port the Service exposes. Upstream `http://127.0.0.1:8080`. |
| `rfactory-web` | 1000 (`node`) | `127.0.0.1:8080` (unchanged code) | The web app. `RFACTORY_STT_URL=http://127.0.0.1:8081`. |
| `rfactory-stt` | 10001 | `0.0.0.0:8081` (`STT_PORT=8081`) | whisper-server. Limits 8 CPU and 2 GiB, as in the pod; requests 1 CPU and 1 GiB. |
| `cred-sync` | 1000 | none | Refreshes the Claude login from `factory-cli-creds`. A byte-identical vendored copy of CFactory's script, with its `preStop` hook. |
| init `seed-creds` | 1000 | none | Copies the Claude login into the login home before the web app starts. |

**Why one pod:**
- `rfactory-web` binds only `127.0.0.1` (`web/server.js:288`). No other pod can reach it; only containers in this pod can.
- The trust boundary is the pod: the containers in it share loopback, and all four are ours.
- `rfactory-stt` stays on loopback for the web app, as #16 deviation 6 chose for the pod.

**NetworkPolicy `rfactory-ingress`** (new) selects the pod and allows ingress only on TCP 4180, only from the `cloudflared` pods.
- It closes `rfactory-stt`'s 8081, which the whisper wrapper binds on `0.0.0.0` and so on the pod IP.
- It also stops any other `factory` pod from reaching 4180 directly.
- `factory` has no default-deny, and CFactory has no policy.

**Egress stays open**, like every other `factory` workload (owner sign-off item E below). The web app reaches:

| Destination | Address |
|---|---|
| CFactory | `cfactory.factory.svc.cluster.local:3111` (`/mcp`) |
| Runner | `rfactory-runner-api.rfactory-desktops.svc:8443` |
| Keycloak | `keycloak.factory.svc:8080` |
| Anthropic | HTTPS 443 |
| DNS | kube-dns |

**Probes:**
- `oauth2-proxy`: HTTP `/ping` on 4180.
- `rfactory-web`: an exec probe that opens a TCP connection to `127.0.0.1:8080`. The web app answers 401 without an identity header, and it opens its listener only after CFactory answers, so this covers the app.
- `rfactory-stt`: an exec probe that connects to `127.0.0.1:8081`.

Both exec probes are checked live, because kubelet's TCP and HTTP probes target the pod IP, which the web app does not bind. The pod also sets `enableServiceLinks: false`, as the other `factory` pods do.

### Reach: tunnel, DNS, Keycloak

- **Service** `rfactory` (ClusterIP) → 4180.
- **Tunnel:** a new ingress rule in `factory-gitops/infra/cloudflared/cloudflared.yaml`: `rfactory.freundcloud.org.uk` → `http://rfactory.factory.svc.cluster.local:4180`, above the catch-all, as `cfactory` has (commit 27f1f92). It is verified live that cloudflared reloaded the route.
- **DNS (manual, owner's OK):** `cloudflared tunnel route dns <tunnel> rfactory.freundcloud.org.uk`, as `docs/build-and-deploy.md` describes. DNS is not in git.
- **Keycloak (manual `kcadm.sh`, owner's OK):** the existing confidential client `rfactory` gets the redirect URI `https://rfactory.freundcloud.org.uk/oauth2/callback` and the web origin. The `127.0.0.1:4180` callback stays while the p620 pod is the fallback and is removed with it. Clients are not in git (`docs/keycloak-sso.md`).
- **oauth2-proxy** follows `cfactory-auth`'s working pattern for a tunnelled host.
  - **Alpha config** (a ConfigMap): `skipDiscovery: true`.
    - `loginURL` is public: `https://keycloak.freundcloud.org.uk/realms/factory/protocol/openid-connect/auth`.
    - `redeemURL` is the full in-cluster token endpoint: `http://keycloak.factory.svc.cluster.local:8080/realms/factory/protocol/openid-connect/token`.
    - `jwksURL` is in-cluster too.
    - The issuer stays `https://keycloak.freundcloud.org.uk/realms/factory`.
    - Without `skipDiscovery`, startup discovery goes out through the tunnel and fails on a cold start, as `cfactory-auth` records.
  - **Kept from RFactory's `deploy/oauth2-proxy.yaml`:**
    - PKCE S256 and nonce validation;
    - the email claim injected as `X-Forwarded-Email`, which replaces any value a client sends;
    - no bearer-token pass-through;
    - the 60 s upstream timeout, above the 55 s standup deadline;
    - `email_domains = ["*"]`: the web app's role lists decide membership.
  - **Flags** (not alpha config):
    - `--reverse-proxy=true` (today `false`);
    - `--cookie-secure=true` and `--cookie-samesite=lax`;
    - `--whitelist-domain=rfactory.freundcloud.org.uk`;
    - `--redirect-url=https://rfactory.freundcloud.org.uk/oauth2/callback`.

    `pass_host_header` stays on, so the web app's same-origin check (`Origin` against `Host`) keeps working.

### Images: built, signed and promoted by CI, like CFactory

A new workflow, `.github/workflows/deploy.yml` in RFactory, runs on push to `main`:

1. **`rfactory-web`:** `docker build -f web/Containerfile --build-arg RFACTORY_COMMIT=$GITHUB_SHA` → `ghcr.io/olafkfreund/rfactory-web:sha-<short>`.
   - CI builds only pushed commits of a public repository, so AGPL §13 (#13) holds by construction.
   - The image still carries the commit, which `GET /api/config` reports.
2. **`rfactory-stt`:** Nix is installed in the job, then `nix build .#image-stt` (it downloads the pinned ~466 MiB `ggml-small.bin`, with the hash checked). It is pushed as `ghcr.io/olafkfreund/rfactory-stt:sha-<short>` with skopeo.
3. **Gates, as CFactory's `deploy.yml`:**
   - Trivy (`HIGH,CRITICAL`, `--ignore-unfixed`);
   - `cosign sign --yes` keyless on the digest;
   - a `cosign verify` self-test;
   - the signature-location assert (signatures where Kyverno looks, Factory#804);
   - syft SBOM attestations.
4. **Promotion:** bump `newTag` for both images in `factory-gitops/apps/rfactory/manifests/kustomization.yaml` with a `cd(rfactory): sha-<short> [skip ci]` commit. This needs a `GITOPS_PAT` repository secret, which the owner adds.

**Public packages:**
- Kyverno reads GHCR anonymously and has no registry credential (`verify-factory-image-signatures.yaml`, Factory#430/#522). A private package fails verification and every pod using it is denied.
- So both packages are made **public**, like the other five Factory images. That fits RFactory, which is a public AGPL repository.
- No `imagePullSecret` is needed; `ghcr-pull` may still be listed, as CFactory does.

**Kyverno** (`factory-gitops/apps/kyverno-policies`), landed in this order:
1. The images are published, public and signed.
2. Anonymous reads of the manifest and of the `.sig` tag are verified live.
3. Only then the rule lands:
   - a `verifyImages` rule in namespace `factory` for `ghcr.io/olafkfreund/rfactory-web:*`, `…rfactory-web@*`, `…rfactory-stt:*` and `…rfactory-stt@*` (`:` and `@` paired, Factory#3664);
   - a keyless attestor: issuer `https://token.actions.githubusercontent.com`, `subjectRegExp` `^https://github\.com/olafkfreund/RFactory/\.github/workflows/deploy\.yml@refs/heads/main$`, Rekor `https://rekor.sigstore.dev`;
   - the same four patterns added to `require-first-party-signature-coverage` and its probe, with `assert-signature-lists-agree.py` passing.
4. A server-side dry run (`kubectl create --dry-run=server`) is admitted for both promoted images, and refused for an unsigned and for a wrong-signer image.

`verify-factory-image-signatures` has `failurePolicy: Ignore`. That is existing cluster behaviour, recorded as a risk, not changed here.

`deploy/k3d/import-images.sh` and `imagePullPolicy: Never` stay for the desktop images only.

### Secrets and private settings: out of band, like every `factory` Secret

Both repositories are public, so no personal data or key enters git.

The Secrets are created and updated by a new script, `deploy/k8s/bootstrap-secrets.sh`. It is run by the owner, or by the lead with the owner's OK and a bus announcement. It:
- reads today's files in `~/.config/rfactory`, which stay the source;
- runs `pod.sh`'s format checks:
  - no trailing newline on the Keycloak and cookie secrets;
  - a 16, 24 or 32-byte cookie secret;
  - `stt-path` as 32 lowercase hex characters;
- writes each Secret with `kubectl create secret … --dry-run=client -o yaml | kubectl replace --force -f -`, or `kubectl create` on first use. It never uses `kubectl apply`, which would leave `last-applied-configuration` in the object;
- stamps `rotation.factory.dev/rotated-at`;
- never prints a value;
- ends with `kubectl rollout restart deploy/rfactory`. The role lists and `scope.json` are read once at startup, so a member change only takes effect after a restart.

| Secret | Keys | Used by |
|---|---|---|
| `rfactory-config` | `scope.json`, `allowed-emails`, `approvers`, `admins` | `rfactory-web`: `scope.json` as a file, the role lists as env vars. |
| `rfactory-keys` | `cfactory-read-key`, `cfactory-write-key` | `rfactory-web`, as files |
| `rfactory-stt-path` | `path` | `rfactory-stt` at `/run/secrets/stt/path` (its wrapper's path), and `rfactory-web` as `RFACTORY_STT_SECRET_FILE` |
| `oauth2-proxy-rfactory` | `client-secret`, `cookie-secret` | `oauth2-proxy`, as env vars. The client id `rfactory` is in the ConfigMap. |
| `rfactory-runner-client` | `client.crt`, `client.key`, `ca.crt` | `rfactory-web` as `RFACTORY_RUNNER_CERT`, `_KEY` and `_CA` |

- **File permissions:** each container mounts only the keys it uses (`items:`). Secret volumes use `defaultMode: 0440`, and the pod sets `fsGroup: 1000`. `fsGroup` is added to every container's groups and applied to Secret volumes, so uid 1000 and uid 10001 can read their files and nothing else can.
- **Ledger:** `factory-gitops/docs/secrets-management.md` gets an entry for each new Secret (purpose, source, the script, and the rotation note). `deploy/rfactory` is added to the list of deployments rolled after a `factory-cli-creds` re-seed.
- **Switches** are not secrets and live in the Deployment:
  - `RFACTORY_WRITES`, `RFACTORY_SHARES`, `RFACTORY_DESKTOP=1`, `RFACTORY_CALLS=1`;
  - the STT URL;
  - later `RFACTORY_INVESTIGATIONS`.

  A switch and its `scope.json` flag must agree (`pod.sh`: `RFACTORY_WRITES=off` needs `writes_enabled: false`). A change to either is one step: edit both, run the script, then roll the pod.
- **CFactory:** the scope's MCP URL points at `https://cfactory-mcp.freundcloud.org.uk` today, which the tunnel routes to `cfactory.factory.svc.cluster.local:3111`. In the cluster the scope uses that Service directly (`http://cfactory.factory.svc.cluster.local:3111/mcp`), so CFactory calls no longer go out and back through Cloudflare. The read and write keys are unchanged.
- **Desktop runner:** `RFACTORY_RUNNER_URL=https://rfactory-runner-api.rfactory-desktops.svc:8443`.
  - Its server certificate already names `rfactory-runner-api.rfactory-desktops.svc` (`deploy/k3d/mk-tls.sh:41`), so no new certificate is needed.
  - The runner's ingress policy allows TCP 8443 from any source. mTLS with the `rfactory-web` client certificate is the control, as today.
  - The p620 load-balancer port `127.0.0.1:18443` stays, because the desktop verify scripts on p620 use it. Only the web app stops using it.

### Claude login: the shared `factory-cli-creds`, like CFactory

- The login home is an `emptyDir` mounted at **today's path, `/var/lib/rfactory/claude-home`**, as the whole home (the CLI writes `~/.claude.json` there too).
- `seed-creds` copies `claude-credentials.json` from `factory-cli-creds` to `.claude/.credentials.json` in it. `cred-sync` re-copies it when the Secret holds a newer `expiresAt`, with CFactory's 90-day skew guard.
- `scope.json`'s `brain.home` stays `/var/lib/rfactory/claude-home`. The brain's `approved_hash` is `sha256(claude-cli|<version>|<realpath(home)>)` (`core/src/brains/destination.js:26`). Neither the CLI version (pinned in the image) nor the path changes, so the approved hash stays valid.
- `checkClaudeHome` rejects only a `settings.json` that redirects the CLI. The seeded home has none.
- It is the same subscription login as the other Factory services: a long-lived `setup-token` login with about 352 days of runway, watched by cred-broker. No API key is involved.
- **Re-seeding:** the owner re-seeds `factory-cli-creds` as today, and then rolls `deploy/rfactory` with the others. The skew guard can refuse a yearly renewal inside a running pod, so a roll is needed.

### State

- A PVC `rfactory-data` (`local-path`, 1 GiB, RWO) is mounted at `/var/lib/rfactory/actions`. It holds the action, share and (with #18) investigation records. Its ownership comes from `fsGroup: 1000`.
- An `emptyDir` is mounted at `/tmp` for the web app (Node, Piper, espeak-ng) and for whisper, under `readOnlyRootFilesystem: true`. Whether they write anywhere else is checked live (Verification 3); any other path found gets its own `emptyDir`.

### Pod security

Every container follows CFactory's convention, even though `factory` only audits and warns at `baseline`:
- explicit numeric `runAsUser` and `runAsNonRoot: true` (a username such as `USER node` cannot be checked, AIFactory#848);
- `allowPrivilegeEscalation: false`;
- `capabilities.drop: [ALL]`;
- `seccompProfile: RuntimeDefault`;
- `readOnlyRootFilesystem: true`;
- `automountServiceAccountToken: false`.

`--init` and `--shm-size` existed for in-container Chrome. With `RFACTORY_DESKTOP=1`, calls run in the desktop VMs (`web/server.js:260-284`: the VM spawner is used whenever the runner is set), so they are dropped. Chrome stays in the image, unused here.

### Order and cutover

The p620 pod keeps serving, idle, until the cluster has passed every check.

1. **Merge #16 (PR #32) first**, so the cluster deployment includes `rfactory-stt` from the start. #18 follows with its own switch, off until its live test.
2. **RFactory:** land the workflow. It publishes and signs both images; then the packages are made public and anonymous reads are checked.
3. **`factory-gitops`:**
   - the Kyverno rule and coverage;
   - the Application `apps/rfactory` with its manifests (Deployment, Service, PVC, ConfigMaps, NetworkPolicy);
   - the tunnel rule;
   - the secrets ledger.

   The Application lands with `replicas: 0`.
4. **Owner's OK and a bus announcement**, then the Secrets bootstrap, the `kcadm` redirect and the DNS route.
5. **Start:** set `replicas: 1` in git, with the same switches and scope as the p620 pod.
   - Then copy the p620 `rfactory-actions` records into the PVC (`kubectl cp -c rfactory-web`), and restart the pod so it recovers from them.
   - Compare the file list and SHA-256 sums with the source.
   - The p620 pod is idle meanwhile; nobody uses it.
6. **Live checks** against `https://rfactory.freundcloud.org.uk` (Verification). Only the cluster instance is used during them, so only one instance owns a call or changes shared state.
7. **Stop the p620 pod.** It and its volume are kept for 7 days as the fallback (owner decision 4).
   - Falling back means setting `replicas: 0` in git and starting the pod with `pod.sh`. Records written in the cluster in between are not copied back.
   - After 7 days: the podman volume and images are removed, the `127.0.0.1` callback is deleted, and `deploy/pod.sh` stays as a development path. Its README section says so.

## Owner decisions (proposed defaults)

| # | Question | Proposed default |
|---|---|---|
| 2 | Namespace | `factory`: shares `factory-cli-creds`, in-cluster Keycloak and the Kyverno coverage. |
| 3 | Images | CI builds and signs them in RFactory, as **public** GHCR packages. |
| 4 | Retiring the pod | Stop it after the checks; keep it stopped 7 days as a fallback, with no copy-back of cluster records; then remove it. `pod.sh` stays as a development path. |
| 5 | Claude login | The shared `factory-cli-creds`; the owner re-seeds it and rolls RFactory with the others. |
| 6 | Keycloak | The same `rfactory` client, with a new callback; the `127.0.0.1` callback is removed after the 7 days. |
| 7 | Role lists and scope | An out-of-band Secret, written by a bootstrap script; a member change means script plus restart. |
| 8 | Existing records | Migrated once at cutover, with checksums compared. |
| 9 | Members | The owner's two addresses. |
| E | Egress | Open, like every `factory` workload; ingress is restricted. The intent named the egress paths; this spec lists them but does not enforce them. |

## Alternatives rejected

- **A separate `rfactory` namespace.**
  - The pod could not mount `factory-cli-creds`, so it would need a second login copy and refresh path.
  - The signature policies match literal namespaces. A new namespace gets no enforced verification until every list is extended; only the audit-only catch-all would report the gap.
- **Separate Deployments for the web app, proxy and STT.**
  - Each would need a Service, plus policies to keep the web app and STT reachable only from their one client.
  - The web app would need a code change to bind the pod IP and to trust the identity header only from the proxy.
  - Its advantages are real but small: separate restarts, so a member change would not reload the whisper model; and simpler per-container uids.
- **Importing locally built images (`imagePullPolicy: Never`), as the desktop images are.**
  - It can deliver images, but the `factory` controls establish provenance only for signed first-party GHCR images.
  - It ties every deploy to p620.
- **An egress allowlist.** No other `factory` workload has one, and Anthropic's addresses are not stable, so a stale list would silently break the brain. Offered as owner item E.
- **Role lists and scope in a ConfigMap in git.** Both repositories are public, and the lists hold personal email addresses.
- **A volume-held Claude login (today's `claude-home`).** It has no refresh path; the owner would copy credentials by hand.
- **A separate Keycloak client for the cluster.**
  - It would let the two deployments rotate credentials independently.
  - But the overlap lasts only 7 days, and one client keeps fallback and rollback simple.

## Risks

- **Admission:** if the signature rule or coverage list is wrong, the pod is denied. The dry runs in step 4 of Kyverno find this before `replicas: 1`.
  - The verify policy's `failurePolicy: Ignore` means a Kyverno outage admits unverified images. That is existing behaviour, applied to every `factory` service.
- **Trivy:** the web image pins Chrome 157, Piper and the Claude CLI, with no security-refresh build argument. CFactory's hard Trivy gate may fail on a pinned package. The workflow's first run decides it: bump the pin, or add a documented `.trivyignore` entry, never a blanket skip.
- **CI cost:** the STT build installs Nix and downloads the 466 MiB model on each run.
- **The CNI may not enforce NetworkPolicy.** Then `rfactory-stt` would be reachable from other `factory` pods. Verified live (Verification 2). `rfactory-desktops`' default-deny already relies on enforcement.
- **The public hostname** exposes the login page. Every route is behind oauth2-proxy, the proxy replaces any client-sent identity, and the web app refuses non-members.
- **CPU:** `rfactory-stt`'s 8-CPU limit competes with the other Factory pods on p620. The #16 load check measured about 6.5 cores in a 3-request burst. Its request is 1 CPU, so it schedules.
- **The shared Claude login:** RFactory's turns count against the same subscription as the other services, and a missed re-seed roll stops the brain until the pod is restarted.
- **Two instances during the checks:** the idle p620 pod and the cluster pod share CFactory and the desktop runner. Only the cluster instance is used until the p620 pod is stopped.
- **`GITOPS_PAT`:** until the owner adds it, promotion is a manual `factory-gitops` commit.
- **Migration** writes into the cluster once, with `kubectl cp`. The source volume is kept for 7 days.

## Verification

Against `https://rfactory.freundcloud.org.uk`, before the p620 pod is stopped:

1. **Login and roles:**
   - unauthenticated `GET /` → 302 to Keycloak `factory`;
   - each of the owner's addresses → 200;
   - a signed-in non-member → 403;
   - an approver can approve and a member cannot (403);
   - a request carrying a forged `X-Forwarded-Email` is served as the signed-in user, not the forged one;
   - an authenticated mutation (`POST` with the page's `Origin`) passes the same-origin check.
2. **Isolation:** from an unlabelled throwaway pod in `factory`, connections to the RFactory pod IP on 4180, 8080 and 8081 all fail (time out or are refused). 4180 answers only through the tunnel, via the hostname.
3. **Hardened runtime:** under the exact security context:
   - a standup is answered by the brain (Claude CLI under `readOnlyRootFilesystem`);
   - a spoken answer is made (Piper);
   - a question is transcribed (whisper);
   - no container logs an `EROFS` or `EACCES` error.
4. **Restart:** delete the pod. After it is recreated:
   - the role lists, switches and scope are in force;
   - the migrated records match the p620 source (file list and SHA-256 sums);
   - a brain turn works with the seeded login.
5. **Images:**
   - the running containers' image digests carry a cosign signature from RFactory's `deploy.yml@refs/heads/main`;
   - `GET /api/config` reports the deployed commit;
   - an unsigned and a wrong-signer image are refused by a server-side dry run.
6. **Calls and features** (the intent's list): with the runner reached over its Service, mTLS authenticated both ways (a missing client certificate is refused):
   - #3: a call in a desktop VM;
   - #12: a board share approved and shown in the call;
   - #16: 5 of 5 Meet questions with own transcription;
   - #28: the standup and the review panel;
   - #18: its live test, once merged and switched on.
7. **Secrets:**
   - no secret value or role-list address appears in either repository (`git grep` for the addresses and a key prefix), in a `last-applied-configuration` annotation, or in container logs;
   - a member change through the script takes effect after the roll.
8. **Argo:** the Application is `Synced` and `Healthy`, and a manual edit to the Deployment is reverted by self-heal.
