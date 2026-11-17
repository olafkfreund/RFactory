---
status: approved
issue: 13
intent: intent/2026-11-17-13-talking-avatar.md
---

# Spec: A face for the bot that talks when it speaks

## Evidence this spec rests on

The feasibility check (intent decision 4) ran in the owner's Meet on
2026-11-17 (`spike/RESULTS.md` on branch `spike/d5b-camera`, commits
`c45edb1`, `0b7a687`, `ad2e545`):

- A canvas camera drawn by an injected renderer shows as the bot's tile.
- **Meet refuses the first camera turn-on** ("camera might be blocked");
  the second attempt works.
- Owner's choices after seeing three versions: a **still portrait** with
  **blinking** and **frame motion** (slow sway, small nods while speaking,
  an orange frame that brightens with the voice). Mouth overlays looked
  pasted on and were dropped; a **mesh-warp mouth** (the lower face bends,
  nothing is painted on top) was rendered offline and approved by the
  owner.

## Design

### What the library already provides

`@vibeconferencing/calls` 0.1.0-alpha.3 (MIT), in Meet's page:

- a canvas camera for every video request, drawn by
  `window.__vibeconfMedia.setCameraRenderer(factory)` each frame; a new
  renderer also applies to cameras that already exist
  (`inject/page-inject.js` 20–135, 477–523). It does **not** catch errors
  thrown by `render()` (132–134);
- `window.__vibeconfMedia.speechLevel()`: the smoothed loudness (0..1) of
  the bot's **own** TTS output; in silence it decays by ×0.86 per sample
  (187–201), about 0.9 s from full to near zero;
- `bot-speaking {speaking}` events, which are not replayed to late
  listeners (500–503);
- `setCameraOn(on)` clicks Meet's button and returns without confirming
  (`providers/google-meet-provider.js` 653–663).

### The face

One renderer, `bot/avatar/renderer.js`, injected into Meet's page; its
logic is a pure module, `bot/avatar/state.js`, shared with the tests.

- **Frame:** Factory dark background; the portrait at ~62 % of the frame
  height; an orange frame around it; a name strip "RFactory Bot (AI)", an
  **"AI" badge** and a small **source line** (below) on every frame.
- **Idle:** still portrait, a blink every 3–6 s (eyelids drawn in skin
  colour sampled above each eye), a slow sway (±2 px, ±0.4°).
- **Speaking:** small nods that follow the voice; the frame brightens with
  the level; the **mouth opens by mesh warp**:
  - a triangle mesh over the lower face (lip corners, upper lip line,
    lower lip, under the lip, jaw sides, chin, and a fixed outer ring);
  - the lower lip and chin points move down by up to 13 source pixels
    with the level, the jaw sides by about half that; the portrait is
    drawn into the moved triangles (affine texture mapping), so the face
    bends rather than being painted on;
  - the gap between the upper lip line and the moved lower lip is filled
    with a dark mouth shape; no teeth.
- **Per-portrait anchors:** `bot/avatars/manifest.json` gives each
  portrait's mesh points and eye points in its 256×256 pixels. Only
  portraits with anchors can be chosen; the first slice measures **m01**
  (the one tested); others are added one by one.

### Timing and "never frozen"

- **The level drives everything, events only close.** Each frame reads
  `speechLevel()` directly, so a renderer injected while the greeting is
  already playing still opens the mouth (no reliance on a missed
  `speaking: true`).
- **Closing:** on `bot-speaking: false` the mouth closes within 150 ms,
  regardless of the decaying level. With no `speaking: true` seen and a
  level below 0.06, the mouth target is closed.
- **Stop paths:** before the bot cancels speech or leaves, `bot/run.js`
  calls `__rfAvatar.idle()` in the page (mouth closed, nods off), then
  proceeds without waiting more than 200 ms for it. This covers the
  spoken leave, `cancel`, `leave` from the parent, stdin closing, the
  60-minute limit and `removed`/`error` states. A `stopping` flag set
  first means the avatar is never injected or turned on after stopping
  begins.
