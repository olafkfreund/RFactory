# Graph Report - RFactory-65  (2026-11-26)

## Corpus Check
- 309 files · ~466,066 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 10, .nix 6, .css 4)

## Summary
- 3507 nodes · 6323 edges · 237 communities (202 shown, 35 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 832 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a6599a60`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verify lib.sh
- Design
- rfb.js
- test/call.test.js
- public app.js
- createCallManager
- claude-cli.js
- createLifecycle
- agent.test.js
- investigations.test.js
- run.js
- test desktop-ui.test.js
- guard.test.js
- RFB
- runner runner.test.js
- k8s-policy.js
- state
- github.test.js
- runner runner.js
- cli.test.js
- test server.test.js
- test brain.test.js
- test avatar-state.test.js
- Profiles
- .rQwait
- Steps
- Plan: in-call agents, slice 1: live read-only lookups
- rfactory-standup.js
- How the bot hears
- web server.js
- lookups.test.js
- viewer/board.test.js
- test claude-cli.test.js
- avatar-renderer.test.js
- tts.test.js
- client.test.js
- profiles.test.js
- Plan: run RFactory in the factory cluster
- stt-bridge.test.js
- deflate.js
- cfactory-write.test.js
- kyverno-scope.test.js
- verify verify.test.js
- desktop-routes.test.js
- speak
- makeRedactor
- inflate.js
- verify net.sh
- verify profiles.sh
- lookup-endpoint.test.js
- listProjects
- spike hello-call.test.js
- share.test.js
- vm-call.test.js
- createInvestigationManager
- index.js
- createProxy
- runner protocol.js
- @rfactory/core
- createShare
- proxy.js
- lifecycle.js
- share-desktop.test.js
- checkFacts
- Deviations from the spec (for approval with this plan)
- reaper reaper.test.js
- Spec: call the bot "Factory"
- Steps
- ref_node_assert
- test cfactory.test.js
- agent/call.test.js
- proxy.test.js
- pod.test.js
- bot bot/package.json
- Design
- trees.js
- runner k8s-lifecycle.test.js
- web live-view.test.js
- tts.js
- Display
- ref_node_fs
- Design
- spike spike/package.json
- ref_node_os
- test run.test.js
- createShareManager
- web/call.js
- core/package.json
- Intent: the bot hears the call itself (its own speech-to-text)
- bot run()
- desktop.test.js
- ref_node_path
- test/board.test.js
- desktop desktop/package.json
- running
- actions-record.test.js
- Spec: an approved, read-only Claude investigation from the call
- lookup-endpoint.js
- cfactory-write.js
- Intent: in-call agents, the model with live tools, provider chosen per call
- Steps
- k3d k14-env.sh
- verify handover.sh
- Intent: project-aware calls
- protocol.test.js
- Spec: the bot hears the call itself (its own speech-to-text)
- verify lifecycle.sh
- Design
- vnc.test.js
- Design
- k3d gate.sh
- gateway.js
- stt-languages.test.js
- des.js
- shell-browser.test.js
- ref_node_http
- Design
- boundary.test.js
- createActionManager
- Intent: call the bot "Factory"
- RSAAESAuthenticationState
- Intent: see why Meet refuses the call bot, and recover from it
- Websock
- verify e2e.sh
- H264Decoder
- k3d k11.sh
- k3d mk-tls.sh
- a
- verify liveview.sh
- Plan: Phase 3, act on the Factories from the call
- @modelcontextprotocol/sdk
- Spec: Phase 3, act on the Factories from the call
- GestureHandler
- profiles.js
- Keyboard
- browser.js
- inflator.js
- roles.test.js
- crypto.js
- u8ArrayToBigInt
- Cursor
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
- points
- util.js
- ._handleMouse
- guard.js
- Design
- web/package.json
- md5.js
- TightDecoder
- stt.test.js
- core/test/actions.test.js
- Desktop VMs on the k3d factory cluster
- createGuard
- eyes
- control.js
- Design
- Socket
- teams-tap-spike.js
- Design
- shares.test.js
- Plan: Phase 0, the Linux call test
- Intent: run a Claude terminal from the call, and show it
- createCfactorySource
- origin
- Intent: run RFactory in the factory cluster like the other Factory services
- Deviations from the spec revision (Codex re-check and plan review, for approval with this plan)
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
- k14 results: agent workspace desktops on k3d with KubeVirt
- Design
- ZRLEDecoder
- Intent: Meeting agent Phase 3, act on the Factories from the call
- Intent: Show the Factories in the call
- Intent: Meeting agent Phase 1b, a voice standup in Google Meet
- Intent: Review and control the Factories from the standup and the bot
- bootstrap-secrets.test.sh
- allowlist.js
- Intent: Meeting agent web app for the Factories
- Intent: Standalone mode, without the Factories
- Intent: Agent workspace, a disposable desktop per call
- Intent: Meeting agent Phase 1a, a text standup in the web UI
- Third-party notices
- portraits
- effects.js
- review.test.js
- RFactory
- LegacyCrypto
- theme.js
- RSACipher
- CLAUDE.md
- .claude/CLAUDE.md
- Intent: finish the "Factory" rename and stop false wakes at a caption block start
- check-image-stt.sh
- SHELL_INVENTORY.md
- source-guard.test.js
- bootstrap-secrets.sh
- createHearing
- assert-signature-location.sh
- Plan: finish the "Factory" rename and stop false wakes at a caption block start
- mesh
- move
- Approved decisions (copied from the spec, so this plan stands alone)
- Spec: A face for the bot that talks when it speaks
- anchors
- anchors
- anchors
- anchors
- anchors
- anchors
- anchors
- anchors
- anchors
- anchors
- anchors
- anchors
- Avatar portraits
- makeTable
- Buf16
- Buf32
- Buf8
- deflateInfo
- inflateInfo

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `createLifecycle()` - 45 edges
3. `makeRedactor()` - 40 edges
4. `createInvestigationManager()` - 37 edges
5. `checkFacts()` - 33 edges
6. `Display` - 32 edges
7. `Websock` - 32 edges
8. `createCallManager()` - 31 edges
9. `run()` - 27 edges
10. `toModel()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `Claude login: the shared `factory-cli-creds`, like CFactory` --references--> `checkClaudeHome()`  [INFERRED]
  spec/2026-11-24-33-rfactory-in-cluster.md → core/src/brains/destination.js
- `3. Tests` --references--> `createHearing()`  [INFERRED]
  spec/2026-11-26-62-bot-name-factory.md → core/src/call/hearing.js
- `Constraints` --references--> `heard()`  [INFERRED]
  intent/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `Proposed outcome` --references--> `heard()`  [INFERRED]
  intent/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `Verification` --references--> `heard()`  [INFERRED]
  spec/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js

## Import Cycles
- None detected.

## Communities (237 total, 35 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Design, Hearing: wake phrase and end of a question, Packaging, Risks, Spec: Phase 1b, a voice standup in Google Meet, Speech (TTS), The bot process (`bot/run.js`) (+3 more)

### Community 2 - "rfb.js"
Cohesion: 0.04
Nodes (21): CopyRectDecoder, HextileDecoder, JPEGDecoder, RawDecoder, RREDecoder, TightPNGDecoder, Deflator, encodings (+13 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.09
Nodes (19): assert, { createCallManager }, { createInvestigationManager }, { EventEmitter }, fakeClock(), finishSpeech(), flush(), fs (+11 more)

### Community 4 - "public app.js"
Cohesion: 0.06
Nodes (67): ago(), clear(), clock(), day(), decide(), decideInvestigation(), decideShare(), el() (+59 more)

### Community 5 - "createCallManager"
Cohesion: 0.26
Nodes (21): Steps, createCallManager(), addressed(), answer(), armQuiet(), audio(), drain(), incoming() (+13 more)

### Community 6 - "claude-cli.js"
Cohesion: 0.13
Nodes (14): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, LOOKUP_ERRORS, LOOKUP_SYSTEM_PROMPT (+6 more)

### Community 7 - "createLifecycle"
Cohesion: 0.11
Nodes (35): createLifecycle(), accept(), allowAccept(), attachAgent(), boot(), callAttach(), cancel(), cancelNow() (+27 more)

### Community 8 - "agent.test.js"
Cohesion: 0.14
Nodes (12): 8. Problems we hit, assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat } (+4 more)

### Community 9 - "investigations.test.js"
Cohesion: 0.13
Nodes (19): Claude Code CLI brain (`core/src/brains/claude-cli.js`), approve(), assert, { createInvestigationManager }, { createRecord }, fs, { loadRoles }, { makeRedactor } (+11 more)

### Community 10 - "run.js"
Cohesion: 0.18
Nodes (9): { buildRendererSource }, crypto, fs, { installSttBridge }, { makeRedactor }, os, path, { SpeechGate } (+1 more)

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "guard.test.js"
Cohesion: 0.13
Nodes (14): assert, { buildPolicy }, cniResult(), entry, { execFileSync }, fake(), fs, https (+6 more)

### Community 13 - "RFB"
Cohesion: 0.06
Nodes (7): clientEncodings(), enableContinuousUpdates(), keyEvent(), QEMUExtendedKeyEvent(), RFB, setDesktopSize(), xvpOp()

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 15 - "k8s-policy.js"
Cohesion: 0.05
Nodes (46): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+38 more)

