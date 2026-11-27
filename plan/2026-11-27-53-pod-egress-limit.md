---
status: draft
issue: 53
spec: spec/2026-11-27-53-pod-egress-limit.md
coders:
  1: codex   # the check script and its test: small, tricky logic (probe program, exit codes)
  2: coder   # one NetworkPolicy document in factory-gitops, copied from this plan: routine
reviewers:
  - codex    # a fresh read-only session (not step 1's implementer) reviews both diffs against this plan
  - agy      # a second independent read-only review
---

# Plan: enforce an egress limit for the RFactory pod

## Decisions (the approved intent and spec)

- **One new NetworkPolicy, `rfactory-egress`,** in factory-gitops. It selects the whole RFactory pod, so it
  covers all four containers and both init containers. No RFactory code changes.
- **Public hosts** (Anthropic, the public CFactory MCP name, `api.github.com`): any public IPv4 address on
  TCP 443. No host list, no proxy, no CNI change. Host-name pinning through a proxy is a later slice.
- **CFactory MCP** stays on `https://cfactory-mcp.freundcloud.org.uk/mcp`. No scope or code change.
- **In-cluster targets are exact:** DNS to `kube-dns` only (UDP and TCP 53), Keycloak on TCP 8080, the runner
  API on TCP 8443.
- **Accepted residual risk:** a compromised pod can still reach any public host on 443, and can leak through
  DNS. Node traffic is out of scope.
- **Refusal visibility:** the app's own error. No log is added.
- **The check script `deploy/k8s/check-egress.sh` is in this slice.** It has two modes: `--baseline` (before
  the policy, every target must connect) and the default (after the policy, every line must match).
- **The owner merges the factory-gitops PR, with no call running.** Argo CD syncs `apps/rfactory`
  automatically with self-heal, so the policy is live minutes after that merge.
- **The baseline run comes before that merge.**
- **Two repos, two PRs.** This plan covers both, as the #33 plan did. factory-gitops gets no intent, spec or
  plan of its own; its PR links the three files here.

Limits and constraints carried from the intent and spec:

- **IPv4 only.** The pod network is IPv4 only, so there is no IPv6 rule and IPv6 egress stays refused.
- **Rule 4 checks the address and the port, not the protocol.** Anything on TCP 443 to a public address passes.
- **Nothing opens TLS** to public hosts: no interception, no extra CA, no proxy variable in the pod.
- **The code's own pins stay:** redirects refused, the Claude CLI's fixed environment, the settings and
  destination-hash checks. No file under `core/`, `web/`, `bot/` or `desktop/` changes.
- **Loopback traffic inside the pod** is not subject to the policy. Keycloak and the runner (mTLS) stay direct.
- **No secret** in the policy, the script or its output. The probe sends no credential.

What the policy refuses that is open today: the Kubernetes API, every other Service and pod in the cluster
(including CFactory's own Service on `:3111`), the host and the LAN (including `host.k3d.internal`,
`172.18.0.1`), the Tailscale range, link-local addresses, and any public address on a port other than 443.

Facts checked on 2026-11-27 (read-only):

- factory-gitops `origin/main` is `7b27823`. `rfactory-ingress` is `apps/rfactory/manifests/manifests.yaml:46-56`;
  the `---` at `:57` starts the Deployment.
- Live labels match the rules: Keycloak pods carry `app: keycloak` and listen on 8080; CoreDNS pods carry
  `k8s-app: kube-dns`; the runner pod carries `app.kubernetes.io/name: rfactory-runner` and its policy
  `rfactory-runner-api` accepts TCP 8443 from any source. The namespaces carry `kubernetes.io/metadata.name`.
- The Kyverno policy `rfactory-no-protected-netpol` (it forbids `namespaceSelector`) matches only the
  `rfactory-desktops` namespace. It does not touch a policy in `factory`.
- The controls exist: Service `cfactory` on 3111 in `factory`; `host.k3d.internal` resolves to `172.18.0.1`
  through its own CoreDNS block. Whether each one connects from the pod is what the baseline run proves.

## Steps

