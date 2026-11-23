# Graph Report - 16-int  (2026-11-23)

## Corpus Check
- 275 files · ~362,837 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 20 file(s) not represented in the graph (top: (none) 9, .nix 6, .css 4)

## Summary
- 3018 nodes · 5449 edges · 206 communities (166 shown, 40 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 678 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d919a927`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verify lib.sh
- runner k8s-policy.js
- Display
- test/call.test.js
- public app.js
- guard.js
- zlib deflate.js
- runner createLifecycle()
- agent index.js
- core rfb.js
- core RFB
- test desktop-ui.test.js
- k14 results: agent workspace desktops on k3d with KubeVirt
- zlib inflate.js
- runner runner.test.js
- core .rQwait()
- zlib trees.js
- test github.test.js
- runner runner.js
- web createActionManager()
- test server.test.js
- test brain.test.js
- test avatar-state.test.js
- Profiles
- runner vnc.test.js
- crypto des.js
- Websock
- rfactory-standup.js
- test cli.test.js
- web server.js
- input GestureHandler
- util browser.js
- test claude-cli.test.js
- src gateway.js
- tts.test.js
- runner client.test.js
- core RSAAESAuthenticationState
- ref_node_path
- stt-bridge.test.js
- H264Context
- test cfactory-write.test.js
- runner kyverno-scope.test.js
- verify verify.test.js
- web desktop-routes.js
- decoders TightDecoder
- scope.js
- Design
- verify net.sh
- verify profiles.sh
- vm-call.test.js
- createShareManager
- spike hello-call.test.js
- crypto crypto.js
- input util.js
- loadScope
- proxy.test.js
- runner protocol.js
- util logging.js
- crypto u8ArrayToBigInt()
- HextileDecoder
- util Cursor
- avatars points
- guard.test.js
- items.test.js
- reaper reaper.test.js
- review.js
- toModel
- ref_node_assert
- test cfactory.test.js
- agent/call.test.js
- ref_node_fs
- core ._handleMouse()
- bot bot/package.json
- test gateway.test.js
- ref_node_child_process
- runner k8s-lifecycle.test.js
- web live-view.test.js
- crypto md5.js
- inflator.js
- Design
- viewer/board.test.js
- spike spike/package.json
- input Keyboard
- test run.test.js
- core core/package.json
- Deviations from the spec (for approval with this plan)
- ref_node_os
- share.test.js
- bot run()
- avatars eyes
- bot run.js
- test test/board.test.js
- desktop desktop/package.json
- runner protocol.test.js
- web web/package.json
- test desktop-routes.test.js
- test source-guard.test.js
- profiles.test.js
- Plan: v1 roles in code (admin, approver, member), slice "roles" of #2
- Design
- k3d k14-env.sh
- verify handover.sh
- heard
- createGuard
- Spec: the bot hears the call itself (its own speech-to-text)
- verify lifecycle.sh
- decoders ZRLEDecoder
- avatars.test.js
- avatars portraits
- k3d gate.sh
- lifecycle.js
- crypto LegacyCrypto
- crypto RSACipher
- shell-browser.test.js
- createShare
- verify main()
- boundary.test.js
- util events.js
- avatars mesh
- avatars move
- Steps
- createCallManager
- verify e2e.sh
- kubevirt.test.js
- k3d k11.sh
- k3d mk-tls.sh
- Plan: Show the CFactory board in the call
- verify liveview.sh
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- deploy pod.sh
- verify share.sh
- k3d prep.sh
- verify capacity.sh
- verify secrets.sh
- deploy check-image.sh
- k3d import-images.sh
- deploy source-guard.sh
- guard guard/package.json
- proxy proxy/package.json
- spike run.sh
- utils Buf16
- utils Buf32
- utils Buf8
- zlib deflateInfo
- zlib inflateInfo
- Steps
- web/call.js
- mapCard
- createActionManager
- H264Decoder
- standup.test.js
- Plan: Phase 0, the Linux call test
- Design
- stt.test.js
- teams-tap-spike.js
- Design
- stt-languages.test.js
- Design
- createControl
- Design
- share-desktop.test.js
- stun.test.js
- .sendKey
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
- makeTable
- Standalone mode S1: end-to-end results (#2 step 10)
- Spec: Phase 3, act on the Factories from the call
- Intent: Meeting agent Phase 3, act on the Factories from the call
- Intent: Show the Factories in the call
- Intent: Meeting agent Phase 1b, a voice standup in Google Meet
- Intent: Review and control the Factories from the standup and the bot
- fill_window
- core/test/actions.test.js
- Intent: Meeting agent web app for the Factories
- Intent: Standalone mode, without the Factories
- Intent: Agent workspace, a disposable desktop per call
- Intent: Meeting agent Phase 1a, a text standup in the web UI
- Third-party notices
- Spec: Phase 1a, a text standup in the web UI
- speak
- Approved decisions (copied from the spec, so this plan stands alone)
- How the bot hears
- websock.js
- theme.js
- Avatar portraits
- CLAUDE.md
- .claude/CLAUDE.md
- check-image-stt.sh
- SHELL_INVENTORY.md

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `createLifecycle()` - 45 edges
3. `makeRedactor()` - 32 edges
4. `Display` - 32 edges
5. `Websock` - 32 edges
6. `checkFacts()` - 28 edges
7. `createCallManager()` - 25 edges
8. `portraits` - 23 edges
9. `Profiles` - 23 edges
10. `GestureHandler` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Steps` --references--> `event()`  [INFERRED]
  plan/2026-11-21-16-own-speech-to-text.md → bot/test/stt-bridge.test.js
- `Verification` --references--> `heard()`  [INFERRED]
  spec/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `Source offer to every remote user (AGPL §13)` --references--> `origin()`  [INFERRED]
  spec/2026-11-17-13-talking-avatar.md → core/src/desktop/session.js
- `Risks` --references--> `checkFacts()`  [INFERRED]
  spec/2026-11-17-5-phase-1a-text-standup.md → core/src/facts.js
- `Verification` --references--> `checkFacts()`  [INFERRED]
  spec/2026-11-17-5-phase-1a-text-standup.md → core/src/facts.js

## Import Cycles
- None detected.

## Communities (206 total, 40 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "runner k8s-policy.js"
Cohesion: 0.05
Nodes (46): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+38 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.12
Nodes (15): assert, { createCallManager }, { EventEmitter }, fakeActions(), a, fakeClock(), finishSpeech(), flush() (+7 more)

### Community 4 - "public app.js"
Cohesion: 0.08
Nodes (42): ago(), clear(), clock(), day(), decide(), decideShare(), el(), fill() (+34 more)

### Community 5 - "guard.js"
Cohesion: 0.19
Nodes (13): binding(), cidrFamily(), command(), apply(), { execFile }, execFileAsync, findVeth(), fs (+5 more)

### Community 6 - "zlib deflate.js"
Cohesion: 0.08
Nodes (33): deflate(), deflateEnd(), deflateInit(), deflateInit2(), deflateReset(), deflateResetKeep(), deflateSetDictionary(), DeflateState() (+25 more)

### Community 7 - "runner createLifecycle()"
Cohesion: 0.14
Nodes (26): createLifecycle(), accept(), allowAccept(), attachAgent(), boot(), callAttach(), cancelNow(), check() (+18 more)

### Community 8 - "agent index.js"
Cohesion: 0.10
Nodes (23): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+15 more)