### Community 16 - "state"
Cohesion: 0.13
Nodes (18): releaseAttempt(), join(), Decisions (approved intent and spec), Deviations, Plan: see why Meet refuses the call bot, and recover from it, Rollback, Steps, Tests (+10 more)

### Community 17 - "github.test.js"
Cohesion: 0.09
Nodes (24): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFileSync } (+16 more)

### Community 18 - "runner runner.js"
Cohesion: 0.09
Nodes (27): clearInterval(), { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade(), crypto (+19 more)

### Community 19 - "cli.test.js"
Cohesion: 0.08
Nodes (16): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+8 more)

### Community 20 - "test server.test.js"
Cohesion: 0.08
Nodes (23): CFactory source (`core/src/sources/cfactory.js`), assert, boardData, { createApp, makeLogin }, fakeBrain, fs, { handleCall }, items (+15 more)

### Community 21 - "test brain.test.js"
Cohesion: 0.12
Nodes (18): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+10 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.12
Nodes (12): installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), meshAt(), approvedM01 (+4 more)

### Community 23 - "Profiles"
Cohesion: 0.22
Nodes (3): name(), Profiles, Captions vs own transcription

### Community 25 - "Steps"
Cohesion: 0.13
Nodes (21): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+13 more)

### Community 26 - "Plan: in-call agents, slice 1: live read-only lookups"
Cohesion: 0.25
Nodes (7): setCameraRenderer(), ctx(), Decisions (approved intent and spec, with the owner's amendments of 2026-11-26), Plan: in-call agents, slice 1: live read-only lookups, Rollback, Shared contracts (steps 2 to 6 all follow these), Tests

### Community 27 - "rfactory-standup.js"
Cohesion: 0.10
Nodes (27): { checkFacts }, count(), fs, main(), path, { setup }, ageOf(), approveClaude() (+19 more)

### Community 28 - "How the bot hears"
Cohesion: 0.22
Nodes (9): Environment and scope reference, How the bot hears, Language, `listen` values and the per-platform `auto` rule, Per-call worker environment variables (set internally), Privacy, Rollback, Scope fields (`RFACTORY_SCOPE_FILE`) (+1 more)

### Community 29 - "web server.js"
Cohesion: 0.11
Nodes (27): 4. Credentials, destination and egress, { buildStandup, speakStandupHeadline }, createApp(), bind(), decide(), resolveSlug(), DESKTOP_STATIC, EMPTY_LISTS (+19 more)

### Community 30 - "lookups.test.js"
Cohesion: 0.08
Nodes (27): cap(), collect(), walk(), createLookups(), FACTORY, GITHUB, { mapCard }, specs (+19 more)

### Community 31 - "viewer/board.test.js"
Cohesion: 0.18
Nodes (11): assert, board(), browser, column(), open(), { test }, { viewerRoute, URL_BOARD }, fs (+3 more)

### Community 32 - "test claude-cli.test.js"
Cohesion: 0.11
Nodes (28): createClaudeBrain(), answerTurn(), checkDestination(), lookupTurn(), propose(), run(), stop(), summarize() (+20 more)

### Community 33 - "avatar-renderer.test.js"
Cohesion: 0.12
Nodes (10): source, commit, path, repo, assert, { buildRendererSource }, { chromium }, fs (+2 more)

### Community 34 - "tts.test.js"
Cohesion: 0.12
Nodes (15): Deviations, Gates, Plan: an approved, read-only Claude investigation from the call (RFactory side), Rollback, Tests, after(), assert, { createTts } (+7 more)

### Community 35 - "client.test.js"
Cohesion: 0.10
Nodes (16): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+8 more)

