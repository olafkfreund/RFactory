---
status: approved
issue: 3
spec: spec/2026-11-18-3-agent-workspace-k3d.md
coders:
  k2: coder    # Nix guest conversion: kernel boot, erofs disk, DHCP, outbound channels, proxy auth
  k3: codex    # small tricky logic: paused-start ordering, identity by pod UID, Lease, reverse VNC
  k4: codex    # small tricky logic: policy generation, contained excepts, protected ranges
  k5: codex    # small tricky logic: bridge mark plus inet rules, kernel timeouts, shared quota
  k6: codex    # small tricky logic: CONNECT/SNI, resolve-check-connect, per-desktop token
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
stored preview login, the live view, the web routes, Teams (deviations 26
and 27) and the scripts. This plan is self-contained.

## Decisions carried over from the approved spec revision

- **Shape:**
  - KubeVirt installed by ArgoCD from `factory-gitops`, with KVM only
    (never `useEmulation`).
  - A runner Deployment keeping the existing HTTP API and mTLS.
  - The guest is our NixOS system, booted with `kernelBoot` and a
    read-only erofs `containerDisk`. All writes go to tmpfs in guest
    memory, 4 GiB in total.
  - Images are imported with `k3d image import` and pinned by digest.
- **Desktop guard** DaemonSet (`hostNetwork`, `NET_ADMIN`). It touches
  only desktop pods' traffic and does anti-spoofing, the startup gate,
  20 Mbit/s, the 1 GiB quota and the runner-loss cut. Kyverno allows
  `hostNetwork` for it alone.
- **Network:**
  - NetworkPolicy default deny, with one policy per desktop.
  - Web traffic goes only through an egress proxy (CONNECT with matching
    SNI, resolve once, check, connect to the checked address, its own
    egress policy).
  - Media goes direct to the pinned Meet, Zoom, Teams and Slack ranges.
  - `except` blocks only where contained; server-side dry-run validation.
- **Lifecycle:**
  - A paused start, unpaused only after the guard's gate.
  - A separate reaper acts on a stale runner Lease (60 s) or the runtime
    limit (3 h).
  - Reconcile at runner start; a ResourceQuota caps the namespace at
    `maxDesktops`.
- **Profiles:** a filesystem PVC with one raw `disk.img`, LUKS opened in
  the guest with a per-profile key, metadata in a ConfigMap, and one VMI
  per profile.
- **Exposure:** a NodePort plus `k3d node edit k3d-factory-serverlb
  --port-add 127.0.0.1:<port>:<nodeport>`, mTLS only.
- **Kyverno**, in `rfactory-desktops` with `failurePolicy: Fail`: no
  NetworkPolicy may allow a protected range; `hostNetwork` or
  `privileged` only for the guard; signatures or pinned digests for every
  image there.
- **Removed:** the NixOS runner module and sample host, vsock and the CID
  oneshot, per-VM `microvm-run` copies, and the p620 NixOS change.

## Deviations from the spec revision (Codex re-check and plan review, for approval with this plan)

1. **Channels are guest-initiated; the guest has no listeners.**
   - The guest dials the runner Service at a **fixed ClusterIP** (pinned
     `spec.clusterIP`, passed as a `kernelBoot` kernel argument): 5000
     control, 5001 heartbeat, and 5900 VNC with `x11vnc -connect
     <ip>:5900 -rfbport 0`, so x11vnc opens no listening port.
   - The guest firewall drops all inbound traffic.
   - The runner accepts a connection only from a launcher pod IP it
     created, and maps it to that pod's UID.
