---
status: draft
issue: 33
intent: intent/2026-11-24-33-rfactory-in-cluster.md
---

# Spec: run RFactory in the factory cluster

## Design

### One pod, as today

RFactory runs as a single Deployment `rfactory` in namespace **`factory`**, with `replicas: 1` and `strategy: Recreate`. There is one call manager, one action record on an RWO volume, and one investigation slot, so two copies must never run at once.

The pod holds today's three containers plus CFactory's credential sidecar:

| Container | Listens on | Role |
|---|---|---|
| `oauth2-proxy` | `0.0.0.0:4180` | Keycloak login. The only port the Service exposes. Upstream `http://127.0.0.1:8080`. |
| `rfactory-web` | `127.0.0.1:8080` (unchanged code) | The web app. `RFACTORY_STT_URL=http://127.0.0.1:8081`. |
| `rfactory-stt` | `0.0.0.0:8081` (`STT_PORT=8081`) | whisper-server. Limits: 8 CPU, 2 GiB, as in the pod. |
| `cred-sync` | none | Refreshes the Claude login from `factory-cli-creds`, as in CFactory. |
| init `seed-creds` | none | Copies the Claude login into the `emptyDir` home before the web app starts. |

**Why one pod:**
- `rfactory-web` already binds only `127.0.0.1` (`web/server.js`, `listen(..., '127.0.0.1')`). Inside a shared pod, only the proxy can reach it, so "forwarded identity only from the proxy" holds with no code change.
- `rfactory-stt` stays on localhost, as #16 deviation 6 chose for the pod.

**NetworkPolicy `rfactory-ingress`** (new) selects the pod and allows ingress only on TCP 4180, only from the `cloudflared` pods.
- This closes `rfactory-stt`'s 8081, which the whisper wrapper binds on `0.0.0.0` and so on the pod IP. The web app's 8080 binds only `127.0.0.1`.
- `factory` has no default-deny. CFactory has no policy at all.
- Egress stays open, like every other `factory` workload. The web app needs:
  - CFactory (`factory`);
  - the runner (`rfactory-desktops`);
  - Keycloak (in-cluster `redeemURL`, as `cfactory-auth`);
  - Anthropic (the Claude CLI);
  - DNS.

  An egress allowlist would be the only one in the namespace and would break the Claude CLI whenever Anthropic changes its addresses. It is left out on purpose (see Alternatives).

### Reach: tunnel, DNS, Keycloak