### Community 36 - "profiles.test.js"
Cohesion: 0.15
Nodes (12): admin, assert, fakeK8s(), fixture(), fs, { hkdfSync }, MASTER, os (+4 more)

### Community 37 - "Plan: run RFactory in the factory cluster"
Cohesion: 0.15
Nodes (12): Branches and worktrees, Corrections to the approved spec, Decisions (from the approved spec; owner defaults accepted 2026-11-24), Deviations, Landing record (2026-11-24), Lead steps, in order, Plan: run RFactory in the factory cluster, Rollback (+4 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.10
Nodes (8): installSttBridge(), assert, fs, { installSttBridge }, path, setup(), test, vm

### Community 39 - "deflate.js"
Cohesion: 0.08
Nodes (38): deflate(), deflate_fast(), deflate_huff(), deflate_rle(), deflate_slow(), deflate_stored(), deflateEnd(), deflateInit2() (+30 more)

### Community 40 - "cfactory-write.test.js"
Cohesion: 0.10
Nodes (19): createCfactoryWriter(), getClient(), invoke(), assert, bareBlocked, bareStarted, before, card (+11 more)

### Community 41 - "kyverno-scope.test.js"
Cohesion: 0.14
Nodes (16): assert, dir, { firstHost }, fs, path, policies, probeCidrs(), test (+8 more)

### Community 42 - "verify verify.test.js"
Cohesion: 0.12
Nodes (15): assert, beats(), CHECKS, fs, http, INPUT, { join }, LIB (+7 more)

### Community 43 - "desktop-routes.test.js"
Cohesion: 0.10
Nodes (28): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+20 more)

### Community 44 - "speak"
Cohesion: 0.16
Nodes (16): event(), heard(), Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 1b, a voice standup in Google Meet, Rollback, Steps, Tests (+8 more)

### Community 45 - "makeRedactor"
Cohesion: 0.09
Nodes (35): base64(), JOINED_RULES, jwtSpans(), KEY_VALUE_AT, keyValueAt(), keyValueMatch(), keyValueSpans(), makeRedactor() (+27 more)

### Community 46 - "inflate.js"
Cohesion: 0.09
Nodes (22): adler32(), inflate_fast(), fixedtables(), inflate(), inflateInit2(), inflateReset2(), inflateSetDictionary(), InflateState() (+14 more)

### Community 47 - "verify net.sh"
Cohesion: 0.16
Nodes (17): BP, connect(), deadline_left(), hello(), mk_target(), mkp(), NIP, node_ip() (+9 more)

### Community 48 - "verify profiles.sh"
Cohesion: 0.23
Nodes (18): app_restore(), app_sync(), argo_app(), attach(), ciphertext(), cm_field(), errmatch(), extra_cleanup() (+10 more)

### Community 49 - "lookup-endpoint.test.js"
Cohesion: 0.17
Nodes (8): assert, { Client }, { createLookupEndpoint }, { DESKTOP }, http, { StreamableHTTPClientTransport }, test, tools

