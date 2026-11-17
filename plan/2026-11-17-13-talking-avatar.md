---
status: approved
issue: 13
spec: spec/2026-11-17-13-talking-avatar.md
coders:
  1: coder   # portraits, manifest and notices: fetch, hash, write files
  2: codex   # state module: timing rules and mesh geometry are small, tricky logic
  3: codex   # renderer drawing and its headless Chrome tests (owner: "use codex in agent teams", 2026-11-17)
  4: codex   # bot integration: retries, stop paths and the stopping flag are small, tricky logic
  5: codex   # scope switch, env pass-through, page footer and chat link (owner, 2026-11-17)
  6: coder   # licence files, package fields, upstream texts, README: mechanical
reviewers:
  - codex    # independent review of the diff against this plan (agent-team), plus a herdr-team review of each wave's diff before its commit (owner, 2026-11-17)
---

# Plan: A face for the bot that talks when it speaks

## Decisions carried over (approved intent and spec)

- **Evidence:** the live checks on 2026-11-17 (`spike/RESULTS.md` on
  branch `spike/d5b-camera`, `c45edb1`, `0b7a687`, `ad2e545`): the canvas
  camera shows as the bot's tile; Meet refuses the first camera turn-on;
  the owner chose a still portrait with blinking and frame motion, and
  approved the mesh-warp mouth (offline stills).
- **Library facts** (`@vibeconferencing/calls` 0.1.0-alpha.3, pinned):
  `window.__vibeconfMedia.setCameraRenderer(factory)` draws every frame
  and applies to existing cameras; it does not catch `render()` errors;
  `speechLevel()` is the smoothed level of the bot's own TTS (×0.86 decay
  per sample in silence); `bot-speaking` events are not replayed;
  `setCameraOn(on)` clicks Meet's button without confirming.
- **The face (every frame):** Factory dark background (`#1d2021`); the
  portrait at ~62 % of frame height, centred; an orange frame
  (`#fe8019`) around it; name strip "RFactory Bot (AI)"; an "AI" badge;
  a small source line "Source: github.com/olafkfreund/RFactory".
- **Idle:** blink every 3–6 s (eyelid ellipse in the skin colour sampled
  7 px above each eye, 130 ms, with a lash line), slow sway (±2 px,
  ±0.4°).
- **Speaking:** nods following the voice; the frame brightens with the
  level; the **mesh-warp mouth**. Mesh for **m01** (256×256 source px),
  measured and approved offline:
  - fixed ring: OL (58,150), OBL (74,194), OB (116,204), OBR (162,188),
    OR (168,146);
  - upper lip line, fixed: UL (77,141), UM (101,137), UR (125,134);
  - moving, by opening `d` (0..13 px): LL (77,141) fixed corner, LM
    (101,138+d), LR (125,134) fixed corner, LB (101,153+0.9d), JL
    (83,166+0.55d), C (113,177+0.85d), JR (148,159+0.5d);
  - triangles: (OL,LL,JL) (LL,LM,LB) (LM,LR,LB) (LL,LB,JL) (LB,C,JL)
    (LB,LR,C) (LR,JR,C) (LR,OR,JR) (OL,JL,OBL) (JL,C,OBL) (OBL,C,OB)
    (C,JR,OB) (JR,OBR,OB) (JR,OR,OBR);
  - draw the portrait, then the dark mouth shape (`#2a0e09`) between the
    upper lip line and LM, then each triangle textured from its `d = 0`
    source onto its moved destination (affine map, clip grown ~0.8 px to
    hide seams); no teeth;
  - eyes: (78,99) width 10 and (126,95) width 11.
- **Timing:** each frame reads `speechLevel()`; the mouth opens from the
  level alone (a missed `speaking: true` does not matter); on
  `bot-speaking: false` the mouth closes within 150 ms; level < 0.06 with
  no speaking event → closed; nods only while speaking; blinks only when
  idle.
- **Never frozen:** `render()` wrapped; an error draws the closed idle
  face, logged at most 3 times; 30 consecutive errors → the bot turns the
  camera off and logs `avatar failed: render`. `__rfAvatar.idle()` forces
  closed at once; `bot/run.js` calls it (waiting at most 200 ms) before
  every cancel and leave. A `stopping` flag set first prevents injection
  or turn-on after stopping begins.