2. **The guard: a bridge-family mark, then inet-family rules.** Native
   bridge filtering sees the Service ClusterIP before kube-proxy's DNAT,
   and routed traffic leaves the bridge layer. So per desktop the guard
   writes two tables, named by pod UID:
   - **bridge `rfdesk_<uid>`**, at `prerouting`, `iifname <veth>`:
     - drop any frame whose source MAC or IPv4/IPv6 source is not the
       pod's;
     - ARP only for the pod's own IP;
     - set `meta mark` to the desktop's mark.
   - **inet `rfdesk_<uid>`:**
     - `forward` at filter priority, after kube-proxy's NAT at
       `prerouting -100`;
     - `input`, for traffic to the bridge gateway or the node itself,
       which drops everything for that mark.
   - The inet rules match `meta mark` and are ordered:
     1. drop unless the `alive` and `deadline` elements exist
        (deviation 3);
     2. the shared 1 GiB `quota` object, over the limit → drop;
     3. the always-protected drop;
     4. allow:
        - `ct original ip daddr` equal to the runner's ClusterIP on 5000,
          5001 or 5900;
        - the proxy pod's port;
        - the media ipBlocks;
        - approved previews;
     5. `ct state established,related` accept;
     6. drop.

     Return traffic is matched by the conntrack zone of the same mark.
   - The veth is found from the pod IP's neighbour MAC on `cni0`, then
     the bridge fdb port. The guard retries five times, 1 s apart. A
     missing or ambiguous match keeps the VMI paused and reports
     `guard-no-veth`.
   - The startup gate is "the guard read back both tables for this pod
     UID". NetworkPolicy is a second, independent layer. The k10b gate
     proves on the live cluster that the mark survives from the bridge
     to the IP layer with `br_netfilter` off (`cni0` reports
     `nf_call_iptables 0`).
