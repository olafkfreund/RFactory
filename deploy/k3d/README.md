# Desktop VMs on the k3d factory cluster

This takes you from "the k3d cluster exists" to "desktops on".
Each desktop is a KubeVirt VM in the namespace `rfactory-desktops`.
The background is in `plan/2026-11-18-3-agent-workspace-k3d.md`; the numbers in
"Problems we hit" are that plan's deviations.

Run the steps in this order. Run every script from the repo root.

| Step | Script | What it does |
|---|---|---|
| 2 | `mk-tls.sh` | CA, certificates and the profile key, encrypted into agenix |
| 3 | `import-images.sh` | builds the six images and loads them into both nodes |
| 4 | `prep.sh` | the namespace and the two TLS Secrets (the runner creates its own Lease) |
| 5 | (a factory-gitops PR) | ArgoCD syncs the manifests |
| 6 | `gate.sh` | the isolation gate; must be all PASS |
| 7 | `k11.sh` | taints the desktop node, exposes the runner, starts the web pod |

The cluster is shared. Post on the agent bus before steps 3, 5, 6 and 7.

## 1. Prerequisites

- A k3d cluster named `factory` with the nodes `k3d-factory-server-0` and
  `k3d-factory-agent-0`. The nodes are privileged docker containers and see the
  host's `/dev/kvm`. KubeVirt runs with KVM only, never emulation.
- Kubernetes 1.34 or newer. KubeVirt v1.9.1 supports 1.34 to 1.36; ours is 1.35.10.
- ArgoCD, with the `factory-gitops` app-of-apps, and Kyverno.
- The `factory-gitops` app `apps/kubevirt` (KubeVirt v1.9.1, images pinned by digest).
  It must include the blanket toleration on the KubeVirt CR
  (`spec.workloads.nodePlacement.tolerations: [{operator: Exists}]`).
  Without it, virt-handler cannot stay on the tainted desktop node. `k11.sh` refuses to run without it.
- On the host: `nix`, `docker`, `k3d`, `kubectl`, `podman`, `age`, `openssl`, `jq`, `curl`, `python3`.
- A clone of the NixOS config repo that holds the agenix secrets (default `~/.config/nixos`).

Check:

```bash
kubectl -n kubevirt get kubevirt                 # PHASE: Deployed
kubectl get nodes -o custom-columns='NODE:.metadata.name,VER:.status.nodeInfo.kubeletVersion,KVM:.status.allocatable.devices\.kubevirt\.io/kvm'
kubectl -n kubevirt get ds virt-handler -o jsonpath='{.spec.template.spec.tolerations}'   # contains {"operator":"Exists"}
kubectl -n argocd get application kubevirt       # Synced, Healthy
```

## 2. TLS: `mk-tls.sh`

```bash
deploy/k3d/mk-tls.sh
```

It creates a private P-256 CA (10 years) and four leaf certificates (825 days):

- runner API server: `rfactory-runner-api.rfactory-desktops.svc` and `127.0.0.1`;
- runner client to the guard: CN `rfactory-runner`;
- guard server: `rfactory-guard` and the node IPs;
- web client: CN `rfactory-web`.

It also creates a 64-byte profile master key.
What goes into agenix: eleven files in `secrets/`, each encrypted to one user key and one host key,
plus their entries in `secrets.nix`:

```text
rfactory-desktops-ca-{key,crt}    rfactory-runner-tls-{crt,key}    rfactory-runner-client-{crt,key}
rfactory-guard-tls-{crt,key}      rfactory-web-client-{crt,key}    rfactory-profile-key
```

The script writes them to a branch in its own worktree and does not commit.
Review, commit and merge that branch yourself. `prep.sh` reads the secrets from `origin/main`.

The web client files go to `~/.config/rfactory/desktop-runner/` (mode 600), for `pod.sh` and `gate.sh`.

The script prints no secret. Plaintext exists only in a temporary directory (mode 700) and is shredded on exit.

Defaults fit p620. Override them with environment variables, listed at the top of the script:
`RF_NIXOS_REPO` (`~/.config/nixos`), `RF_AGE_USER` and `RF_AGE_HOST` (`olafkfreund` and `p620`, the names in `secrets.nix`),
`RF_AGE_IDENTITY`, `RF_TLS_WORKTREE`, `RF_TLS_BRANCH`, `RF_GUARD_SANS` (the k3d node IPs) and `RFACTORY_CONFIG`.