### Community 9 - "core rfb.js"
Cohesion: 0.07
Nodes (17): CopyRectDecoder, JPEGDecoder, RawDecoder, RREDecoder, ZlibDecoder, Deflator, encodings, _buildExtendedClipboardFlags() (+9 more)

### Community 10 - "core RFB"
Cohesion: 0.07
Nodes (4): clientEncodings(), RFB, setDesktopSize(), xvpOp()

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "k14 results: agent workspace desktops on k3d with KubeVirt"
Cohesion: 0.13
Nodes (13): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+5 more)

### Community 13 - "zlib inflate.js"
Cohesion: 0.08
Nodes (24): adler32(), inflate_fast(), fixedtables(), inflate(), inflateInit2(), inflateReset(), inflateReset2(), inflateResetKeep() (+16 more)

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 16 - "zlib trees.js"
Cohesion: 0.16
Nodes (28): bi_flush(), bi_reverse(), bi_windup(), build_bl_tree(), build_tree(), compress_block(), copy_block(), d_code() (+20 more)

### Community 17 - "test github.test.js"
Cohesion: 0.10
Nodes (22): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFileSync } (+14 more)

### Community 18 - "runner runner.js"
Cohesion: 0.11
Nodes (24): clearInterval(), createK8s(), { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade() (+16 more)

### Community 19 - "web createActionManager()"
Cohesion: 0.13
Nodes (12): @rfactory/core, { deriveEffects, describe }, FINAL, { randomUUID }, { validate, hashPayload, canonical }, approve(), assert, { createActionManager } (+4 more)

### Community 20 - "test server.test.js"
Cohesion: 0.10
Nodes (17): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, { handleCall }, items, { loadRoles } (+9 more)

### Community 21 - "test brain.test.js"
Cohesion: 0.11
Nodes (19): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+11 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.11
Nodes (13): installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState(), meshAt() (+5 more)

### Community 23 - "Profiles"
Cohesion: 0.17
Nodes (5): fs, LABEL, name(), Profiles, { randomUUID, hkdfSync }

### Community 24 - "runner vnc.test.js"
Cohesion: 0.12
Nodes (19): bridgeViewOnly(), createFilter(), assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session (+11 more)

### Community 25 - "crypto des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 27 - "rfactory-standup.js"
Cohesion: 0.07
Nodes (40): { checkFacts }, count(), fs, main(), path, { setup }, ageOf(), causes() (+32 more)

### Community 28 - "test cli.test.js"
Cohesion: 0.07
Nodes (18): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+10 more)