3. **Permissions expire in the kernel.**
   - The `alive` element of a per-desktop set has a timeout: 60 s, or
     5 s while a share is active.
   - The runner's heartbeat to the guard refreshes it with `nft delete
     element` plus `add element … timeout`, since a duplicate `add` does
     not reset the expiry. It runs every 10 s, or every 2 s while
     sharing.
   - `deadline` (3 h) is added once.
   - On start the guard keeps existing tables (it never re-adds
     `deadline`) and removes tables for UIDs that are not live desktops.
   - A crashed or hung guard, runner or API lets the elements expire,
     and rule 1 then drops everything, established flows included.
4. **A profile disk is formatted only when it is provably new:** its
   ConfigMap says `initialized: false`, the disk serial equals the
   profile id, and the first 16 MiB are zero. After a format the runner
   sets `initialized: true`. An initialized profile without a LUKS header
   fails closed and is never formatted.
5. **RBAC**, all in `rfactory-desktops`:
   - **runner:**
     - `kubevirt.io/virtualmachineinstances`: create, get, list, watch,
       delete;
     - `subresources.kubevirt.io/virtualmachineinstances/unpause`:
       update;
     - `networking.k8s.io/networkpolicies`: create, get, list, delete;
     - core `persistentvolumeclaims`: create, get, list, delete;
     - core `configmaps`: create, get, list, update, delete;
     - core `pods`: get, list, watch;
     - `coordination.k8s.io/leases`: get, update, on `resourceNames:
       [rfactory-runner]`. The Lease is created by the manifests.
   - **reaper:**
     - leases: get, on `resourceNames: [rfactory-runner]`;
     - VMIs: list, delete.

     Owned objects are garbage-collected (deviation 7).
   - **guard:**
     - pods: list, watch;
     - configmaps: get, list, watch.
   - **proxy:**
     - pods: get, list, watch;
     - configmaps: get, list, watch.
6. **KubeVirt creates the blank `disk.img`** in a filesystem PVC
   (`local-path` is `WaitForFirstConsumer`). Deviation 4 governs the first
   format.
7. **One creation order, ownership, and identity:**
   1. create the VMI with `startStrategy: Paused`;
   2. read its UID; wait for its launcher pod (UID, IP);
   3. create the NetworkPolicy, the proxy-entry ConfigMap and the
      guard-entry ConfigMap, each with an `ownerReference` to the VMI;
   4. wait for the guard's ready;
   5. unpause.

   Any failure deletes the VMI, which garbage-collects the rest.
   Deleting the VMI by any path (runner, reaper or manual) removes all of
   it.

   **The proxy needs a per-desktop credential.** The runner generates a
   random token at step 3, stores it in the proxy-entry ConfigMap and
   sends it to the guest in `call-config`. Both guest Chromes use it as
   proxy credentials (`--proxy-server` plus Playwright's `proxy` option).
   The proxy accepts a connection only with a token whose entry's pod UID
   and IP match the source. A stale watch cannot grant anything, because
   a new pod at a reused IP does not hold the old token.
8. **Two kinds of protected ranges.**
   - **Always protected:**
     - the node network `172.18.0.0/16`;
     - the pod CIDR `10.42.0.0/16` and service CIDR `10.43.0.0/16`,
       except the runner ClusterIP and proxy endpoints;
     - p620's LAN and Tailscale addresses;
     - the Factory hosts;
     - `169.254.169.254`;
     - every other desktop.
   - **Private by default:** RFC1918 outside those, CGNAT, ULA and
     link-local. An admin-approved exact `ip:port` for one scope may be
     allowed there.
9. **Profiles survive a rollback.**
   - The namespace is created outside the ArgoCD Application, with
     `argocd.argoproj.io/sync-options: Delete=false`, so deleting the app
     never deletes the namespace.
   - Profile PVCs use a StorageClass `rfactory-profiles` (the `local-path`
     provisioner, `reclaimPolicy: Retain`).
   - Profile ConfigMaps carry `argocd.argoproj.io/compare-options:
     IgnoreExtraneous` and are never in Git, so ArgoCD never prunes them.
10. **The KubeVirt release must support Kubernetes 1.31.** k1a pins the
    newest KubeVirt release whose published support matrix includes
    Kubernetes 1.31.5, recorded with the matrix link and image digests.
    A cluster upgrade is out of scope.
11. **Packet path, final form (Codex's re-check of e7238c6, after
    approval; it replaces the rule details of deviation 2).**
    - **Placement:**
      - Desktop VMIs run only on `k3d-factory-agent-0` (a nodeSelector).
      - The runner and the proxy run only on `k3d-factory-server-0`
        (nodeSelector, plus anti-affinity with desktops).
      - The proxy is also reached through a fixed ClusterIP, passed as a
        kernel argument like the runner's.

      So every legitimate desktop flow is **routed** through the
      gateway, and never bridged to a same-node pod.
    - **Bridge table** per desktop:
      - `prerouting`, `iifname <veth>`: anti-spoofing (MAC, IPv4 and
        IPv6 source), and ARP only for the pod's own IP;
      - `forward`, `iifname <veth>` and `oifname <veth>`: drop all IP.
        Nothing a desktop needs is bridged, so same-node pod traffic
        cannot bypass the inet rules.
    - **Inet table** per desktop, with no packet mark. The bridge
      anti-spoofing guarantees the source.
      - `forward`, egress, `ip saddr <podIP>` (and IPv6), in this order:
        1. `alive` and `deadline` present, else drop;
        2. the shared quota, over the limit → drop;
        3. accept `ct original ip daddr` equal to the runner ClusterIP
           on 5000, 5001 or 5900, or the proxy ClusterIP on its port;
        4. the always-protected drop;
        5. accept the media ipBlocks and approved previews;
        6. drop.
      - `forward`, ingress, `ip daddr <podIP>`:
        1. `alive` and `deadline` present, else drop;
        2. `ct state established,related` accept;
        3. drop.

        Replies are identified by conntrack state and destination; no
        zone or mark is needed.
      - `input`, `ip saddr <podIP>`: drop (nothing on the node itself is
        for desktops).
    - **Proxy token transport:**
      - `desktop/runner/protocol.js` `call-config` gains `proxy: {addr,
        token}`, in k3;
      - the guest handler passes it to the call worker and the control
        Chrome, both launched with the proxy and credentials, in k2;
      - a test shows both Chromes are given them.
    - **Order:** `net.sh`'s k10b checks are written in k12, which now runs
      before k10.
    - k10b adds one check: a desktop cannot reach a pod on its own node
      by pod IP.

12. **The cluster is upgraded first (owner decision, 2026-11-18); this
    replaces deviation 10.**
    - KubeVirt's support matrix lists only 1.7–1.9 as maintained, for
      Kubernetes 1.34–1.36. The cluster's k3s 1.31.5 is end of life; the
      only KubeVirt tested on it is 1.6, which no longer gets fixes.
    - The owner chose to upgrade the cluster first, as
      olafkfreund/nixos_config#3071 through that repo's own artifact
      workflow.
    - **k1a waits for it.** k1a then pins the newest maintained KubeVirt
      that supports the upgraded Kubernetes.
    - The offline steps (k2–k9, k12, k13) go ahead meanwhile.
13. **k4 results (Codex, lead verified).**
    - `desktop/runner/k8s-policy.js` builds the VMI-owned NetworkPolicy,
      the proxy entry and the guard entry from one input.
    - The policy also allows TCP and UDP 53 to the proxy pods, for the
      guest's only resolver.
    - A media block that lies wholly inside a protected range is
      dropped. `except` lists only the protected ranges contained in a
      block.
    - The guard entry still carries a `mark` field, which deviation 11
      no longer uses; k5 ignores it.
    - Callers (k3) must pass the host-specific always-protected ranges:
      p620's LAN and Tailscale addresses, and the Factory hosts.
14. **k5 results (Codex, lead verified).**
    - `desktop/guard/guard.js` writes the deviation 11 tables per pod UID
      and keeps existing tables on start (so `deadline` is never reset).
      It removes stale `rfdesk_<uid>` tables only, and reports ready only
      after reading both tables back.
    - It serves a runner-only mTLS endpoint.
    - Rate limiting is `tc` ingress policing at 20 Mbit/s on the veth
      (the pod's egress).
    - Reconcile also runs every 10 s, to cover missed watch events.
    - `desktop/guard/package.json` exists so `node --test guard/`
      resolves.
    - The lead made each `alive` refresh one `nft -f` transaction (delete
      plus add), so the element is never absent in between. An expired
      element makes the transaction fail, so the cut stands.
    - k8 must give the guard `NODE_NAME`, the desktop label
      `rfactory.io/desktop=true` and the ServiceAccount CA.
    - Kernel behaviour is proven only at k10b.
15. **k2, k7, k8 and k9 results (workflow: coder, Opus review, fix
    round; lead verified).**
    - **k2, the guest:**
      - Root is a tmpfs; only `/nix/store` is a read-only erofs (label
        `rfroot`), because NixOS stage 2 needs writable `/etc`, `/var`
        and `/run`. The writable budget is 4 GiB in total: root 3 GiB,
        `/dev/shm` 512 MiB, `/run` 256 MiB.
      - The runner sets the kernel arguments `rf.runner=<ClusterIP>` and
        `rf.proxy=<ip>:<port>`.
      - DHCP comes through networkd with the lease's DNS ignored;
        `resolv.conf` points only at the proxy IP. The firewall has no
        inbound rules, so DHCP renewals depend on KubeVirt's long lease.
      - x11vnc runs `-connect_or_exit … -rfbport 0 -viewonly` after
        `network-online`. It and the agent have
        `StartLimitIntervalSec=0`.
      - The agent dials 5000 and 5001 and redials after every close.
      - The proxy credential is user `rf`, with the password from
        `call-config.proxy.token`. Both Chromes use it; the control
        Chrome refuses to start without it, and a repeated
        `call-config` is harmless.
      - The boot image (kernel, initrd, cmdline) and the disk image
        (erofs) are docker archives for `k3d image import`.
      - The old vsock image still evaluates, but it does not work at
        runtime until k13 removes it.
    - **k7, the reaper:** it fails closed on a missing or unparseable
      Lease (all desktops deleted); on other API errors it skips only the
      Lease check (the 3 h limit still applies). It re-reads the token
      every call.
    - **k8, the manifests:**
      - Two Services: `rfactory-runner`, ClusterIP-only `10.43.250.10`
        (5000, 5001, 5900), and `rfactory-runner-api`, NodePort `31843`
        to 8443. The proxy has a fixed ClusterIP `10.43.250.11` and
        public resolvers (`dnsPolicy: None`).
      - Runner and proxy are pinned to `k3d-factory-server-0`, with
        anti-affinity to desktops.
      - Kyverno policies are limited to the namespace by webhook
        `matchConditions`, so a Kyverno outage cannot block other
        namespaces. `rfactory-no-host-privileged` is Pod-only (autogen
        off).
      - `rfactory-no-protected-netpol` also refuses empty `to`/`from`
        and `namespaceSelector` peers. It exempts the seven static
        infrastructure policies by name, and only when ArgoCD's
        controller applies them (the API server and the guard sit on
        the node network).
      - Image fields are digest placeholders until k10. The owner
        creates the TLS Secrets `rfactory-runner-tls` and
        `rfactory-guard-tls`, never in Git.
      - Launcher pods must carry `rfactory.io/role: desktop` (k3 sets
        it).
    - **k9, profiles:**
      - The ConfigMap's `initialized` travels in the attach message.
      - The guest checks the disk serial (the full id or its first 20
        characters, the virtio limit; k10b confirms this) and reads the
        first 16 MiB in-process.
      - A crash between format and the flag update leaves the profile
        refused until it is deleted (the safe default).
    - **Known failing test until k3:** `runner.test.js` "serve wires
      Profiles". `serve()` still builds the old profile constructor;
      k3 rewrites that wiring.
    - **Not run:** `kubectl apply --dry-run=client` on the manifests (the
      session's permission check refused it). It runs at k10 instead.
16. **k6 results (Codex, lead verified).**
    - `desktop/proxy/proxy.js` takes a fresh API read of the pod and its
      proxy entry for every CONNECT and DNS request (no stale watch
      data). It reads the matching guard entry for the protected ranges.
    - It refuses a name if any resolved address is protected or private
      (previews: only the exact approved private `ip:port`).
    - The token is compared in constant time.
    - `desktop/proxy/package.json` exists for `node --test proxy/`.
    - k8 must give the proxy the ServiceAccount CA and the right to bind
      TCP and UDP 53.
17. **TLS material (owner request, 2026-11-18).** The lead generated it
    and put it in agenix on olafkfreund/nixos_config#3072 (encrypted to
    olafkfreund and p620; plaintext shredded).
    - A private P-256 CA (10 years) and leaf certificates (825 days):
      - runner API server: `rfactory-runner-api.rfactory-desktops.svc`,
        `127.0.0.1`;
      - runner client to the guard: CN `rfactory-runner`;
      - guard server: `rfactory-guard`, `172.18.0.2`, `172.18.0.3`;
      - web client: CN `rfactory-web`.
    - A 64-byte profile master key.
    - The web client files are in `~/.config/rfactory/desktop-runner/`
      (mode 600) for `pod.sh`.
    - **Secret layout k3 and k11 follow:**
      - `rfactory-runner-tls`: `tls.crt`, `tls.key`, `ca.crt`,
        `client.crt`, `client.key`, `profile-key`;
      - `rfactory-guard-tls`: `tls.crt`, `tls.key`, `ca.crt`;
      - both mounted at `/etc/rfactory/tls`.
    - The runner verifies the guard by CA and CN `rfactory-guard`, not by
      IP, because node IPs can change when the cluster is recreated
      (#3071); otherwise the guard certificate is re-issued from the CA.
18. **k3 results (Codex, lead verified).**
    - `desktop/runner/k8s.js`, and a Kubernetes lifecycle path: a paused
      VMI, then the owned policy and entries, the guard's ready, unpause.
    - Channels are bound to the live pod UID.
    - The Lease and the guard heartbeat are renewed (every 2 s while
      sharing).
    - Reconcile runs at start.
    - Reverse VNC goes through the existing view-only filter (`vnc.js`
      unchanged).
    - `call-config` gains `proxy {addr, token}`.
    - `serve()` wires the k9 Profiles.
    - **Cold spare:** a spare reserves capacity, and its VMI is created
      when it is claimed. The platform and scope policy cannot be fixed
      before the claim, so a warm VMI would need a policy rewrite.
    - **Open for the manifests (k8 follow-up):**
      - digest images;
      - `RF_ALWAYS_PROTECTED` (p620 LAN, Tailscale, Factory hosts);
      - `NODE_EXTRA_CA_CERTS`;
      - a runner egress allowance for the pinned media preflight probes.
19. **Security review of the Codex-built core, manifest follow-up, k12 and
    k13 (workflow: Opus review, coders, fix rounds; lead verified).**
    - **Runner API:** it and its upgrade routes accept only a client
      certificate with CN `rfactory-web`. All four hops now pin a CN.
    - **Rate limits per source IP, before any API read:** the proxy
      (burst 20, 10/s; its discarded watch loops are removed) and the
      runner's `accept()` (burst 20, 5/s). The maps reset past 4096 IPs.
    - **The guard keeps a pod ready** when a reconcile error occurs but its
      tables still read back. One API blip no longer cuts a desktop.
    - **Manifests:**
      - `RF_ALWAYS_PROTECTED` is `192.168.0.0/16` plus the Tailscale
        ranges, the same as Kyverno's list (a test enforces it);
      - `NODE_EXTRA_CA_CERTS` on all four pods;
      - the guard gets its TLS, port and `NODE_NAME` variables;
      - a static `rfactory-runner-egress-media-probe` policy (the probe
        hosts on TCP 443, generated from `ranges.json`, with a drift
        test);
      - the proxy binds 53 through a pod sysctl, with the Service mapping
        53 on TCP and UDP.
    - **k13:** the host layer is removed:
      - `desktop/nixos/`, `desktop/gate/`, the probe guest and `vsock.js`;
      - the flake's runner module, sample host, vsock guests and the
        `microvm` input.

      The runner is Kubernetes-only, and `create()` returns
      `{desktop_id, nonce}`.
20. **Final review blockers (workflow: fix, Opus review, fix round).**
    - **Boot:** the VMI `kernelArgs` is the whole command line: the
      runner's `RF_GUEST_CMDLINE` (the flake's `guest-kubevirt-cmdline`
      output, validated `init=/nix/store/<hash>-<name>/init`, no `rf.*`)
      plus `rf.runner` and `rf.proxy`. k10 fills it in `runner.yaml`.
    - **Private previews over plain HTTP:** the proxy also forwards
      absolute-form `http://` requests, only to an approved private
      preview `ip:port`, with the same token, pod UID and source checks,
      and only to the checked address. This supersedes k6's CONNECT-only
      wording.
      - The checked entry is cached per keep-alive connection, so a page
        with many assets is not rate-limited.
      - The token and target are checked on every request.
      - A revoked entry stays in force until that connection closes.
    - **The web image** no longer copies the removed `vsock.js`.
    - **Images for k10:** flake outputs `image-runner`, `image-guard`,
      `image-proxy` and `image-reaper` (`deploy/images/`). The guard image
      includes nftables, iproute2 and tc, and runs as root with
      `NET_ADMIN`; the others run as uid 10001. Test files are excluded.