A second run makes a new CA and new keys. After it, merge the branch, rerun `prep.sh` and restart the pods.

## 3. Images: `import-images.sh`

```bash
deploy/k3d/import-images.sh > refs.txt        # all six
deploy/k3d/import-images.sh image-guard       # only one, after a guard change
```

It builds with nix and loads each image into the containerd of both nodes.
The images exist only in the nodes, so the manifests use `imagePullPolicy: Never`.
Repeat the import after the cluster is recreated.

The script handles three traps:

1. `k3d image import` reports success but imports nothing when the cluster has no shared image volume.
   The script uses `ctr -n k8s.io images import` in each node.
2. `ctr import` names an image only `repo:tag`. Kubelet looks up a `tag@digest` pin as `repo@digest`.
   The script adds that second name.
3. Kubelet's image garbage collection removes images no pod uses. The guest images are unused between desktops.
   The script labels every ref `io.cri-containerd.pinned=pinned`.

Pinned images are never reclaimed, so each import also removes the older versions of the same image.
Otherwise the node disk fills. After an import, the old version is gone from the nodes:
do the pin bump (below and step 5) soon, or a restarted pod gets `ErrImageNeverPull`.

The script prints one line per image and the kernel command line:

```text
image-runner docker.io/rfactory/runner:<tag>@sha256:<digest>
image-guard docker.io/rfactory/guard:<tag>@sha256:<digest>
image-proxy docker.io/rfactory/proxy:<tag>@sha256:<digest>
image-reaper docker.io/rfactory/reaper:<tag>@sha256:<digest>
guest-kubevirt-boot-image docker.io/library/rfactory-guest-boot:k2@sha256:<digest>
guest-kubevirt-disk-image docker.io/library/rfactory-guest-disk:k2@sha256:<digest>
RF_GUEST_CMDLINE init=/nix/store/<hash>-nixos-system-desktop-guest-<version>/init console=ttyS0 ...
```

Put them into `deploy/k8s/rfactory-desktops/`:

| Line | File | Field |
|---|---|---|
| `image-runner` | `runner.yaml` | `image:` |
| `guest-kubevirt-boot-image` | `runner.yaml` | env `RF_GUEST_BOOT_IMAGE` |
| `guest-kubevirt-disk-image` | `runner.yaml` | env `RF_GUEST_DISK_IMAGE` |
| `RF_GUEST_CMDLINE` | `runner.yaml` | env `RF_GUEST_CMDLINE` (the whole line after the name) |
| `image-guard` | `guard.yaml` | `image:` |
| `image-proxy` | `proxy.yaml` | `image:` |
| `image-reaper` | `reaper.yaml` | `image:` |

Take each value from the line that starts with its name, for example `grep '^image-guard ' refs.txt`.
A looser grep also matches the script's progress lines, and we once pinned the wrong image that way.
Commit and push the manifests. ArgoCD reads them from GitHub.

## 4. Before the first sync: `prep.sh`

```bash
deploy/k3d/prep.sh
```

It applies three things that ArgoCD does not own:

- the namespace `rfactory-desktops`. It stays out of the app, so deleting the app never deletes
  the namespace or the profile PVCs;
- the Secrets `rfactory-runner-tls` (`tls.crt`, `tls.key`, `ca.crt`, `client.crt`, `client.key`, `profile-key`)
  and `rfactory-guard-tls` (`tls.crt`, `tls.key`, `ca.crt`).

It decrypts from agenix straight into `kubectl`. It writes no plaintext to disk and prints only the key names.
It is safe to repeat. It uses `RF_NIXOS_REPO` and `RF_AGE_IDENTITY` like `mk-tls.sh`.

## 5. The ArgoCD app

The app lives in `factory-gitops` as `apps/rfactory-desktops/application.yaml`.
Start from `deploy/k8s/rfactory-desktops/application.yaml` in this repo.
In `factory-gitops`, `targetRevision` follows this repo's branch while the feature is built (`feat/3-agent-workspace`),
so a pushed commit deploys with no `factory-gitops` change: ArgoCD polls every 3 minutes, and `deploy/k3d/k14-env.sh sync`
syncs at once and waits. When the branch merges, `targetRevision` goes to `main` in one `factory-gitops` pull request.
Image pins from step 3 are commits here; never `kubectl set image`, which self-heal reverts.

