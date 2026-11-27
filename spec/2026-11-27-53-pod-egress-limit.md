---
status: draft
issue: 53
intent: intent/2026-11-27-53-pod-egress-limit.md
---

# Spec: Enforce an egress limit for the RFactory pod

## Design

One new NetworkPolicy, `rfactory-egress`, for the RFactory pod. It names the in-cluster targets exactly and
limits everything else to TCP 443 on public addresses. One small script proves it after the sync. No RFactory code changes.

### Where it lands

- **factory-gitops** (its own pull request): `apps/rfactory/manifests/manifests.yaml`, a new document right after
  `rfactory-ingress` (lines 46-56 on `origin/main`). The pod's manifests live only there; this repo has no copy.
- **RFactory** (this repo): `deploy/k8s/check-egress.sh`, the runtime check, and the spec and plan.
- `rfactory-ingress` is not touched. `kustomization.yaml` is not touched: the policy is in `manifests.yaml`, which
  it already lists.

### The policy

Namespace `factory`, `podSelector: { app: rfactory }`, `policyTypes: ["Egress"]`. It selects the whole pod, so it
covers all four containers and both init containers (intent constraint). Four rules:

| # | To | Ports | For | Intent decision |
| --- | --- | --- | --- | --- |
| 1 | namespace `kube-system` (`kubernetes.io/metadata.name`), pods `k8s-app: kube-dns` | UDP 53, TCP 53 | DNS | 6 |
| 2 | pods `app: keycloak`, same namespace | TCP 8080 | `oauth2-proxy` token and keys (`manifests.yaml:34,38`) | — |
| 3 | namespace `rfactory-desktops`, pods `app.kubernetes.io/name: rfactory-runner` | TCP 8443 | runner API, VNC and call streams (`manifests.yaml:170`; `deploy/k8s/rfactory-desktops/runner.yaml:36`) | — |
| 4 | `ipBlock 0.0.0.0/0` except `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `100.64.0.0/10` | TCP 443 | Anthropic, the public CFactory MCP name, `api.github.com` | 1, 2, 3, 4 |

- Rule 4 is the same shape as `allow-provider-egress` in the `gateway` namespace
  (`apps/model-gateway/manifests/manifests.yaml`, the "Upstream provider egress" block), so the cluster has one
  pattern for "public addresses, TCP 443 only".
- Rules 1 and 3 put a namespace selector and a pod selector in **one** peer, so both must match. Rule 2 is a
  pod selector alone, which means "this namespace". All selectors use `matchLabels`.
- Rule 4 limits the address and the port only. A NetworkPolicy cannot check that the traffic is TLS.
- Ports are the pods' own ports, not Service ports. The policy sees traffic after the Service address is
  translated. Here they are the same numbers (53, 8080, 8443).
- No IPv6 rule. The cluster's pod network is IPv4 only (`podCIDRs: 10.42.x.0/24`), so IPv6 egress stays refused.
- A comment above the policy states the residual risk and points to this issue, as the gateway policy does.

What this refuses that is open today:

- the Kubernetes API (`10.43.0.1`, and the nodes on `172.18.0.0/16`);
- every other Service and pod in the cluster, including CFactory's own Service on `:3111`;
- the host and the LAN, including `host.k3d.internal` (`172.18.0.1`);
- the Tailscale range (`100.64.0.0/10`) and link-local addresses;
- any public address on a port other than 443.

What it does not refuse (accepted, decision 1): any public IPv4 address on TCP 443.

### How each decision is carried

1. **Public hosts:** rule 4. No proxy, no CNI change.
2. **CFactory MCP:** stays on `https://cfactory-mcp.freundcloud.org.uk/mcp`. Cluster DNS forwards the name to
   public resolvers and has no override for it, so it resolves to Cloudflare's public addresses; rule 4 covers it.
3. **Anthropic hosts:** no list. Rule 4 covers the API and the token refresh.
4. **`api.github.com`:** no separate rule. Rule 4 covers it if a scope turns `github_read` on.
5. **Proxy choice:** deferred.
6. **DNS:** rule 1, `kube-dns` only. The pod cannot reach another resolver on port 53.
7. **Refusal visibility:** none added. kube-router rejects the connection, so the app fails fast with its own
   error (`deploy/k3d/README.md:222`).
8. **Node traffic:** out of scope.

### The check: `deploy/k8s/check-egress.sh`

A short bash script the owner runs after the sync. It changes nothing in the cluster.

- It runs `kubectl --context "${RFACTORY_KUBE_CONTEXT:-k3d-factory}" -n factory exec deploy/rfactory -c rfactory-web`
  with one `node -e` program. The web image has `node`; the pod's probes already use it
  (`manifests.yaml:190,195`). The context variable is the one `deploy/k8s/bootstrap-secrets.sh:30` uses.
- The program opens plain TCP connections with a 5 second limit. It sends no request and no credential.
- It prints one line per target: the target, what is expected, and the result: `connects`, `refused` (refused or
  timed out) or `dns-error`. A `dns-error` is always wrong: the name must resolve even for a target that must
  be refused.