1. **The check script and its test** (RFactory, new files `deploy/k8s/check-egress.sh` and
   `deploy/k8s/check-egress.test.sh`; one line in `README.md`). Coder: codex.
   - **Header:** `#!/usr/bin/env bash`, `set -euo pipefail`, as `deploy/k8s/bootstrap-secrets.sh:1-2`. Mode `755`.
   - **Options:** no argument, or exactly `--baseline`. Anything else (also a second argument) prints
     `unknown option: …` to stderr and exits 2 (the form at `bootstrap-secrets.sh:12`).
   - **The target table** is one bash array in the script, in this order:

     | Expectation after the policy | Protocol | Host | Port |
     | --- | --- | --- | --- |
     | connects | tcp | `api.anthropic.com` | 443 |
     | connects | tcp | `cfactory-mcp.freundcloud.org.uk` | 443 |
     | connects | tcp | `keycloak.factory.svc` | 8080 |
     | connects | tcp | `rfactory-runner-api.rfactory-desktops.svc` | 8443 |
     | refused | tcp | `kubernetes.default.svc` | 443 |
     | refused | tcp | `cfactory.factory.svc` | 3111 |
     | refused | tcp | `host.k3d.internal` | 11434 |
     | refused | tcp | `1.1.1.1` | 53 |
     | refused | tcp | `1.1.1.1` | 80 |
     | refused | udp | `1.1.1.1` | 53 |

   - **One kubectl call:**
     `timeout 60 kubectl --context "${RFACTORY_KUBE_CONTEXT:-k3d-factory}" -n factory exec deploy/rfactory -c rfactory-web -- node -e "$program" <proto>:<host>:<port> …`.
     No `-i`, no `-t`. The context variable is the one at `bootstrap-secrets.sh:30`. If the call fails or
     hits the 60 second limit, print `cannot run the probe in deploy/rfactory` to stderr and exit 2.
   - **The node program** (a quoted here-document in the script; plain Node 22, no modules beyond `dns`, `net`
     and `dgram`). It takes the targets from `process.argv.slice(1)` (with `node -e` the first target is
     `argv[1]`), probes them all at once, and prints one line per target, in argument order:
     `<proto>:<host>:<port> <result> <reason>`. It always exits 0.
     - **One 5 second limit per target** covers the name lookup and the connection together.
     - **Resolve first:** `dns.lookup(host, { family: 4 })`. A failure, or the limit passing during the lookup,
       is `dns-error`. Use `lookup`, not `resolve`: short names such as `keycloak.factory.svc` need the pod's
       search list.
     - **tcp:** `net.connect` to the resolved address. `connect` is `connects`. An error or the limit is
       `refused`. Destroy the socket. Send nothing.
     - **udp:** send one DNS query (an `A` question for `example.com`, 29 bytes, recursion desired, a random
       ID) with `dgram`. A reply from the target address with the same ID and the response bit set is
       `connects`. An error or no such reply within the limit is `refused`.
     - **`<reason>`** is for the reader only and does not change the verdict: `ok`, the error code
       (`ECONNREFUSED`, `EHOSTUNREACH`, `ENOTFOUND`, …) or `timeout`.
     - **Each probe settles once:** on its first outcome it clears its timer and closes its socket, so the
       program ends by itself when the last probe is done.
     - No credential, no HTTP request, no TLS.
   - **The verdict is in bash,** so the test can drive it. For each table row, find its line in the output:
     - the expected result is the table's, or `connects` for every row with `--baseline`;
     - print `<proto>:<host>:<port> expected=<x> result=<y> (<reason>)` and add ` WRONG` when they differ;
     - a missing line (printed as `result=missing`), a second line for the same target, an unknown result
       or `dns-error` is always wrong;
     - match targets as whole strings (an associative array), not as patterns: `1.1.1.1` has dots;
     - an output line that is no table row, or is malformed, makes the run wrong too.
     Exit 0 when nothing is wrong, else 1.
   - **`check-egress.test.sh`** follows `bootstrap-secrets.test.sh:4-35`: a fake `kubectl` on `PATH` that logs
     its arguments, saves the `-e` program to a file, and prints `$FAKE_OUT`. It asserts:
     - enforced output (4 `connects`, 6 `refused`): default mode exits 0, `--baseline` exits 1;
     - all `connects`: `--baseline` exits 0, default mode exits 1;
     - one `dns-error` on a "refused" row: both modes exit 1;
     - one line missing, one line twice, one extra line: exit 1 each. Fake kubectl exits 1: exit 2.
       `--nope` and `--baseline --baseline`: exit 2 and kubectl was not called;
     - kubectl is called exactly once, with exactly these arguments in order: `--context k3d-factory -n factory
       exec deploy/rfactory -c rfactory-web -- node -e <program>` and then the ten targets in table order.
       `RFACTORY_KUBE_CONTEXT=other` changes only the context;
     - the saved program passes `node --check`;
     - **the probe itself, on loopback only.** A small `node` helper in the test listens on an ephemeral TCP
       port, answers on an ephemeral UDP port (it echoes the query's ID with the response bit set), and
       reserves one more TCP port that it has closed again. The test runs the program the way the pod does,
       `node -e "$(cat <file>)" tcp:127.0.0.1:<open> tcp:127.0.0.1:<closed> udp:127.0.0.1:<udp> tcp:nope.invalid:443`,
       and expects `connects`, `refused`, `connects`, `dns-error`, in that order.
   - **`README.md`,** after the bullet at `:13`: one bullet, "**Check the egress limit:**
     `deploy/k8s/check-egress.sh` (`--baseline` before a policy change). It probes from the pod and changes nothing."
   - **Check:** `bash deploy/k8s/check-egress.test.sh` passes;
     `shellcheck deploy/k8s/check-egress.sh deploy/k8s/check-egress.test.sh` is clean.
   - **Traps:**
     - Do not run `check-egress.sh` against the cluster. The live runs are steps 4 and 6, the owner's, once each.
     - This repo has no root `package.json` and no CI job for shell tests; the test is run by hand, as
       `bootstrap-secrets.test.sh` is.
     - kube-router rejects, so a refused TCP connection usually fails fast (`ECONNREFUSED`), but a timeout
       must count as `refused` too (`deploy/k3d/README.md:222`).
     - A UDP socket gets no error for a rejected packet. Only the timeout ends that probe.
     - **The check's ceiling:** a "refused" row also reads `refused` when its target is simply down (Ollama
       on the host, CFactory). Only the baseline tells the two apart, so steps 4 to 6 run close together.
       The same ceiling is written down for `apps/netpol-node-probe`.
     - The web container has a read-only root file system. The program writes no file.
     - After the edit run `graphify update .` (project rule).

