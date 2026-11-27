# Graph Report - RFactory-t57  (2026-11-27)

## Corpus Check
- 330 files · ~503,043 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 10, .nix 6, .css 4)

## Summary
- 3707 nodes · 6607 edges · 263 communities (221 shown, 42 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 907 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `71187abd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verify lib.sh
- .rQwait
- rfb.js
- test/call.test.js
- public app.js
- createCallManager
- claude-cli.js
- createLifecycle
- index.js
- Steps
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
- Design
- Steps
- logging.js
- rfactory-standup.js
- Multi-participant live test
- web server.js
- lookups.test.js
- share.js
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
- Design
- facts.js
- makeRedactor
- inflate.js
- verify net.sh
- verify profiles.sh
- lookup-endpoint.test.js
- running
- spike hello-call.test.js
- share.test.js
- vm-call.test.js
- createInvestigationManager
- kubevirt.test.js
- createProxy
- runner protocol.js
- web/test/actions.test.js
- createShare
- proxy.js
- lifecycle.js
- share-desktop.test.js
- a
- Deviations from the spec (for approval with this plan)
- reaper reaper.test.js
- Spec: call the bot "Factory"
- Steps
- ref_node_assert
- test cfactory.test.js
- agent/call.test.js
- proxy.test.js
- makeRedactor
- bot bot/package.json
- Design
- trees.js
- runner k8s-lifecycle.test.js
- web live-view.test.js
- ref_node_child_process
- Display
- Steps
- Design
- spike spike/package.json
- Spec: one live test call with 5-10 team members talking to Factory
- test run.test.js
- createShareManager
- web/call.js
- core/package.json
- Design
- bot run()
- Websock
- gateway.test.js
- test/board.test.js
- desktop desktop/package.json
- Design
- ref_node_fs
- Spec: an approved, read-only Claude investigation from the call
- lookup-endpoint.js
- readiness.sh
- Intent: in-call agents, the model with live tools, provider chosen per call
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
- Plan: in-call agents, slice 1: live read-only lookups
- des.js
- shell-browser.test.js
- ref_node_http
- Spec: one live test call with 5-10 team members talking to Factory
- boundary.test.js
- createActionManager
- Intent: call the bot "Factory"
- RSAAESAuthenticationState
- observer.js
- Websock
- verify e2e.sh
- H264Decoder
- k3d k11.sh
- k3d mk-tls.sh
- a
- verify liveview.sh
- createRecord
- @modelcontextprotocol/sdk
- setup
- GestureHandler
- createCfactorySource
- Keyboard
- browser.js
- ZRLEDecoder
- inflateReset
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
- Plan: Show the CFactory board in the call
- guard.js
- callevents.js
- web/package.json
- md5.js
- TightDecoder
- Design
- Intent: redact credentials that wrap across log lines
- Desktop VMs on the k3d factory cluster
- desktop-routes.test.js
- eyes
- createControl
- logging.js
- Socket
- teams-tap-spike.js
- Design
- @rfactory/core
- Plan: Phase 0, the Linux call test
- Intent: run a Claude terminal from the call, and show it
- investigations.test.js
- Intent: one live test call with 5-10 team members talking to Factory
- Intent: run RFactory in the factory cluster like the other Factory services
- Deviations from the spec revision (Codex re-check and plan review, for approval with this plan)
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
- k14 results: agent workspace desktops on k3d with KubeVirt
- callevents.js
- deflator.js
- Intent: Meeting agent Phase 3, act on the Factories from the call
- Intent: Show the Factories in the call
- Intent: Meeting agent Phase 1b, a voice standup in Google Meet
- Intent: Review and control the Factories from the standup and the bot
- bootstrap-secrets.test.sh
- core/test/actions.test.js
- Intent: Meeting agent web app for the Factories
- Intent: Standalone mode, without the Factories
- Intent: Agent workspace, a disposable desktop per call
- Intent: Meeting agent Phase 1a, a text standup in the web UI
- Third-party notices
- portraits
- Intent: redact credentials that wrap across log lines
- review.test.js
- Plan: Phase 3, act on the Factories from the call
- LegacyCrypto
- theme.js
- RSACipher
- CLAUDE.md
- .claude/CLAUDE.md
- Intent: finish the "Factory" rename and stop false wakes at a caption block start
- check-image-stt.sh
- SHELL_INVENTORY.md
- Design
- bootstrap-secrets.sh
- createHearing
- assert-signature-location.sh
- run.js
- mesh
- move
- JPEGDecoder
- fill_window
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
- deflate
- Buf16
- Buf32
- Buf8
- deflateInfo
- inflateInfo
- cap
- join
- check-egress.sh
- actions.js
- client.js
- Spec: the call Chrome runs with its sandbox on, so Meet admits the bot
- ref_node_os
- Keyboard
- ref_node_crypto
- desktop-routes.test.js
- shares.test.js
- Design
- createClaudeBrain
- k8s.test.js
- pod.test.js
- Plan: Phase 1b, a voice standup in Google Meet
- Intent: the bot hears the call itself (its own speech-to-text)
- stun.test.js
- Intent: see why Meet refuses the call bot, and recover from it
- Plan: finish the "Factory" rename and stop false wakes at a caption block start
- HextileDecoder
- events.js
- connect
- JPEGDecoder
- profiles.js
- Plan: the bot hears the call itself (its own speech-to-text)

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `createLifecycle()` - 45 edges
3. `makeRedactor()` - 40 edges
4. `createInvestigationManager()` - 37 edges
5. `checkFacts()` - 33 edges
6. `createCallManager()` - 33 edges
7. `Display` - 32 edges
8. `Websock` - 32 edges
9. `run()` - 29 edges
10. `toModel()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `3. Tests` --references--> `createHearing()`  [INFERRED]
  spec/2026-11-26-62-bot-name-factory.md → core/src/call/hearing.js
- `Constraints` --references--> `heard()`  [INFERRED]
  intent/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `Proposed outcome` --references--> `heard()`  [INFERRED]
  intent/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `Verification` --references--> `heard()`  [INFERRED]
  spec/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `2. The wake rule (`core/src/call/hearing.js`)` --references--> `heard()`  [INFERRED]
  spec/2026-11-26-62-bot-name-factory.md → core/src/call/hearing.js

## Import Cycles
- None detected.

## Communities (263 total, 42 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 2 - "rfb.js"
Cohesion: 0.07
Nodes (18): CopyRectDecoder, RawDecoder, RREDecoder, ZlibDecoder, Deflator, encodings, _buildExtendedClipboardFlags(), clientCutText() (+10 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.08
Nodes (19): assert, { createCallManager }, { createInvestigationManager }, { EventEmitter }, fakeClock(), finishSpeech(), flush(), fs (+11 more)

### Community 4 - "public app.js"
Cohesion: 0.06
Nodes (67): ago(), clear(), clock(), day(), decide(), decideInvestigation(), decideShare(), el() (+59 more)

### Community 5 - "createCallManager"
Cohesion: 0.21
Nodes (25): Deviations (Codex review of the approved plan, 2026-11-17), Steps, createCallManager(), addressed(), answer(), armQuiet(), audio(), captionSeen() (+17 more)

### Community 6 - "claude-cli.js"
Cohesion: 0.11
Nodes (17): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, LOOKUP_ERRORS, LOOKUP_SYSTEM_PROMPT (+9 more)

### Community 7 - "createLifecycle"
Cohesion: 0.10
Nodes (37): createLifecycle(), accept(), action(), allowAccept(), attachAgent(), boot(), callAttach(), cancel() (+29 more)

### Community 8 - "index.js"
Cohesion: 0.09
Nodes (25): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+17 more)

### Community 9 - "Steps"
Cohesion: 0.09
Nodes (15): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+7 more)