21. **agent-0 is reserved for desktops (Opus core review; the IP-identity
    risk).**
    - At k11 the lead taints `k3d-factory-agent-0` with
      `rfactory.io/desktops=true:NoSchedule` and `:NoExecute`.
    - Desktop VMIs tolerate it (`lifecycle.js`).
    - The cluster-wide Kyverno policy `rfactory-desktops-toleration` admits
      that toleration only on `rfactory-desktops` launcher pods. It has
      `failurePolicy: Fail`, CREATE and UPDATE only, and a matchCondition,
      so only pods carrying the key reach the webhook.
    - So only guarded veths sit on that node's bridge, and no other pod
      can claim a desktop's IP there.
    - A per-desktop channel secret is not added.
22. **Verification with probe pods; changed k10b and k14 split (lead
    accepts).**
    - `net.sh` and the probe parts of `capacity.sh` use ordinary probe
      pods, not probe VMIs. KubeVirt's masquerade means a guest cannot
      spoof at the veth, but a pod can.
    - Probes run on agent-0 and cannot tolerate the desktop taint, so all
      probe checks run in **k10b, before the k11 taint**. The scripts
      refuse to start once the taint is present.
    - k10b's "on each node" becomes "on the desktop node, against
      same-node and cross-node targets", because desktops run only on
      agent-0 (deviation 11).
    - **In k14:** `net.sh`'s k10b result stands. `capacity.sh` runs only
      its create checks (a 4th create refused, one success out of two
      simultaneous creates, start-up time).
    - **`owner_confirm` items with a real sharing desktop:** the runner's
      1 GiB egress destroy, and the 5 s share cutoff with the runner
      stopped. `net.sh` measures the 5 s cutoff on a probe as
      `net-share-cut-5s`.


