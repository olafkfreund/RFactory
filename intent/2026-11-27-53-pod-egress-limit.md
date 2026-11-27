---
status: approved
issue: 53
author: olafkfreund
---

# Intent: Enforce an egress limit for the RFactory pod

## Problem

The RFactory pod in `k3d-factory` can open a connection to any address. Only the code limits where it goes.

- The pod's one NetworkPolicy is ingress only: factory-gitops `apps/rfactory/manifests/manifests.yaml:46-56`
  (`rfactory-ingress`, read from `origin/main`). The live cluster shows the same: `policyTypes: [Ingress]`.
- The code pins its hosts, but a pin in code is not a network limit:
  - GitHub reads go to `api.github.com` with redirects refused (`core/src/sources/github-read.js:17,52`);
  - CFactory lookups refuse redirects (`core/src/sources/cfactory.js:11-12,85-86`). The ordinary CFactory reads
    and the writes do not: they use the MCP client's defaults (`cfactory.js:86`, `core/src/sinks/cfactory-write.js:37-39`);
  - the Claude CLI runs with its built-in tools off and a strict MCP config. A lookup turn adds only RFactory's
    own loopback MCP tools (`core/src/brains/claude-cli.js:17,81-82`).
- The pod holds things worth protecting: the Claude credential, the CFactory read and write keys, the runner's
  client certificate, and call transcripts. A bug, a bad dependency or a prompt injection that got past the code
  checks could send them anywhere.
- The #51 spec first said "the existing egress rules apply". There were none. The owner moved the enforced limit
  to this issue (`spec/2026-11-26-51-in-call-agents.md:274-276`).

What the pod talks to today (four containers, one network namespace, so one policy covers all of them):

| From | To | Evidence |
| --- | --- | --- |
| `rfactory-web` (Claude CLI child, pinned `2.1.326`) | Anthropic, public, TCP 443: the API, and the OAuth token refresh. Any optional traffic (telemetry, update checks) is not measured. | `claude-cli.js:33`; `web/Containerfile:40`; scope `brain.destination: third-party` |
| `rfactory-web` | CFactory MCP at `https://cfactory-mcp.freundcloud.org.uk/mcp`. This is the **public** name behind Cloudflare, not the in-cluster Service. | cluster scope file; `core/src/scope.js:64` refuses plain `http` unless the host is `127.0.0.1`; decided in `plan/2026-11-24-33-rfactory-in-cluster.md:33` |
| `rfactory-web` | Desktop runner, `rfactory-runner-api.rfactory-desktops.svc:8443`, mTLS. VNC and call streams go through the same port. The pod never reaches a desktop or bot VM directly. | manifest `:170`; `desktop/runner/client.js:20,35` |
| `rfactory-web` | `api.github.com:443`, only when the scope has `github_read`. The cluster scope has none today. | `github-read.js:17` |
| `oauth2-proxy` | Keycloak in-cluster, `keycloak.factory.svc:8080`, plain HTTP (token and keys). The login URL is the browser's, not the pod's. | manifest `:33-38` |
| all | Cluster DNS, `kube-dns` in `kube-system`, port 53. | `dnsPolicy: ClusterFirst` |
| `oauth2-proxy` to web, web to `rfactory-stt`, the Claude CLI to the lookup endpoint, speech synthesis, `cred-sync`, and the init containers `seed-creds` and `stage-keys` | Nothing leaves the pod: loopback, a child process, and file copies. | manifest `:24,171`; `core/src/lookup-endpoint.js:44`; `web/tts.js:19`; manifest `:74-111,229-333` |

What the cluster can enforce:

- k3d runs k3s `v1.35.10` with its defaults: flannel plus the built-in kube-router policy controller. No flag
  turns it off. A default-deny policy exists in `rfactory-desktops`, and the project has seen kube-router refuse
  traffic there (`deploy/k3d/README.md:222`). Enforcement in the `factory` namespace was not measured for this
  intent.
- A plain NetworkPolicy does not log what it refuses.
- That controller knows IP blocks, pods and namespaces. It has no host-name (FQDN) rules. There are no Cilium or
  Calico CRDs in the cluster.
- So a plain NetworkPolicy can pin the in-cluster targets exactly. It cannot pin Anthropic, GitHub or the public
  CFactory name: their addresses are shared and change. The closest it gets is "any public IPv4 address on
  TCP 443", as the `gateway` namespace does (`allow-provider-egress`).

## Proposed outcome

- The pod reaches only the destinations in an approved list. Everything else is refused at the network, whatever
  the code inside the pod does.