- **Renderer errors:** `render()` is wrapped; an error draws a plain idle
  frame (portrait, no warp) and is logged at most 3 times. After 30
  consecutive errors the bot turns the camera **off** and logs
  `avatar failed: render`.
- **Limits of the guarantee:** if Chrome itself crashes, Meet keeps the
  last frame or a ghost tile until it drops the participant; RFactory
  cannot draw anything then. The parent's existing process-group cleanup
  ends the browser.

### Turning the camera on

- After join and the chat line (`afterJoin`), unless stopping: check the
  portrait's SHA-256 against the manifest, inject the renderer, then turn
  the camera on: up to **3 attempts, 3 s apart**, each confirmed by Meet's
  button reading "Turn off camera" (the first attempt is usually refused).
- **Fails safe:** a bad hash, an inject error, or no confirmation after 3
  attempts → `setCameraOn(false)` (best effort) and `avatar failed:
  <reason>`; the bot goes on without a camera. Join, speech, stop and
  interrupt never wait on the avatar beyond the 200 ms idle call.
- Scope file `avatar: "<id>"` (validated by `loadScope` against the
  manifest ids with anchors). No `avatar` → no camera, exactly as today.
  `web/call.js` passes the id as `RFACTORY_AVATAR`.

### Cost

- Targets, measured over 5 minutes of a call with speech: **≤ 0.3 extra
  CPU core and ≤ 150 MB extra memory** for Chrome against the same call
  without the camera.
- The renderer caches one pre-scaled portrait per camera size (Meet may
  ask for more than one; at most 2 cached).
- Over budget: draw every second frame (15 fps) and measure again; still
  over → the avatar is turned off by default (`avatar` unset) and the
  owner is told.

### Portraits and notices

- `bot/avatars/{f,m}01–20.webp`: the 40 OmegaStar files **unchanged**,
  from commit `8304f225fc2f88f9baef6de622a0d229666e09f9` of
  `itsfutsy/OmegaStar` (`src/assets/avatars/`), each pinned by SHA-256 in
  `manifest.json`; a test recomputes every hash.
- `bot/avatars/NOTICE.md`: source repository and commit, "Copyright (C)
  2026 Abram Industries Pty Ltd", AGPL-3.0, no warranty (see `LICENSE`),
  "files unmodified"; any later conversion or crop is listed with what and
  when.

### Licence (owner decision 2: the whole repository is AGPL-3.0)

- `LICENSE`: the verbatim GNU AGPL v3 text.
- `"license": "AGPL-3.0-only"` in `bot/`, `core/`, `web/`, `spike/`
  `package.json`.
- `NOTICE.md`: every third-party part with its licence, and the
  **upstream licence texts preserved** in `LICENSES/` (copied from the
  installed packages, not summarised): `@vibeconferencing/calls` (MIT),
  `playwright-core` (Apache-2.0, with its NOTICE if present), core's npm
  dependencies (MIT, ISC, BSD-2/3, Apache-2.0); Piper (GPL-3.0, separate
  process) and the LJSpeech voice (public domain); Google Chrome
  (proprietary, installed in the image from Google's repository, not in
  this repository).
- A "Licence" section in `README.md`.
- This spec is an engineering reading of the licences, not a legal
  review; anything uncertain is marked "pending verification" in
  `NOTICE.md`.

### Source offer to every remote user (AGPL §13)

- **Canonical source:** `https://github.com/olafkfreund/RFactory`, public.
- **The image records its commit:** `deploy/pod.sh` refuses to build
  unless `git status --porcelain` is empty (untracked files included) and
  `HEAD` is on `origin`; it passes `--build-arg RFACTORY_COMMIT=<sha>`.
  After building, it checks **anonymously** (no token) that
  `https://github.com/olafkfreund/RFactory/tree/<sha>` answers 200.
- **Offered in three places, so it survives a failed chat:**
  - the RFactory page footer: "RFactory is free software (AGPL-3.0).
    Source: <link to the commit>";
  - the bot's chat line after join, with the same link;
  - **on the camera, every frame**: a small "Source: github.com/
    olafkfreund/RFactory" line, visible to everyone in the call,
    including people who join later or never open the chat.