### Community 10 - "run.js"
Cohesion: 0.12
Nodes (15): hello(), Captions vs own transcription, Environment and scope reference, How the bot hears, Language, `listen` values and the per-platform `auto` rule, Per-call worker environment variables (set internally), Privacy (+7 more)

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "guard.test.js"
Cohesion: 0.13
Nodes (14): assert, { buildPolicy }, cniResult(), entry, { execFileSync }, fake(), fs, https (+6 more)

### Community 13 - "RFB"
Cohesion: 0.07
Nodes (3): keyEvent(), RFB, xvpOp()

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 15 - "k8s-policy.js"
Cohesion: 0.05
Nodes (45): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+37 more)

### Community 16 - "state"
Cohesion: 0.25
Nodes (3): extendedPointerEvent(), pointerEvent(), clientToElement()

### Community 17 - "github.test.js"
Cohesion: 0.09
Nodes (18): { Client }, { execFileSync }, READ_TOOLS, RECORDED, { StdioClientTransport }, fetchScope(), assert, conn() (+10 more)

### Community 18 - "runner runner.js"
Cohesion: 0.10
Nodes (24): clearInterval(), createK8s(), fs, { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle } (+16 more)

### Community 19 - "cli.test.js"
Cohesion: 0.22
Nodes (12): binding(), cidrFamily(), command(), apply(), { execFile }, execFileAsync, fs, https (+4 more)

### Community 20 - "test server.test.js"
Cohesion: 0.08
Nodes (21): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, { handleCall }, items, { loadRoles } (+13 more)

### Community 21 - "test brain.test.js"
Cohesion: 0.11
Nodes (19): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+11 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.11
Nodes (13): installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState(), meshAt() (+5 more)

### Community 24 - "Design"
Cohesion: 0.14
Nodes (13): AI disclosure, Alternatives rejected, Cost, Design, Evidence this spec rests on, Licence (owner decision 2: the whole repository is AGPL-3.0), Packaging, Portraits and notices (+5 more)

### Community 25 - "Steps"
Cohesion: 0.10
Nodes (26): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+18 more)

### Community 26 - "logging.js"
Cohesion: 0.22
Nodes (8): speechLevel(), Decisions carried over (approved intent and spec), Deviations after merge, Plan: A face for the bot that talks when it speaks, Rollback, Steps, Tests, Timing and "never frozen"

### Community 27 - "rfactory-standup.js"
Cohesion: 0.13
Nodes (21): ageOf(), approveClaude(), causes(), { checkFacts }, { connect }, { createBrain }, { createCfactorySource }, { createClaudeBrain, ARGV: CLAUDE_ARGV } (+13 more)

