---
status: draft
issue: 68
spec: spec/2026-11-27-68-call-chrome-sandbox.md
coders:
  1: coder   # a few Nix lines that copy the controlChrome pattern next to them
  2: codex   # small, ordering-sensitive logic (chown before launch, flag only without CALL_UID) plus its test
reviewers:
  - codex   # the plan draft and the final diff
  - agy     # the plan draft and the final diff, in parallel
---

# Plan: the call Chrome runs with its sandbox on, so Meet admits the bot

## Decisions carried over (approved intent and spec)

- Cause (microVM test, 2026-11-27): Meet refuses a Chrome started with
  `--no-sandbox` ("You can't join this video call"); the same Chrome without
  it is admitted. Name and proxy are ruled out.
- The guest's call Chrome runs as a user of its own, `rfcall` (uid/gid 991,
  home `/var/lib/rfcall`), through a `setpriv` wrapper like `controlChrome`;
  not `rfchrome`.
- No `--no-sandbox` on the call Chrome in the guest image. The calls library
  already launches with `chromiumSandbox: true`
  (`bot/node_modules/@vibeconferencing/calls/hosts/playwright/index.js` l.181).
- Outside the guest image (`CALL_UID` unset) the worker keeps `--no-sandbox`,
  as `index.js` l.108–110 does for the control Chrome without `CONTROL_CHROME`.
- `bot/run.js` is unchanged (it makes the profile with `mkdtemp` as root,
  mode 0700, and removes it as root).
- Rejected: hiding the flag from Meet; sharing `rfchrome`; an unprivileged agent.

## Steps

1. `desktop/guest/default.nix`:
   - after `controlChrome` (l.7–10) add `callChrome`, the same wrapper with
     `HOME=/var/lib/rfcall` and `--reuid=991 --regid=991`;
   - after l.17–18 add `users.groups.rfcall.gid = 991;` and
     `users.users.rfcall = { isSystemUser = true; uid = 991; group = "rfcall"; home = "/var/lib/rfcall"; createHome = true; };`;
   - l.44: `CHROME = "${callChrome}";` with the comment "the call Chrome runs as
     rfcall with the Chrome sandbox on (#68; Meet refuses --no-sandbox)", and add
     `CALL_UID = "991"; CALL_GID = "991";`.
   → verify: `nix-instantiate --parse desktop/guest/default.nix >/dev/null`
   (syntax only); option names and bindings are checked by the image build in step 3.
   Traps: `CHROME` is also the fallback control Chrome in `index.js` l.110, used
   only when `CONTROL_CHROME` is unset; the guest always sets it, so no change.

2. `desktop/guest/agent/call.js` l.84–87 (`workerDeps.playwrightHost`):
   - add `const fs = require('node:fs');` to the imports (l.3–4); the test injects
     `deps.chown`, so a missing import would pass the tests and fail in the VM;
   - `const sandboxed = env.CALL_UID && env.CALL_GID;` when set:
     `await (deps.chown || fs.promises.chown)(o.userDataDir, Number(env.CALL_UID), Number(env.CALL_GID))`
     before `withProxy(...)`, and leave `'--no-sandbox'` out of the args;
   - when unset: args as today (`'--no-sandbox'` kept), no chown.
   - a one-line comment with the why (#68: Meet refuses a `--no-sandbox` Chrome);
     add `chown` to the deps list in the comment at l.78.
   - `bot/run.js` l.470–472 makes the profile with `mkdtemp` and launches straight
     after, writing nothing into it, so a non-recursive chown is enough.
   `desktop/guest/agent/kubevirt.test.js` l.66–83: keep the existing test as the
   "no CALL_UID" case (still expects `--no-sandbox`); add one test with
   `env: { CALL_UID: '991', CALL_GID: '991' }` and a `deps.chown` that returns a
   promise held pending: the launch has not started while it is pending; after
   it resolves, the chown got `('/d', 991, 991)` and the args hold no
   `--no-sandbox`. In the existing test, assert no chown call.
   → verify: `node --test desktop/guest/agent/kubevirt.test.js`, then
   `node --test desktop/guest/agent/` (all pass). The worktree has no
   `bot/node_modules`: link it from the main checkout (untracked) to run them.
   Not a gap: `o.args` from `bot/run.js` (l.472) carries no flags, and
   `callLaunchArgs` (`share.js` l.9) only adds `--auto-select-desktop-capture-source`;
   the STT bridge and `share.js` use no files, devices or sockets (in-page only).
   Traps: `env` reaches `createCallWorker` from `index.js` (process.env); the
   chown must not run when the launch is skipped by an earlier failure; keep
   the `host.close()` cleanup path at l.88–94 unchanged.

3. Build and pin (lead). Announce on the agent bus; record rollback values:
   the current `runner.yaml` pins on main (the #69 values: boot `2c6b8bb6…`,
   disk `1245fd51…`, cmdline `z0sn1rb2…`) into `scratchpad/68-release/guest-main.txt`;
   `deploy/k3d/import-images.sh guest-kubevirt-boot-image guest-kubevirt-disk-image > scratchpad/68-release/refs.txt`;
   pin the boot and disk `repo:tag@digest` and the cmdline `init=` path in
   `deploy/k8s/rfactory-desktops/runner.yaml` (inline `{name: X, value: "…"}` entries).
   → verify: both images build; the three values in `runner.yaml` match `refs.txt`
   and the built system path.
   Traps: never `kubectl apply`; the release (merge, Argo CD refresh) needs the
   owner's OK on the PR.

4. Final reviews (lead): Codex and agy on the diff, in parallel with a fresh
   Opus review given only this plan and `git diff origin/main`. PR linking
   intent, spec and plan; on the owner's OK, merge and hard-refresh Argo CD
   `rfactory-desktops`.

5. Live check (lead, after release): observer in microVM `rf-observer` in the
   test Meet; one captions-mode call (tfactory-testing): the bot reaches
   `in-call` on the first try, no "can't join" — this is also the first proof
   that the call Chrome starts sandboxed as uid 991 in the KubeVirt guest (if
   it does not start, roll back at once); ask s70.wav (covers #56); ask the bot
   to share its board and confirm on the observer's screen that the share shows
   (the spec's share check). Then one audio-mode call with s71.wav: the bot's
   events show the question `heard` through STT and an answer (covers #67).
   Results on #68, #56, #67.

## Tests

- `node --test desktop/guest/agent/` → all pass, including the new CALL_UID test.
- `node --test bot/test/` → unchanged, all pass.
- Image build through `import-images.sh` → exit 0.
- Live check as in step 5.

## Rollback

Revert the PR: it restores the #69 pins in `runner.yaml` (boot `2c6b8bb6…`,
disk `1245fd51…`, cmdline `z0sn1rb2…`, kept in `scratchpad/68-release/guest-main.txt`),
the images deployed before this change. Hard-refresh Argo CD `rfactory-desktops`.
The old images stay imported (pinned against kubelet GC) on the nodes.

## Accepted risk

There is no pre-merge run of the new guest: the first sandboxed start of the
call Chrome in the KubeVirt guest is the live check in step 5 (Codex review,
high). The control Chrome already runs as `rfchrome` with the sandbox on in
this guest and no guest Nix file disables user namespaces; rollback is one revert.