- **Camera on:** after join and the chat line, unless stopping: check the
  portrait's SHA-256 against the manifest, inject, then up to **3
  attempts, 3 s apart**, each confirmed by Meet's button reading "Turn off
  camera". Failure → `setCameraOn(false)` (best effort), `avatar failed:
  <reason>`, the bot carries on without a camera.
- **Switch:** scope `avatar: "<id>"`, validated by `loadScope` against
  manifest ids that have anchors; unset → no camera, as today.
  `web/call.js` passes it to the bot as `RFACTORY_AVATAR`.
- **Cost:** ≤ 0.3 extra CPU core and ≤ 150 MB extra memory for Chrome,
  measured over 5 minutes with speech against the same call without the
  camera. One pre-scaled portrait cached per camera size, at most 2.
  Over → 15 fps (draw every second frame), measure again; still over →
  `avatar` unset by default and the owner told.
- **Portraits:** `bot/avatars/{f,m}01–20.webp`, unchanged, from
  `itsfutsy/OmegaStar` commit `8304f225fc2f88f9baef6de622a0d229666e09f9`
  (`src/assets/avatars/`), each SHA-256 in `bot/avatars/manifest.json`;
  `bot/avatars/NOTICE.md` with source, commit, "Copyright (C) 2026 Abram
  Industries Pty Ltd", AGPL-3.0, no warranty, "files unmodified".
- **Licence:** root `LICENSE` (verbatim AGPL-3.0); `"license":
  "AGPL-3.0-only"` in `bot/`, `core/`, `web/`, `spike/` `package.json`;
  root `NOTICE.md` listing every third-party part; upstream licence texts
  preserved in `LICENSES/` (copied from the installed packages); a
  "Licence" section in `README.md`; uncertain points marked "pending
  verification". Not a legal review.
- **Source offer:** canonical `https://github.com/olafkfreund/RFactory`;
  page footer "RFactory is free software (AGPL-3.0). Source: <link to the
  commit>"; the chat line after join carries the same link; the camera
  carries the source line on every frame. `deploy/pod.sh` builds only
  from a clean tree (untracked files included) whose `HEAD` is on
  `origin`, passes `--build-arg RFACTORY_COMMIT=<sha>`, and checks
  anonymously that `/tree/<sha>` answers 200.
- **Packaging:** `web/Containerfile` copies `bot/avatar/`, `bot/avatars/`,
  `LICENSE`, `NOTICE.md`, `LICENSES/`; an image check lists them and
  verifies the portrait hashes inside the image.
- **AI disclosure:** name, chat line and listening announcement unchanged;
  "AI" badge and name strip on every frame; illustrations only.

## Deviations (Codex review of the approved plan, 2026-11-17)

- **D1, camera API.** Use the public `call.camera.setOn(on)` for every
  turn-on, retry, failure cleanup and render-failure shutdown (not the
  internal `setCameraOn`). The fake call in tests exposes `camera.setOn`.
- **D2, mesh containment.** "Moved points stay inside the ring" means
  inside the lower-face polygon UL → UM → UR → OR → OBR → OB → OBL → OL →
  UL (the upper lip line plus the fixed ring); LM at (101,138) starts just
  below UM, inside it. The spec's containment line is read this way.
- **D3, stop paths.** Add to step 4's list: the direct `h.cancel()` in
  `play()` when a pending `call.speak()` resolves after cancellation
  (`bot/run.js:73`), stdin `error`, and a join failure. Each calls
  `__rfAvatar.idle()` (≤ 200 ms) when a page exists and is a no-op when
  it does not; tests cover the speak-after-cancel race and the absent
  page.
- **D4, scope to child.** Step 5 adds an `avatar` option to
  `createCallManager()`, passes `scope.avatar` from `web/server.js`, and
  tests the child's environment (`RFACTORY_AVATAR` present only when set).
- **D5, chat test.** Step 5 updates `bot/test/run.test.js`'s chat-line
  assertion for the appended source link (applied after step 4).