### Community 29 - "web server.js"
Cohesion: 0.13
Nodes (21): { buildStandup, speakStandupHeadline }, createApp(), DESKTOP_STATIC, fs, HEADERS, http, keepAlive(), main() (+13 more)

### Community 31 - "util browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

### Community 32 - "test claude-cli.test.js"
Cohesion: 0.08
Nodes (32): approveClaude(), ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, createClaudeBrain(), propose(), run() (+24 more)

### Community 33 - "src gateway.js"
Cohesion: 0.10
Nodes (26): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), origin() (+18 more)

### Community 34 - "tts.test.js"
Cohesion: 0.17
Nodes (11): Recorded GitHub inventory (pinned 1.14.0, captured 2026-11-17), after(), assert, { createTts }, { EventEmitter }, fs, os, { PassThrough } (+3 more)

### Community 35 - "runner client.test.js"
Cohesion: 0.10
Nodes (16): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+8 more)

### Community 36 - "core RSAAESAuthenticationState"
Cohesion: 0.12
Nodes (4): RA2Cipher, RSAAESAuthenticationState, EventTargetMixin, encodeUTF8()

### Community 37 - "ref_node_path"
Cohesion: 0.12
Nodes (13): fs, os, path, fs, path, assert, { createRecord }, fs (+5 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.10
Nodes (9): installSttBridge(), assert, event(), fs, { installSttBridge }, path, setup(), test (+1 more)

### Community 40 - "test cfactory-write.test.js"
Cohesion: 0.07
Nodes (31): makeRedactor(), redactString(), PATTERNS, { Client }, createCfactoryWriter(), { deriveEffects }, fs, { makeRedactor } (+23 more)

### Community 41 - "runner kyverno-scope.test.js"
Cohesion: 0.14
Nodes (16): assert, dir, { firstHost }, fs, path, policies, probeCidrs(), test (+8 more)

### Community 42 - "verify verify.test.js"
Cohesion: 0.12
Nodes (15): assert, beats(), CHECKS, fs, http, INPUT, { join }, LIB (+7 more)

### Community 43 - "web desktop-routes.js"
Cohesion: 0.18
Nodes (18): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+10 more)

### Community 45 - "scope.js"
Cohesion: 0.10
Nodes (18): source, commit, path, repo, DESTINATIONS, fs, LISTEN, { makeRedactor } (+10 more)

### Community 46 - "Design"
Cohesion: 0.22
Nodes (8): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Spec: Standalone mode, with a choice of source and brain

### Community 47 - "verify net.sh"
Cohesion: 0.16
Nodes (17): BP, connect(), deadline_left(), hello(), mk_target(), mkp(), NIP, node_ip() (+9 more)

### Community 48 - "verify profiles.sh"
Cohesion: 0.23
Nodes (18): app_restore(), app_sync(), argo_app(), attach(), ciphertext(), cm_field(), errmatch(), extra_cleanup() (+10 more)