## Steps

The live steps (k1a, k10, k10b, k11, k14) are mine and owner-gated on
p620, each with an agent-bus notice first. Coders never run `kubectl
apply`, `k3d`, `podman`, `nix build` or ArgoCD syncs.

1. **k1a. Hardware gate (mine, owner OK; nothing else needed).**
   - Pick the KubeVirt release per deviation 10.
   - Add `apps/kubevirt` to `factory-gitops` as a PR the owner merges.
   - Boot KubeVirt's own demo `containerDisk` VMI in a scratch namespace,
     then delete it and the namespace.

   → verify: `kubectl get kubevirt` reports Deployed; the launcher has
   `/dev/kvm`; `virsh dumpxml` in the launcher shows `type='kvm'`; the
   VMI reaches Running.
   A failure stops this revision, and the owner is told.
2. **k2. Guest for KubeVirt.** `desktop/guest/kubevirt.nix` imports
   `default.nix` and outputs a kernel-and-initrd container image and an
   erofs root `containerDisk` (`flake.nix` exports).
   - Guest settings:
     - DHCP on the masquerade NIC;
     - DNS only at the proxy's resolver;
     - inbound firewall drops everything;
     - the agent dials `<runner ClusterIP>:5000`, and the heartbeat dials
       `:5001`;
     - x11vnc per deviation 1, under a systemd unit with
       `Restart=always`, so it reconnects after each viewer;
     - tmpfs for every writable path (4 GiB);
     - root read-only;
     - both Chromes get the proxy and the token from `call-config`.
   - `desktop/guest/agent/index.js` `hostLink` and the control transport
     become TCP, with the same framing and protocol.

   → verify: `nix eval` of both outputs; agent tests with a TCP fake
   runner.
   Traps: no secret in the image; one call worker per VM.