- The image carries `LICENSE`, `NOTICE.md`, `LICENSES/` and
  `bot/avatars/NOTICE.md`.

### Packaging

`web/Containerfile` copies `bot/avatar/`, `bot/avatars/`, `LICENSE`,
`NOTICE.md` and `LICENSES/` (today it copies only `bot/run.js`). An
image-level check lists them in the built image and verifies the portrait
hashes there.

### AI disclosure

Unchanged and added to: the name "RFactory Bot (AI)", the chat line and
listening announcement stay; every frame carries the "AI" badge and the
name strip. The portraits are illustrations, never photographs.

## Alternatives rejected

- **Mouth overlays** (a dark shape, a moved jaw strip with teeth): tried
  live; looked pasted on (owner).
- **Driving the face from the server or bot process:** the page already
  has the exact level; a protocol hop adds drift.
- **A pre-rendered video as a fake camera:** cannot follow the speech; the
  library's `getUserMedia` override bypasses it.
- **Lip-sync from phonemes, or a machine-learning talking head:** more
  work, heavier, and model licences are unclear; the mesh warp is enough
  to show who is speaking.
- **Licensing only the portraits AGPL:** the owner chose the whole
  repository.

## Risks

- **Meet's camera refusal** may need more than one retry on another day;
  three attempts, then no camera.
- **Private-field use** (`call._inner.page`) of an alpha library: pinned;
  marked `shortcut:`; replaced when the library exposes a renderer option.
- **CPU and memory** under Xvfb: measured, with a 15 fps fallback and an
  off switch.
- **Mesh anchors per portrait** are hand-measured; a bad anchor shows as a
  bent face, so only measured and reviewed portraits are selectable.
- **Portrait provenance:** accepted by the owner; replaced if a rights
  claim is raised.

## Verification

1. Unit tests (no network):
   - `state.js`: the mouth follows the level while speaking; closes within
     150 ms of `speaking: false` even with a high decaying level; opens
     from the level alone when the start event was missed; nods only while
     speaking; blinks only when idle; `idle()` forces closed at once.
   - mesh: for m01, every triangle keeps a positive area at all openings
     (no fold-over); moved points stay inside the outer ring.
   - manifest: 40 files with matching SHA-256; anchors inside 256×256;
     `loadScope` refuses an unknown or anchorless `avatar`.
   - `bot/run.js` with a fake call: injection after the chat line; three
     camera attempts with confirmation; a refused first attempt then
     success; three refusals → camera off and logged; a bad hash or an
     inject error → logged, no throw, speech still works; `idle()` called
     before cancel and leave on every stop path (spoken leave, cancel,
     parent leave, stdin close, time limit, removed/error); no injection
     or turn-on after stopping began; without `RFACTORY_AVATAR` the camera
     is never touched.
   - renderer in headless Chrome (`bot/`'s `playwright-core`,
     `RF_TEST_CHROME`; fails rather than skips with
     `RFACTORY_REQUIRE_BROWSER=1`), with a fake `__vibeconfMedia` that
     uses the library's real smoothing: mouth-region pixels differ between
     level 0 and 0.8; "AI" badge, name strip and source line present in
     every frame; a renderer exception after an open-mouth frame → the
     next frame is the closed idle face; 30 errors → camera off.
   - licence: `LICENSE` is the AGPL-3.0 text; every `package.json` says
     `AGPL-3.0-only`; `LICENSES/` holds the upstream texts named in
     `NOTICE.md`; page footer, chat line and camera line carry the source
     link.
   - `pod.sh`: refuses a dirty tree (including an untracked file) and an
     unpushed commit; the anonymous source check runs.
   - image: the built image contains the renderer, portraits, manifest
     and notices, and the portrait hashes match inside it.
2. **Live on p620** (owner's OK): the bot's tile shows the chosen face
   with the "AI" badge and source line; it blinks and sways while idle;
   the mouth and nods follow its speech and stop when it stops; "RFactory,
   leave" mid-answer leaves with a closed mouth; the camera comes on even
   when Meet refuses the first attempt; CPU and memory measured over 5
   minutes; with `avatar` unset the bot joins as before with no camera.