### Community 28 - "Multi-participant live test"
Cohesion: 0.12
Nodes (13): a. The invitation, b. The timeline, c. The script, d. The score sheet, e. The results comment template, Multi-participant live test, The 10 questions, Deployment (+5 more)

### Community 29 - "web server.js"
Cohesion: 0.11
Nodes (26): { buildStandup, speakStandupHeadline }, createApp(), bind(), decide(), resolveSlug(), DESKTOP_STATIC, EMPTY_LISTS, fs (+18 more)

### Community 30 - "lookups.test.js"
Cohesion: 0.08
Nodes (25): createLookups(), FACTORY, GITHUB, { mapCard }, specs, { STATES }, validate(), { validPath, validNumber } (+17 more)

### Community 31 - "share.js"
Cohesion: 0.14
Nodes (13): { randomBytes }, { viewerRoute, URL_BOARD, ORIGIN }, assert, board(), browser, column(), open(), { test } (+5 more)

### Community 32 - "test claude-cli.test.js"
Cohesion: 0.13
Nodes (16): claudeHash(), assert, { claudeHash, checkClaudeHome }, { createClaudeBrain }, { EventEmitter }, fs, lookup, lookupBrain() (+8 more)

### Community 33 - "avatar-renderer.test.js"
Cohesion: 0.12
Nodes (10): source, commit, path, repo, assert, { buildRendererSource }, { chromium }, fs (+2 more)

### Community 34 - "tts.test.js"
Cohesion: 0.12
Nodes (17): Deviations, after(), assert, { createTts }, { EventEmitter }, fs, os, { PassThrough } (+9 more)

### Community 35 - "client.test.js"
Cohesion: 0.14
Nodes (11): assert, { createHandler, createUpgrade }, { createRunnerClient }, { execFileSync }, fs, https, os, { PassThrough, Duplex } (+3 more)

### Community 36 - "profiles.test.js"
Cohesion: 0.15
Nodes (12): admin, assert, fakeK8s(), fixture(), fs, { hkdfSync }, MASTER, os (+4 more)