2. **The policy** (factory-gitops, `apps/rfactory/manifests/manifests.yaml`). Coder: coder.
   - **Where:** worktree `/mnt/code/Source-home/GitHub/factory-gitops-wt-53`, branch `feat/53-rfactory-egress`
     from `origin/main`. The lead creates both before this step.
   - **Change:** insert this document after line 56, before the `---` at line 57. Nothing else changes;
     `rfactory-ingress` and `kustomization.yaml` are not touched.

     ```yaml
     ---
     # Egress limit for the RFactory pod (RFactory#53). In-cluster targets are exact: cluster DNS,
     # Keycloak (oauth2-proxy token and keys) and the desktop runner API. A NetworkPolicy cannot
     # match host names, so Anthropic, the public CFactory MCP name and api.github.com are public
     # HTTPS only: TCP 443 to any address except the private, link-local and CGNAT ranges, the
     # same shape as allow-provider-egress in apps/model-gateway. That keeps the Kubernetes API,
     # the node, the LAN and every other Service out of reach. Residual risk, accepted in
     # RFactory#53: a compromised pod can reach any public HTTPS host, and can leak through DNS.
     # Host-name pinning through a proxy is a later slice. Check: RFactory deploy/k8s/check-egress.sh.
     apiVersion: networking.k8s.io/v1
     kind: NetworkPolicy
     metadata: { name: rfactory-egress, namespace: factory, labels: { app: rfactory } }
     spec:
       podSelector: { matchLabels: { app: rfactory } }
       policyTypes: ["Egress"]
       egress:
         - to:
             - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: kube-system } }
               podSelector: { matchLabels: { k8s-app: kube-dns } }
           ports:
             - { protocol: UDP, port: 53 }
             - { protocol: TCP, port: 53 }
         - to:
             - podSelector: { matchLabels: { app: keycloak } }
           ports:
             - { protocol: TCP, port: 8080 }
         - to:
             - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: rfactory-desktops } }
               podSelector: { matchLabels: { app.kubernetes.io/name: rfactory-runner } }
           ports:
             - { protocol: TCP, port: 8443 }
         - to:
             - ipBlock:
                 cidr: 0.0.0.0/0
                 except: [10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 100.64.0.0/10]
           ports:
             - { protocol: TCP, port: 443 }
     ```

   - **Check**, in the worktree:
     - `bash -o pipefail -c 'kustomize build apps/rfactory/manifests | nix run nixpkgs#kubeconform -- -strict -ignore-missing-schemas -verbose -summary -'`
       exits 0, and its output has the line `NetworkPolicy rfactory-egress is valid` (so the policy was
       checked, not skipped);
     - `bash -o pipefail -c "kustomize build apps/rfactory/manifests | grep -c '^kind: NetworkPolicy$'"` prints `2`;
     - `git diff --stat origin/main` shows one file, additions only.
   - **Traps:**
     - In rules 1 and 3 the `podSelector` is a key of the **same** list item as the `namespaceSelector` (no
       second `-`). A second `-` would allow every pod in that namespace **or** every `kube-dns`-labelled pod
       in `factory`.
     - Ports are the pods' ports. Do not use the runner's NodePort `31843`.
     - Read only `origin/main` of factory-gitops. Other worktrees of that repo hold unrelated work.
     - No `kubectl apply`, no `--dry-run=server`, no Argo CD sync. The merge is the deploy, and it is the owner's.
     - `manifest-validate.yml` has no path filter: every job runs on this PR.

