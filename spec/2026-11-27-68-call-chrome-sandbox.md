---
status: approved
issue: 68
intent: intent/2026-11-27-68-call-chrome-sandbox.md
---

# Spec: the call Chrome runs with its sandbox on, so Meet admits the bot

## Design

Do for the call Chrome what `default.nix` already does for the control Chrome.

1. **A user and a wrapper** (`desktop/guest/default.nix`). Add `rfcall`
   (uid/gid 991, home `/var/lib/rfcall`, `createHome`), and a `callChrome`
   wrapper shaped like `controlChrome`:
   `HOME=/var/lib/rfcall setpriv --reuid=991 --regid=991 --clear-groups google-chrome-stable "$@"`.
   The agent service gets `CHROME = callChrome` (in place of the bare Chrome)
   and `CALL_UID = "991"`, `CALL_GID = "991"`. The Deviation 18 comment goes.
2. **The call worker** (`desktop/guest/agent/call.js`, `playwrightHost`).
   When `env.CALL_UID` is set, it chowns the bot's profile directory
   (`o.userDataDir`, made by `bot/run.js` with `mkdtemp` as root, mode 0700)
   to `CALL_UID:CALL_GID` before the launch, and adds no `--no-sandbox`. The
   calls library already launches with `chromiumSandbox: true`, so the sandbox
   is then on. Without `CALL_UID` (a run outside the guest image) the worker
   keeps `--no-sandbox`, as `index.js` does for the control Chrome without
   `CONTROL_CHROME`; root Chrome refuses to start sandboxed.
3. **`bot/run.js` is unchanged.** It removes the profile as root at the end,
   which works whatever its owner.
4. **Release.** Rebuild the boot and disk images
   (`deploy/k3d/import-images.sh guest-kubevirt-boot-image guest-kubevirt-disk-image`),
   pin the new digests and init path in `deploy/k8s/rfactory-desktops/runner.yaml`,
   merge, refresh Argo CD `rfactory-desktops`. The web image does not change.

## Alternatives rejected

- **Hide `--no-sandbox` from Meet** (a patched Chrome or an init script): we
  do not know which signal Meet reads, and patching it is an arms race.
- **Share `rfchrome`**: the owner chose a user of its own (intent decision 1).
- **Run the whole agent unprivileged**: it needs root for `cryptsetup`,
  mounts and the profile disk; far larger than this fix.

## Risks

- **User namespaces in the KubeVirt guest.** The sandbox needs unprivileged
  user namespaces (or the setuid helper, which nixpkgs' Chrome does not
  ship). The control Chrome already relies on this. If Chrome cannot start
  sandboxed, every call fails at launch (`state error`); rollback is the
  previous pins in `scratchpad/69-release/guest-live.txt`.
- **X display access for uid 991.** Xvfb runs without `-auth`, so local
  clients from any uid connect; the control Chrome shows this already.
- **The share step.** `share.js` and the capture guard run inside the same
  Chrome via Playwright; an owner change does not touch them. Checked in
  the live check (a share request).
- **Files Chrome writes outside the profile** (downloads, crash dumps) go to
  `/var/lib/rfcall` or Playwright's temp dirs; nothing the bot reads.

## Verification

- Unit: `node --test desktop/guest/agent/` passes. `kubevirt.test.js`
  "call worker" test: with `CALL_UID` set, the launch args hold no
  `--no-sandbox` and the profile is chowned to 991:991 before the launch;
  without it, `--no-sandbox` stays.
- Build: `nix build` of the boot and disk images succeeds (through
  `import-images.sh`).
- Live (after release), with the observer in the microVM `rf-observer` in the
  test Meet: one captions-mode call; the bot reaches `in-call` on its first
  try, with no "can't join" error. The same call then serves the #56 check
  (first question after the greeting); one audio-mode call serves #67.