3. **k3. Runner Kubernetes backend.** `desktop/runner/k8s.js` is a minimal
   in-cluster client over fetch: VMIs, unpause, NetworkPolicies,
   ConfigMaps, PVCs, pods and the Lease.
   - **`lifecycle.js`:**
     - the deviation 7 order, with cleanup on failure;
     - identity by pod UID;
     - accepts on 5000, 5001 and 5900 only from known launcher IPs;
     - the Lease renewed every 10 s;
     - the guard heartbeat;
     - reconcile at start.
   - **Reverse VNC** (`desktop/runner/vnc.js`, `runner.js`
     `createUpgrade`):
     - the runner keeps the desktop's latest accepted 5900 socket;
     - `/vnc/<id>` bridges one viewer to it, and a second viewer gets
       409;
     - on viewer close the runner closes the reverse socket and x11vnc
       reconnects;
     - the existing view-only RFB filter stays on the path.

   → verify: `(cd desktop && node --test)` with a fake API server. The
   existing lifecycle tests are kept, plus:
   - the creation order and cleanup at each failure;
   - an unknown source IP refused;
   - a reused IP with a new UID refused;
   - reconcile;
   - a reverse VNC bridge with the view-only filter, and reconnect.
4. **k4. Policy generator.** `desktop/runner/k8s-policy.js` builds the
   NetworkPolicy, the proxy entry and the guard entry from one input:
   - an `except` only when contained;
   - an always-protected preview refused;
   - IPv4 and IPv6.

   → verify: unit tests, including a schema check of every manifest.
