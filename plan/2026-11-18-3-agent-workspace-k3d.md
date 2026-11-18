---
status: draft
issue: 3
spec: spec/2026-11-18-3-agent-workspace-k3d.md
coders:
  k2: coder    # Nix guest conversion: kernel boot, erofs disk, DHCP, outbound channels
  k3: codex    # small tricky logic: paused-start ordering, identity by pod UID, Lease
  k4: codex    # small tricky logic: policy generation, contained excepts, protected ranges
  k5: codex    # small tricky logic: per-veth nft bridge rules with kernel timeouts, quota
  k6: codex    # small tricky logic: CONNECT/SNI, resolve-check-connect, UID binding
  k7: coder    # reaper: list, compare, delete
  k8: coder    # Kubernetes manifests and Kyverno policies, declarative
  k9: coder    # profiles on PVCs, guarded first-time format
  k12: coder   # verification scripts re-pointed to the cluster
  k13: coder   # removal of the host layer once k3 to k5 pass
reviewers:
  - codex      # read-only second review of each step's diff and of the whole branch (agy out of use, #2748)
---

# Plan: desktops as KubeVirt VMs in the k3d cluster (#3, revision)

Each desktop is a KubeVirt VM in the k3d `factory` cluster on p620, in the
namespace `rfactory-desktops`. A runner Deployment is the only thing that
creates them, and a guard per node enforces each VM's network. Everything
the approved #3 plan built above the host layer stays: the guest agent,
the call worker, handover and the approval queue, the share, profiles, the
live view, the web routes, Teams (deviation 26) and the scripts. This plan
is self-contained.

## Decisions carried over from the approved spec revision

- **Shape:**
  - KubeVirt, pinned, installed by ArgoCD from `factory-gitops`, with KVM
    only (never `useEmulation`).
  - A runner Deployment with the existing HTTP API and mTLS.
  - The guest is our NixOS system, booted with `kernelBoot` and a
    read-only erofs `containerDisk`. All writes go to tmpfs in guest
    memory, 4 GiB in total.
  - Images are imported with `k3d image import` and pinned by digest.
- **Desktop guard** DaemonSet (`hostNetwork`, `NET_ADMIN`) in
  `rfactory-desktops`. It touches only desktop pods' traffic and does
  anti-spoofing, the startup gate, bandwidth (20 Mbit/s), the 1 GiB
  quota and the runner-loss cut. Kyverno allows `hostNetwork` for it
  alone.
- **Network:**
  - NetworkPolicy default deny in the namespace, with one policy per
    desktop.
  - Web traffic goes only through an egress proxy (CONNECT with matching
    SNI, resolve once, check, connect to the checked address; its own
    egress policy).
  - Media goes direct to the pinned Meet, Zoom, Teams and Slack ranges.
  - Generated `except` blocks only where contained, and every manifest is
    server-side dry-run validated.
- **Lifecycle:**
  - Policy and proxy entry are created first, then the VMI paused; it is
    unpaused only after the guard's gate.
  - A separate reaper deletes desktops on a stale runner Lease (60 s) or
    past the runtime limit (3 h).
  - The runner deletes unknown labelled VMIs at start.
  - A ResourceQuota caps the namespace at `maxDesktops`.
- **Profiles:** a filesystem PVC holding one raw `disk.img`, with LUKS
  opened in the guest using a per-profile key, metadata in a ConfigMap,
  and one VMI per profile.
- **Exposure:** a NodePort Service, plus `k3d node edit
  k3d-factory-serverlb --port-add 127.0.0.1:<port>:<nodeport>`, mTLS
  only, bound on loopback.
- **Kyverno**, in `rfactory-desktops` with `failurePolicy: Fail`: no
  NetworkPolicy may allow a protected range; no `hostNetwork` or
  `privileged` except the guard; signatures or pinned digests for the
  runner, proxy, guard, reaper and guest images.
- **Removed:** the NixOS runner module and sample host, vsock bridges and
  the CID oneshot, per-VM `microvm-run` copies, and the p620 NixOS change.

## Deviations from the spec revision (Codex re-check, for approval with this plan)

1. **Channels are guest-initiated; the guest has no listeners.** The spec
   had the guest listening on 5000 and 5900, but masquerade preserves the
   runner's pod IP inbound, so a gateway-only firewall would block it.
   Instead:
   - The guest dials the runner's Service on a **fixed ClusterIP**
     (`spec.clusterIP` pinned in the manifest, passed to the guest as a
     `kernelBoot` kernel argument): 5000 control, 5001 heartbeat, and
     5900 VNC through `x11vnc -connect` (reverse VNC).
   - The guest firewall drops all inbound traffic.
   - The runner accepts a connection only from the source IP of a launcher
     pod it created, and maps it to that pod's UID. The guard's
     anti-spoofing makes the source IP trustworthy.
   - The guard and the desktop's NetworkPolicy allow exactly that
     ClusterIP and those ports, matched after kube-proxy's DNAT (the
     destination is the runner pod).