### Community 50 - "listProjects"
Cohesion: 0.17
Nodes (13): createState(), idle(), source(), Deviations (Codex review of the approved plan, 2026-11-17), Decisions (approved intent and spec, as delivered in slice A), Delivery in two slices (a plan decision; the approved spec is unchanged), Deviations, Plan: project-aware calls, slice A (project-aware reads) (+5 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.11
Nodes (13): Steps, Pieces, botName(), path, run(), assert, { EventEmitter }, fs (+5 more)

### Community 52 - "share.test.js"
Cohesion: 0.15
Nodes (11): callLaunchArgs(), { randomBytes }, assert, browser, { createShare, titleFor, callLaunchArgs, installCaptureGuard }, http, pick(), { test } (+3 more)

### Community 53 - "vm-call.test.js"
Cohesion: 0.18
Nodes (10): assert, { createVmSpawn }, { Duplex }, { test }, createVmSpawn(), { EventEmitter }, firstLine(), { PassThrough } (+2 more)

### Community 54 - "createInvestigationManager"
Cohesion: 0.12
Nodes (44): count(), COUNT_CLAIM, createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog(), endCall() (+36 more)

### Community 55 - "index.js"
Cohesion: 0.09
Nodes (25): octets(), parseCmdline(), startHeartbeat(), createAgent(), { createCallWorker }, { createControl }, { createProfile }, { dial } (+17 more)

### Community 56 - "createProxy"
Cohesion: 0.23
Nodes (18): checkedAddresses(), createApi(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect() (+10 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.24
Nodes (16): board(), boolean(), columns, count(), exact(), identity, log(), login() (+8 more)

### Community 58 - "@rfactory/core"
Cohesion: 0.11
Nodes (14): @rfactory/core, { deriveEffects, describe }, FINAL, { randomUUID }, { validate, hashPayload, canonical }, { hashPayload }, { randomUUID }, approve() (+6 more)

### Community 59 - "createShare"
Cohesion: 0.47
Nodes (9): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+1 more)

### Community 60 - "proxy.js"
Cohesion: 0.16
Nodes (15): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, inRange() (+7 more)

### Community 61 - "lifecycle.js"
Cohesion: 0.17
Nodes (9): nonce(), { buildPolicy }, { createDecoder, tag, encode, LANGUAGE }, crypto, net, { nonce: newNonce }, { StringDecoder }, Deviations (+1 more)

### Community 62 - "share-desktop.test.js"
Cohesion: 0.24
Nodes (7): createShareDesktop(), schedule(), stopPolling(), assert, { createShareDesktop }, setup(), test

### Community 63 - "checkFacts"
Cohesion: 0.07
Nodes (32): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass** (+24 more)

### Community 64 - "Deviations from the spec (for approval with this plan)"
Cohesion: 0.16
Nodes (16): label(), stopShare(), exec(), hosts(), Decisions carried over from the approved spec, Deviations from the spec (for approval with this plan), Facts checked in the real repos, Open questions for the owner (+8 more)

### Community 65 - "reaper reaper.test.js"
Cohesion: 0.17
Nodes (13): createReaper(), leaseStale(), tick(), fs, main(), assert, { createReaper }, fake() (+5 more)

### Community 66 - "Spec: call the bot "Factory""
Cohesion: 0.20
Nodes (9): 1. The name, everywhere a person sees or hears it, 2. The wake rule (`core/src/call/hearing.js`), 3. Tests, Alternatives rejected, Amendment (owner, 2026-11-26): share requests in natural words (#63), Design, Risks, Spec: call the bot "Factory" (+1 more)

### Community 67 - "Steps"
Cohesion: 0.11
Nodes (20): tools(), ask(), listTools(), raw(), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains), Recorded GitHub inventory (pinned 1.14.0, captured 2026-11-17) (+12 more)

### Community 68 - "ref_node_assert"
Cohesion: 0.08
Nodes (21): assert, crypto, dir, fs, ids, manifest, path, test (+13 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.12
Nodes (8): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, { makeRedactor }, reply(), repos, test

### Community 70 - "agent/call.test.js"
Cohesion: 0.14
Nodes (11): createCallWorker(), { createShare, callLaunchArgs }, { PassThrough }, assert, { createCallWorker, withProxy, MEET_GUEST, TEAMS_CAPTIONS }, { EventEmitter }, fixture(), { test } (+3 more)

### Community 71 - "proxy.test.js"
Cohesion: 0.13
Nodes (11): assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard, os (+3 more)

### Community 72 - "pod.test.js"
Cohesion: 0.22
Nodes (7): assert, fs, os, path, realPod, { spawnSync }, test

### Community 73 - "bot bot/package.json"
Cohesion: 0.14
Nodes (13): dependencies, playwright-core, @vibeconferencing/calls, engines, node, playwright-core, @vibeconferencing/calls, license (+5 more)

### Community 74 - "Design"
Cohesion: 0.13
Nodes (14): Alternatives rejected, Claude login: the shared `factory-cli-creds`, like CFactory, Design, Images: built, signed and promoted by CI, like CFactory, One pod, as today, Order and cutover, Owner decisions (proposed defaults), Pod security (+6 more)

### Community 75 - "trees.js"
Cohesion: 0.16
Nodes (28): bi_flush(), bi_reverse(), bi_windup(), build_bl_tree(), build_tree(), compress_block(), copy_block(), d_code() (+20 more)

### Community 76 - "runner k8s-lifecycle.test.js"
Cohesion: 0.19
Nodes (9): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+1 more)

### Community 77 - "web live-view.test.js"
Cohesion: 0.15
Nodes (11): assert, client(), clientSession, { createApp }, fbUpdate, includes(), { loadRoles }, net (+3 more)

### Community 78 - "tts.js"
Cohesion: 0.38
Nodes (6): createTts(), say(), fs, path, run(), wavHeader()

### Community 80 - "ref_node_fs"
Cohesion: 0.11
Nodes (15): createK8s(), fs, assert, { createK8s }, fs, http, { inClusterConfig }, os (+7 more)

### Community 81 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Design, Exposure, Facts this rests on (checked on p620, 2026-11-18), Lifecycle, Live view, Profiles, Risks (+4 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "ref_node_os"
Cohesion: 0.21
Nodes (7): createProfile(), readHead(), assert, { createProfile }, KEY, setup(), { test }

### Community 84 - "test run.test.js"
Cohesion: 0.11
Nodes (12): assert, audioJoined(), { EventEmitter }, fs, joined(), { PassThrough }, path, { run } (+4 more)

### Community 85 - "createShareManager"
Cohesion: 0.31
Nodes (19): createShareManager(), approve(), cleanup(), close(), emit(), endCall(), expire(), frameFor() (+11 more)

### Community 86 - "web/call.js"
Cohesion: 0.10
Nodes (22): SELF_NAMES, BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts, checkFactsDetailed }, emitLimits(), lookupAnswer(), { createHearing, SELF_NAMES }, { createShareDesktop } (+14 more)

### Community 87 - "core/package.json"
Cohesion: 0.17
Nodes (11): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+3 more)

