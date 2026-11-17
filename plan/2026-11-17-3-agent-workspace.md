---
status: approved
issue: 3
spec: spec/2026-11-17-3-agent-workspace.md
coders:
  1: coder    # Nix and shell scaffolding with no tricky logic
  2: coder    # scripted checks that call tools; the logic is in the tools
  3: codex    # small tricky logic: ordered nft rules, range overlap and IPv6
  4: codex    # small tricky logic: framing, size limit, schema, tagging
  5: coder    # lifecycle glue around systemd, with injected fakes in tests
  6: coder    # NixOS module, mostly declarative
  7: coder    # guest agent: Playwright, route handler, heartbeats
  8: codex    # small tricky logic: the five-check session gate and revoke
  9: coder    # WebSocket proxy and noVNC page
  10: codex   # small tricky logic: attach lock and delete ordering
  11: codex   # small tricky logic: nonce, track check, fail-closed stop
  12: coder   # scheduled job and a connectivity probe
  13: coder   # production wiring of existing pieces, no new logic
  14: coder   # web UI pages and controls over existing APIs
  15: coder   # verification scripts that drive the probe image
reviewers:
  - codex     # read-only second review of the whole diff; agy is out of use (#2748)
---

# Plan: Agent workspace, a disposable desktop per call (#3)

Every call gets one disposable VM desktop. A runner on the KVM host is the
only thing that creates or destroys it. The guest holds no secrets, reaches
only the call platform and allowlisted previews, and is driven through a
gateway with time-limited, revocable handovers. Nothing survives the call.

This plan is self-contained: it does not need the intent or the spec open.

## Decisions carried over from the approved spec

**Answers to the intent's open questions**

- **Isolation:** VM-level for any desktop the agent can drive. A container is
  allowed only for a call-only bot the agent can't drive (#1's Phase 0 shape).
- **Who approves:** the per-scope **approver** role from #2 hands over
  control, approves shares and approves single actions. Scope **members** may
  watch the live view.
- **App control in v1:** web apps only, through Playwright in the guest.
  Native apps and terminals are a later slice.
- **Project copy:** v1 opens only preview or staging URLs that already exist
  and are on the scope's allowlist. It does not build previews.
- **Sizing:** 2 vCPU, 3 GiB RAM, 4 GiB disk, plus 0.5 GiB VM overhead. p620
  starts at most 3 desktops; the **pre-booted spare counts toward the 3**.
  Step 17 measures these and they live in config.
- **Window share** needs #1's Phase 0 share check (D5) to pass. Step 11 is
  built only after D5 passes. If D5 fails, the spec is updated and approved
  again before any share work. All other steps do not depend on sharing.

**Feasibility gate (steps 1, 2 first; stop and report if any fails)**

1. A VM can be created and destroyed at runtime without rebuilding the host,
   with `microvm.nix` and **cloud-hypervisor** (see Deviation 1).
2. A vsock to the guest carries length-prefixed JSON, and VNC passes through
   it: `x11vnc` on `127.0.0.1:5900` in the guest, bridged by
   `socat VSOCK-LISTEN:5900,fork TCP:127.0.0.1:5900`.
3. Per-tap nftables rules block everything under **Network**, IPv4 and IPv6,
   including guest-to-guest traffic.
4. Inside the VM, Meet still passes #1's Phase 0 criteria.

**Shape**

- **Runner** (host, systemd service): the only component that creates or
  destroys desktops. Server talks to it over **mTLS** with `create`,
  `destroy`, `list`, `heartbeat`. It maps each VM to `call_id` and scope, and
  every vsock message is tagged from that map, never from guest content.
- **Guest:** one read-only NixOS image from this repo's flake: Xvfb with
  openbox, Google Chrome for the call, the call worker, Playwright with a
  **separate** Chrome for control and share, `x11vnc` on localhost plus a
  `socat` vsock bridge. No SSH, no secrets in the image.
- **Control channel:** three vsock ports only: `control` 5000, `vnc` 5900,
  `heartbeat` 5001. The host listens on no others. Messages are
  length-prefixed JSON, max 64 KiB, schema-checked; unknown or malformed
  ones are dropped and logged. The guest can't name a call, scope or
  desktop.
- **vsock transport on cloud-hypervisor** (Deviation 3), set up before any
  framing:
  - Each VM has one host Unix socket, `/run/rfactory-desktop/<id>/vsock.sock`
    (`--vsock cid=<cid>,socket=<that path>`).
  - **Host → guest** (`control` 5000, `vnc` 5900): the runner connects to
    `vsock.sock`, writes `CONNECT <port>\n`, and reads `OK <n>\n` before the
    stream is used. Anything else closes the connection.
  - **Guest → host** (`heartbeat` 5001): the guest connects to host CID 2,
    port 5001; cloud-hypervisor delivers it to the Unix socket
    `vsock.sock_5001`, which the runner listens on. The runner creates only
    `vsock.sock_5001`, so a guest connect to any other port finds no
    listener.
  - The guest listens with `socat VSOCK-LISTEN:<port>,fork` for 5000 and
    5900 only.
- **Heartbeat:** the call worker sends one every **5 s**; the runner
  destroys the VM after 30 s without one (6 missed beats).