2. **The guard enforces the whole allowlist; there is no namespace
   probe.** The spec had the guard prove connections from inside the
   pod's network namespace, which needs `CAP_SYS_ADMIN` and `setns`, and a
   protected-address canary could pass before kube-router acts. Instead,
   per desktop the guard writes an nft **bridge-family** table on that
   pod's veth:
   - anti-spoofing;
   - allow only the runner endpoints, the proxy, the desktop's media
     ipBlocks and its approved previews;
   - drop everything else.

   The veth is found without entering the pod's network namespace: the
   pod IP's neighbour MAC on `cni0`, then the bridge fdb port. The startup
   gate is "the guard read back its table for this pod UID". NetworkPolicy
   is a second, independent layer, and the gate does not depend on it.
3. **Permissions expire in the kernel, not in the guard process.** Every
   allow rule matches a per-desktop nft set element `alive`. That element
   carries a kernel **timeout**: 60 s, or 5 s while a share is active. The
   runner's heartbeat to the guard refreshes it (every 10 s, or every 2 s
   while sharing). A second element, `deadline`, has a 3 h timeout set
   once at creation. If the guard crashes or hangs, or the API is
   partitioned, the elements expire and the desktop's table drops
   everything. On start, the guard removes tables for pod UIDs that are
   not live desktops.
4. **A profile disk is formatted only when it is provably new.** Formatting
   happens only when all three hold:
   - the profile's ConfigMap says `initialized: false`;
   - the disk serial equals the profile id;
   - the first 16 MiB are all zero.

   After a format the runner sets `initialized: true`. An initialized
   profile without a LUKS header fails closed and is never formatted.
5. **Explicit RBAC**, all in `rfactory-desktops`:
   - **runner:**
     - `kubevirt.io/virtualmachineinstances`: create, get, list, watch,
       delete;
     - `subresources.kubevirt.io/virtualmachineinstances/unpause`:
       update;
     - `networking.k8s.io/networkpolicies`: create, get, list, delete;
     - core `persistentvolumeclaims`: create, get, list, delete;
     - core `configmaps`: create, get, list, update, delete;
     - core `pods`: get, list, watch;
     - `coordination.k8s.io/leases`: get, create, update, on
       `resourceNames: [rfactory-runner]`.
   - **reaper:**
     - leases: get;
     - VMIs: list, delete;
     - networkpolicies and configmaps: list, delete.
   - **guard:**
     - pods: list, watch;
     - configmaps: get, list, watch.
6. **KubeVirt creates the blank `disk.img`.** `local-path` is
   `WaitForFirstConsumer`, so the runner cannot write into a new PVC.
   KubeVirt creates the image at first attach (filesystem PVC, size
   given), and deviation 4 governs the first format.
7. **Cleanup on every path; identity by pod UID.**
   - Each desktop's NetworkPolicy, proxy-entry ConfigMap and guard-entry
     ConfigMap carry an `ownerReference` to its VMI, so deleting the VMI
     by any path (runner, reaper or manual) garbage-collects them.
   - The proxy and the guard key entries by launcher pod UID, and resolve
     a source IP to a UID through a pod watch. A reused IP with another
     UID gets nothing.
8. **Two kinds of protected ranges.**
   - **Always protected**, never allowed:
     - the node network `172.18.0.0/16`;
     - the pod CIDR `10.42.0.0/16` and service CIDR `10.43.0.0/16`,
       except the runner and proxy endpoints;
     - p620's LAN and Tailscale addresses;
     - the Factory hosts;
     - `169.254.169.254`;
     - every other desktop.
   - **Private by default:** RFC1918 outside those, CGNAT, ULA and
     link-local. Here an admin-approved exact `ip:port` for one scope may
     be allowed, in the policy, the guard and the proxy.

## Steps

All live steps (k1, k10, k11, k14) are mine and owner-gated on p620, with
an agent-bus notice first. Coders never run `kubectl apply`, `k3d`,
`podman`, `nix build` or ArgoCD syncs.