3. **Review, commit and open both PRs** (lead).
   - Review both diffs against this plan: a fresh Opus agent, Codex and agy, in parallel, read-only.
   - Re-run the checks of steps 1 and 2, and `bash deploy/k8s/bootstrap-secrets.test.sh` (unchanged, must
     still pass). Commit each repo on its branch.
   - **RFactory PR:** links the intent, spec and plan; says codex did step 1 and coder did step 2.
   - **factory-gitops PR:** links the same three files and RFactory#53. Its body says in the first line:
     "Do not merge before the baseline run (RFactory#53 plan, step 4). Owner merges, with no call running."
     `manifest-validate.yml` must be green.
   - Traps: neither PR is merged in this step. No call, no cluster change.

4. **Baseline, one run** (owner; before any merge of the factory-gitops PR).
   - From the RFactory branch: `deploy/k8s/check-egress.sh --baseline`. It must exit 0: all ten lines `connects`.
   - **If a line is wrong, stop.** The policy is not merged.
     - One of the four "connects" rows is wrong: the pod cannot reach something it needs today. Diagnose
       that first; the row is not replaced.
     - One of the six "refused" rows is wrong: that control proves nothing. The lead replaces it in the
       script (a deviation, recorded here), and the changed script gets its own single baseline run.
   - Post the output on #53. Then the RFactory PR merges. Steps 5 and 6 follow the same day.

5. **Merge the policy** (owner).
   - Confirm no call is running. Merge the factory-gitops PR. Start no call until step 6 has passed.
   - Wait for Argo CD: `kubectl --context k3d-factory -n factory get networkpolicy rfactory-egress` shows it.
   - Then wait one more minute. The object existing does not prove kube-router has written its rules, and
     step 6 is one run.

6. **Enforced check, one run** (owner, right after step 5).
   - `deploy/k8s/check-egress.sh` exits 0.
   - **If it fails, roll back at once** (see Rollback), then post the output on #53. Do not re-run to "see if
     it settles".
   - Where to look, by line: a "connects" line that reads `refused` is most likely a selector or port that
     does not match. A "refused" line that reads `connects` means the policy is not enforced for that path;
     one known cause is the stale kube-router node address that `apps/netpol-node-probe` describes.

7. **By hand, once, each started fresh after step 6** (owner). Open connections can survive a new policy, so
   a session or call from before the merge proves nothing.
   - Sign out and in again. Run a standup. Ask one lookup question. Approve one write. Open a desktop.
     Join one test call and get a spoken answer.
   - Any failure: roll back, then report on #53.

8. **Next day, once** (owner), after the Claude token has been refreshed.
   - Ask one lookup question. It gets an answer from Claude. The spec names a standup here, but a standup
     makes no AI call (`README.md:31`), so it cannot prove the refresh; the lookup can.
   - `kubectl --context k3d-factory -n factory logs deploy/rfactory -c rfactory-web --since=24h` and the same
     for `-c cred-sync` show no credential or connection errors. A quiet log alone is not proof; the answer is.
   - If the lookup fails with a credential or connection error: roll back, then report on #53.
   - Otherwise post the result on #53 and close it.

## Tests

| Repo | Command | Expected |
| --- | --- | --- |
| RFactory | `bash deploy/k8s/check-egress.test.sh` | passes |
| RFactory | `shellcheck deploy/k8s/check-egress.sh deploy/k8s/check-egress.test.sh` | clean |
| RFactory | `bash deploy/k8s/bootstrap-secrets.test.sh` | unchanged, passes |
| factory-gitops | `kustomize build apps/rfactory/manifests \| nix run nixpkgs#kubeconform -- -strict -ignore-missing-schemas -summary -` | valid |
| factory-gitops | CI `manifest-validate.yml` on the PR | green |
| live, owner, once | `deploy/k8s/check-egress.sh --baseline` (step 4) | exit 0 |
| live, owner, once | `deploy/k8s/check-egress.sh` (step 6) | exit 0 |
| live, owner, once | the by-hand list (step 7) and the next-day lookup (step 8) | each works |

No `core`, `web`, `bot` or `desktop` test changes: no code there is touched.

## Rollback

- **The policy:** revert the factory-gitops commit and merge the revert. Argo CD prunes `rfactory-egress`
  within minutes. No pod restart is needed in either direction.
- **Recovered when:** `kubectl --context k3d-factory -n factory get networkpolicy rfactory-egress` answers
  `NotFound`, and a fresh sign-in works.
- **Deleting the policy by hand does not help:** self-heal puts it back. The revert is the only undo.
- **The script:** it changes nothing in the cluster. Leaving it in place is harmless.
- **No data migration:** nothing is stored.