- **Service** `rfactory` (ClusterIP) → port 4180.
- **Tunnel:** a new ingress rule in `factory-gitops/infra/cloudflared/cloudflared.yaml`: `rfactory.freundcloud.org.uk` → `http://rfactory.factory.svc.cluster.local:4180`, above the catch-all, as `cfactory` has (commit 27f1f92).
- **DNS (manual, owner's OK):** `cloudflared tunnel route dns <tunnel> rfactory.freundcloud.org.uk`, as `docs/build-and-deploy.md` describes. DNS is not in git.
- **Keycloak (manual, `kcadm.sh`, owner's OK):** keep the existing confidential client `rfactory`.
  - Add the redirect URI `https://rfactory.freundcloud.org.uk/oauth2/callback` and the web origin.
  - Keep `http://127.0.0.1:4180/oauth2/callback` while the p620 pod is the fallback; remove it when the pod is retired.
  - Clients are not in git (`docs/keycloak-sso.md`).
- **oauth2-proxy config:** `deploy/oauth2-proxy.yaml`'s settings move into a ConfigMap:
  - `redirect_url`, the cookie domain and secure cookies for the new host;
  - `redeem_url` `http://keycloak.factory.svc.cluster.local:8080`, as `cfactory-auth`.

  Unlike `cfactory-auth`, it keeps today's RFactory behaviour:
  - email from the ID token, passed as `X-Forwarded-Email`;
  - no bearer-token pass-through;
  - `email_domains = ["*"]`, because membership is decided by the web app's role lists, not by the proxy.

  `pass_host_header` stays on (the default). The web app's same-origin check compares `Origin` with `Host`, so it keeps working at the new hostname.

### Images: built, signed and promoted by CI, like CFactory

A new workflow `.github/workflows/deploy.yml` in RFactory runs on push to `main`:

1. **`rfactory-web`:** `docker build -f web/Containerfile --build-arg RFACTORY_COMMIT=$GITHUB_SHA` → `ghcr.io/olafkfreund/rfactory-web:sha-<short>`.
   - CI builds only pushed commits of a public repository, so AGPL §13 (#13) holds by construction.
   - The image still carries the commit, and `/source` still answers with it.
2. **`rfactory-stt`:** `nix build .#image-stt`, then pushed as `ghcr.io/olafkfreund/rfactory-stt:sha-<short>` (skopeo from the docker archive).
3. **Gates:** Trivy, then `cosign sign --yes` keyless on the digest, a verify self-test, and syft SBOM attestations. These copy CFactory's `deploy.yml` steps.
4. **Promotion:** bump `newTag` (and digest) in `factory-gitops/apps/rfactory/manifests/kustomization.yaml` with a `cd(rfactory): sha-<short> [skip ci]` commit, using the same `GITOPS_PAT` pattern. The PAT is a repository secret the owner adds.

**Kyverno (`factory-gitops/apps/kyverno-policies`):**
- add a `verifyImages` rule for `ghcr.io/olafkfreund/rfactory-web*` and `rfactory-stt*` in namespace `factory`, with the pinned `subjectRegExp` `^https://github\.com/olafkfreund/RFactory/\.github/workflows/deploy\.yml@refs/heads/main$`;
- add both images to `require-first-party-signature-coverage`'s list;
- keep `assert-signature-lists-agree.py` passing.

Without these changes, `require-first-party-signature-coverage` denies the pod.

**Private images:** the pod pulls with the existing `ghcr-pull` Secret in `factory`.

`deploy/k3d/import-images.sh` and `imagePullPolicy: Never` stay for the desktop images only.

### Secrets and private settings: out of band, like every `factory` Secret

Both repositories are public, so no personal data or key enters git.

New Secrets are created with `kubectl create secret` by a bootstrap script `deploy/k8s/bootstrap-secrets.sh`. The owner runs it, or the lead runs it with the owner's OK. It reads the files from `~/.config/rfactory` and never prints them:

| Secret | Keys | Mounted |
|---|---|---|
| `rfactory-config` | `scope.json`, `allowed-emails`, `approvers`, `admins` | `scope.json` as a file. The role lists as env vars (`RFACTORY_ALLOWED_EMAILS`, `RFACTORY_APPROVERS`, `RFACTORY_ADMINS`). |
| `rfactory-keys` | `cfactory-read-key`, `cfactory-write-key`, `stt-path` | files, read-only, mode 0400 |
| `oauth2-proxy-rfactory` | `client-secret`, `cookie-secret` | oauth2-proxy (client id `rfactory` is in the ConfigMap) |
| `rfactory-runner-client` | `client.crt`, `client.key`, `ca.crt` | files for `RFACTORY_RUNNER_CERT`, `_KEY` and `_CA` |

- **Changing a member:** edit the file and rerun the script. The change is not a git change, because the lists are personal data and both repositories are public.
- **Switches:** they are not secrets and live in the Deployment: `RFACTORY_WRITES`, `RFACTORY_SHARES`, `RFACTORY_DESKTOP`, `RFACTORY_CALLS=1`, the STT URL and secret file, and later `RFACTORY_INVESTIGATIONS`. A restart can no longer drop them.
- **Desktop runner:** `RFACTORY_RUNNER_URL=https://rfactory-runner-api.rfactory-desktops.svc:8443`. Its server certificate already names `rfactory-runner-api.rfactory-desktops.svc` (`mk-tls.sh`), so mTLS works with no new certificate. The runner's ingress policy allows TCP 8443 from any source; mTLS with the `rfactory-web` client certificate is the control, as today.

### Claude login: the shared `factory-cli-creds`, like CFactory

- An init container copies `claude-credentials.json` from `factory-cli-creds` to `<home>/.claude/.credentials.json` in an `emptyDir`.
- `cred-sync` re-copies it when the Secret holds a newer `expiresAt`, with CFactory's 90-day skew guard.
- `scope.json`'s `brain.home` points at that `emptyDir`.
- It is the same subscription login the other Factory services use. It is a long-lived `setup-token` login with about 352 days of runway, re-seeded by the owner, and cred-broker watches it.
- No API key is involved.

### State

- A PVC `rfactory-data` (`local-path`, 1 GiB, RWO) is mounted at `/var/lib/rfactory/actions`. It holds the action, share and (with #18) investigation records.
- **Migration, once at cutover (owner's OK):** the p620 `rfactory-actions` podman volume is exported and copied into the PVC (`kubectl cp` into the running pod while writes are off), so the 90-day record continues.

### Pod security

Every container follows CFactory's convention, even though `factory` only audits and warns:
- `runAsNonRoot` (`node` is uid 1000; whisper uses its image's non-root uid 10001);
- `allowPrivilegeEscalation: false`;
- `capabilities.drop: [ALL]`;
- `seccompProfile: RuntimeDefault`;
- `readOnlyRootFilesystem: true`, with `emptyDir` mounts for `/tmp` and the Claude home;
- `automountServiceAccountToken: false`.

`--init` and `--shm-size` existed for in-container Chrome. With `RFACTORY_DESKTOP=1`, calls run in the desktop VMs (`web/server.js`: `spawn` is the VM spawner whenever the runner is set), so they are dropped. Chrome stays in the image, unused.

### Order and cutover

1. Merge #16 (PR #32) first: the cluster deployment includes `rfactory-stt` from the start. #18 follows with its own switch, off until its live test.
2. Land the RFactory workflow and manifests, and the `factory-gitops` changes:
   - the Application `apps/rfactory`;
   - Kyverno;
   - the tunnel rule;
   - the ingress policy.
3. **Owner's OK and a bus announcement**, then:
   - the Secrets bootstrap;
   - the `kcadm` redirect;
   - the DNS route.
4. Argo CD syncs. The web app comes up next to the still-running p620 pod, with writes **off** in the cluster until the checks pass.
5. Live checks against `https://rfactory.freundcloud.org.uk` (Verification). Then:
   - stop the p620 pod;
   - migrate the records;
   - turn writes, shares and desktop on in the cluster;
   - rerun the call checks.
6. **Fallback:** the stopped p620 pod and its volume stay for 7 days. Falling back means stopping the cluster Deployment (scale to 0 through git) and starting the pod. Records written in the cluster in between are not copied back.

   After 7 days:
   - the podman volume and image are removed;
   - the `127.0.0.1` callback is deleted;
   - `deploy/pod.sh` stays in the repository as a development path only, with its README section saying so.

## Owner decisions (defaults proposed; the intent's open questions)

| # | Question | Proposed default |
|---|---|---|
| 2 | Namespace | `factory`: shares `factory-cli-creds`, `ghcr-pull`, in-cluster Keycloak and the Kyverno coverage. |
| 3 | Images | CI builds and signs them in RFactory, like CFactory. |
| 4 | Retiring the pod | Stop it after the checks; keep it stopped for 7 days as a fallback, with no copy-back of cluster records; then remove it. `pod.sh` stays as a development path. |
| 5 | Claude login | The shared `factory-cli-creds`. |
| 6 | Keycloak | The same `rfactory` client, with a new callback; the `127.0.0.1` callback is removed after the 7 days. |
| 7 | Role lists and scope | An out-of-band Secret, with a bootstrap script. |
| 8 | Existing records | Migrated once at cutover. |
| 9 | Members | The owner's two addresses. |

## Alternatives rejected

- **A separate `rfactory` namespace.**
  - The pod could not mount `factory-cli-creds`, so it would need a second login copy and refresh path.
  - The signature policies match literal namespaces, so a new namespace would get no image verification at all unless every list were extended.
- **Separate Deployments for the web app, proxy and STT.** Each would need a Service, plus policies to keep the web app and `rfactory-stt` reachable only from their one client. It would also need a web-app code change to bind the pod IP and to trust the forwarded identity only from the proxy. One pod gets both for free.
- **Importing locally built images (`imagePullPolicy: Never`), as the desktop images are.**
  - In `factory` it would pass the signature policies only because they ignore non-ghcr images. That is a hole, not a design.
  - It ties every deploy to p620.
- **An egress allowlist for the pod.** No other `factory` workload has one. Anthropic's addresses are not stable, and a stale list would silently break the brain.
- **Role lists and scope in a ConfigMap in git.** Both repositories are public, and they hold personal email addresses.
- **A volume-held Claude login (today's `claude-home`).** It has no refresh path, and the owner would copy credentials by hand.
- **A new Keycloak client.** It adds a client and a secret for no gain; the callback list is enough.

## Risks

- **Kyverno denies the pod** if the signature rule or coverage list is wrong. Found at the first sync; the p620 pod keeps serving until cutover.
- **The CNI does not enforce NetworkPolicy:** then `rfactory-stt` would be reachable from other `factory` pods. Verified live: from a test pod, port 8081 must time out. `rfactory-desktops`' default-deny already relies on enforcement.
- **The public hostname** exposes the login page to the internet. Every route is behind oauth2-proxy, as CFactory is; non-members are refused by the web app.
- **CPU:** `rfactory-stt`'s 8-CPU limit now competes with the other Factory pods on p620. The #16 load check measured about 6.5 cores during a 3-request burst.
- **The shared Claude login:** RFactory's use counts against the same subscription as the other services.
- **The CI workflow needs a `GITOPS_PAT` secret in RFactory** to promote tags. Until the owner adds it, promotion is a manual `factory-gitops` commit.
- **Migration:** `kubectl cp` into the pod writes cluster state. It is done once, with writes off, and the source volume is kept for 7 days.

## Verification

Against `https://rfactory.freundcloud.org.uk`, with the p620 pod stopped:

1. **Login:**
   - unauthenticated `GET /` → 302 to Keycloak `factory`;
   - each of the owner's addresses → 200;
   - a signed-in non-member → 403;
   - a non-approver cannot approve (403).
2. **Isolation:** from a throwaway pod in `factory`, TCP to the pod IP on 8080 and 8081 times out, and 4180 answers.
3. **Restart:** delete the pod. After Argo/ReplicaSet recreation:
   - the role lists, switches and scope are in force;
   - the action record is intact (count before = after);
   - a standup question is answered by the brain.
4. **Images:**
   - the Deployment's images are `ghcr.io/olafkfreund/rfactory-*@sha256:…` with a valid cosign signature from RFactory's `deploy.yml@refs/heads/main`;
   - `GET /source` reports the deployed commit;
   - an unsigned tag is refused by admission (`kubectl create --dry-run=server`).
5. **Calls:** the #16 Meet checks:
   - 5 of 5 questions with own transcription;
   - the standup;
   - a desktop share (#12).

   The runner is reached over the Service, with mTLS authenticated on both sides.
6. **Secrets:** no secret value or role list appears in either repository (`git grep` for the addresses and a key prefix), or in container logs.
7. **Argo:** the Application is `Synced` and `Healthy`; a manual edit to the Deployment is reverted by self-heal.