### Community 49 - "vm-call.test.js"
Cohesion: 0.16
Nodes (10): assert, { createVmSpawn }, { Duplex }, { test }, createVmSpawn(), { EventEmitter }, firstLine(), { PassThrough } (+2 more)

### Community 50 - "createShareManager"
Cohesion: 0.13
Nodes (27): createShareManager(), approve(), cleanup(), emit(), endCall(), expire(), reject(), request() (+19 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.13
Nodes (12): Steps, botName(), path, run(), assert, { EventEmitter }, fs, JoinError (+4 more)

### Community 53 - "input util.js"
Cohesion: 0.15
Nodes (5): DOMKeyTable, codepoints, getKey(), getKeycode(), getKeysym()

### Community 55 - "loadScope"
Cohesion: 0.16
Nodes (18): loadScope(), fixture(), action(), Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Steps (+10 more)

### Community 56 - "proxy.test.js"
Cohesion: 0.06
Nodes (45): addressBits(), BASE_PROTECTED, checkedAddresses(), createApi(), get(), createProxy(), addresses(), answerDns() (+37 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.20
Nodes (14): board(), columns, count(), exact(), hosts(), identity, login(), optional() (+6 more)

### Community 59 - "crypto u8ArrayToBigInt()"
Cohesion: 0.24
Nodes (5): bigIntToU8Array(), modPow(), u8ArrayToBigInt(), DHCipher, DHPublicKey

### Community 62 - "avatars points"
Cohesion: 0.12
Nodes (16): points, C, JL, JR, LB, LL, LM, LR (+8 more)

### Community 63 - "guard.test.js"
Cohesion: 0.13
Nodes (14): assert, { buildPolicy }, cniResult(), entry, { execFileSync }, fake(), fs, https (+6 more)

### Community 64 - "items.test.js"
Cohesion: 0.18
Nodes (10): FAIL, failing(), labelNames(), logins(), mapGithub(), assert, { mapGithub, summarise }, mapping (+2 more)

### Community 65 - "reaper reaper.test.js"
Cohesion: 0.17
Nodes (13): createReaper(), leaseStale(), tick(), fs, main(), assert, { createReaper }, fake() (+5 more)

### Community 66 - "review.js"
Cohesion: 0.15
Nodes (17): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+9 more)

### Community 67 - "toModel"
Cohesion: 0.10
Nodes (26): tools(), toModel(), ask(), raw(), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains), Rollback (+18 more)

### Community 68 - "ref_node_assert"
Cohesion: 0.08
Nodes (17): assert, { buildRendererSource }, { chromium }, fs, path, test, toSpeech(), assert (+9 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.13
Nodes (7): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, reply(), repos, test

### Community 70 - "agent/call.test.js"
Cohesion: 0.17
Nodes (9): createCallWorker(), { createShare, callLaunchArgs }, { PassThrough }, assert, { createCallWorker, withProxy, TEAMS_CAPTIONS }, { EventEmitter }, fixture(), { test } (+1 more)

### Community 71 - "ref_node_fs"
Cohesion: 0.12
Nodes (14): assert, fs, path, root, test, fs, assert, { createK8s } (+6 more)

### Community 72 - "core ._handleMouse()"
Cohesion: 0.25
Nodes (3): extendedPointerEvent(), pointerEvent(), clientToElement()

### Community 73 - "bot bot/package.json"
Cohesion: 0.14
Nodes (13): dependencies, playwright-core, @vibeconferencing/calls, engines, node, playwright-core, @vibeconferencing/calls, license (+5 more)

### Community 74 - "test gateway.test.js"
Cohesion: 0.12
Nodes (11): assert, base, { createGateway }, fetchScope(), fs, { loadScope }, { makeRedactor }, os (+3 more)

### Community 75 - "ref_node_child_process"
Cohesion: 0.13
Nodes (13): assert, fs, os, path, realPod, { spawnSync }, test, createTts() (+5 more)

### Community 76 - "runner k8s-lifecycle.test.js"
Cohesion: 0.19
Nodes (9): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+1 more)

### Community 77 - "web live-view.test.js"
Cohesion: 0.15
Nodes (11): assert, client(), clientSession, { createApp }, fbUpdate, includes(), { loadRoles }, net (+3 more)