### Community 37 - "Plan: run RFactory in the factory cluster"
Cohesion: 0.09
Nodes (28): afterJoin(), captions(), heard(), When the bot starts to hear (Meet captions), Decisions (carried from the approved intent and spec), Deviations found during implementation, Deviations from the spec (made while planning, for approval with this plan), Approval (2026-11-27) (+20 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.08
Nodes (13): installSttBridge(), assert, event(), fs, { installSttBridge }, path, RTCRtpReceiver, RTCRtpSender (+5 more)

### Community 39 - "deflate.js"
Cohesion: 0.08
Nodes (33): deflate(), deflateEnd(), deflateInit(), deflateInit2(), deflateReset(), deflateResetKeep(), deflateSetDictionary(), DeflateState() (+25 more)

### Community 40 - "cfactory-write.test.js"
Cohesion: 0.08
Nodes (26): { Client }, createCfactoryWriter(), getClient(), invoke(), { deriveEffects }, fs, { makeRedactor }, STAGES (+18 more)

### Community 41 - "kyverno-scope.test.js"
Cohesion: 0.14
Nodes (16): assert, dir, { firstHost }, fs, path, policies, probeCidrs(), test (+8 more)

### Community 42 - "verify verify.test.js"
Cohesion: 0.10
Nodes (19): assert, beats(), CHECKS, fs, http, INPUT, { join }, LIB (+11 more)

### Community 43 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Answers to the intent's open questions, Design, Feasibility gate (first plan step), Lifecycle and disposal, Live view, Network, Persistent profiles (+3 more)

### Community 44 - "facts.js"
Cohesion: 0.15
Nodes (12): 1. The service: `rfactory-stt`, 2. In the bot (`bot/run.js`, both deployments): cut speech, send segments, 3. In the call manager (`web/call.js`): transcribe and hear, 4. The listen setting, 5. Packaging and deploy, Alternatives rejected, Design, Measured on p620 (2026-11-21) (+4 more)

### Community 45 - "makeRedactor"
Cohesion: 0.11
Nodes (30): base64(), JOINED_RULES, jwtSpans(), KEY_VALUE_AT, keyValueAt(), keyValueMatch(), keyValueSpans(), makeRedactor() (+22 more)

### Community 46 - "inflate.js"
Cohesion: 0.08
Nodes (24): adler32(), inflate_fast(), fixedtables(), inflate(), inflateInit2(), inflateReset(), inflateReset2(), inflateResetKeep() (+16 more)

### Community 47 - "verify net.sh"
Cohesion: 0.16
Nodes (17): BP, connect(), deadline_left(), hello(), mk_target(), mkp(), NIP, node_ip() (+9 more)

### Community 48 - "verify profiles.sh"
Cohesion: 0.23
Nodes (18): app_restore(), app_sync(), argo_app(), attach(), ciphertext(), cm_field(), errmatch(), extra_cleanup() (+10 more)

### Community 49 - "lookup-endpoint.test.js"
Cohesion: 0.17
Nodes (8): assert, { Client }, { createLookupEndpoint }, { DESKTOP }, http, { StreamableHTTPClientTransport }, test, tools

### Community 50 - "running"
Cohesion: 0.24
Nodes (12): source(), Decisions (approved intent and spec, as delivered in slice A), Delivery in two slices (a plan decision; the approved spec is unchanged), Deviations, Plan: project-aware calls, slice A (project-aware reads), Rollback (in reverse order), Steps, Tests (+4 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.11
Nodes (13): Steps, Pieces, botName(), path, run(), assert, { EventEmitter }, fs (+5 more)

### Community 52 - "share.test.js"
Cohesion: 0.18
Nodes (8): assert, browser, { createShare, titleFor, callLaunchArgs, installCaptureGuard }, http, pick(), { test }, { URL_BOARD }, titleFor()

### Community 53 - "vm-call.test.js"
Cohesion: 0.17
Nodes (10): assert, { createVmSpawn }, { Duplex }, { test }, createVmSpawn(), { EventEmitter }, firstLine(), { PassThrough } (+2 more)

### Community 54 - "createInvestigationManager"
Cohesion: 0.12
Nodes (44): count(), COUNT_CLAIM, createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog(), endCall() (+36 more)

### Community 55 - "kubevirt.test.js"
Cohesion: 0.13
Nodes (13): octets(), parseCmdline(), assert, { createAgent }, { createCallWorker }, { createControl }, { dial }, { encode, createDecoder } (+5 more)

### Community 56 - "createProxy"
Cohesion: 0.24
Nodes (18): checkedAddresses(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect(), handleForward() (+10 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.24
Nodes (16): board(), boolean(), columns, count(), exact(), identity, log(), login() (+8 more)

### Community 58 - "web/test/actions.test.js"
Cohesion: 0.20
Nodes (7): approve(), assert, { createActionManager }, { loadRoles }, { makeRedactor }, setup(), test

### Community 59 - "createShare"
Cohesion: 0.47
Nodes (9): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+1 more)

### Community 60 - "proxy.js"
Cohesion: 0.17
Nodes (14): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, inRange() (+6 more)

### Community 61 - "lifecycle.js"
Cohesion: 0.22
Nodes (6): { buildPolicy }, { createDecoder, tag, encode, LANGUAGE }, crypto, net, { nonce: newNonce }, { StringDecoder }

### Community 62 - "share-desktop.test.js"
Cohesion: 0.24
Nodes (7): createShareDesktop(), schedule(), stopPolling(), assert, { createShareDesktop }, setup(), test

### Community 64 - "Deviations from the spec (for approval with this plan)"
Cohesion: 0.17
Nodes (15): label(), stopShare(), hosts(), Decisions carried over from the approved spec, Deviations from the spec (for approval with this plan), Facts checked in the real repos, Open questions for the owner, Plan: Agent workspace, a disposable desktop per call (#3) (+7 more)

### Community 65 - "reaper reaper.test.js"
Cohesion: 0.17
Nodes (13): createReaper(), leaseStale(), tick(), fs, main(), assert, { createReaper }, fake() (+5 more)

### Community 66 - "Spec: call the bot "Factory""
Cohesion: 0.20
Nodes (9): 1. The name, everywhere a person sees or hears it, 2. The wake rule (`core/src/call/hearing.js`), 3. Tests, Alternatives rejected, Amendment (owner, 2026-11-26): share requests in natural words (#63), Design, Risks, Spec: call the bot "Factory" (+1 more)

### Community 67 - "Steps"
Cohesion: 0.08
Nodes (33): tools(), ask(), required(), number(), raw(), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains) (+25 more)

### Community 68 - "ref_node_assert"
Cohesion: 0.10
Nodes (15): assert, fs, path, root, test, assert, { loadRoles }, test (+7 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.12
Nodes (9): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, listTools(), { makeRedactor }, reply(), repos (+1 more)

### Community 70 - "agent/call.test.js"
Cohesion: 0.15
Nodes (13): createCallWorker(), { createShare, callLaunchArgs }, fs, { PassThrough }, assert, { createCallWorker, withProxy, MEET_GUEST, TEAMS_CAPTIONS }, { EventEmitter }, fixture() (+5 more)

### Community 71 - "proxy.test.js"
Cohesion: 0.12
Nodes (12): createApi(), assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard (+4 more)

### Community 72 - "makeRedactor"
Cohesion: 0.11
Nodes (20): DESTINATIONS, fs, LISTEN, loadScope(), { makeRedactor }, path, { toWhisperLanguage }, toWhisperLanguage() (+12 more)

### Community 73 - "bot bot/package.json"
Cohesion: 0.14
Nodes (13): dependencies, playwright-core, @vibeconferencing/calls, engines, node, playwright-core, @vibeconferencing/calls, license (+5 more)

### Community 74 - "Design"
Cohesion: 0.14
Nodes (13): Alternatives rejected, Design, Images: built, signed and promoted by CI, like CFactory, One pod, as today, Order and cutover, Owner decisions (proposed defaults), Pod security, Reach: tunnel, DNS, Keycloak (+5 more)

### Community 75 - "trees.js"
Cohesion: 0.16
Nodes (28): bi_flush(), bi_reverse(), bi_windup(), build_bl_tree(), build_tree(), compress_block(), copy_block(), d_code() (+20 more)

### Community 76 - "runner k8s-lifecycle.test.js"
Cohesion: 0.19
Nodes (9): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+1 more)

### Community 77 - "web live-view.test.js"
Cohesion: 0.17
Nodes (10): assert, clientSession, { createApp }, fbUpdate, includes(), { loadRoles }, net, start() (+2 more)

### Community 78 - "ref_node_child_process"
Cohesion: 0.08
Nodes (29): checkFacts(), assert, checked(), { checkFacts, checkFactsDetailed }, snapshot, test, Alternatives rejected, Claude Code CLI brain (`core/src/brains/claude-cli.js`) (+21 more)

### Community 80 - "Steps"
Cohesion: 0.23
Nodes (10): idle(), bash(), Decisions (the approved intent and spec), Deviations, Open questions, Plan: one live test call with 5-10 team members talking to Factory, Rollback, Steps (+2 more)

### Community 81 - "Design"
Cohesion: 0.06
Nodes (32): gateway(), Affected users and systems, Constraints, Decisions (2026-11-27), Intent: Enforce an egress limit for the RFactory pod, Open questions, Problem, Proposed outcome (+24 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "Spec: one live test call with 5-10 team members talking to Factory"
Cohesion: 0.18
Nodes (9): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+1 more)

### Community 84 - "test run.test.js"
Cohesion: 0.11
Nodes (11): assert, { EventEmitter }, fs, joined(), { PassThrough }, path, { run }, setup() (+3 more)

### Community 85 - "createShareManager"
Cohesion: 0.31
Nodes (19): createShareManager(), approve(), cleanup(), close(), emit(), endCall(), expire(), frameFor() (+11 more)

### Community 86 - "web/call.js"
Cohesion: 0.10
Nodes (23): SELF_NAMES, resolveListen(), BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts, checkFactsDetailed }, emitLimits(), lookupAnswer(), { createHearing, SELF_NAMES } (+15 more)

### Community 87 - "core/package.json"
Cohesion: 0.17
Nodes (11): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+3 more)

### Community 88 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Design, Hearing: wake phrase and end of a question, Packaging, Risks, Spec: Phase 1b, a voice standup in Google Meet, Speech (TTS), The bot process (`bot/run.js`) (+3 more)

### Community 89 - "bot run()"
Cohesion: 0.19
Nodes (22): pageLeft(), run(), abandon(), discardOpen(), failureReport(), guestHelper(), idleAvatar(), leftConfirmed() (+14 more)

### Community 91 - "gateway.test.js"
Cohesion: 0.14
Nodes (9): assert, base, { createGateway }, fs, { loadScope }, { makeRedactor }, os, path (+1 more)

### Community 92 - "test/board.test.js"
Cohesion: 0.09
Nodes (25): COLUMNS, projectBoard(), { repositoryOf }, STAGES, boundedFetch(), { Client }, inScope(), repositoryOf() (+17 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Control-channel additions (an additive change to #3), Design, Order and dependencies, Proposing, approving, stopping, Risks, Spec: Show the CFactory board in the call, The constraint that shapes it (+3 more)

### Community 95 - "ref_node_fs"
Cohesion: 0.08
Nodes (21): assert, crypto, dir, fs, ids, manifest, path, test (+13 more)

### Community 96 - "Spec: an approved, read-only Claude investigation from the call"
Cohesion: 0.18
Nodes (10): 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), 3. RFactory: hearing, approval, the shared log, the spoken result, Alternatives rejected, Design, Findings this design rests on (checked 2026-11-19), Order and dependencies, Risks (+2 more)

### Community 97 - "lookup-endpoint.js"
Cohesion: 0.22
Nodes (6): createLookupEndpoint(), http, { ListToolsRequestSchema, CallToolRequestSchema }, { randomBytes, timingSafeEqual }, { Server }, { StreamableHTTPServerTransport }

### Community 98 - "readiness.sh"
Cohesion: 0.35
Nodes (10): alive(), extra_cleanup(), mode_checks(), settle(), readiness.sh script, stop_call(), stop_helpers(), wait_event() (+2 more)

### Community 99 - "Intent: in-call agents, the model with live tools, provider chosen per call"
Cohesion: 0.18
Nodes (10): Affected users and systems, Amendments (owner, 2026-11-26), Constraints, Decisions (owner, 2026-11-26: "approve with your recommendations"), Intent: in-call agents, the model with live tools, provider chosen per call, Open questions, Problem, Proposed outcome (+2 more)

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
Cohesion: 0.35
Nodes (12): createApi(), get(), createGuard(), counters(), heartbeat(), reconcile(), reconcileOnce(), server() (+4 more)

### Community 106 - "verify lifecycle.sh"
Cohesion: 0.42
Nodes (7): case_hold(), egress_cut(), fresh(), hold(), settled(), lifecycle.sh script, watch_end()

### Community 107 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Bounded run time, Decisions on the intent's open questions (proposed), Design, PEM flag across polls (`web/shares.js:49-51`), PEM marker scanner, Risks, Spec: redact credentials that wrap across log lines (+2 more)

### Community 108 - "vnc.test.js"
Cohesion: 0.15
Nodes (13): bridgeViewOnly(), createFilter(), assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session (+5 more)

### Community 109 - "Design"
Cohesion: 0.11
Nodes (18): Alternatives rejected, Design, Effects are derived, not trusted, Execution: re-check, claim, record, dispatch once, Keys and switches, Pending actions and approval, Reading CFactory's results, Recognising an action request (+10 more)

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "gateway.js"
Cohesion: 0.10
Nodes (22): checkFactsDetailed(), CLAIM, COUNT, { summarise }, WORDS, DESKTOP, { mapGithub, summarise, STATES }, NAMES (+14 more)

### Community 112 - "Plan: in-call agents, slice 1: live read-only lookups"
Cohesion: 0.25
Nodes (7): setCameraRenderer(), ctx(), Decisions (approved intent and spec, with the owner's amendments of 2026-11-26), Plan: in-call agents, slice 1: live read-only lookups, Rollback, Shared contracts (steps 2 to 6 all follow these), Tests

### Community 113 - "des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 114 - "shell-browser.test.js"
Cohesion: 0.20
Nodes (6): assert, { chromium }, { createApp }, { loadRoles }, { spawnSync }, test

### Community 115 - "ref_node_http"
Cohesion: 0.29
Nodes (3): http, [portA, portB], state

### Community 116 - "Spec: one live test call with 5-10 team members talking to Factory"
Cohesion: 0.17
Nodes (11): 1. The readiness-check tool (slice 1, code), 2. The runbook page (slice 1, docs), 3. How the results are scored without a code change, 4. The day (slice 2, no code), 5. Deferred, Alternatives rejected, Approval (2026-11-27), Design (+3 more)

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

### Community 121 - "observer.js"
Cohesion: 0.24
Nodes (8): [chrome, dir], close(), controller, endWatch, fs, path, stop(), stopped

### Community 122 - "Websock"
Cohesion: 0.14
Nodes (13): Branches and worktrees, Corrections to the approved spec, Decisions (from the approved spec; owner defaults accepted 2026-11-24), Deviations, Landing record (2026-11-24), Lead steps, in order, Live check results (step 12), Plan: run RFactory in the factory cluster (+5 more)

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

### Community 127 - "a"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: the first question after the bot joins is heard in Meet captions mode, Open questions, Proposed outcome

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 129 - "createRecord"
Cohesion: 0.31
Nodes (10): Waves, Steps, createRecord(), files(), lastEntries(), prune(), unfinished(), unfinishedInvestigations() (+2 more)

### Community 130 - "@modelcontextprotocol/sdk"
Cohesion: 0.33
Nodes (4): { ListToolsRequestSchema, CallToolRequestSchema }, { Server }, { StdioServerTransport }, @modelcontextprotocol/sdk

### Community 131 - "setup"
Cohesion: 0.67
Nodes (3): crc32(), makeTable(), read_buf()

### Community 133 - "createCfactorySource"
Cohesion: 0.36
Nodes (10): createCfactorySource(), call(), connect(), view(), comments(), freshness(), scopedCards(), withClient() (+2 more)

### Community 134 - "Keyboard"
Cohesion: 0.20
Nodes (8): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass**

### Community 135 - "browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

### Community 137 - "inflateReset"
Cohesion: 0.19
Nodes (10): loadRoles(), has(), rolesOf(), Decisions carried over from the approved spec, Decisions for this plan, Deviations, Plan: v1 roles in code (admin, approver, member), slice "roles" of #2, Rollback (+2 more)

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
Cohesion: 0.15
Nodes (5): DOMKeyTable, codepoints, getKey(), getKeycode(), getKeysym()

### Community 155 - "Plan: Show the CFactory board in the call"
Cohesion: 0.33
Nodes (5): Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Tests

### Community 156 - "guard.js"
Cohesion: 0.27
Nodes (9): calls(), FAKE_ARGS, FAKE_CALLS, FAKE_OUT, FAKE_PROGRAM, fixture(), PATH, run() (+1 more)

### Community 157 - "callevents.js"
Cohesion: 0.15
Nodes (12): 10. Intent constraints carried into slice 1, 1. Data comes from four CFactory read tools, all on the existing read key, 3. Failure and freshness, 4. `core/src/standup.js` (new, pure): `buildStandup(cards, freshness)`, 6. Review (`core/src/review.js`, new, pure), 8. `core/src/sources/cfactory.js`, 9. CFactory issues to file when this spec is approved (slice 2 dependencies), Alternatives rejected (+4 more)

### Community 158 - "web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 159 - "md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 161 - "Design"
Cohesion: 0.22
Nodes (8): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Spec: Standalone mode, with a choice of source and brain

### Community 162 - "Intent: redact credentials that wrap across log lines"
Cohesion: 0.18
Nodes (10): Source adapters, assert, fs, git(), guard, os, path, repo() (+2 more)

### Community 163 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.18
Nodes (10): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 8. Problems we hit (+2 more)

### Community 164 - "desktop-routes.test.js"
Cohesion: 0.18
Nodes (18): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+10 more)

### Community 165 - "eyes"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 166 - "createControl"
Cohesion: 0.43
Nodes (7): capText(), createControl(), applyHosts(), closePage(), page(), start(), originOf()

### Community 167 - "logging.js"
Cohesion: 0.09
Nodes (5): toSigned32bit(), toUnsigned32bit(), DataChannel, rawChannelProps, ReadyStates

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 170 - "Design"
Cohesion: 0.18
Nodes (10): 1. The wake rule (`core/src/call/hearing.js:3`), 2. A rejected mention still ends the request before it (`hearing.js:50-71`), 3. What people are told, 4. The shared views (`desktop/guest/agent/viewer/board.js:30`, `:35`), 5. Tests, Alternatives rejected, Design, Risks (+2 more)

### Community 171 - "@rfactory/core"
Cohesion: 0.28
Nodes (7): { checkFacts }, count(), fs, main(), path, { setup }, setup()

### Community 172 - "Plan: Phase 0, the Linux call test"
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "investigations.test.js"
Cohesion: 0.14
Nodes (18): approve(), assert, { createInvestigationManager }, { createRecord }, fs, { loadRoles }, { makeRedactor }, os (+10 more)

### Community 175 - "Intent: one live test call with 5-10 team members talking to Factory"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: one live test call with 5-10 team members talking to Factory, Open questions, Problem, Proposed outcome

### Community 176 - "Intent: run RFactory in the factory cluster like the other Factory services"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decided, Intent: run RFactory in the factory cluster like the other Factory services, Open questions, Problem, Proposed outcome

### Community 177 - "Deviations from the spec revision (Codex re-check and plan review, for approval with this plan)"
Cohesion: 0.13
Nodes (21): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), origin() (+13 more)

### Community 178 - "Spec: Phase 0, the Linux call test"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Context for later phases (not decided here), Decisions on the intent's Phase 0 questions, Design, Goal, Pass / fail, Risks, Spec: Phase 0, the Linux call test (+1 more)

### Community 179 - "Intent: A face for the bot that talks when it speaks"
Cohesion: 0.22
Nodes (8): Affected users and systems, Constraints, Decisions (owner, 2026-11-17), Intent: A face for the bot that talks when it speaks, Open questions, Problem, Proposed outcome (first slice), Source of the portraits

### Community 180 - "k14 results: agent workspace desktops on k3d with KubeVirt"
Cohesion: 0.25
Nodes (8): findVeth(), wait(), Decisions carried over from the approved spec revision, Deviations from the spec revision (Codex re-check and plan review, for approval with this plan), Plan: desktops as KubeVirt VMs in the k3d cluster (#3, revision), Rollback, Steps, Tests

### Community 181 - "callevents.js"
Cohesion: 0.29
Nodes (5): filter(), GREETING, HEARING, LOG_CLASSES, STATES

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

### Community 188 - "core/test/actions.test.js"
Cohesion: 0.06
Nodes (47): ACTIONS, bounded(), canonical(), CREATE_STATUSES, { createHash }, criteria(), FIELDS, hashPayload() (+39 more)

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

### Community 195 - "Intent: redact credentials that wrap across log lines"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: redact credentials that wrap across log lines, Open questions, Problem, Proposed outcome

### Community 196 - "review.test.js"
Cohesion: 0.25
Nodes (7): assert, CURRENT, NOT_IN_CARD, { reviewCard, reviewProject }, STALE, test, UNAVAILABLE

### Community 197 - "Plan: Phase 3, act on the Factories from the call"
Cohesion: 0.33
Nodes (5): Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Tests

### Community 199 - "theme.js"
Cohesion: 0.67
Nodes (3): applyTheme(), dark, observer

### Community 203 - "Intent: finish the "Factory" rename and stop false wakes at a caption block start"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: finish the "Factory" rename and stop false wakes at a caption block start, Open questions, Problem, Proposed outcome

### Community 206 - "Design"
Cohesion: 0.29
Nodes (6): Accepted risk, Decisions carried over (approved intent and spec), Deviations, Plan: the call Chrome runs with its sandbox on, so Meet admits the bot, Rollback, Tests

### Community 207 - "bootstrap-secrets.sh"
Cohesion: 0.83
Nodes (3): env_of(), bootstrap-secrets.sh script, write_secret()

### Community 208 - "createHearing"
Cohesion: 0.18
Nodes (12): createHearing(), assert, { createHearing }, fakeClock(), setup(), test, Decisions (the approved intent and spec, including the spec's amendment), Deviations (+4 more)

### Community 210 - "run.js"
Cohesion: 0.13
Nodes (13): buildRendererSource(), { buildRendererSource }, { CALL_EVENTS }, crypto, fs, { installSttBridge }, { makeRedactor }, os (+5 more)

### Community 211 - "mesh"
Cohesion: 0.33
Nodes (6): mesh, anchors, file, sha256, triangles, f17

### Community 212 - "move"
Cohesion: 0.33
Nodes (6): move, C, JL, JR, LB, LM

### Community 213 - "JPEGDecoder"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (approved 2026-11-27), Intent: the call Chrome runs with its sandbox on, so Meet admits the bot, Open questions, Problem, Proposed outcome

### Community 214 - "fill_window"
Cohesion: 0.43
Nodes (8): deflate_fast(), deflate_huff(), deflate_rle(), deflate_slow(), deflate_stored(), fill_window(), flush_block_only(), longest_match()

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

### Community 228 - "deflate"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: the bot hears in audio mode, and joins Meet on the first try, Open questions, Problem, Proposed outcome

### Community 237 - "cap"
Cohesion: 0.67
Nodes (3): cap(), collect(), walk()

### Community 238 - "join"
Cohesion: 0.08
Nodes (26): releaseAttempt(), join(), Candidate causes, and what the code says, How a caption becomes a question today, Problem, Decisions (approved intent and spec), Deviations, Plan: see why Meet refuses the call bot, and recover from it (+18 more)

### Community 240 - "actions.js"
Cohesion: 0.22
Nodes (8): nonce(), Deviations, @rfactory/core, { deriveEffects, describe }, FINAL, { randomUUID }, { validate, hashPayload, canonical }, composeWrites()

### Community 241 - "client.js"
Cohesion: 0.17
Nodes (10): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, connect(), handshake(), main() (+2 more)

### Community 242 - "Spec: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Design, Risks, Spec: the call Chrome runs with its sandbox on, so Meet admits the bot, Verification

### Community 243 - "ref_node_os"
Cohesion: 0.14
Nodes (9): fs, os, path, assert, { createStt }, fs, os, path (+1 more)

### Community 245 - "ref_node_crypto"
Cohesion: 0.22
Nodes (8): RFC-6455, attachLiveView(), { bridgeViewOnly }, crypto, wsFrame(), wsReader(), { hashPayload }, { randomUUID }

### Community 246 - "desktop-routes.test.js"
Cohesion: 0.18
Nodes (9): assert, { createApp }, { createDesktop }, grant, { loadRoles }, { makeRedactor }, open, roles (+1 more)

### Community 247 - "shares.test.js"
Cohesion: 0.20
Nodes (9): approve(), assert, { createShareManager }, { loadRoles }, { makeRedactor }, setup(), test, tick() (+1 more)

### Community 248 - "Design"
Cohesion: 0.20
Nodes (9): 1. CFactory: projects on the server (CFactory PR A, then PR B), 2. RFactory: the allowlist and its secrets (`core/src/scope.js`), 5. RFactory: each proposal keeps its target (`web/actions.js`, `web/shares.js`, `web/investigations.js`), 6. Rollout order, Alternatives rejected, Design, Risks, Spec: project-aware calls (+1 more)

### Community 249 - "createClaudeBrain"
Cohesion: 0.53
Nodes (9): createClaudeBrain(), answerTurn(), checkDestination(), lookupTurn(), propose(), run(), stop(), summarize() (+1 more)

### Community 250 - "k8s.test.js"
Cohesion: 0.22
Nodes (8): assert, { createK8s }, fs, http, { inClusterConfig }, os, path, test

### Community 251 - "pod.test.js"
Cohesion: 0.22
Nodes (7): assert, fs, os, path, realPod, { spawnSync }, test

### Community 252 - "Plan: Phase 1b, a voice standup in Google Meet"
Cohesion: 0.25
Nodes (6): toSpeech(), Deviations from the spec (approved with this plan), Plan: Phase 1b, a voice standup in Google Meet, Rollback, Steps, Tests

### Community 253 - "Intent: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text), Open questions, Problem, Proposed outcome

### Community 254 - "stun.test.js"
Cohesion: 0.29
Nodes (4): assert, dgram, { stunProbe }, test

### Community 255 - "Intent: see why Meet refuses the call bot, and recover from it"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: see why Meet refuses the call bot, and recover from it, Open questions, Problem, Proposed outcome

### Community 256 - "Plan: finish the "Factory" rename and stop false wakes at a caption block start"
Cohesion: 0.29
Nodes (6): Decisions (the approved intent and spec), Deviations, Plan: finish the "Factory" rename and stop false wakes at a caption block start, Rollback, Steps, Tests

### Community 258 - "events.js"
Cohesion: 0.48
Nodes (5): _capturedElemChanged(), _captureObserver, _captureProxy(), releaseCapture(), setCapture()

### Community 259 - "connect"
Cohesion: 0.60
Nodes (6): connect(), call(), fetchScope(), getItem(), itemActivity(), paged()

### Community 261 - "profiles.js"
Cohesion: 0.50
Nodes (3): fs, LABEL, { randomUUID, hkdfSync }

### Community 262 - "Plan: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.50
Nodes (3): Plan: the bot hears the call itself (its own speech-to-text), Rollback, Tests

## Knowledge Gaps
- **41 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+36 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1816 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Websock` connect `Websock` to `.rQwait`, `rfb.js`, `._fail`, `logging.js`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `createLifecycle()` (e.g. with `lifecycle.js` and `action()`) actually correct?**
  _`createLifecycle()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _41 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `Steps` to `test cfactory.test.js`, `makeRedactor`, `ref_node_child_process`, `gateway.js`, `Profiles`, `Websock`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Should `rfb.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06829268292682927 - nodes in this community are weakly interconnected._
- **Why does `RFB` connect `RFB` to `.rQwait`, `rfb.js`, `._fail`, `state`, `Keyboard`, `RSAAESAuthenticationState`, `Websock`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._