`factory-gitops` CI (`.github/workflows/manifest-validate.yml`) cannot read manifests in another repo.
An Application that points elsewhere fails unless its name is listed in `is_external_declared()` with a tracking issue.
`rfactory-desktops` is listed. A renamed or second app needs its own entry.

After the merge:

```bash
kubectl -n argocd get application rfactory-desktops      # Synced, Healthy
kubectl -n rfactory-desktops get pods -o wide            # runner, proxy, reaper, one guard per node: Ready
kubectl get clusterpolicy | grep rfactory                # four policies, Ready
```

## 6. The gate: `gate.sh`

```bash
deploy/k3d/gate.sh gate.log
```

It port-forwards the runner API to `127.0.0.1:8443` and runs `desktop/verify/net.sh`.
The log goes to the path in `$1`. Without it, the script makes a temporary file and prints its path.

Every line must be `PASS`. A clean run on our install has 32 lines.
Do not go on with a `FAIL`. Fix the cause and run the gate again.

Run it before step 7. The checks use probe pods on the desktop node, and a probe cannot tolerate the taint.
After the taint, `net.sh` refuses to start.

It needs a BusyBox image on both nodes, pinned as `repo:tag@digest` (`VERIFY_PROBE_IMAGE`).
The probes never pull, so load it into the nodes the way `import-images.sh` does.
Other defaults to check: `VERIFY_FACTORY_HOSTS` (hosts a desktop must never reach) and
`VERIFY_NODE_CLI` (`docker`, because k3d nodes are docker containers).

Run it on a quiet host. With a load average above 25, k3s answered `database is locked` and a run failed.

## 7. Desktops on: `k11.sh`

```bash
deploy/k3d/k11.sh gate.log
```

It refuses to run unless the log is a clean gate run and virt-handler has the blanket toleration. Then:

1. It taints `k3d-factory-agent-0` with `rfactory.io/desktops=true:NoSchedule`.
   NoSchedule only: nothing running is evicted. NoExecute would evict ArgoCD, Kyverno and virt-handler at once.
   Only desktop launcher pods may tolerate the key (the Kyverno policy `rfactory-desktops-toleration`).
2. It adds a port to the k3d load balancer: host `127.0.0.1:18443` to NodePort `31843` (the runner API, mTLS only).
   The load balancer is recreated, so the cluster API is away for a few seconds.
   The script then checks that the port listens on loopback only and that `list` answers over mTLS.
3. It restarts the web pod with `RFACTORY_DESKTOP=1` and `RFACTORY_RUNNER_URL=https://127.0.0.1:18443`.
   `pod.sh` then starts the pod with `--network pasta:-T,18443`. The pod's `127.0.0.1:18443` is the host's,
   so the `127.0.0.1` name on the runner certificate still matches.
   The allow, approver and admin lists are copied from the running `rfactory-web` container.

Overrides: `K11_NODE`, `K11_LB`, `K11_PORT`, `K11_NODEPORT`, `RFACTORY_CONFIG`. Port 8443 stays free for the gate's port-forward.