5. **k5. Desktop guard.** `desktop/guard/guard.js` writes deviation 2's
   tables:
   - the veth lookup with retries;
   - `alive` and `deadline` per deviation 3;
   - the shared `quota` object;
   - `tc` at 20 Mbit/s;
   - counters for reporting;
   - an mTLS endpoint for the runner (heartbeat, sharing on/off, ready);
   - start-up reconcile.

   → verify: unit tests of the rule text and order (the timeout check is
   before the established accept), the refresh as delete plus add, the
   veth lookup on ambiguity, and that reconcile keeps `deadline`.
   Traps: argv arrays; only tables named `rfdesk_<uid>`; never flush
   others.
6. **k6. Egress proxy.** `desktop/proxy/proxy.js` handles:
   - CONNECT with a token (deviation 7);
   - the SNI from the ClientHello equal to the CONNECT host;
   - plain HTTP only for an approved private preview;
   - resolve once, check, connect to the checked address;
   - a DNS responder that answers allowlisted names only.

   → verify: unit tests for SNI mismatch, a name resolving into a
   protected range, a token used from another pod's IP, a reused IP
   without the token, and an unknown source.
7. **k7. Reaper.** `desktop/reaper/reaper.js` deletes labelled VMIs when
   the Lease is older than 60 s or the VMI is older than 3 h.
   → verify: unit tests with a fake API.
8. **k8. Manifests.** `deploy/k8s/rfactory-desktops/`:
   - the namespace (deviation 9) and the `rfactory-profiles`
     StorageClass;
   - RBAC per deviation 5 and the `rfactory-runner` Lease;
   - the runner, proxy and reaper Deployments and the guard DaemonSet,
     digest-pinned, `runAsNonRoot` except the guard, with limits;
   - the runner Service (fixed ClusterIP, NodePort);
   - default deny and the ResourceQuota;
   - the Kyverno policies, scoped to this namespace;
   - the ArgoCD Application for `factory-gitops`, which the owner merges.

   → verify: `kubectl apply --dry-run=client` per file; a test that the
   Kyverno policies name only this namespace.
9. **k9. Profiles on PVCs.**
   - `desktop/runner/profiles.js` creates the PVC
     (`rfactory-profiles`) and a ConfigMap (`initialized: false`),
     attaches the disk with serial `<profile id>`, and keeps the lock and
     expiry.
   - `desktop/guest/agent/profile.js` formats only per deviation 4.

   → verify: unit tests, including an initialized profile without a
   header failing closed and a second attach refused.
10. **k10. Images (mine, owner OK).** Build the runner, guard, proxy,
    reaper, kernel-boot and `containerDisk` images on p620, `k3d image
    import` them, and record the digests in the manifests.