**Network** (per tap, IPv4 and IPv6). Rules are evaluated in this exact
order (Deviation 6 resolves the spec's order conflict):

0. Anti-spoofing: only the guest's assigned source address on its tap; no
   forwarding between taps.
1. **Resolver, the only exception before the protected drops:** UDP and TCP
   port 53 to the runner's resolver address on this tap, and nothing else on
   that address.
2. **Protected drops, unconditional, no exception after this can reopen
   them:** the host's own addresses (all ports except rule 1), the cluster
   pod and service ranges, the Factory hosts, `169.254.169.254`, every other
   desktop's address.
3. **Approved private previews:** accept an admin-approved `ip:port` (TCP,
   exact address and port) for this VM's scope. `validatePreview` refuses at
   configuration time any preview inside a rule-2 range.
4. **Private drops:** RFC1918, CGNAT 100.64/10, IPv4 link-local, IPv6 ULA
   and link-local.
5. DNS-resolved set: the resolver (dnsmasq with `nftset=`) answers only
   names on the platform allowlist and the scope's preview allowlist and
   adds the resolved addresses to a per-VM nft set. TCP and UDP to that set
   are allowed.
6. Media: UDP and TCP to the call platform's published media IP ranges
   (Google Meet, Zoom, Microsoft Teams, Slack). Ranges are pinned in the repo
   and refreshed by a scheduled job that opens a PR for review. WebRTC media
   goes to these addresses through ICE, not DNS names. Slack's published
   huddles range is `99.77.128.0/18`, UDP 3478 (and legacy 22466) and
   TCP 443, both directions (Slack's "Guide to network and system
   configuration for Slack huddles", checked 2026-11-17).
7. Everything else is dropped, with a rate-limited log.

**Lifecycle and disposal**

- **Create:** read-only image, empty overlay on tmpfs, as its own transient
  unit: `systemd-run --unit=rfactory-vm-<id> -p RuntimeMaxSec=3h
  -p BindsTo=rfactory-runner.service -p PartOf=rfactory-runner.service`.
  systemd enforces 3 h even if the runner is down; the VM dies with the
  runner (fail closed). One pre-booted spare is allowed and counts toward the
  limit; a VM is bound to one `call_id` once claimed.
- **Destroy** on: normal call end (reported by the call worker); no
  call-worker heartbeat over vsock for 30 s; no server heartbeat for 60 s;
  10 min idle (no speech, no share, no tool call); `RuntimeMaxSec`; runner
  stop.
- **Recovery:** on runner start a reconcile loop stops every `rfactory-vm-*`
  unit and deletes leftover state. A desktop never survives a runner restart
  (the call goes voice-only, or the user rejoins).
- **Cleanup failures:** retried 3 times with backoff, then alert in the web
  UI admin view and the logs, and the runner refuses new `create` until
  cleared.
- **Capacity:** with 3 VMs (spare included), `create` returns `capacity` at
  once and the call is **refused** with a clear message. The user may then
  explicitly start a voice-only bot (#1's container bot). Nothing changes
  silently.
- **Per-VM limits:** fixed CPU and RAM; 4 GiB tmpfs overlay; 20 Mbit/s `tc`
  rate limit on the tap; 1 GiB per-call egress quota, after which the tap is
  dropped and the call ends.

**Driving apps**

- **Gateway tools** (#2's gateway): `desktop_open(url)`,
  `desktop_click(target)`, `desktop_type(target, text)`, `desktop_scroll(dy)`,
  `desktop_screenshot()`. They run on the guest's control Chrome, separate
  from the call Chrome.
- **Handover:** an approver grants `{ scope, call_id, desktop_id, actions[],
  hosts[], until }`, `until` at most 30 min away. **On every tool call** the
  gateway checks: (1) session exists and is not revoked; (2) `now < until`;
  (3) `scope`, `call_id`, `desktop_id` match the running call; (4) the tool
  is in `actions`; (5) for navigation, the target origin is in `hosts`. A call
  that fails the session checks but is otherwise allowed for the scope goes to
  the **per-action approval queue** (as in #1 and #2), visible in the web UI
  and run only once approved. It is not silently rejected.
- **Browser boundary:** `hosts` governs **all requests** of the control
  context. `context.route('**/*')` aborts any request whose origin is not in
  `hosts` (redirects, meta refresh, JS `location`, form posts, fetch, click
  or type navigation). The context is created with `serviceWorkers: 'block'`.
  Popups and new pages share the context and route handler; any page not in
  the context is closed when it opens. The network allowlist is a second
  boundary beneath this one.
- **Revoke:** (1) the gateway marks the session revoked at once; (2) the
  runner sends `cancel` on the control port, and the guest closes the control
  context and stops any action in flight; (3) if the guest doesn't confirm in
  2 s, the runner destroys the VM.
- **No secrets:** the guest gets no credential (source, Factory,
  call-platform login, cookies) except an admin-approved profile and an
  approved preview login. `desktop_type` also refuses values matching a
  stored credential (extra protection, not the guarantee). A preview login is
  filled by the runner's `desktop_login(profile)`, never by the brain.
- **Untrusted content:** screenshots, page text and titles go to the brain as
  untrusted `content`, as in #2. Nothing on screen or in speech can change a
  session, share, allowlist or approval.
- **Pending actions shown:** the web UI shows the active handover with a
  countdown, the action running now, and queued actions waiting for approval,
  live.

**Share**

- The share window is a page in the control Chrome, in app mode, titled
  `RFactory share <nonce>` (random per share). An init script locks
  `document.title`.
- The call Chrome is launched with
  `--auto-select-desktop-capture-source=RFactory share <nonce>` for that
  share.
- The brain can only call `propose_share(url)`; an approver's click starts
  it; the URL must be in `hosts`.
- Fail closed: the call worker's `getDisplayMedia` hook requires
  `getSettings().displaySurface === 'window'` and a track `label` containing
  the nonce; otherwise the track is stopped before Meet gets it and the share
  is reported failed.
- **Consent is bound to the target** (intent: "starting or changing a share
  needs an approver"). The approval records `{ share_id, nonce, url,
  origin }`. The share page is its own Playwright page with a route handler
  that allows only requests to the approved origin, and a
  `framenavigated` listener on its main frame: any navigation away from the
  approved URL (including same-origin path changes), a new page opened from
  it, or a change of the shared window **stops the share at once** and
  reports `share-target-changed`. Sharing something else needs a new
  `propose_share` and a new approver click. The gateway refuses
  `desktop_open` / `desktop_click` / `desktop_type` on the share page while
  it is shared.
- Stop: the web UI shows "Sharing: <url>" with **Stop**. Stop calls
  `stopShare` and also closes the share window (ending capture even if
  `stopShare` or the channel fails). Control channel down for 5 s during a
  share: the runner destroys the VM.

**Persistent profiles**

- Record `{ scope, purpose, approved_by, created_at, retention_days
  (default 30) }`. Only an admin creates one. The approving admin and the
  scope's admins can list and delete it. Never attached to another scope, and
  to at most one desktop at a time, under a lock.
- Stored as a LUKS-encrypted disk image on the runner; the key is kept by the
  runner from sops-nix or agenix, sent to the guest over the control vsock at
  boot, and unlocked in the guest with dm-crypt. Plaintext exists only in
  guest memory; a crash leaves only ciphertext on the host.
- **Guest side:** the image is attached as a second virtio-blk disk
  (`--disk path=<image>`), never mounted on the host. In the guest,
  `profile-unlock` reads the key from the control message on stdin, runs
  `cryptsetup open --key-file=- /dev/vdb rfprofile`, mounts
  `/dev/mapper/rfprofile` on `/run/rfactory/profile` (tmpfs-backed path,
  `nodev,nosuid,noexec`), and the control Chrome starts with
  `--user-data-dir=/run/rfactory/profile/chrome`. Without a profile, the
  control Chrome uses an empty tmpfs user-data dir. On destroy or cancel the
  guest closes Chrome, unmounts and runs `cryptsetup close` before the VM
  stops (best effort; the VM stopping is the guarantee).
- Deleting a profile, or reaching its retention date, while attached destroys
  that desktop first, then deletes the image. Profile sessions count as
  credentials under the no-secrets rule.

**Live view**

- VNC over vsock goes through the runner to the server, then to noVNC as a
  WebSocket. The server checks session and scope membership before accepting,
  re-checks every 5 s and closes on loss. A stream is bound to one
  `desktop_id`. It is **view-only**: the server parses client-to-server RFB
  messages and forwards only the ones viewing needs: the version and
  security handshake, `ClientInit`, `SetPixelFormat` (type 0),
  `SetEncodings` (2) and `FramebufferUpdateRequest` (3). `KeyEvent` (4),
  `PointerEvent` (5), `ClientCutText` (6) and any unknown type close the
  stream. `x11vnc -viewonly` in the guest is the second boundary.

**Alternatives rejected (do not reintroduce):** pods for driven desktops;
KubeVirt; hosted desktop services; open egress with only tool-layer URL
checks; an HTTP proxy allowlist alone; choosing the share window by title
alone; decrypting profiles on the host; screenshot-and-click computer use in
v1; Wayland in the guest.

## Facts checked in the real repos

- This worktree holds only `README.md`, `intent/`, `spec/`. There is **no**
  `core/`, `web/`, `flake.nix` or `desktop/` here. `core/` (gateway, items,
  scope) exists only on `feat/2-standalone-mode` and `feat/5-phase-1a-text-standup`
  (`/mnt/code/Source-home/GitHub/RFactory/core/src/gateway.js`), not on `main`.
  `web/` does not exist on any branch yet (planned in #5 step 6).
  No `flake.nix` exists in RFactory on any branch, so "this repo's flake" is
  created by step 1.
- `core/src/gateway.js` (#2 S1) has a fixed `NAMES` list of four read tools, a
  `NEVER` regex and per-tool `SCHEMAS`, and its `call(name, args)` rejects
  anything else. Desktop tools are additive there (step 8).
- RFactory code style: Node `>=22`, CommonJS, `'use strict'`, tests with
  `node --test` (`core/package.json`). New `desktop/` code follows that.
- `spike/package.json` pins `playwright-core` 1.65.1 and
  `@vibeconferencing/calls` 0.1.0-alpha.3. The library's
  `inject/page-inject.js` already overrides `getDisplayMedia` (line 764), and
  `docs/status.md:93-94` says share on Playwright needs a loopback that is not
  built.
- `spike/RESULTS.md` says the share check (D5) was **not run**. Step 11 is
  blocked on it.
- `nixarchy` `modules/microvm/guest.nix` uses **qemu**, 9p shares of the host
  `/nix/store`, and SLiRP user networking. `tests/microvm-template.nix:89`
  asserts qemu and notes "cloud-hypervisor cannot do user networking". See
  Deviation 1.
- microvm.nix's `lib/runners/cloud-hypervisor.nix` supports `microvm.vsock.cid`
  and virtiofs, with a host-side Unix socket for vsock (`socket=<path>`), not
  host `AF_VSOCK`. It has no 9p.
- p620 has `/dev/kvm`. p620's NixOS config lives in `~/.config/nixos`
  (`hosts/p620/configuration.nix`, uses agenix); agents must not edit it.
- Roles and the approval queue: #2 defines admin / approver / member (S6 adds
  writes). #1 Phase 3 defines the per-action approval queue. Neither code
  exists on any branch ("not found").

## Deviations from the spec (for approval with this plan)

1. **`nixarchy vm` is not "the same way".** Spec feasibility fact 1 says
   cloud-hypervisor "in the same way as `nixarchy vm`, no root, no rebuild".
   Real `nixarchy vm` is qemu with SLiRP, no tap. Per-tap nftables (the
   spec's network design) needs tap devices, nft and `systemd-run` of
   system units, so the runner is a **privileged host service** and needs a
   one-time NixOS module on p620 (step 6, owner imports and rebuilds). After
   that, create and destroy need no rebuild, which is what the spec cares
   about. Decision for approval: runner runs as root with systemd hardening;
   VMs run as an unprivileged `rfactory-vm` user via `-p User=`.
2. **Guest store is an erofs of the guest's own closure** (`storeOnDisk =
   true`), not the 9p share of the host `/nix/store` that `nixarchy` guests
   use. cloud-hypervisor has no 9p, and a virtiofs share would expose the
   whole host store to the guest. Same "one read-only image" as the spec;
   boot is a little slower, which the isolation rule allows.
3. **vsock host side is a Unix socket per VM**, not CID-addressed
   `AF_VSOCK`. The runner therefore keys its map by socket path (it still
   assigns a CID for the guest), and uses cloud-hypervisor's `CONNECT
   <port>` handshake host → guest and `<socket>_<port>` listeners guest →
   host (see "vsock transport" above). The tagging rule is unchanged and no
   guest field is trusted.
4. **Dependencies the spec assumes do not exist yet.** See "Prerequisites"
   below. Steps 8 and 9 are written against injected interfaces
   (`sessions`, `queue`, `isApprover`, `isMember`) with in-memory fakes;
   step 13 replaces the fakes with the real pieces and step 14 builds the UI,
   both only once the prerequisites are on `main`. This is a sequencing
   change, not a design change.
5. *(Removed: Slack's published range was found and is recorded under
   Network, rule 6.)*
6. **Network rule order.** The spec lists RFC1918 and the host's addresses
   in the first "drop" rule and says protected ranges come first so no
   exception reopens them, yet also allows approved private previews and
   requires the guest to use the runner's resolver (a host address). As
   written, both exceptions are unreachable. The plan splits the drops:
   host, cluster, Factory, metadata and other-desktop ranges stay
   unconditional and first; the only rule before them is DNS (port 53 only)
   to the runner's resolver; approved `ip:port` previews come next, then
   the remaining private ranges are dropped. The protection the spec cares
   about (host, cluster and Factories never reachable) is unchanged.

## Prerequisites (named revisions)

| Needed by | Prerequisite | Where it is now |
|---|---|---|
| step 8 | #2 S1 (`core/src/gateway.js`, `scope.js`, `items.js`) merged to `main` | `feat/2-standalone-mode` (steps 1–7 at `f3ca6a0`), not on `main` |
| steps 9, 13, 14 | #5 Phase 1a `web/server.js` (oauth2-proxy trust rule) merged to `main` | planned in #5 plan step 6, not built |
| step 13 | #2's admin / approver / member roles in code | #2 spec only (S6), not built |
| step 13 | #1 Phase 3 per-action approval queue | #1 intent only, not built |

Steps 1–12 do not need any of these. Steps 13 and 14 do not start until all
four are on `main`; this plan does not build the roles or the queue.

## Steps

Owner-gated means: do not run it until the owner says OK. Steps 2, 6 (deploy),
17 run on p620. Builds on p620 are owner-gated too. Nothing here stages,
commits or pushes: the implementer hands back; I commit.

1. **Create** `flake.nix`, `desktop/guest/default.nix`,
   `desktop/guest/chrome.nix`: a `nixosConfigurations.desktop-guest` for
   microvm.nix with cloud-hypervisor, `vcpu = 2`, `mem = 3072`, `vsock.cid`,
   `storeOnDisk = true`, a tmpfs overlay (4 GiB), Xvfb, openbox, `x11vnc`
   (`-localhost -rfbport 5900 -viewonly`), `socat` bridges for the three vsock
   ports, Chrome (`allowUnfree` for `google-chrome` only), Node and
   Playwright for the guest agent, `cryptsetup` for profiles, no `openssh`,
   no secrets. Also `nixosConfigurations.desktop-guest-probe` = the same
   guest plus a test-only systemd service `rfactory-probe` on control port
   5000 that answers
   `{type:"probe", proto, addr, port}` with the connect result. It is used
   only by step 2 and step 15; the production image never has it.
   → verify, from the repo root:
   `nix flake check --no-build`;
   `nix eval --raw .#nixosConfigurations.desktop-guest.config.system.build.toplevel.drvPath`
   prints a store path;
   `nix eval .#nixosConfigurations.desktop-guest.config.services.openssh.enable`
   prints `false`;
   `nix eval .#nixosConfigurations.desktop-guest.config.systemd.services --apply 'builtins.hasAttr "rfactory-probe"'`
   prints `false`.
   Traps: pin `microvm` in `flake.lock`; do not copy `guest.nix`'s 9p
   `ro-store` share (Deviation 2); the image must hold no `/etc/ssh`; commit
   `flake.lock`; do not build on p620 here.

2. **Feasibility gate (owner-gated, runs on p620).** Create
   `desktop/gate/{vm.sh,vsock.sh,net.sh,meet.sh}` and `desktop/gate/RESULTS.md`
   (filled by hand). `vm.sh` starts one VM under
   `systemd-run --unit=rfactory-vm-gate` and destroys it; `vsock.sh` sends a
   length-prefixed JSON ping and pulls a VNC handshake through the bridge;
   `net.sh` loads a minimal per-tap rule set and probes from inside a
   `desktop-guest-probe` VM; `meet.sh` runs #1's Phase 0 join in the VM.
   → verify: each script exits 0 and `RESULTS.md` records the four facts as
   pass or fail with evidence. **If any fails, stop and report; do not build
   steps 3 onward.**
   Traps: needs root for tap and nft; the owner's OK before any build or run;
   announce on the agent bus before disrupting p620; run `shellcheck` on all
   scripts; never touch other VMs or `rfactory-vm-*` units you did not create.

3. **Create** `desktop/runner/net.js`, `desktop/runner/net.test.js`: pure
   functions that return the nft ruleset text for one VM (IPv4 and IPv6) in
   the exact order under "Network" (rules 0–7), the per-VM nft set, media
   ranges, the rate-limited drop log, and
   `validatePreview(ipPort, protectedRanges)` that refuses a preview inside
   a rule-2 range.
   → verify: `cd desktop && node --test runner/net.test.js` passes. Tests
   check: the order 0–7 exactly; the resolver accept matches only port 53
   on the resolver address, and any other port to that address hits the
   rule-2 drop; an approved `10.x:port` preview is accepted before the
   rule-4 drop, and another port on the same address is dropped; a preview
   overlapping the host, cluster or Factory range is refused by
   `validatePreview`; IPv6 ULA and link-local dropped; `169.254.169.254`
   dropped; guest-to-guest dropped; a DNS-set address that is private is
   still dropped by rule 4.
   Traps: CIDR overlap must work for IPv6 and for IPv4-mapped IPv6
   addresses; previews are `ip:port`, never a hostname; do not interpolate
   user strings into rules (quote and validate).

4. **Create** `desktop/runner/vsock.js`, `desktop/runner/protocol.js`,
   `desktop/runner/protocol.test.js`:
   `vsock.js` implements the cloud-hypervisor transport from "vsock
   transport": `connectGuest(sockPath, port)` connects the Unix socket,
   writes `CONNECT <port>\n`, requires `OK <n>\n` within 2 s and returns the
   stream (only ports 5000 and 5900 are allowed); `listenGuest(sockPath)`
   listens on `<sockPath>_5001` only. `protocol.js` is
   the length-prefixed JSON framer (4-byte big-endian length, 64 KiB max),
   schemas for each message, a drop-and-log path for oversize, malformed,
   wrong-schema or unknown types, and `tag(msg, socketPath, map)` that sets
   `call_id`, `scope`, `desktop_id` from the map and discards any such field
   sent by the guest.
   → verify: `cd desktop && node --test runner/protocol.test.js` passes.
   Tests: oversize, truncated frame, two frames in one chunk, split frame,
   guest claims another `call_id` and gets its real one; against a fake
   Unix-socket server: `connectGuest` sends exactly `CONNECT 5000\n`,
   rejects a reply other than `OK <n>\n`, times out at 2 s, and refuses
   port 22; `listenGuest` creates only the `_5001` socket.
   Traps: reject the frame header before buffering the body; no
   `JSON.parse` of an oversize body; fixed message type allowlist; no
   prototype pollution (`__proto__`) in parsed objects.

5. **Create** `desktop/runner/runner.js`, `desktop/runner/lifecycle.js`,
   `desktop/runner/runner.test.js`: `create/destroy/list/heartbeat` over mTLS,
   the `systemd-run` call from the spec, the reconcile loop on start, the
   destroy triggers (call end, 30 s worker heartbeat, 60 s server heartbeat,
   10 min idle, `RuntimeMaxSec`), cleanup retry (3 with backoff, then alert
   and refuse `create`), capacity 3 with spare counted and a mutex so two
   concurrent `create`s cannot both pass, the `tc` 20 Mbit/s and 1 GiB egress
   quota, spare handling.
   → verify: `cd desktop && node --test runner/runner.test.js` passes with
   injected fake `exec` and fake clock: 4th `create` returns `capacity`, two
   simultaneous `create`s with one slot left give one success, forced cleanup
   failure retries 3 times then blocks `create`; worker heartbeats every 5 s
   keep the VM alive, a beat delayed by 20 s (gap 25 s) does not destroy it,
   and a 30 s gap does.
   Traps: no shell string building (argv arrays only); heartbeat timers use
   the injected clock; `destroy` is idempotent; limits come from config, not
   constants; the runner never trusts a guest-supplied id.

6. **Create** `desktop/nixos/runner.nix` and export it as
   `nixosModules.desktop-runner` from `flake.nix`: the `rfactory-runner`
   service (hardened), dnsmasq with `nftset=`, the `rfactory-vm` user, nft
   base table, tap and bridge-less per-VM tap setup hooks, and the agenix or
   sops-nix key path option. **Do not edit `~/.config/nixos`.** The owner
   imports the module.
   Also create `desktop/nixos/sample-host.nix` (a minimal host that imports
   the module, used only for evaluation) and export it as
   `nixosConfigurations.desktop-runner-sample`.
   → verify, from the repo root: `nix flake check --no-build`;
   `nix eval --raw .#nixosConfigurations.desktop-runner-sample.config.system.build.toplevel.drvPath`
   prints a store path;
   `nix eval .#nixosConfigurations.desktop-runner-sample.config.networking.firewall.allowedTCPPorts`
   lists only the mTLS port. **Deploy is owner-gated** (rebuild on p620,
   announce on the agent bus first).
   Traps: p620 has `/dev/kvm`; a cloud VM without KVM must make `create`
   return a clear refusal, not crash; no secrets in the store; the module
   must not open any host port other than the mTLS one.

7. **Create** `desktop/guest/agent/{index.js,control.js,heartbeat.js}` and
   `desktop/guest/agent/agent.test.js`: guest agent that reads the three vsock
   ports, runs the control Chrome with Playwright (`serviceWorkers: 'block'`,
   `context.route('**/*')` origin check, popup and stray-page closing),
   implements `cancel`, sends the heartbeat **every 5 s** and the call-end
   event, and fills `desktop_login` only from a runner message. Also
   `desktop/guest/agent/profile.js`: on a `profile-attach {key}` control
   message, `cryptsetup open --key-file=- /dev/vdb rfprofile` (key on
   stdin), mount on `/run/rfactory/profile` with `nodev,nosuid,noexec`, and
   start the control Chrome with `--user-data-dir=/run/rfactory/profile/chrome`;
   on `cancel` or shutdown, close Chrome, unmount, `cryptsetup close`.
   → verify: `cd desktop && node --test guest/agent/agent.test.js` passes
   against a local test server: redirect chain, meta refresh, JS `location`,
   form post, fetch and popup to a non-allowed origin are all aborted; a
   service worker does not register; `cancel` closes the context within 2 s;
   heartbeats go out every 5 s (fake clock); `profile.js` with a fake `exec`
   passes the key only on stdin (never argv or env), uses the mount options
   above, and closes in order Chrome → unmount → `cryptsetup close`.
   Traps: pin `playwright-core` 1.65.1 as in `spike/package.json`; the call
   Chrome and control Chrome use different profiles and user-data dirs;
   never log typed text; the agent never opens SSH or any other port.

8. **Edit (additive)** `core/src/gateway.js`; **create**
   `core/src/desktop/session.js`, `core/test/desktop.test.js`: register
   `desktop_*` tools and `propose_share`, the control session store, the
   five checks in order, queueing of calls that fail only the session checks,
   revoke (mark, `cancel`, 2 s then destroy), `desktop_type` refusal of
   values matching a stored credential, results returned as untrusted
   `content`. **Gated on #2 S1 being on `main`**; until then write it against
   the branch's `gateway.js` and keep `sessions`, `queue`, `isApprover`
   injected.
   → verify: `cd core && npm test` passes (existing tests unchanged), with
   cases for each of: no, expired, revoked session; wrong scope, call or
   desktop; tool not in `actions`; navigation to a host not in `hosts`;
   `until` more than 30 min away refused at grant; revoke during an action.
   Traps: `NEVER` and scope checks still run first; the existing four tools'
   schemas must not change; `desktop_*` must not be reachable when the phase
   or write state forbids it; a prompt-injected string can never grant,
   extend or approve (only the web UI approver path can).

9. **Create** `desktop/runner/vnc.js`, `web/live-view.js`,
   `web/public/live.html` (noVNC, view-only), and tests: runner VNC bridge,
   server WebSocket with membership check at admit and every 5 s, binding to
   one `desktop_id`, and the RFB client-message filter from "Live view"
   (forward handshake, `ClientInit`, `SetPixelFormat`, `SetEncodings`,
   `FramebufferUpdateRequest`; close on `KeyEvent`, `PointerEvent`,
   `ClientCutText` or an unknown type). **Gated on #5 `web/server.js`
   existing.**
   → verify: `cd web && node --test live-view.test.js`: non-member and
   other-scope member refused; revoking a member closes the stream within
   5 s (fake clock); a recorded noVNC client session (handshake,
   `SetEncodings`, `FramebufferUpdateRequest`) is forwarded byte for byte
   and a `FramebufferUpdate` comes back from a fake RFB server; a
   `KeyEvent`, a `PointerEvent` and a `ClientCutText` each close the stream
   and never reach the fake server. A real noVNC page receiving frames is
   checked in step 17.
   Traps: parse RFB client messages with their real lengths (`SetEncodings`
   and `ClientCutText` are variable length); session cookie check must not
   trust `X-Forwarded-Email` without the same oauth2-proxy rule #5 uses;
   pin the noVNC version and vendor it, no CDN.

10. **Create** `desktop/runner/profiles.js`, `desktop/runner/profiles.test.js`:
    profile record, admin-only create, list and delete, one-scope binding, a
    single-attach lock, LUKS image create (`cryptsetup luksFormat` with the
    key on stdin, on the runner, without ever opening it on the host),
    attach as a second virtio-blk disk (`--disk path=<image>`) plus a
    `profile-attach {key}` control message to the guest (step 7's
    `profile.js`), retention expiry, and delete order (destroy desktop, then
    delete image).
    → verify: `cd desktop && node --test runner/profiles.test.js`: attach to
    another scope refused; second attach refused; delete while attached
    destroys the desktop first (assert call order); expiry job removes only
    expired; the fake `exec` log shows no `cryptsetup open` and no `mount`
    on the host, and the key only on stdin. Ciphertext-only on a real host,
    while attached and after a killed VM, is checked in step 17.
    Traps: the host must hold only ciphertext, so the key is never written to
    disk on the host outside the secret path; no key in logs or argv; use
    stdin or a file descriptor for `cryptsetup`.

11. **Share (blocked until D5 passes and the owner says so).** **Create**
    `desktop/guest/agent/share.js`, `desktop/guest/agent/share.test.js`; **edit**
    `desktop/guest/agent/control.js`, `core/src/desktop/session.js`: share
    window with random nonce title and locked `document.title`, the
    auto-select flag on the call Chrome, the `getDisplayMedia` track check
    (`displaySurface === 'window'` and label contains the nonce), stop that
    closes the window, 5 s control-down rule in the runner, `propose_share`
    queued for approver click, and consent bound to the target (see
    "Share"): the share page's route handler allows only the approved
    origin, and a `framenavigated` on its main frame to any URL other than
    the approved one, a popup from it, or a change of shared window stops
    the share with `share-target-changed`; the gateway refuses driving tools
    on the shared page.
    → verify: `cd desktop && node --test guest/agent/share.test.js`: wrong
    label or `displaySurface === 'monitor'` stops the track before it is
    returned; a page changing its title does not change the match; stop
    with a failing `stopShare` still ends capture; during an active share,
    `location.href` to another path on the same origin, a link click to
    another allowed origin, and `window.open` each stop the share and
    report `share-target-changed`; `desktop_click` on the shared page is
    refused. Live check is owner-only (step 17).
    Traps: the library's override is `inject/page-inject.js:764`, used by
    `@vibeconferencing/calls` 0.1.0-alpha.3; hook around it, do not fork it;
    if D5 fails, **stop** and report: the spec needs a loopback update.

12. **Create** `desktop/ranges/{ranges.json,refresh.js,refresh.test.js}`,
    `.github/workflows/refresh-ranges.yml`, `desktop/runner/preflight.js`:
    pinned media ranges per platform, the scheduled job that opens a PR,
    and a pre-call connectivity probe that fails the call with a clear
    message if ranges drifted (no audio, never open egress).
    → verify, from the repo root: `cd desktop && node --test
    ranges/refresh.test.js`; `actionlint .github/workflows/refresh-ranges.yml`
    if installed; `ranges.json` lists, per platform, its source URL, or the
    literal string `"not found"`. Slack's entry is
    `{ "cidrs": ["99.77.128.0/18"], "udp": [3478, 22466], "tcp": [443],
    "source": "https://slack.com/help/articles/36284146785427" }`.
    Traps: record only what an official published list says; use "not found"
    for any platform without one; the job needs no secrets beyond the
    default token; it only opens a PR, never merges.

13. **Production wiring (after the Prerequisites are on `main`).**
    **Edit** `web/server.js` (additive), `core/src/desktop/session.js`;
    **create** `web/desktop-routes.js`, `web/test/desktop-routes.test.js`,
    `desktop/runner/client.js` (mTLS client for the server): replace the
    step 8/9 fakes with the real pieces: `isApprover` / `isMember` from #2's
    roles, `queue` from #1 Phase 3's approval queue, `sessions` persisted in
    the server's store, and the runner reached through `client.js`. HTTP
    routes, all behind #5's sign-in and scope check:
    `POST /api/desktop/:id/handover` (approver only; body `{actions, hosts,
    minutes ≤ 30}`), `POST /api/desktop/:id/revoke`,
    `POST /api/desktop/:id/share/:proposal/approve` (approver only),
    `POST /api/desktop/:id/share/stop`, `GET /api/desktop/:id/state`
    (members: handover, countdown end, running action, queued actions,
    share, cleanup alert), and the live-view WebSocket from step 9 mounted
    on the server.
    → verify: `cd web && node --test test/desktop-routes.test.js`: a member
    who is not an approver gets `403` on handover, revoke and share approve;
    `minutes: 31` is refused; `state` returns the live fields; a queued
    action runs only after approval; `cd core && npm test` and
    `cd web && npm test` stay green.
    Traps: no new auth code; reuse #5's oauth2-proxy rule and #2's role
    check; every route re-checks scope; the runner mTLS key path comes from
    the module option (step 6), never from the repo.

14. **Web UI pieces (after step 13).** **Create**
    `web/public/desktop.html`, `web/public/desktop.js`,
    `web/public/desktop.css`, `web/test/desktop-ui.test.js`: one page per
    desktop with the view-only live view (step 9's `live.html` embedded),
    **handover controls** (approver only: actions, hosts, minutes ≤ 30,
    grant and revoke), the **countdown** to `until`, the **running action**
    and **pending actions** with approve / reject (approver only), the
    **share** line "Sharing: <url>" with **Stop**, share proposals with
    approve, and a **cleanup alert** banner for admins when the runner
    reports blocked cleanup. It polls `GET /api/desktop/:id/state` every
    2 s. Same rules as #5's page: `textContent` only, no `innerHTML`, no
    inline script, CSP `default-src 'self'`, keyboard usable, a live region
    for state changes.
    → verify: `cd web && node --test test/desktop-ui.test.js` (DOM shim as
    in #5): controls hidden for a non-approver; the countdown renders from
    `until`; Stop calls `/share/stop`; a URL or action text containing
    `<img src=x onerror=…>` renders as text; `grep -rn innerHTML web/public`
    returns nothing.
    Traps: the UI is not the security boundary; every action is refused
    server-side too (step 13).

15. **Verification scripts.** **Create** `desktop/verify/lib.sh` and
    `desktop/verify/{net,channel,lifecycle,capacity,handover,secrets,share,profiles,liveview,e2e}.sh`:
    each starts what it needs through the runner API (the probe image where
    a probe from inside the guest is needed), checks, cleans up, and prints
    one `PASS <name>` or `FAIL <name>: <evidence>` line per check in the
    step 17 checklist. They only run on p620 with the owner's OK (step 17).
    → verify (offline, here): `shellcheck desktop/verify/*.sh` is clean;
    `bash -n` passes for each; every check name in step 17's checklist
    appears in exactly one script (`grep -c`).
    Traps: argv arrays, no `eval`; every script has a `trap … EXIT` that
    destroys what it created; never touch units it did not create.

16. **Review (mine, not a coder step).** After steps 1 to 15 that apply, a
    fresh `opus` agent gets only this plan path and `git diff`; Codex reads
    the same diff read-only. Findings are confirmed or refuted before fixing.
    → verify: findings list shown with the diff.

17. **Owner-gated verification and end to end on p620 (mine).** With the
    owner's OK and an agent-bus notice, from `desktop/` on p620, as root:
    `for s in net channel lifecycle capacity handover secrets share profiles liveview e2e; do ./verify/$s.sh; done | tee verify/out.txt`.
    Every line below must be `PASS` (share checks only after D5 and step 11):

    | Script | Check (one `PASS`/`FAIL` line each) |
    |---|---|
    | `net.sh` | TCP and UDP, IPv4 and IPv6, from a probe guest fail to: p620's LAN address, a cluster pod IP, a cluster service IP, each Factory host, `169.254.169.254`, a second running desktop |
    | `net.sh` | resolver port 53 works; any other port on the resolver address fails |
    | `net.sh` | DNS for a name not on the allowlist gets no answer |
    | `net.sh` | an allowlisted public preview loads; an approved `ip:port` private preview loads; another port on that IP fails |
    | `net.sh` | a spoofed source address from the guest is dropped (the anti-spoof rule's counter rises) |
    | `net.sh` | configuring a private preview that overlaps a protected range is refused |
    | `channel.sh` | host → guest `CONNECT` to any port other than 5000/5900 fails; guest → host connect to any port other than 5001 fails |
    | `channel.sh` | oversized, malformed and wrong-schema messages are dropped and logged |
    | `channel.sh` | a guest message claiming another `call_id` is tagged with its real one |
    | `lifecycle.sh` | for each case, `list` is empty, no `rfactory-vm-*` unit remains and `/run/rfactory-desktop/<id>` is gone: normal call end; worker heartbeat loss; server heartbeat loss; idle expiry; `RuntimeMaxSec` (60 s in the test); the runner killed (VMs die via `BindsTo`); runner restart with a live call (VM not kept); forced cleanup failure (3 retries, alert, `create` blocked until cleared) |
    | `capacity.sh` | a 4th `create` (spare counted) returns `capacity`; two simultaneous `create`s with one slot give one success; filling the tmpfs overlay stops at 4 GiB; the 1 GiB egress quota drops the tap and ends the call; start-up time is printed; the owner checks one call's audio while two others run |
    | `handover.sh` | rejected or queued for: no session, expired, revoked; wrong scope, call, desktop; action not in `actions`; blocked: redirect chain, meta refresh, JS `location`, popup to another origin, service worker, form post, click navigating elsewhere; revoke during an action stops it within 2 s or destroys the VM |
    | `secrets.sh` | no credential files or cookies in the guest apart from the attached profile; `desktop_type` with a stored value is refused; a preview login never appears in the brain input or the logs |
    | `share.sh` | runs only with the approved nonce window; a title change does not change the match; auto-select pointed at the screen: the track is stopped (the owner confirms nothing reaches Meet); navigation of the shared page stops the share (`share-target-changed`); Stop ends the share with `stopShare` made to fail; control channel down 5 s destroys the VM |
    | `profiles.sh` | attach to another scope and a second attach are refused; while attached and after the VM is killed, `cryptsetup isLuks` succeeds on the host image, no `/dev/mapper` entry for it exists on the host, and `strings` finds no known plaintext marker; deleting or expiring an attached profile destroys the desktop first |
    | `liveview.sh` | a non-member and another scope's member are refused; revoking a member closes their stream within 5 s; a real noVNC page (headless Chrome) receives at least one frame; a `KeyEvent` sent by the test closes the stream and the guest screen is unchanged |
    | `e2e.sh` (owner watches) | in a desktop VM the bot joins a Meet; an approver hands over one allowlisted preview origin; the agent opens it; an approved share shows only that window; Stop ends it; the call ends and nothing of the VM is left |

    Then measure RAM, CPU and start-up time, put the measured sizing in the
    module's config, and write `desktop/RESULTS.md` quoting `verify/out.txt`.
    → verify: `grep -c '^FAIL' verify/out.txt` prints `0`, and `RESULTS.md`
    quotes every line.
    Traps: never touch p510 or the Factory pods; owner-only live checks for
    the share and the call audio; leave nothing behind (no `rfactory-vm-*`
    unit remains); `verify/out.txt` holds no secret values.

## Tests

- `cd desktop && node --test` (steps 3, 4, 5, 7, 10, 11, 12): all pass,
  offline, no root, no network.
- `cd core && npm test` (steps 8, 13): existing tests plus `desktop.test.js`
  pass.
- `cd web && npm test` (steps 9, 13, 14).
- `nix flake check --no-build` at the repo root (steps 1, 6), plus the
  `nix eval` checks in steps 1 and 6.
- `shellcheck desktop/gate/*.sh desktop/verify/*.sh`.
- Owner-gated on p620: the gate scripts (step 2) and the full checklist
  (step 17).

## Rollback

- All new code is additive under `desktop/`, `web/live-view.js`,
  `web/desktop-routes.js`, `web/public/desktop.*`, `flake.nix`, and new
  files in `core/src/desktop/`; revert the commits. The only edits to
  existing code are the additive registration in `core/src/gateway.js` and
  the route mounting in `web/server.js`.
- On p620: remove the `desktop-runner` import from the owner's NixOS config
  and rebuild (owner-gated). Before that, `systemctl stop rfactory-runner`
  destroys every VM (they are `BindsTo` it); then
  `systemctl list-units 'rfactory-vm-*'` must be empty and
  `/var/lib/rfactory-desktop` (runner state) can be deleted. Profile images
  hold ciphertext; delete them with the profile API or by hand.
- Calls fall back to #1's voice-only container bot, so no call depends on a
  desktop.

## Open questions for the owner

1. Approve Deviation 1 (privileged runner on p620, one-time NixOS module that
   you import), Deviation 2 (erofs store, no host store in the guest) and
   Deviation 6 (network rule order).
2. Should #1's approval queue and #2's approver role be built first (steps 13
   and 14 wait for them), or is it fine that steps 1–12 go ahead against
   fakes meanwhile?
3. Is D5 (share check) to be run before this plan's work starts, or only
   before step 11?