- Must connect: `api.anthropic.com:443`, `cfactory-mcp.freundcloud.org.uk:443`, `keycloak.factory.svc:8080`,
  `rfactory-runner-api.rfactory-desktops.svc:8443`.
- Must be refused: `kubernetes.default.svc:443`, `cfactory.factory.svc:3111`, `host.k3d.internal:11434`,
  `1.1.1.1:53`, `1.1.1.1:80`, and one UDP DNS query sent straight to `1.1.1.1` (must time out).
- Two modes, so a pass means one thing each time:
  - `check-egress.sh --baseline`, before the policy: exits 0 only if **every** target connects and the UDP query
    is answered. This proves each "must be refused" target is a real, reachable control. A control that does
    not connect in the baseline is replaced in the script before the policy is merged.
  - `check-egress.sh`, after the policy: exits 0 only if every line matches its expectation.

### Deferred

- Host-name pinning through an allowlist proxy, with its refusal log (decisions 1, 5, 7). It needs RFactory code
  changes: the Claude CLI's fixed environment (`core/src/brains/claude-cli.js:22`) and Node's `fetch`.
- Measuring the Claude CLI's real host list (decision 3).
- Moving CFactory MCP to the in-cluster Service (decision 2).
- A default-deny policy for the whole `factory` namespace.

## Alternatives rejected

- **Allowlist proxy now:** the owner's decision 1 makes it a later slice. It also needs code changes and a new
  workload; this slice needs neither.
- **A CNI with FQDN rules (Cilium):** replaces the network of a cluster shared with CFactory, AIFactory, Keycloak
  and the desktops. Decision 1 rules it out.
- **Pinned address ranges for Anthropic, Cloudflare and GitHub:** the ranges are shared with other customers and
  change, so the list would be both loose and fragile. Decision 3 says no host list in this slice.
- **Namespace-wide default-deny in `factory`:** it would cut every other app in the namespace that has no egress
  policy. Out of scope; a policy that selects `app: rfactory` already denies everything it does not list.
- **Four separate policies, as `gateway` has:** same effect, more objects. One policy keeps the list in one place.
- **CFactory MCP through the in-cluster Service:** `core/src/scope.js:64` refuses plain HTTP to it, and #33
  decided to keep the public name.
- **Service-port or named-port rules:** numeric pod ports are what the policy matches, and they are plain to read.
- **A CI test of the policy's effect:** factory-gitops CI has no cluster. `manifest-validate.yml` checks the
  schema; the effect is checked on the live cluster by the script.

## Risks

All on `k3d-factory`. ArgoCD syncs `apps/rfactory` automatically with self-heal
(`apps/rfactory/application.yaml`), so the policy is live minutes after the factory-gitops merge.

- **Sign-in breaks** if rule 2 does not match Keycloak (label or port drift). Seen at once: the token exchange
  fails after login. The check covers it.
- **Desktops and calls break** if rule 3 does not match the runner. The runner's own ingress policy already
  accepts `:8443` from any source, so only this side can be wrong. The check covers it.
- **Answers and the credential refresh break** if the Claude CLI needs something outside rule 4 (a non-443 port
  or a private address). Not expected, and not measured. A failed refresh would only show hours later, when the
  token expires; watch the `rfactory-web` log for a day.
- **A live call drops** if the policy lands mid-call and is wrong. Merge when no call is running.
- **CFactory reads break** if the public name ever resolves to a private address (a split-DNS change). Today
  it does not.
- **Enforcement can lapse.** factory-gitops already probes it: the `netpol-node-probe` CronJob proves egress
  enforcement for task pods in `factory` on `k3d-factory-server-0`, the node RFactory runs on, and it names a
  known failure (kube-router with a stale node address after a restart;
  `apps/netpol-node-probe/manifests/manifests.yaml`). That probe does not cover this policy; the check here does,
  when someone runs it.
- **A wrong policy may not show at once.** Connections that are already open can survive the new policy, so a
  running call or session is not a test. Verification uses fresh ones.
- **Residual:** a compromised pod can still send data to any public host on 443, or through DNS. Accepted in
  decisions 1 and 6.
- **Undo:** revert the factory-gitops commit; ArgoCD prunes the policy. No pod restart is needed either way.

## Verification

1. **factory-gitops CI:** `manifest-validate.yml` (kustomize build and kubeconform) passes on the pull request.
2. **Before the merge:** `deploy/k8s/check-egress.sh --baseline` exits 0: every target connects today.
3. **After the sync:** `kubectl --context k3d-factory -n factory get networkpolicy rfactory-egress` shows the
   policy, and `deploy/k8s/check-egress.sh` exits 0.
4. **By hand, once, each started fresh after the sync:** sign out and in again; run a standup; ask one lookup
   question; approve one write; open a desktop; join one test call and get a spoken answer. Each works.
5. **Next day, after the Claude token has been refreshed:** run a standup again. It answers, and the
   `rfactory-web` and `cred-sync` logs show no credential or connection errors. A quiet log alone is not proof.
6. **This repo:** `shellcheck deploy/k8s/check-egress.sh` is clean.

Steps 2 to 5 need the owner: they run against the live cluster.
