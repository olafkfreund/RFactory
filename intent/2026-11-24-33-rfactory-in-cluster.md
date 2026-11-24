---
status: draft
issue: 33
author: olafkfreund
---

# Intent: run RFactory in the factory cluster like the other Factory services

## Problem

RFactory runs as a podman pod on p620, started by hand with `deploy/pod.sh up`. The running pod is built from the #16 branch (PR #32, not yet merged) and has three containers: the web app, its login proxy (oauth2-proxy) and its speech-to-text server (`rfactory-stt`). `main`'s `pod.sh` starts only the first two. That causes four problems:

- **Reach:** the portal answers only at `http://127.0.0.1:4180` on p620. From any other machine it needs an SSH tunnel, and its Keycloak callback is that local address.
- **Settings live in a shell:** who is a member, approver or admin, and which switches are on, live only in the environment of the shell that started the pod. A restart that forgets one setting silently drops it. That has happened: the role lists were lost once.
- **Unlike the rest of the Factory:** CFactory, PFactory, AIFactory and TFactory run in the k3d `factory` cluster, deployed by Argo CD from `factory-gitops`, each at a `*.freundcloud.org.uk` hostname through the Cloudflare tunnel. CFactory has its own oauth2-proxy app (`cfactory-auth`); the others log in with OIDC natively. RFactory's desktop VMs (`rfactory-desktops`, #3) are already in the cluster; only RFactory itself is not.
- **Tied to one host's shell:** if p620 restarts, or someone stops the pod, RFactory stays away until someone starts it again with every setting.

## Proposed outcome

Observable when done:

- **Reach and login:**
  - `https://rfactory.freundcloud.org.uk` (owner's decision) works from any machine, with no tunnel.
  - An unauthenticated request is sent to Keycloak (`factory` realm).
  - A signed-in non-member is refused.
  - Members, approvers and admins keep their different rights.
  - The web app accepts the forwarded identity only from its own login proxy; other workloads in the cluster cannot reach it directly.
- **Restarts lose nothing:** after the pod is replaced:
  - the role lists, switches (writes, shares, desktop, own speech-to-text, and investigations once #18 lands) and the project scope are still in force;
  - the action, share and investigation records are still there;
  - the brain answers with the Claude subscription login.
- **Speech-to-text in the cluster:**
  - a call question is transcribed by `rfactory-stt` in the cluster;
  - an unrelated workload cannot reach `rfactory-stt`;
  - it keeps its secret request path and its 8-CPU and 2 GB limits.
- **Desktop runner over the cluster network:** a live call goes through the runner's in-cluster Service, with both sides of the mTLS connection authenticated, instead of the load-balancer port on p620.
- **The p620 pod retired:** after the cluster deployment passes the live checks of #3, #12, #16, #28 (and #18 if merged), the pod is stopped, on the owner's terms (open question 4).

## Affected users and systems

- **People:** the owner and anyone added to the role lists. Today that is the owner's freundcloud.com and Gmail addresses (the Gmail one is also the owner's GitHub sign-in).
- **Repositories (both public):**
  - RFactory: images, Kubernetes manifests, docs, and what becomes of `deploy/pod.sh`.
  - `factory-gitops`: the Application(s), a login proxy app like `cfactory-auth`, and the Cloudflare tunnel route.
- **Cloudflare:** the tunnel route and the DNS record for `rfactory.freundcloud.org.uk`.
- **Keycloak `factory` realm:** RFactory's client and its callback for the new hostname (open question 6).
- **The k3d `factory` cluster on p620:**
  - the namespace RFactory runs in;
  - network policies for every path:
    - the tunnel to the login proxy;
    - the proxy to Keycloak and to the web app;
    - the web app to CFactory, the desktop runner, `rfactory-stt`, Anthropic (the Claude CLI) and DNS;
    - the receiving side of those paths;
  - Kyverno admission (signed first-party images) and the pod-security baseline the other services meet: non-root, read-only root filesystem, no privilege escalation, all capabilities dropped, no service-account token.
- **`rfactory-desktops`:**
  - its runner Service and network policies;
  - the runner's server certificate, which names `127.0.0.1` today and must also name the Service;
  - the load-balancer port the pod uses now.
- **p620:** the pod is retired. The cluster runs on p620 too, so no new host is involved.

## Constraints

- **Secrets stay out of git and are never printed:**
  - the CFactory read and write keys;
  - the Keycloak client secret and the cookie secret;
  - the `rfactory-stt` path secret;
  - the desktop runner's client certificate, client key and CA certificate.

  The cluster today creates such Secrets out of band, not from `factory-gitops` (`oauth2-proxy-cfactory` is documented that way), until sealed or external secrets land. RFactory follows that process, with the owner's OK. "No `kubectl apply`" applies to the manifests, which go through `factory-gitops`.
- **Personal data stays out of the public repositories:**
  - the role lists hold personal email addresses;
  - `scope.json` is kept private (mode 600) today.

  Both repositories are public, so these cannot be committed as they are (open question 7).
- **Claude login:**
  - the brain uses the Claude CLI with a subscription login, never an API key;
  - a refreshed login must reach the pod without a manual copy, or the owner must know who re-authenticates and how (open question 5).

  CFactory seeds its Claude login from the shared `factory-cli-creds` Secret into an `emptyDir` and refreshes it with a `cred-sync` sidecar; it does not keep it on a volume.
- **AGPL §13 (#13):** the deployed web image must carry the clean, pushed commit it was built from, as `pod.sh` enforces today with `source-guard.sh --check-public` and `RFACTORY_COMMIT`, whichever way images are built.
- **Images:**
  - the web image is built with `podman build` from `web/Containerfile`, and `rfactory-stt` with Nix (`.#image-stt`);
  - the web image carries Chrome and Xvfb for calls run in the web container (`RFACTORY_CALLS=1`, `--shm-size=1g`);
  - both must meet the cluster's admission and pod-security rules, or the spec names the exception.
- **Calls are unchanged:** calls still run in the desktop VMs, and the existing live checks must pass against the cluster deployment.
- **Owner's OK and bus announcements:** builds and deploys on p620 need the owner's OK and an agent-bus announcement first.
- **Order with open work:** #16 (PR #32) and #18 are still open. The deployment starts from `main` after they merge, or carries their switches off until then.

## Decided

1. **Hostname:** `rfactory.freundcloud.org.uk` (owner, 2026-11-24).

## Open questions

2. **Namespace:** `factory`, next to CFactory (shares `factory-cli-creds` and its policies), or its own `rfactory`? The spec can decide this against the cluster's policies, unless you have a preference.
3. **Image delivery:** CI builds and signs images to `ghcr.io/olafkfreund/rfactory-*` like CFactory's, or p620 builds them and imports them into k3d? The spec can decide this, unless you have a preference.
4. **Retiring the pod:**
   - Retire it right after the cluster checks pass, or keep it as a fallback for a while?
   - If kept: for how long?
   - Are records written in the cluster after cutover allowed to be lost if you fall back?
   - Does `deploy/pod.sh` stay as a development path, or is it removed?
5. **Claude login:** use the cluster's shared `factory-cli-creds` login (refreshed automatically, the same account as the other Factory services), or a separate RFactory-only login?
6. **Keycloak:** add the new callback to RFactory's existing client, or create a separate client for the cluster? Should the `127.0.0.1:4180` callback be kept?
7. **Role lists and scope:** both repositories are public, so where do the member lists and `scope.json` live? For example, an out-of-band Secret like the others, accepting that changing a member is not a git change.
8. **Existing records:** migrate the action and share records from the p620 `rfactory-actions` volume into the cluster, or start clean?
9. **Members:** the owner's freundcloud.com and Gmail addresses for now. Anyone else?