### Community 88 - "Intent: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text), Open questions, Problem, Proposed outcome

### Community 89 - "bot run()"
Cohesion: 0.17
Nodes (25): buildRendererSource(), pageLeft(), run(), abandon(), afterJoin(), discardOpen(), failureReport(), idleAvatar() (+17 more)

### Community 90 - "desktop.test.js"
Cohesion: 0.18
Nodes (12): createGateway(), call(), numberFrom(), snapshot(), assert, { createGateway }, { createSessions }, { makeRedactor } (+4 more)

### Community 91 - "ref_node_path"
Cohesion: 0.06
Nodes (29): DESTINATIONS, fs, LISTEN, loadScope(), { makeRedactor }, path, resolveListen(), { toWhisperLanguage } (+21 more)

### Community 92 - "test/board.test.js"
Cohesion: 0.09
Nodes (25): COLUMNS, projectBoard(), { repositoryOf }, STAGES, boundedFetch(), { Client }, inScope(), repositoryOf() (+17 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "running"
Cohesion: 0.09
Nodes (21): Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Tests, Live check results (step 12), Alternatives rejected, Control-channel additions (an additive change to #3) (+13 more)

### Community 95 - "actions-record.test.js"
Cohesion: 0.13
Nodes (19): action(), Waves, Steps, Steps, createRecord(), files(), lastEntries(), prune() (+11 more)

### Community 96 - "Spec: an approved, read-only Claude investigation from the call"
Cohesion: 0.18
Nodes (10): 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), 3. RFactory: hearing, approval, the shared log, the spoken result, Alternatives rejected, Design, Findings this design rests on (checked 2026-11-19), Order and dependencies, Risks (+2 more)

### Community 97 - "lookup-endpoint.js"
Cohesion: 0.22
Nodes (6): createLookupEndpoint(), http, { ListToolsRequestSchema, CallToolRequestSchema }, { randomBytes, timingSafeEqual }, { Server }, { StreamableHTTPServerTransport }

### Community 98 - "cfactory-write.js"
Cohesion: 0.25
Nodes (7): { Client }, { deriveEffects }, fs, { makeRedactor }, STAGES, { StreamableHTTPClientTransport }, TOOLS

### Community 99 - "Intent: in-call agents, the model with live tools, provider chosen per call"
Cohesion: 0.22
Nodes (8): Affected users and systems, Amendments (owner, 2026-11-26), Constraints, Decisions (owner, 2026-11-26: "approve with your recommendations"), Intent: in-call agents, the model with live tools, provider chosen per call, Open questions, Problem, Proposed outcome

### Community 100 - "Steps"
Cohesion: 0.22
Nodes (8): speechLevel(), Decisions carried over (approved intent and spec), Deviations after merge, Plan: A face for the bot that talks when it speaks, Rollback, Steps, Tests, Timing and "never frozen"

### Community 101 - "k3d k14-env.sh"
Cohesion: 0.44
Nodes (9): app_sync(), argo(), desktops(), env_of(), kc(), kubectl(), runner_restart(), k14-env.sh script (+1 more)

### Community 102 - "verify handover.sh"
Cohesion: 0.42
Nodes (8): fixture_reached(), hits(), open_page(), page_loaded(), session_of(), handover.sh script, trap_page(), wait_attached()

### Community 103 - "Intent: project-aware calls"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-26: "approved", with the recommendations), Intent: project-aware calls, Open questions, Problem, Proposed outcome

### Community 104 - "protocol.test.js"
Cohesion: 0.18
Nodes (7): assert, fs, { MAX, encode, createDecoder, tag }, net, os, path, { test }

### Community 105 - "Spec: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.15
Nodes (12): 1. The service: `rfactory-stt`, 2. In the bot (`bot/run.js`, both deployments): cut speech, send segments, 3. In the call manager (`web/call.js`): transcribe and hear, 4. The listen setting, 5. Packaging and deploy, Alternatives rejected, Design, Measured on p620 (2026-11-21) (+4 more)

### Community 106 - "verify lifecycle.sh"
Cohesion: 0.42
Nodes (7): case_hold(), egress_cut(), fresh(), hold(), settled(), lifecycle.sh script, watch_end()

### Community 107 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Bounded run time, Decisions on the intent's open questions (proposed), Design, Find first, replace once (`core/src/redact.js` `logSafeWindow`), PEM flag across polls (`web/shares.js:49-51`), PEM marker scanner, Risks (+3 more)

### Community 108 - "vnc.test.js"
Cohesion: 0.12
Nodes (19): bridgeViewOnly(), createFilter(), assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session (+11 more)

### Community 109 - "Design"
Cohesion: 0.18
Nodes (11): Design, Effects are derived, not trusted, Execution: re-check, claim, record, dispatch once, Keys and switches, Pending actions and approval, Reading CFactory's results, Recognising an action request, The action allowlist (the only things that can ever run) (+3 more)

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "gateway.js"
Cohesion: 0.07
Nodes (28): tableOf(), checkFactsDetailed(), CLAIM, COUNT, { summarise }, WORDS, DESKTOP, { mapGithub, summarise, STATES } (+20 more)

### Community 112 - "stt-languages.test.js"
Cohesion: 0.38
Nodes (5): toWhisperLanguage(), WHISPER_LANGUAGES, assert, test, { WHISPER_LANGUAGES, toWhisperLanguage }

### Community 113 - "des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 114 - "shell-browser.test.js"
Cohesion: 0.20
Nodes (6): assert, { chromium }, { createApp }, { loadRoles }, { spawnSync }, test

### Community 115 - "ref_node_http"
Cohesion: 0.29
Nodes (3): http, [portA, portB], state

### Community 116 - "Design"
Cohesion: 0.22
Nodes (8): 1. CFactory: projects on the server (CFactory PR A, then PR B), 5. RFactory: each proposal keeps its target (`web/actions.js`, `web/shares.js`, `web/investigations.js`), 6. Rollout order, Alternatives rejected, Design, Risks, Spec: project-aware calls, Verification

### Community 117 - "boundary.test.js"
Cohesion: 0.10
Nodes (14): card(), assert, callTool(), { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs (+6 more)

### Community 118 - "createActionManager"
Cohesion: 0.36
Nodes (14): Steps, createActionManager(), approve(), emit(), endCall(), expire(), finish(), list() (+6 more)

### Community 119 - "Intent: call the bot "Factory""
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-26: "approved", with the recommendations), Intent: call the bot "Factory", Open questions, Problem, Proposed outcome

### Community 120 - "RSAAESAuthenticationState"
Cohesion: 0.12
Nodes (4): RA2Cipher, RSAAESAuthenticationState, EventTargetMixin, encodeUTF8()

### Community 121 - "Intent: see why Meet refuses the call bot, and recover from it"
Cohesion: 0.33
Nodes (5): Affected users and systems, Constraints, Intent: see why Meet refuses the call bot, and recover from it, Open questions, Proposed outcome

### Community 123 - "verify e2e.sh"
Cohesion: 0.53
Nodes (4): real_ids(), e2e.sh script, teams_call(), WEB_MAX

### Community 124 - "H264Decoder"
Cohesion: 0.16
Nodes (3): H264Context, H264Decoder, H264Parser

### Community 125 - "k3d k11.sh"
Cohesion: 0.50
Nodes (4): env_of(), RFACTORY_DESKTOP, RFACTORY_RUNNER_URL, k11.sh script

### Community 126 - "k3d mk-tls.sh"
Cohesion: 0.70
Nodes (4): FILES, key(), leaf(), mk-tls.sh script

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 129 - "Plan: Phase 3, act on the Factories from the call"
Cohesion: 0.33
Nodes (5): Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Tests

### Community 130 - "@modelcontextprotocol/sdk"
Cohesion: 0.33
Nodes (4): { ListToolsRequestSchema, CallToolRequestSchema }, { Server }, { StdioServerTransport }, @modelcontextprotocol/sdk

### Community 131 - "Spec: Phase 3, act on the Factories from the call"
Cohesion: 0.40
Nodes (4): Alternatives rejected, Risks, Spec: Phase 3, act on the Factories from the call, Verification

### Community 133 - "profiles.js"
Cohesion: 0.50
Nodes (3): fs, LABEL, { randomUUID, hkdfSync }

### Community 134 - "Keyboard"
Cohesion: 0.16
Nodes (7): Keyboard, _capturedElemChanged(), _captureObserver, _captureProxy(), releaseCapture(), setCapture(), stopEvent()

### Community 135 - "browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

### Community 136 - "inflator.js"
Cohesion: 0.13
Nodes (9): ZlibDecoder, Inflate, deflateInit(), Z_DEFAULT_COMPRESSION, Z_FULL_FLUSH, inflateInit(), inflateReset(), inflateResetKeep() (+1 more)

### Community 137 - "roles.test.js"
Cohesion: 0.14
Nodes (14): loadRoles(), has(), rolesOf(), commit(), assert, { loadRoles }, test, Decisions carried over from the approved spec (+6 more)

### Community 139 - "u8ArrayToBigInt"
Cohesion: 0.24
Nodes (5): bigIntToU8Array(), modPow(), u8ArrayToBigInt(), DHCipher, DHPublicKey

### Community 141 - "deploy pod.sh"
Cohesion: 1.00
Nodes (3): down(), pod.sh script, up()

### Community 142 - "verify share.sh"
Cohesion: 0.83
Nodes (3): ready(), share.sh script, web_stop()

### Community 153 - "points"
Cohesion: 0.12
Nodes (16): points, C, JL, JR, LB, LL, LM, LR (+8 more)

### Community 154 - "util.js"
Cohesion: 0.17
Nodes (5): DOMKeyTable, codepoints, getKey(), getKeycode(), getKeysym()

### Community 155 - "._handleMouse"
Cohesion: 0.25
Nodes (3): extendedPointerEvent(), pointerEvent(), clientToElement()

### Community 156 - "guard.js"
Cohesion: 0.22
Nodes (12): binding(), cidrFamily(), command(), apply(), { execFile }, execFileAsync, fs, https (+4 more)

### Community 157 - "Design"
Cohesion: 0.14
Nodes (13): 10. Intent constraints carried into slice 1, 1. Data comes from four CFactory read tools, all on the existing read key, 3. Failure and freshness, 4. `core/src/standup.js` (new, pure): `buildStandup(cards, freshness)`, 5. The spoken headline is built by the server: `speakStandupHeadline(standup)`, 6. Review (`core/src/review.js`, new, pure), 8. `core/src/sources/cfactory.js`, 9. CFactory issues to file when this spec is approved (slice 2 dependencies) (+5 more)

### Community 158 - "web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 159 - "md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 161 - "stt.test.js"
Cohesion: 0.15
Nodes (9): Web server environment variables, createStt(), fs, assert, { createStt }, fs, os, path (+1 more)

### Community 162 - "core/test/actions.test.js"
Cohesion: 0.18
Nodes (12): assert, card, context, { deriveEffects, describe }, { makeRedactor }, ok(), proposal(), refused() (+4 more)

### Community 163 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.20
Nodes (9): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 9. Rollback (+1 more)

### Community 164 - "createGuard"
Cohesion: 0.35
Nodes (12): createApi(), get(), createGuard(), counters(), heartbeat(), reconcile(), reconcileOnce(), server() (+4 more)

### Community 165 - "eyes"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 166 - "control.js"
Cohesion: 0.27
Nodes (10): capText(), createControl(), applyHosts(), closePage(), page(), start(), fs, originOf() (+2 more)

### Community 167 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Answers to the intent's open questions, Design, Feasibility gate (first plan step), Lifecycle and disposal, Live view, Network, Persistent profiles (+3 more)

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 170 - "Design"
Cohesion: 0.18
Nodes (10): 1. The wake rule (`core/src/call/hearing.js:3`), 2. A rejected mention still ends the request before it (`hearing.js:50-71`), 3. What people are told, 4. The shared views (`desktop/guest/agent/viewer/board.js:30`, `:35`), 5. Tests, Alternatives rejected, Design, Risks (+2 more)

### Community 171 - "shares.test.js"
Cohesion: 0.20
Nodes (9): approve(), assert, { createShareManager }, { loadRoles }, { makeRedactor }, setup(), test, tick() (+1 more)

### Community 172 - "Plan: Phase 0, the Linux call test"
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "createCfactorySource"
Cohesion: 0.36
Nodes (10): createCfactorySource(), call(), connect(), view(), comments(), freshness(), scopedCards(), withClient() (+2 more)

### Community 175 - "origin"
Cohesion: 0.39
Nodes (8): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), origin()

