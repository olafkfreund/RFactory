---
status: draft
issue: 33
author: olafkfreund
---

# Intent: run RFactory in the factory cluster like the other Factory services

## Problem

RFactory's web app, its login proxy (oauth2-proxy) and its speech-to-text server (`rfactory-stt`, #16) run as a podman pod on p620, started by hand with `deploy/pod.sh up`. That causes four problems:

- **Reach:** the portal answers only at `http://127.0.0.1:4180` on p620. From any other machine it needs an SSH tunnel, and its Keycloak callback is that local address.
- **Not managed from git:** the pod's settings, including who is a member, approver or admin, live only in the environment of the shell that started it. A restart that forgets one setting silently drops it. That has happened: the role lists were lost once.
- **Unlike the rest of the Factory:** CFactory, PFactory, AIFactory and TFactory run in the k3d `factory` cluster. Argo CD deploys them from `factory-gitops`, each behind its own oauth2-proxy and a `*.freundcloud.org.uk` hostname through the Cloudflare tunnel. RFactory's desktop VMs (`rfactory-desktops`, #3) are already there; only RFactory itself is not.
- **Tied to one host's shell:** if p620 restarts, or someone stops the pod, RFactory stays away until someone starts it again with every setting.

## Proposed outcome

- **Reach:** RFactory is reachable at its own hostname (for example `rfactory.freundcloud.org.uk`), behind its own oauth2-proxy against the Keycloak `factory` realm, like CFactory.
- **Deployed from git:** Argo CD deploys it from `factory-gitops`, including the role lists, the switches (writes, shares, desktop, own speech-to-text, and investigations once #18 lands) and `scope.json`. A restart keeps them all.
- **Speech-to-text in the cluster:** `rfactory-stt` runs in the cluster next to the web app, which reaches it without leaving the cluster.
- **Desktop runner:** the web app reaches it as an in-cluster Service, not through a load-balancer port on p620.
- **State survives restarts:** the action and investigation records, and the Claude login the brain uses, survive restarts (persistent volumes, as CFactory has).
- **p620 pod retired:** once the cluster deployment passes the same live checks, the pod is stopped, and `deploy/pod.sh` stays only as a development path (or is removed).

## Affected users and systems

- **People:** the owner and anyone added to the role lists. Today that is the owner's freundcloud.com and Gmail addresses (the Gmail one is also the owner's GitHub sign-in).
- **Repositories:**
  - RFactory: images, manifests (`deploy/k8s/`), docs.
  - `factory-gitops`: a new Application or Applications, an auth app like `cfactory-auth`, and the Cloudflare tunnel route.
- **Keycloak `factory` realm:** a client redirect URI for the new hostname.
- **The k3d `factory` cluster on p620:**
  - namespace `factory`, or a new one;
  - the network policies that let the web app reach CFactory, the desktop runner and `rfactory-stt`;
  - Kyverno policies (signed first-party images).
- **p620:** the pod is retired. The cluster runs there too, so no new host is involved.

## Constraints

- **Secrets stay out of git:**
  - the CFactory read and write keys;
  - the Keycloak client secret and the cookie secret;
  - the `rfactory-stt` path secret;
  - the desktop runner's client certificate.

  They follow the cluster's existing secret pattern (as `factory-secrets` and `oauth2-proxy-cfactory` do). They are never printed.
- **Claude login:** the brain uses the Claude CLI with a subscription login, never an API key. Its login home must move with it and stay private to the pod.
- **Speech-to-text exposure:** `rfactory-stt` is reachable only from the web app (a network policy). It keeps its secret request path and its 8-CPU and 2 GB limits.
- **Images:** the cluster's admission policy requires signed first-party images. RFactory's images are built with Nix on p620 today, so they have to be published and signed the way the other services' images are, or imported the way the desktop images are.
- **Login:** only listed members get in, as now. Approvers and admins must also be members. The hostname is public, so every route stays behind oauth2-proxy.
- **Calls are unchanged:** calls still run in the desktop VMs, and all live checks from #3, #12, #16 and #28 must pass against the cluster deployment before the pod is retired.
- **Owner's OK and bus announcements:** builds and deploys on p620 need the owner's OK and an agent-bus announcement first. `kubectl apply` is not used; changes go through `factory-gitops`.
- **Order with open work:** #16 (PR #32) and #18 are still open. The deployment starts from `main` after they merge, or carries their switches off until then.

## Open questions

1. **Hostname:** `rfactory.freundcloud.org.uk`, or another?
2. **Namespace:** `factory` next to CFactory, or its own (`rfactory`)?
3. **Images:** publish to `ghcr.io/olafkfreund/rfactory-*` from CI and sign them like CFactory's, or keep the Nix build on p620 and import into k3d like the desktop images?
4. **Retiring the pod:** retire it right after the cluster checks pass, or keep it for a while as a fallback?
5. **Members:** the owner's freundcloud.com and Gmail addresses for now. Anyone else?