### Community 78 - "crypto md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 80 - "Design"
Cohesion: 0.14
Nodes (15): Proposed outcome, Design, Effects are derived, not trusted, Keys and switches, Pending actions and approval, Reading CFactory's results, Recognising an action request, The action allowlist (the only things that can ever run) (+7 more)

### Community 81 - "viewer/board.test.js"
Cohesion: 0.18
Nodes (11): assert, board(), browser, column(), open(), { test }, { viewerRoute, URL_BOARD }, fs (+3 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 84 - "test run.test.js"
Cohesion: 0.15
Nodes (12): assert, audioJoined(), { EventEmitter }, fs, joined(), { PassThrough }, path, { run } (+4 more)

### Community 85 - "core core/package.json"
Cohesion: 0.11
Nodes (15): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+7 more)

### Community 86 - "Deviations from the spec (for approval with this plan)"
Cohesion: 0.16
Nodes (15): label(), stopShare(), exec(), Decisions carried over from the approved spec, Deviations from the spec (for approval with this plan), Facts checked in the real repos, Open questions for the owner, Plan: Agent workspace, a disposable desktop per call (#3) (+7 more)

### Community 87 - "ref_node_os"
Cohesion: 0.24
Nodes (7): createProfile(), readHead(), assert, { createProfile }, KEY, setup(), { test }

### Community 88 - "share.test.js"
Cohesion: 0.15
Nodes (11): callLaunchArgs(), { randomBytes }, assert, browser, { createShare, titleFor, callLaunchArgs, installCaptureGuard }, http, pick(), { test } (+3 more)

### Community 89 - "bot run()"
Cohesion: 0.23
Nodes (19): buildRendererSource(), run(), afterJoin(), discardOpen(), idleAvatar(), leftConfirmed(), newGate(), onAudio() (+11 more)

### Community 90 - "avatars eyes"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 91 - "bot run.js"
Cohesion: 0.17
Nodes (9): { buildRendererSource }, crypto, fs, { installSttBridge }, { makeRedactor }, os, path, { SpeechGate } (+1 more)

### Community 92 - "test test/board.test.js"
Cohesion: 0.13
Nodes (15): COLUMNS, projectBoard(), { repositoryOf }, STAGES, assert, callTool(), card(), { createCfactorySource } (+7 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "runner protocol.test.js"
Cohesion: 0.20
Nodes (7): assert, fs, { MAX, encode, createDecoder, tag }, net, os, path, { test }

### Community 95 - "web web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 96 - "test desktop-routes.test.js"
Cohesion: 0.18
Nodes (9): assert, { createApp }, { createDesktop }, grant, { loadRoles }, { makeRedactor }, open, roles (+1 more)

### Community 97 - "test source-guard.test.js"
Cohesion: 0.18
Nodes (10): Source adapters, assert, fs, git(), guard, os, path, repo() (+2 more)

### Community 98 - "profiles.test.js"
Cohesion: 0.15
Nodes (12): admin, assert, fakeK8s(), fixture(), fs, { hkdfSync }, MASTER, os (+4 more)

### Community 99 - "Plan: v1 roles in code (admin, approver, member), slice "roles" of #2"
Cohesion: 0.19
Nodes (10): loadRoles(), has(), rolesOf(), Decisions carried over from the approved spec, Decisions for this plan, Deviations, Plan: v1 roles in code (admin, approver, member), slice "roles" of #2, Rollback (+2 more)

### Community 100 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Design, Hearing: wake phrase and end of a question, Packaging, Risks, Spec: Phase 1b, a voice standup in Google Meet, Speech (TTS), Verification (+2 more)

### Community 101 - "k3d k14-env.sh"
Cohesion: 0.44
Nodes (9): app_sync(), argo(), desktops(), env_of(), kc(), kubectl(), runner_restart(), k14-env.sh script (+1 more)

### Community 102 - "verify handover.sh"
Cohesion: 0.42
Nodes (8): fixture_reached(), hits(), open_page(), page_loaded(), session_of(), handover.sh script, trap_page(), wait_attached()

### Community 103 - "heard"
Cohesion: 0.14
Nodes (15): createHearing(), heard(), assert, { createHearing }, fakeClock(), setup(), test, Affected users and systems (+7 more)

### Community 104 - "createGuard"
Cohesion: 0.35
Nodes (12): createApi(), get(), createGuard(), counters(), heartbeat(), reconcile(), reconcileOnce(), server() (+4 more)

### Community 105 - "Spec: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.15
Nodes (12): 1. The service: `rfactory-stt`, 2. In the bot (`bot/run.js`, both deployments): cut speech, send segments, 3. In the call manager (`web/call.js`): transcribe and hear, 4. The listen setting, 5. Packaging and deploy, Alternatives rejected, Design, Measured on p620 (2026-11-21) (+4 more)

### Community 106 - "verify lifecycle.sh"
Cohesion: 0.42
Nodes (7): case_hold(), egress_cut(), fresh(), hold(), settled(), lifecycle.sh script, watch_end()

### Community 108 - "avatars.test.js"
Cohesion: 0.20
Nodes (8): assert, crypto, dir, fs, ids, manifest, path, test

### Community 109 - "avatars portraits"
Cohesion: 0.25
Nodes (8): anchors, file, sha256, file, sha256, portraits, f01, f09

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "lifecycle.js"
Cohesion: 0.11
Nodes (18): nonce(), { buildPolicy }, { createDecoder, tag, encode, LANGUAGE }, login(), shareStart(), shareStop(), sharing(), toGuest() (+10 more)

### Community 114 - "shell-browser.test.js"
Cohesion: 0.20
Nodes (6): assert, { chromium }, { createApp }, { loadRoles }, { spawnSync }, test

### Community 115 - "createShare"
Cohesion: 0.47
Nodes (9): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+1 more)

### Community 116 - "verify main()"
Cohesion: 0.36
Nodes (5): connect(), handshake(), main(), [mode, url], out()

### Community 117 - "boundary.test.js"
Cohesion: 0.10
Nodes (14): card(), assert, callTool(), { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs (+6 more)

### Community 118 - "util events.js"
Cohesion: 0.48
Nodes (5): _capturedElemChanged(), _captureObserver, _captureProxy(), releaseCapture(), setCapture()

### Community 119 - "avatars mesh"
Cohesion: 0.33
Nodes (6): mesh, anchors, file, sha256, triangles, f17

### Community 120 - "avatars move"
Cohesion: 0.33
Nodes (6): move, C, JL, JR, LB, LM

### Community 121 - "Steps"
Cohesion: 0.21
Nodes (14): { Client }, createCfactorySource(), call(), comments(), connect(), freshness(), scopedCards(), within() (+6 more)

### Community 122 - "createCallManager"
Cohesion: 0.29
Nodes (18): createCallManager(), addressed(), answer(), armQuiet(), audio(), drain(), incoming(), killGroup() (+10 more)

### Community 123 - "verify e2e.sh"
Cohesion: 0.53
Nodes (4): real_ids(), e2e.sh script, teams_call(), WEB_MAX

### Community 124 - "kubevirt.test.js"
Cohesion: 0.13
Nodes (13): octets(), parseCmdline(), assert, { createAgent }, { createCallWorker }, { createControl }, { dial }, { encode, createDecoder } (+5 more)

### Community 125 - "k3d k11.sh"
Cohesion: 0.50
Nodes (4): env_of(), RFACTORY_DESKTOP, RFACTORY_RUNNER_URL, k11.sh script

### Community 126 - "k3d mk-tls.sh"
Cohesion: 0.70
Nodes (4): FILES, key(), leaf(), mk-tls.sh script

### Community 127 - "Plan: Show the CFactory board in the call"
Cohesion: 0.33
Nodes (5): Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Tests

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 129 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f02

### Community 130 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f03

### Community 131 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f05

### Community 132 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f06

### Community 133 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f07

### Community 134 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f08

### Community 135 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f10

### Community 136 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f11

### Community 137 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f12

### Community 138 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f14

### Community 139 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f15

### Community 140 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f16

### Community 141 - "deploy pod.sh"
Cohesion: 1.00
Nodes (3): down(), pod.sh script, up()

### Community 142 - "verify share.sh"
Cohesion: 0.83
Nodes (3): ready(), share.sh script, web_stop()

### Community 160 - "Steps"
Cohesion: 0.14
Nodes (12): idle(), setCameraRenderer(), Deviations after merge, Plan: A face for the bot that talks when it speaks, Rollback, Steps, Tests, Alternatives rejected (+4 more)

### Community 161 - "web/call.js"
Cohesion: 0.10
Nodes (18): Environment and scope reference, Per-call worker environment variables (set internally), Scope fields (`RFACTORY_SCOPE_FILE`), Web server environment variables, BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts }, { createHearing } (+10 more)

### Community 162 - "mapCard"
Cohesion: 0.15
Nodes (13): mapCard(), 10. Intent constraints carried into slice 1, 1. Data comes from four CFactory read tools, all on the existing read key, 2. Scope: one rule, used everywhere, 3. Failure and freshness, 4. `core/src/standup.js` (new, pure): `buildStandup(cards, freshness)`, 6. Review (`core/src/review.js`, new, pure), 8. `core/src/sources/cfactory.js` (+5 more)

### Community 163 - "createActionManager"
Cohesion: 0.38
Nodes (13): createActionManager(), approve(), emit(), endCall(), expire(), finish(), list(), live() (+5 more)

### Community 165 - "standup.test.js"
Cohesion: 0.21
Nodes (9): buildStandup(), { FAILED, mapCard }, speakStandupHeadline(), assert, build(), { buildStandup, speakStandupHeadline }, freshness(), { makeRedactor } (+1 more)

### Community 166 - "Plan: Phase 0, the Linux call test"
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 167 - "Design"
Cohesion: 0.17
Nodes (12): speechLevel(), Decisions carried over (approved intent and spec), AI disclosure, Cost, Design, Licence (owner decision 2: the whole repository is AGPL-3.0), Packaging, Portraits and notices (+4 more)

### Community 168 - "stt.test.js"
Cohesion: 0.22
Nodes (6): assert, { createStt }, fs, os, path, test

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 170 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Answers to the intent's open questions, Design, Feasibility gate (first plan step), Lifecycle and disposal, Live view, Network, Persistent profiles (+3 more)

### Community 171 - "stt-languages.test.js"
Cohesion: 0.38
Nodes (5): toWhisperLanguage(), WHISPER_LANGUAGES, assert, test, { WHISPER_LANGUAGES, toWhisperLanguage }

### Community 172 - "Design"
Cohesion: 0.13
Nodes (14): gateway(), Alternatives rejected, Design, Exposure, Facts this rests on (checked on p620, 2026-11-18), Lifecycle, Live view, Network (replaces the approved "Network" section) (+6 more)

### Community 173 - "createControl"
Cohesion: 0.43
Nodes (7): capText(), createControl(), applyHosts(), closePage(), page(), start(), originOf()

### Community 174 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Design, Order and dependencies, Proposing, approving, stopping, Risks, Spec: Show the CFactory board in the call, The constraint that shapes it, The viewer page (in the desktop image) (+2 more)

### Community 175 - "share-desktop.test.js"
Cohesion: 0.24
Nodes (7): createShareDesktop(), schedule(), stopPolling(), assert, { createShareDesktop }, setup(), test

### Community 176 - "stun.test.js"
Cohesion: 0.29
Nodes (4): assert, dgram, { stunProbe }, test

### Community 178 - "Spec: Phase 0, the Linux call test"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Context for later phases (not decided here), Decisions on the intent's Phase 0 questions, Design, Goal, Pass / fail, Pieces, Risks (+2 more)

### Community 179 - "Intent: A face for the bot that talks when it speaks"
Cohesion: 0.22
Nodes (8): Affected users and systems, Constraints, Decisions (owner, 2026-11-17), Intent: A face for the bot that talks when it speaks, Open questions, Problem, Proposed outcome (first slice), Source of the portraits

### Community 180 - "makeTable"
Cohesion: 0.67
Nodes (3): crc32(), makeTable(), read_buf()

### Community 181 - "Standalone mode S1: end-to-end results (#2 step 10)"
Cohesion: 0.20
Nodes (8): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass**

### Community 182 - "Spec: Phase 3, act on the Factories from the call"
Cohesion: 0.40
Nodes (4): Alternatives rejected, Risks, Spec: Phase 3, act on the Factories from the call, Verification

### Community 183 - "Intent: Meeting agent Phase 3, act on the Factories from the call"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions at approval (owner, 2026-11-17), Intent: Meeting agent Phase 3, act on the Factories from the call, Not in this slice, Open questions, Problem

### Community 184 - "Intent: Show the Factories in the call"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-17), Intent: Show the Factories in the call, Open questions, Problem, Proposed outcome

### Community 185 - "Intent: Meeting agent Phase 1b, a voice standup in Google Meet"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions at approval (owner, 2026-11-17), Intent: Meeting agent Phase 1b, a voice standup in Google Meet, Open questions, Problem, Proposed outcome

### Community 186 - "Intent: Review and control the Factories from the standup and the bot"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-23: "approved"), Intent: Review and control the Factories from the standup and the bot, Open questions, Problem, Proposed outcome

### Community 187 - "fill_window"
Cohesion: 0.43
Nodes (8): deflate_fast(), deflate_huff(), deflate_rle(), deflate_slow(), deflate_stored(), fill_window(), flush_block_only(), longest_match()

### Community 188 - "core/test/actions.test.js"
Cohesion: 0.06
Nodes (41): ACTIONS, bounded(), canonical(), CREATE_STATUSES, { createHash }, criteria(), FIELDS, hashPayload() (+33 more)

### Community 189 - "Intent: Meeting agent web app for the Factories"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: Meeting agent web app for the Factories, Open questions, Problem, Proposed outcome

### Community 190 - "Intent: Standalone mode, without the Factories"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: Standalone mode, without the Factories, Open questions, Problem, Proposed outcome

### Community 191 - "Intent: Agent workspace, a disposable desktop per call"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: Agent workspace, a disposable desktop per call, Open questions, Problem, Proposed outcome

### Community 192 - "Intent: Meeting agent Phase 1a, a text standup in the web UI"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: Meeting agent Phase 1a, a text standup in the web UI, Open questions, Problem, Proposed outcome

### Community 193 - "Third-party notices"
Cohesion: 0.29
Nodes (6): Bot dependencies (npm), Core dependencies (npm, from core/package-lock.json), Portraits, Programs outside the repository, Third-party notices, Web page dependencies (vendored)

### Community 194 - "Spec: Phase 1a, a text standup in the web UI"
Cohesion: 0.40
Nodes (4): Alternatives rejected, Risks, Spec: Phase 1a, a text standup in the web UI, Verification

### Community 195 - "speak"
Cohesion: 0.14
Nodes (20): log(), cancel(), join(), Privacy, Deviations (Codex review of the approved plan, 2026-11-17), Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 1b, a voice standup in Google Meet (+12 more)

### Community 196 - "Approved decisions (copied from the spec, so this plan stands alone)"
Cohesion: 0.33
Nodes (5): Approved decisions (copied from the spec, so this plan stands alone), Plan: Review and standup from the board (#28, slice 1), Roles, Rollback, Tests

### Community 197 - "How the bot hears"
Cohesion: 0.15
Nodes (11): Captions vs own transcription, How the bot hears, Language, `listen` values and the per-platform `auto` rule, Rollback, When own transcription is not configured, How the bot hears, Licence (+3 more)

### Community 198 - "websock.js"
Cohesion: 0.40
Nodes (3): DataChannel, rawChannelProps, ReadyStates

### Community 199 - "theme.js"
Cohesion: 0.67
Nodes (3): applyTheme(), dark, observer

### Community 200 - "Avatar portraits"
Cohesion: 0.50
Nodes (3): Avatar portraits, Changes, Provenance

## Knowledge Gaps
- **33 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+28 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1462 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Websock` connect `Websock` to `core Websock`, `core rfb.js`, `websock.js`, `core .rQwait()`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `createLifecycle()` (e.g. with `lifecycle.js` and `action()`) actually correct?**
  _`createLifecycle()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _33 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `toModel` to `items.test.js`, `Profiles`, `Deviations from the spec (for approval with this plan)`, `core Websock`, `rfactory-standup.js`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Should `runner k8s-policy.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05389610389610389 - nodes in this community are weakly interconnected._
- **Why does `Deviations from the spec revision (Codex re-check and plan review, for approval with this plan)` connect `runner createLifecycle()` to `guard.js`, `k14 results: agent workspace desktops on k3d with KubeVirt`, `core Websock`, `Profiles`, `proxy.test.js`, `core/test/actions.test.js`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._