- The list is in git (factory-gitops) and reviewed like any other change.
- In-cluster targets are named exactly: DNS, Keycloak `:8080`, the runner API `:8443`.
- Public targets (Anthropic, the CFactory MCP name, and `api.github.com` when GitHub reads are on) are limited
  in this slice to "any public IPv4 address on TCP 443". Private, link-local and cluster ranges are refused
  unless named above. Limiting them by host name is a later slice (decision 1).
- A refused connection shows as the app's own error. Host-level refusal logs come with the later slice
  (decision 7).
- Everything that works today still works: sign-in, standup, lookups, writes, shares, investigations, desktops,
  calls, and the Claude credential refresh.
- A repeatable check proves both sides: an allowed host connects, a host off the list does not.

## Affected users and systems

- **Owner / operator:** approves the list; sees refusals; one more thing to maintain when a host is added.
- **Users of RFactory:** no visible change if the list is right; a failed sign-in, answer or call if it is wrong.
- **factory-gitops:** `apps/rfactory/manifests/manifests.yaml` gains the egress rules. No proxy in this slice.
- **RFactory code:** no change in this slice. For the later proxy slice:
  - the Claude CLI gets a fixed environment with no proxy variable (`core/src/brains/claude-cli.js:22`);
  - a Claude settings file with a `proxy` or `env` key is refused (`core/src/brains/destination.js:41`);
  - Node's `fetch` ignores `HTTPS_PROXY` unless told otherwise, and so does the runner client (`https.request`).
- **`k3d-factory` cluster:** shared with CFactory, AIFactory, Keycloak, the model gateway and the desktops.
  A CNI change would touch all of them.
- **`rfactory-desktops` namespace:** already default-deny, with its own allowlist proxy (`desktop/proxy/proxy.js`).
  The runner accepts `:8443` from any source (`rfactory-runner-api`), so no change is needed there.
- **Cloudflare tunnel / `cloudflared`:** on the path, because CFactory MCP stays on its public name (decision 2).

## Constraints

- Must not break sign-in, the Claude credential refresh, or a live call. The change must be quick to undo.
- Must not weaken the code's own pins: redirects stay refused, the Claude CLI keeps its fixed environment, and
  the settings and destination-hash checks stay (`claude-cli.js:22`, `destination.js:26-43`).
- Traffic inside the pod (loopback) and to Keycloak and the runner (mTLS) must stay direct.
- `openai-compat` refuses a turn when a proxy variable exists, upper or lower case, even empty
  (`core/src/brains/openai-compat.js:5,12`). The
  cluster does not use that brain (`web/server.js:394`), but a pod-wide `HTTPS_PROXY` would break it elsewhere.
- No secret in the policy, the proxy config or its logs. A proxy must log host and port only, never headers.
- TLS to public hosts stays end to end: nothing may open that traffic (no interception, no extra CA in the pod).
  Keycloak in-cluster is plain HTTP today; that is not changed here.
- Changes to factory-gitops and the cluster follow the owner's rules: no deploy, sync or restart without the
  owner. A CNI swap on the shared cluster needs the owner's explicit decision.
- The limit must cover all four containers and both init containers.

## Open questions

None.

## Decisions (2026-11-27)

The owner approved this intent with "use recommendations". The draft gave no recommendation for any of the
eight questions, so each answer below is marked: (no recommendation was given; lead's default, owner may revisit).

1. **Pinning the public hosts:** this slice allows any public IPv4 address on TCP 443, with exact in-cluster
   targets. Host-name pinning by an allowlist proxy is a later slice. A CNI swap is not pursued.
   (no recommendation was given; lead's default, owner may revisit)
2. **CFactory MCP:** stays on the public name, as #33 decided. The public-443 rule covers it. No code or scope
   change. (no recommendation was given; lead's default, owner may revisit)
3. **Anthropic hosts:** no host list in this slice; the public-443 rule covers them. The hosts are measured when
   the proxy slice is specified. (no recommendation was given; lead's default, owner may revisit)
4. **`api.github.com`:** no separate rule; the public-443 rule covers it when a scope turns `github_read` on.
   (no recommendation was given; lead's default, owner may revisit)
5. **New proxy or the existing one:** deferred to the proxy slice.
   (no recommendation was given; lead's default, owner may revisit)
6. **DNS:** allowed to `kube-dns` only, port 53. Data leaving through DNS is accepted and out of scope.
   (no recommendation was given; lead's default, owner may revisit)
7. **Refusal visibility:** the app's own error is enough in this slice. Host-level logs come with the proxy
   slice. (no recommendation was given; lead's default, owner may revisit)
8. **Node traffic:** out of scope. The limit covers the pod's own traffic only.
   (no recommendation was given; lead's default, owner may revisit)