### Community 176 - "Intent: run RFactory in the factory cluster like the other Factory services"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decided, Intent: run RFactory in the factory cluster like the other Factory services, Open questions, Problem, Proposed outcome

### Community 177 - "Deviations from the spec revision (Codex re-check and plan review, for approval with this plan)"
Cohesion: 0.22
Nodes (6): findVeth(), Decisions carried over from the approved spec revision, Deviations from the spec revision (Codex re-check and plan review, for approval with this plan), Plan: desktops as KubeVirt VMs in the k3d cluster (#3, revision), Rollback, Tests

### Community 178 - "Spec: Phase 0, the Linux call test"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Context for later phases (not decided here), Decisions on the intent's Phase 0 questions, Design, Goal, Pass / fail, Risks, Spec: Phase 0, the Linux call test (+1 more)

### Community 179 - "Intent: A face for the bot that talks when it speaks"
Cohesion: 0.22
Nodes (8): Affected users and systems, Constraints, Decisions (owner, 2026-11-17), Intent: A face for the bot that talks when it speaks, Open questions, Problem, Proposed outcome (first slice), Source of the portraits

### Community 180 - "k14 results: agent workspace desktops on k3d with KubeVirt"
Cohesion: 0.22
Nodes (9): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+1 more)

### Community 181 - "Design"
Cohesion: 0.22
Nodes (9): AI disclosure, Cost, Design, Licence (owner decision 2: the whole repository is AGPL-3.0), Packaging, Portraits and notices, Source offer to every remote user (AGPL §13), The face (+1 more)