1. **k1. Gate (mine, owner OK).** Add `apps/kubevirt` to `factory-gitops`,
   as a PR the owner merges: the KubeVirt operator and CR at the newest
   stable release, pinned by version and image digest, with no
   `useEmulation`.
   - Build the guest's kernel-boot container and erofs `containerDisk`
     (k2's outputs) and `k3d image import` them.
   - Boot one probe VMI paused, apply a hand-written guard table (k5's
     rule builder output), and unpause.
   - → verify:
     - `kubectl get kubevirt` reports Deployed;
     - the launcher has `/dev/kvm` and the domain uses KVM;
     - from the probe, every always-protected range fails over TCP and
       UDP;
     - a spoofed source is dropped (the counter rises);
     - Meet's range and the proxy port are reachable;
     - a guest file marker is absent from the node after a forced delete.

   Any failure stops this revision, and the owner is told.
   Traps: never touch other namespaces' resources; KubeVirt's namespace
   is `kubevirt`.
2. **k2. Guest for KubeVirt.** Create `desktop/guest/kubevirt.nix`, which
   imports `default.nix`. Outputs: a kernel-and-initrd container image
   and an erofs root `containerDisk`, both exported from `flake.nix`.
   - Guest settings:
     - DHCP on the masquerade NIC;
     - DNS only at the proxy's resolver (a kernel argument);
     - inbound firewall drops everything;
     - the agent dials `<runner ClusterIP>:5000` and the heartbeat dials
       `:5001` (a kernel argument replaces vsock);
     - x11vnc reverse-connects to `:5900`;
     - tmpfs for every writable path, 4 GiB in total;
     - root read-only.
   - The agent's transport (`desktop/guest/agent/index.js`, `hostLink`)
     becomes TCP to the runner, keeping framing and protocol.
   - → verify: `nix eval` of both outputs' drvPaths; the agent tests pass
     with a TCP fake runner.

   Traps: no secret in the image; keep one call worker per VM (deviation
   24).
3. **k3. Runner Kubernetes backend.** Create `desktop/runner/k8s.js`, a
   minimal client using the in-cluster ServiceAccount token over fetch.
   It covers VMIs, unpause, NetworkPolicies, ConfigMaps, PVCs, pods and
   the Lease.
   - `lifecycle.js` swaps the systemd, tap and vsock backend for it,
     keeping its rules:
     - create order: policy, proxy entry, guard entry, VMI paused, wait
       for the guard's ready, unpause;
     - identity by launcher pod UID;
     - channels accepted on 5000, 5001 and 5900 only from known launcher
       IPs;
     - the Lease renewed every 10 s;
     - the guard heartbeat sent per desktop, every 2 s while sharing;
     - reconcile at start.
   - `runner.js` `main()` reads in-cluster config.
   - → verify: `(cd desktop && node --test)` with a fake API server; the
     existing lifecycle tests are kept, plus paused-start ordering, an
     unknown source IP refused, a reused IP with a new UID refused, and
     reconcile.

   Traps: never trust a guest-supplied id; argv-free.
4. **k4. Policy generator.** Create `desktop/runner/k8s-policy.js`. It
   builds the desktop NetworkPolicy:
   - egress to the runner and proxy pods, the platform media ipBlocks and
     approved previews;
   - an `except` only when contained;
   - an always-protected preview refused.

   The proxy and guard ConfigMap bodies come from the same inputs.
   → verify: unit tests, including a schema check of every generated
   manifest against the NetworkPolicy shape; k1 runs a server-side dry
   run.
   Traps: IPv6 and IPv4 both; never emit a rule allowing an
   always-protected range.
5. **k5. Desktop guard.** Create `desktop/guard/guard.js`, the DaemonSet
   program. Its pieces:
   - **Find each desktop pod's veth:** watch the pods with the desktop
     label on this node; read the guard ConfigMap by owner pod UID; find
     the veth from the neighbour MAC on `cni0` and the bridge fdb.
   - **Write one nft bridge table per pod UID:** anti-spoofing; allow
     rules gated on the `alive` and `deadline` set elements with kernel
     timeouts (deviation 3); the always-protected drop; drop by default;
     counters.
   - **Apply limits:** `tc` at 20 Mbit/s; cut at 1 GiB, reported to the
     runner.
   - **Serve the runner:** an HTTP endpoint (mTLS, runner only) for
     heartbeats and ready.
   - **On start:** remove stale tables.

   → verify: unit tests of the rule text and the veth lookup with fake
   `ip`, `bridge` and `nft` output.
   Traps: argv arrays; touch only tables named `rfdesk_<uid>`; never
   flush other tables.
6. **k6. Egress proxy.** Create `desktop/proxy/proxy.js`:
   - CONNECT only, with the SNI read from the ClientHello and required to
     equal the CONNECT host;
   - plain HTTP only for an approved private preview;
   - allowlist per source pod UID;
   - resolve once, check every address against the protected ranges,
     connect to the checked address;
   - a DNS responder that answers only allowlisted names.

   → verify: unit tests for SNI mismatch, a name resolving into a
   protected range, a reused IP with a new UID, and an unknown source.
   Traps: no external dependency for TLS parsing beyond reading the SNI.
7. **k7. Reaper.** Create `desktop/reaper/reaper.js`. Every 10 s it
   deletes labelled VMIs when the runner Lease is older than 60 s, or when
   the VMI is older than 3 h.
   → verify: unit tests with a fake API.
8. **k8. Manifests.** Create `deploy/k8s/rfactory-desktops/`:
   - the namespace;
   - RBAC per deviation 5;
   - the runner, proxy and reaper Deployments and the guard DaemonSet,
     with digest-pinned images, `runAsNonRoot` except the guard, and
     resource limits;
   - the runner Service: fixed ClusterIP, NodePort;
   - the default-deny NetworkPolicies and the ResourceQuota;
   - the Kyverno ClusterPolicies scoped to the namespace;
   - an ArgoCD Application for `factory-gitops` pointing at this path
     (the owner merges it).

   → verify: `kubectl apply --dry-run=client -f` for every file (no
   cluster contact), and a test that the Kyverno policies name only this
   namespace.
9. **k9. Profiles on PVCs.**
   - `desktop/runner/profiles.js` creates a PVC and a ConfigMap
     (`initialized: false`), attaches the PVC as a disk with serial
     `<profile id>`, and keeps the lock and expiry.
   - `desktop/guest/agent/profile.js` formats only under deviation 4.

   → verify: unit tests, including an initialized profile without a
   header failing closed and a second attach refused.
10. **k10. Images (mine).** Build the runner, guard, proxy, reaper and
    guest images on p620 with the owner's OK, `k3d image import`, and
    record the digests in the manifests.
11. **k11. Deploy and exposure (mine, owner OK, agent bus first).**
    - ArgoCD syncs `rfactory-desktops`.
    - `k3d node edit k3d-factory-serverlb --port-add
      127.0.0.1:<port>:<nodeport>`.
    - Put the runner's client cert, key and CA in
      `~/.config/rfactory/desktop-runner/` (generated, never printed).
    - `deploy/pod.sh up` with `RFACTORY_DESKTOP=1` and the runner URL.

    → verify: `ss -ltn` shows the port on `127.0.0.1` only; `GET /list`
    over mTLS answers.
12. **k12. Scripts.** Re-point `desktop/verify/*.sh`:
    - `net.sh` runs from a probe VMI and includes the startup, spoofing,
      guard-loss (kill the guard: egress cut within 60 s) and proxy
      checks;
    - `lifecycle.sh` adds runner loss and the reaper;
    - `profiles.sh` uses PVCs;
    - `capacity.sh` uses the quota.

    → verify: `shellcheck`, `bash -n`, and every check name appearing
    once.
13. **k13. Remove the host layer** after k3 to k5 pass:
    - `desktop/nixos/` and its flake exports;
    - the vsock code (`vsock.js`, the CID oneshot);
    - `net.js`'s host-only parts (the rule builder moves into the guard);
    - the per-VM `microvm-run` rewriting;
    - `desktop/gate/`, which stays in git history.

    → verify: all suites pass; `grep -rn vsock desktop/` finds only
    history notes.
14. **k14. Review and live (mine).**
    - A fresh Opus review and a Codex review of the diff against this
      plan.
    - Then step 17's checklist on p620 with the owner present, including
      a Meet call and a Teams call from a desktop VMI, handover, an
      approved share and Stop.
    - Measure CPU, RAM and start-up time.
    - Write `desktop/RESULTS.md`.

## Tests

```bash
(cd core && npm test)
(cd web && npm test)
(cd desktop && RF_TEST_CHROME=/etc/profiles/per-user/olafkfreund/bin/google-chrome-stable node --test)
(cd bot && RF_TEST_CHROME=/etc/profiles/per-user/olafkfreund/bin/google-chrome-stable RFACTORY_REQUIRE_BROWSER=1 npm test)
shellcheck deploy/*.sh desktop/verify/*.sh
for f in deploy/k8s/rfactory-desktops/*.yaml; do kubectl apply --dry-run=client -f "$f"; done
! grep -rn innerHTML web/public --include=*.js --exclude-dir=vendor
```

All pass with 0 skipped. Then k1's gate and k14's checklist on p620.

## Rollback

- Delete the ArgoCD Applications `rfactory-desktops` and `kubevirt`
  (KubeVirt's CR first, so its operator removes its pods), and remove the
  serverlb port with `k3d node edit --port-delete`.
- Deploy the pod without `RFACTORY_DESKTOP`.
- Nothing on p620's NixOS config changes, so there is nothing to roll
  back there.
- The host-layer code remains in git history if the host design is needed
  again.