- **D6, test commands.** Run each suite in a subshell; Chrome on this host
  is `/etc/profiles/per-user/olafkfreund/bin/google-chrome-stable` (the
  image's is `/usr/bin/google-chrome-stable`); the `innerHTML` search is
  expected to find nothing and is checked separately:

  ```bash
  (cd core && npm test)
  (cd web && npm test)
  (cd bot && RF_TEST_CHROME=/etc/profiles/per-user/olafkfreund/bin/google-chrome-stable RFACTORY_REQUIRE_BROWSER=1 npm test)
  ! grep -rn innerHTML web/public
  shellcheck deploy/*.sh
  ```
- **D7, licence inputs and detail.** Step 6 runs `npm ci` in `bot/` and
  `core/` first so upstream licence files exist; `NOTICE.md` names Piper
  (GPL-3.0, separate process), the LJSpeech voice (public domain) and
  Google Chrome (proprietary, from Google's repository, not in this
  repository) explicitly; `bot/avatars/NOTICE.md` states the provenance
  rule (OmegaStar's licence is the only evidence of permission; the
  portraits are replaced if a rights claim is raised) and that any later
  change to a file is listed with what and when.
- **D8, executable checks.** Step 7 tests: a dirty tree, an untracked file
  and an unpushed commit are each refused; the anonymous source check
  runs (a fake `curl` in tests, the real one in the live build). Step 4
  tests that polling `__rfAvatar.errors` ≥ 30 calls
  `call.camera.setOn(false)`.
- **D9, order.** Reviews (step 9) run before step 8; step 8 needs the
  reviews' fixes committed. Step 8: `deploy/pod.sh up` with the existing
  environment, then `deploy/check-image.sh`. Step 10 measures with
  `podman stats --no-stream rfactory-web` every 30 s for 5 minutes, with
  and without `avatar`. Step 11: `gh pr create`. Traps: agent bus first;
  never while the owner is testing.

- **D10, wave A results.** m01's anchors in `bot/avatars/manifest.json`
  use the shape `bot/avatar/state.js` reads: `anchors.mesh.{points, move,
  triangles}` (with `move` one number per point, the downward factor),
  `eyes [{x, y, w}]`, `maxDrop`. The lead converted step 1's first shape
  to this and added the provenance and changes sections to
  `bot/avatars/NOTICE.md` (D7). `LICENSES/` names scoped packages with
  `-` for `/`. The Codex review of wave A found two P2s in step 2 (a stale
  close state blocks reopening from the level; the geometry tests used a
  local copy of m01); they are fixed in the next commit.
- **D11, all faces and a voice per face (owner, 2026-11-17).** The owner
  asked for more animated faces, picked at random per stand-up or project,
  and a male voice for male faces; approved the contact sheet ("approve
  all"). All 40 portraits get anchors in `manifest.json`: 34 with a mesh
  (m01 plus 33 fitted from m01's mesh by an affine map through each face's
  lip corners and chin, each passing the fold and containment checks;
  `maxDrop` is m01's 13 px scaled to each face) and
  6 bearded faces (m04, m07, m08, m12, m15, m17) as `{ still: true, eyes }`:
  blink, sway, nods and frame glow, no mouth warp. Step 5: scope `avatar`
  takes an id, a list of ids or `"random"`, resolved once per call; the
  voice follows the face: `m*` → Piper `en_US-joe-medium` (CC0, pinned by
  SHA-256 `abf4b998…3f08d2`, built into the image, added to `NOTICE.md`),
  `f*` → LJSpeech (unchanged). Selectable = has anchors.
- **D12, renderer test and review fixes.** The renderer test failed on the
  lead's host (the fallback frame differed from the reference in the frame
  region: 1243 pixels, max delta 59) and passed in Codex's pane; commit
  `a0123ab` was made with that failure. Cause: after repeated
  `getImageData` reads Chrome moves the test canvas from GPU to CPU, and
  the two resample the portrait (drawn at a half-pixel offset) differently;
  only hosts with a GPU switch. Fix in the test only: the test canvas is
  created with `willReadFrequently: true` (CPU from the first frame), and
  the closed-frame checks compare regions (mouth, frame, badge,
  disclosure) within 4 changed pixels. The renderer is unchanged for this;
  Meet's camera is never read back with `getImageData`. The renderer draws
  `still` anchors (D11) without the warp. Codex review of wave A/step 3: a
  stale `closingAt` survives past 150 ms and blocks reopening from the
  level alone (already fixed with its regression test in `649b35a`); the
  geometry tests run over
  every mesh in the real manifest at d = 0..maxDrop.

## Steps

Integration branch `feat/13-talking-avatar` (main with Phase 3 merged).
Each step runs in worktree `RFactory-wt/13-stepN` on `wip/13-stepN` cut
from it; the lead applies each finished step and commits only when every
suite in **Tests** passes there.

Waves: **A** = steps 1, 2, 6 in parallel; **B** = steps 3 and 5 (after
A); **C** = step 4 (after 3); then steps 7–11 (lead).

1. **Portraits, manifest, notices.**
   - Files: new `bot/avatars/{f,m}01–20.webp`, `bot/avatars/manifest.json`,
     `bot/avatars/NOTICE.md`, `bot/test/avatars.test.js`.
   - Fetch each file from
     `https://raw.githubusercontent.com/itsfutsy/OmegaStar/8304f225fc2f88f9baef6de622a0d229666e09f9/src/assets/avatars/<id>.webp`
     into a new empty directory, verify sizes and write SHA-256s into the
     manifest: `{ "source": {repo, commit, path}, "portraits": { "<id>":
     { "file", "sha256", "anchors": null } } }`; m01 gets the anchors in
     Decisions (`mesh` points, `move` factors, `triangles`, `eyes`,
     `maxDrop: 13`).
   - Tests: 40 entries; every file's SHA-256 matches; m01's anchors lie
     inside 256×256; ids without anchors are listed as not selectable.
   - Verify: `cd bot && npm test` → 0 failures.
   - Traps: never modify the image bytes; never execute anything from the
     download directory.
2. **State module.**
   - Files: new `bot/avatar/state.js`, `bot/test/avatar-state.test.js`.
   - Pure functions, no DOM: `createState({ now, random })` →
     `step(now, { level, speakingEvent })` → `{ open: 0..1, nod: 0..1,
     blink: bool }` and `idle()`; `meshAt(anchors, d)` → moved points.
     Use the library's smoothing in tests (×0.86 per sample decay).
   - Tests: mouth follows the level while speaking; closes within 150 ms
     of `speaking: false` with a high decaying level; opens from the level
     with no start event; level < 0.06 and no event → closed; nods only
     while speaking; blinks only when idle, every 3–6 s; `idle()` closes
     at once; for m01 every triangle keeps a positive signed area at d =
     0..13 (no fold-over) and moved points stay inside the ring.
   - Verify: `cd bot && npm test` → 0 failures.
   - Traps: the module must be serialisable into the page (no `require`
     at call time; export a `source` string or build with
     `Function.prototype.toString`).
3. **Renderer.**
   - Files: new `bot/avatar/renderer.js`, `bot/test/avatar-renderer.test.js`.
   - `buildRendererSource({ portraitDataUrl, anchors, sourceLine })` →
     the page script: decodes the portrait once, samples eyelid colours,
     caches one pre-scaled portrait per camera size (max 2), installs
     `window.__rfAvatar = { idle(), errors }` and
     `setCameraRenderer` with a wrapped `render()` that draws per
     Decisions using `state.js`; on error draws the closed idle face,
     logs at most 3 times, counts consecutive errors.
   - Tests in headless Chrome (`bot/`'s `playwright-core`, Chrome from
     `RF_TEST_CHROME`; **fail** rather than skip when
     `RFACTORY_REQUIRE_BROWSER=1`), with a fake `__vibeconfMedia` using
     the library's smoothing: mouth-region pixels differ between level 0
     and 0.8; "AI" badge, name strip and source line present in every
     frame; an injected exception after an open-mouth frame → next frame
     closed idle; error counter reaches 30.
   - Verify: `cd bot && RF_TEST_CHROME=/usr/bin/google-chrome-stable
     RFACTORY_REQUIRE_BROWSER=1 npm test` → 0 failures, 0 skipped.
   - Traps: no network in the page script; no `innerHTML`.
4. **Bot integration.**
   - Files: `bot/run.js`, `bot/test/run.test.js`.
   - With `RFACTORY_AVATAR` set: in `afterJoin`, after the chat line and
     unless `stopping`: read `bot/avatars/<id>.webp`, check its SHA-256
     against the manifest, inject `buildRendererSource(...)` through
     `call._inner.page.evaluate` (`shortcut:` comment: private field of an
     alpha lib, replace when it exposes a renderer option), then up to 3
     `setCameraOn(true)` attempts 3 s apart, each confirmed by
     `button[aria-label="Turn off camera"]`. Failure → `setCameraOn(false)`
     best effort, log `avatar failed: <reason>`. Poll
     `__rfAvatar.errors` every 5 s; ≥ 30 → camera off, log
     `avatar failed: render`.
   - Set `stopping` before anything else in `stop()`; call
     `__rfAvatar.idle()` (≤ 200 ms) before `cancelAll()` and before
     leaving, on every stop path: spoken leave (`cancel` then `leave`),
     `cancel`, parent `leave`, stdin `end`, the 60-minute limit, and the
     `left/removed/error` states.
   - Tests with a fake call: injection after the chat line; first attempt
     refused then success; three refusals → camera off and logged; a bad
     hash and an inject error → logged, no throw, speech works; `idle()`
     before cancel and leave on each listed stop path; no injection or
     turn-on after stopping began (stop during the hash read, during
     injection, between attempts); without `RFACTORY_AVATAR` the camera is
     never touched.
   - Verify: `cd bot && npm test` → 0 failures.
   - Traps: never `await` the avatar on the join, speech or stop paths
     beyond the 200 ms idle call.
5. **Scope, call and page.**
   - Files: `core/src/scope.js`, `core/test/scope.test.js` (`avatar`
     validated against `bot/avatars/manifest.json` ids with anchors);
     `web/call.js`, `web/test/call.test.js` (pass `RFACTORY_AVATAR` to
     the bot only when `avatar` is set); `web/server.js` (serve
     `RFACTORY_COMMIT` to the page); `web/public/index.html`,
     `web/public/app.js`, `web/public/style.css`, `web/test/app.test.js`
     (footer); `bot/run.js` `CHAT_LINE` gains "Source (AGPL-3.0): <link>"
     with the commit from `RFACTORY_COMMIT` (falls back to the repo URL).
   - Tests: `loadScope` refuses an unknown id and an id without anchors;
     the env var is passed only when set; the footer renders the link with
     `textContent`; the chat line carries the link.
   - Verify: `cd core && npm test`, `cd web && npm test`, `cd bot && npm
     test` → 0 failures; `grep -rn innerHTML web/public` → no output.
   - Traps: step 4 also edits `bot/run.js`; step 5 changes only the
     `CHAT_LINE` constant there, applied after step 4.
6. **Licence files.**
   - Files: new `LICENSE` (verbatim AGPL-3.0 text from
     `https://www.gnu.org/licenses/agpl-3.0.txt`, checked against
     OmegaStar's LICENSE SHA-256
     `0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd38…` prefix match),
     `NOTICE.md`, `LICENSES/` (upstream texts copied from
     `bot/node_modules/@vibeconferencing/calls/LICENSE`,
     `bot/node_modules/playwright-core/LICENSE` and `NOTICE` if present,
     and each of core's dependencies' licence files), `README.md` section;
     `"license": "AGPL-3.0-only"` in `bot/`, `core/`, `web/`, `spike/`
     `package.json`; a test `core/test/licence.test.js` that checks these
     exist and that every `package.json` names the licence.
   - Verify: `cd core && npm test` → 0 failures.
   - Traps: do not summarise upstream licences; copy them.
7. **Packaging and build guard (lead).** `web/Containerfile` copies
   `bot/avatar/`, `bot/avatars/`, `LICENSE`, `NOTICE.md`, `LICENSES/` and
   takes `ARG RFACTORY_COMMIT` into `ENV`; `deploy/pod.sh` refuses a dirty
   tree (`git status --porcelain` non-empty) or a `HEAD` not on `origin`,
   builds with `--build-arg RFACTORY_COMMIT`, checks `curl -sfo /dev/null
   https://github.com/olafkfreund/RFactory/tree/<sha>` without a token;
   new `deploy/check-image.sh` lists the files in the built image and
   verifies the portrait hashes there. Verify: `shellcheck deploy/*.sh`;
   a dry run with a dirty tree is refused.
8. **Deploy (lead; owner's OK; agent bus first).** Scope `avatar: "m01"`;
   rebuild the pod; run `deploy/check-image.sh`.
9. **Reviews:** a fresh Opus agent given this plan and `git diff`, and
   Codex (`reviewers`), read-only; findings fixed with tests.
10. **Live test (owner, on p620):** in a Meet: the face with badge and
    source line; blinking and sway while idle; mouth and nods follow
    speech and stop with it; "RFactory, leave" mid-answer leaves with a
    closed mouth; the camera comes on although Meet refuses the first
    attempt; CPU and memory measured over 5 minutes (`podman stats`)
    against a call with `avatar` unset; with `avatar` unset the bot joins
    with no camera.
11. **PR** linking intent, spec and plan; which steps Codex and the coder
    did.

## Tests

On the integration branch, all with 0 failures:

```bash
cd core && npm test
cd web && npm test
cd bot && RF_TEST_CHROME=/usr/bin/google-chrome-stable RFACTORY_REQUIRE_BROWSER=1 npm test
grep -rn innerHTML web/public   # no output
shellcheck deploy/*.sh
```

## Rollback

Remove `avatar` from the scope file and restart the pod: the bot joins with
no camera, as before. Revert the step commits to remove the face; the
licence change (step 6) is reverted only by the owner's decision.