### Community 183 - "Intent: Meeting agent Phase 3, act on the Factories from the call"
Cohesion: 0.22
Nodes (8): Affected users and systems, Constraints, Decisions at approval (owner, 2026-11-17), Intent: Meeting agent Phase 3, act on the Factories from the call, Not in this slice, Open questions, Problem, Proposed outcome

### Community 184 - "Intent: Show the Factories in the call"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-17), Intent: Show the Factories in the call, Open questions, Problem, Proposed outcome

### Community 185 - "Intent: Meeting agent Phase 1b, a voice standup in Google Meet"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions at approval (owner, 2026-11-17), Intent: Meeting agent Phase 1b, a voice standup in Google Meet, Open questions, Problem, Proposed outcome

### Community 186 - "Intent: Review and control the Factories from the standup and the bot"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-23: "approved"), Intent: Review and control the Factories from the standup and the bot, Open questions, Problem, Proposed outcome

### Community 187 - "bootstrap-secrets.test.sh"
Cohesion: 0.48
Nodes (6): FAKE_LOG, fixture(), PATH, refused(), run(), bootstrap-secrets.test.sh script

### Community 188 - "allowlist.js"
Cohesion: 0.16
Nodes (18): ACTIONS, bounded(), canonical(), CREATE_STATUSES, { createHash }, criteria(), FIELDS, hashPayload() (+10 more)

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