11. **k10b. Isolation gate (mine, owner OK, after k2 to k10).** Sync
    `rfactory-desktops` and run `desktop/verify/net.sh` from a probe VMI
    on each node. Every line must PASS, or the revision stops:
    - startup: traffic sent the moment the VMI is unpaused is filtered;
    - the mark survives from the bridge to the IP layer;
    - every always-protected range fails over TCP and UDP, same-node and
      cross-node;
    - a spoofed IP and a spoofed MAC are dropped;
    - a pinned media range and the proxy (with its token) are reachable;
    - the guard is killed: an established flow is cut within 60 s;
    - while sharing, the runner is stopped: egress is cut within 5 s;
    - the guard restarts and `deadline` is not reset;
    - the proxy refuses a protected resolution, an SNI mismatch and a
      missing token;
    - after a forced delete, no node file holds a guest marker.
12. **k11. Deploy and exposure (mine, owner OK, agent bus first).**
    - `k3d node edit k3d-factory-serverlb --port-add
      127.0.0.1:<port>:<nodeport>`.
    - Put the runner client cert, key and CA in
      `~/.config/rfactory/desktop-runner/` (generated, never printed).
    - `deploy/pod.sh up` with `RFACTORY_DESKTOP=1` and the runner URL.

    → verify: `ss -ltn` shows the port on `127.0.0.1` only; `list` over
    mTLS answers.
13. **k12. Scripts.** Re-point `desktop/verify/*.sh` to the checks in k14:
    - `net.sh` is k10b;
    - `lifecycle.sh` and `profiles.sh` per the table;
    - `capacity.sh` uses the quota.

    → verify: `shellcheck`, `bash -n`, and every check name appearing
    once.
14. **k13. Remove the host layer** after k3 to k5 pass:
    - `desktop/nixos/` and its flake exports;
    - `vsock.js` and the CID oneshot;
    - `net.js`'s host parts;
    - the `microvm-run` rewriting;
    - `desktop/gate/`, which stays in git history.

    → verify: all suites pass; `grep -rn vsock desktop/` finds only notes.
15. **k14. Review and live (mine, owner present).** A fresh Opus review
    and a Codex review of the diff, then on p620 every line below must
    PASS:

    | Script | Checks |
    |---|---|
    | `net.sh` | all of k10b |
    | `lifecycle.sh` | `list` is empty and no VMI, policy, proxy entry or guard table remains after each path: normal call end; worker heartbeat loss; server heartbeat loss; idle expiry; the runtime limit; the runner pod killed (the reaper deletes within 60 s, egress already cut); the runner restarted with a live call; the reaper alone; a manual `kubectl delete vmi` |
    | `capacity.sh` | a 4th create returns `capacity`; two simultaneous creates with one slot give one success; the 20 Mbit/s limit holds; the 1 GiB cutoff ends the call; start-up time printed |
    | `handover.sh` | the existing handover and browser-boundary checks, unchanged |
    | `secrets.sh` | no credentials in the guest besides the attached profile; a stored login is filled and never reaches the brain, page or logs |
    | `share.sh` | the existing share checks on a VMI that joined a real call, plus the 5 s share cutoff on runner loss |
    | `profiles.sh` | first attach formats; a second attach refused; another scope refused; an initialized profile with a wiped header fails closed and is not formatted; deleting or expiring an attached profile destroys the desktop first; after a rollback rehearsal (apps deleted, namespace kept) the PVC and its ConfigMap remain |
    | `liveview.sh` | non-member and other-scope refused; revoking a member closes their stream within 5 s; a real noVNC page receives a frame over the reverse VNC; a KeyEvent closes the stream and the screen is unchanged; a second viewer gets 409 |
    | `e2e.sh` (owner watches) | a Meet call and a Teams call from a desktop VMI; handover of one preview origin; the agent opens it; an approved share shows only that window; Stop ends it; the call ends and nothing of the VM is left |

    Then measure CPU, RAM and start-up time, and write
    `desktop/RESULTS.md`.

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

All pass with 0 skipped. Then k1a, k10b and k14 on p620.

## Rollback

- Delete the ArgoCD Applications `rfactory-desktops` and `kubevirt`
  (KubeVirt's CR first). The namespace and the profile PVCs and
  ConfigMaps stay (deviation 9).
- Remove the serverlb port with `k3d node edit --port-delete`.
- Deploy the pod without `RFACTORY_DESKTOP`.
- To remove profiles as well, the owner deletes the namespace and the
  retained PVs explicitly.
- Nothing on p620's NixOS config changes.