## 8. Problems we hit

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 24 | `k3d image import` succeeds, the node has no image | the recreated cluster has no shared image volume | `ctr -n k8s.io images import` in each node (`import-images.sh`) |
| 25 | every pod `ErrImageNeverPull` on the first sync | kubelet image GC removed the imports, because no pod used them yet | re-import; label the refs `io.cri-containerd.pinned=pinned` |
| 25 | `ErrImageNeverPull` although the image is on the node | `ctr import` names only `repo:tag`; a `tag@digest` pin is looked up as `repo@digest` | `ctr images tag <repo:tag> <repo@digest>` |
| 26 | guard reports `guard-no-veth` for an idle pod or a paused VM | the veth was found through the node's neighbour table; an idle pod has no entry | replaced in 29: the guard reads the CNI result cache |
| 27 | protected targets answer `refused`, not `timeout` | kube-router (k3s NetworkPolicy) REJECTs in iptables filter before the guard's drop | guard chains run earlier: bridge forward at -200, inet forward and input at -10 |
| 27 | every create refused: `runner Lease is missing` | ArgoCD excludes `coordination.k8s.io/Lease` by default | fixed: the runner creates its Lease when missing (RBAC `create` on leases); `lease.yaml` is gone |
| 27 | anti-spoofing checks cannot read node state | the scripts used `podman`; k3d nodes are docker | `VERIFY_NODE_CLI=docker` (`gate.sh` sets it) |
| 28 | Lease `spec` stays empty; every renewal PUT gets 400 | `renewTime` is a MicroTime with six fraction digits; `toISOString()` writes three | the runner writes six digits. Unfixed, the reaper deletes every desktop |
| 29 | a spoofed MAC connects; the bridge table reads `iifname "undefined"` | the guard read the fdb field `dev`; iproute2 calls it `ifname` | the guard takes the veth from `/var/lib/cni/results`, matched by pod UID |
| 29 | the guard finds two CNI entries for one pod | the cache also has a loopback entry per pod (`cni-loopback`, `lo`) | only network `cbr0` (`RF_CNI_NETWORK`) with `ifName` `eth0` counts |
| 29 | the preflight refuses every Meet call | no Meet media host answers TCP 443 | the probe is a STUN binding over UDP to `74.125.250.129:19302`, with its own egress policy |
| 30 | desktop create fails: unpause 409 | the guard is ready before KubeVirt has started and paused the domain | the runner waits for the VMI condition `Paused=True` (up to 60 s) |
| 30 | create fails after a successful unpause | unpause answers 200 with an empty body; `response.json()` threw | parse only a non-empty body |
| 31 | NoExecute on agent-0 would evict 24 pods, virt-handler too | the node also runs ArgoCD, Kyverno and the factory apps | NoSchedule only; blanket toleration on the KubeVirt CR |
| 32 | both nodes `disk-pressure`; new pods stay Pending cluster-wide | every rebuilt image was pinned, so GC could reclaim none | remove the versions the manifests no longer pin, then `crictl rmi --prune`; the import now does the removal |
| 33 | desktop starts, then `control` answers `no-control` | the guard's second reconcile: `tc filter replace` answers `File exists`, the pod goes not ready | the guard reads `tc filter show` and adds the filter only when missing |
| 33 | gate fails, k3s says `database is locked` | host load average 25 to 30 | rerun when the load is below 10 |
| 33 | a page load in the desktop gets `429` from the proxy | the per-IP limit (burst 20, 10/s) was below one page's asset count | the proxy shares its API snapshot for 2 s and allows burst 120 at 40/s |
| 33 | `desktop_open https://meet.google.com/` answers `ok:false` (`ERR_FAILED`) | signed out, Meet redirects to `apps.google.com`; the agent refuses a host outside the grant | grant the landing hosts too (`apps.google.com`, `workspace.google.com`); the guest logs `refused <host>` |
| 33 | `create` times out in the gate under load | the helper's curl waited 60 s; a create can take the runner's full budget (about 150 s) | the helper waits 180 s |

To see a desktop boot, read the launcher pod's `guest-console-log` container. It is the guest's serial console.

## 9. Rollback

Turn desktops off, in reverse order:

```bash
RFACTORY_DESKTOP= deploy/pod.sh up            # web pod without desktops (set the allow lists as usual)
k3d node edit k3d-factory-serverlb --port-delete 127.0.0.1:18443:31843
kubectl taint node k3d-factory-agent-0 rfactory.io/desktops=true:NoSchedule-
```

Remove the workloads: delete `apps/rfactory-desktops` from `factory-gitops` with a pull request.
The app's finalizer removes the workloads, policies and StorageClass.
The namespace, the Lease, the TLS Secrets, the k14 `rfverify-*` Secrets, the profile PVCs and the profile ConfigMaps stay.

To go back one version instead: check out the older commit, run `import-images.sh` there
(it replaces the newer images), and set `targetRevision` to that commit (or revert the commit on the branch).

To remove KubeVirt as well, delete the KubeVirt CR first, then the `kubevirt` app.
To remove profiles as well, delete the namespace and the retained PVs by hand. This destroys the profile data.
Nothing in the host's NixOS configuration changes.