### Community 194 - "portraits"
Cohesion: 0.25
Nodes (8): anchors, file, sha256, file, sha256, portraits, f01, f09

### Community 195 - "effects.js"
Cohesion: 0.32
Nodes (7): deriveEffects(), describe(), SERVICE, STAGE, stageFor(), stateOf(), WRITES

### Community 196 - "review.test.js"
Cohesion: 0.25
Nodes (7): assert, CURRENT, NOT_IN_CARD, { reviewCard, reviewProject }, STALE, test, UNAVAILABLE

### Community 197 - "RFactory"
Cohesion: 0.25
Nodes (6): Deployment, How the bot hears, Licence, RFactory, Roles, Standup and review

### Community 199 - "theme.js"
Cohesion: 0.67
Nodes (3): applyTheme(), dark, observer

### Community 203 - "Intent: finish the "Factory" rename and stop false wakes at a caption block start"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: finish the "Factory" rename and stop false wakes at a caption block start, Open questions, Problem, Proposed outcome

### Community 206 - "source-guard.test.js"
Cohesion: 0.10
Nodes (19): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Source adapters (+11 more)

### Community 207 - "bootstrap-secrets.sh"
Cohesion: 0.83
Nodes (3): env_of(), bootstrap-secrets.sh script, write_secret()

### Community 208 - "createHearing"
Cohesion: 0.18
Nodes (12): createHearing(), assert, { createHearing }, fakeClock(), setup(), test, Decisions (the approved intent and spec, including the spec's amendment), Deviations (+4 more)

### Community 210 - "Plan: finish the "Factory" rename and stop false wakes at a caption block start"
Cohesion: 0.29
Nodes (6): Decisions (the approved intent and spec), Deviations, Plan: finish the "Factory" rename and stop false wakes at a caption block start, Rollback, Steps, Tests

### Community 211 - "mesh"
Cohesion: 0.33
Nodes (6): mesh, anchors, file, sha256, triangles, f17

### Community 212 - "move"
Cohesion: 0.33
Nodes (6): move, C, JL, JR, LB, LM

### Community 213 - "Approved decisions (copied from the spec, so this plan stands alone)"
Cohesion: 0.33
Nodes (5): Approved decisions (copied from the spec, so this plan stands alone), Plan: Review and standup from the board (#28, slice 1), Roles, Rollback, Tests

### Community 214 - "Spec: A face for the bot that talks when it speaks"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Evidence this spec rests on, Risks, Spec: A face for the bot that talks when it speaks, Verification

### Community 215 - "anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f02

### Community 216 - "anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f03

### Community 217 - "anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f05

### Community 218 - "anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f06

### Community 219 - "anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f07

### Community 220 - "anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f08

### Community 221 - "anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f10

### Community 222 - "anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f11

### Community 223 - "anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f12

### Community 224 - "anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f14

### Community 225 - "anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f15

### Community 226 - "anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f16

### Community 227 - "Avatar portraits"
Cohesion: 0.50
Nodes (3): Avatar portraits, Changes, Provenance

### Community 228 - "makeTable"
Cohesion: 0.67
Nodes (3): crc32(), makeTable(), read_buf()

## Knowledge Gaps
- **35 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+30 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1701 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Websock` connect `Websock` to `.rQwait`, `rfb.js`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `createLifecycle()` (e.g. with `lifecycle.js` and `action()`) actually correct?**
  _`createLifecycle()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _35 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `Steps` to `makeRedactor`, `gateway.js`, `state`, `Profiles`, `Websock`, `checkFacts`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Should `rfb.js` be split into smaller, more focused modules?**
  _Cohesion score 0.04072072072072072 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `Steps` to `Cursor`, `origin`, `listProjects`, `bot run()`, `Plan: in-call agents, slice 1: live read-only lookups`, `ref_node_path`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._