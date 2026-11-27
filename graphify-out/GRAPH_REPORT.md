# Graph Report - RFactory-t2  (2026-11-27)

## Corpus Check
- 331 files · ~508,303 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 10, .nix 6, .css 4)

## Summary
- 3771 nodes · 6768 edges · 259 communities (220 shown, 39 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 944 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0b338a9d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verify lib.sh
- Design
- rfb.js
- test/call.test.js
- app.js
- createCallManager
- claude-cli.test.js
- createLifecycle
- gateway.test.js
- app.test.js
- loadScope
- test desktop-ui.test.js
- guard.test.js
- RFB
- runner runner.test.js
- k8s-policy.js
- join
- github.test.js
- runner runner.js
- logging.js
- test server.test.js
- rfactory-standup.js
- test avatar-state.test.js
- Profiles
- Websock
- Steps
- el
- checkFacts
- Spec: see why Meet refuses the call bot, and recover from it
- web server.js
- lookups.test.js
- viewer/board.test.js
- createClaudeBrain
- k8s.test.js
- tts.test.js
- client.test.js
- profiles.test.js
- createHearing
- stt-bridge.test.js
- deflate.js
- cfactory-write.test.js
- kyverno-scope.test.js
- verify verify.test.js
- state
- heard
- toModel
- inflate.js
- verify net.sh
- verify profiles.sh
- lookup-endpoint.test.js
- listProjects
- spike hello-call.test.js
- share.test.js
- vm-call.test.js
- test/call.test.js
- index.js
- createProxy
- runner protocol.js
- guard.js
- Plan: run RFactory in the factory cluster
- proxy.js
- lifecycle.js
- share-desktop.test.js
- .text
- Design
- reaper reaper.test.js
- Design
- Steps
- ref_node_assert
- test cfactory.test.js
- agent/call.test.js
- proxy.test.js
- scope.js
- bot bot/package.json
- Design
- trees.js
- runner k8s-lifecycle.test.js
- web live-view.test.js
- Design
- Display
- origin
- Design
- spike spike/package.json
- ref_node_crypto
- test run.test.js
- createShareManager
- web/call.js
- core/package.json
- checkFacts
- bot run()
- Design
- scope.js
- test/board.test.js
- desktop desktop/package.json
- investigations.test.js
- ref_node_fs
- Spec: an approved, read-only Claude investigation from the call
- lookup-endpoint.js
- shell-browser.test.js
- Intent: in-call agents, the model with live tools, provider chosen per call
- Websock
- k3d k14-env.sh
- verify handover.sh
- Intent: project-aware calls
- protocol.test.js
- Deviations
- verify lifecycle.sh
- Design
- How the bot hears
- Design
- k3d gate.sh
- items.test.js
- createRecord
- des.js
- shell-browser.test.js
- ref_node_http
- ref_node_child_process
- boundary.test.js
- createActionManager
- Intent: call the bot "Factory"
- RSAAESAuthenticationState
- items.test.js
- tts.test.js
- verify e2e.sh
- H264Decoder
- k3d k11.sh
- k3d mk-tls.sh
- Spec: Agent workspace, a disposable desktop per call
- verify liveview.sh
- Keyboard
- @modelcontextprotocol/sdk
- idle
- GestureHandler
- Plan: A face for the bot that talks when it speaks
- Standalone mode S1: end-to-end results (#2 step 10)
- browser.js
- inflator.js
- loadRoles
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
- profile.test.js
- Plan: Show the CFactory board in the call
- Design
- web/package.json
- md5.js
- TightDecoder
- createStt
- Design
- Desktop VMs on the k3d factory cluster
- desktop-routes.test.js
- anchors
- gateway.js
- Intent: redact credentials that wrap across log lines
- Socket
- teams-tap-spike.js
- Design
- Intent: the first question after the bot joins is heard in Meet captions mode
- Plan: Phase 0, the Linux call test
- Intent: run a Claude terminal from the call, and show it
- H264Context
- effects.js
- Intent: run RFactory in the factory cluster like the other Factory services
- desktop.test.js
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
- H264Parser
- Plan: A face for the bot that talks when it speaks
- ZRLEDecoder
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
- eyes
- Plan: enforce an egress limit for the RFactory pod
- review.test.js
- How the bot hears
- LegacyCrypto
- theme.js
- RSACipher
- CLAUDE.md
- .claude/CLAUDE.md
- Intent: finish the "Factory" rename and stop false wakes at a caption block start
- check-image-stt.sh
- SHELL_INVENTORY.md
- repo
- bootstrap-secrets.sh
- createHearing
- assert-signature-location.sh
- Plan: finish the "Factory" rename and stop false wakes at a caption block start
- mesh
- move
- Intent: the call Chrome runs with its sandbox on, so Meet admits the bot
- fill_window
- maxDrop
- .sendKey
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
- Intent: the bot hears in audio mode, and joins Meet on the first try
- Buf16
- Buf32
- Buf8
- deflateInfo
- inflateInfo
- anchors
- join
- check-egress.sh
- github-web.test.js
- ._handleMouse
- Spec: the call Chrome runs with its sandbox on, so Meet admits the bot
- Waves
- loadScope
- facts.js
- createApp
- items.js
- desktop-routes.test.js
- avatars.test.js
- ollama-standup.js
- createClaudeBrain
- scope.test.js
- stt.test.js
- gateway.js
- Plan: Agent workspace, a disposable desktop per call (#3)
- share.js
- Spec: A face for the bot that talks when it speaks

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `createLifecycle()` - 45 edges
3. `makeRedactor()` - 43 edges
4. `createInvestigationManager()` - 37 edges
5. `checkFacts()` - 33 edges
6. `createCallManager()` - 33 edges
7. `Display` - 32 edges
8. `Websock` - 32 edges
9. `run()` - 29 edges
10. `loadScope()` - 27 edges

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

## Communities (259 total, 39 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Design, Hearing: wake phrase and end of a question, Packaging, Risks, Spec: Phase 1b, a voice standup in Google Meet, Speech (TTS), The bot process (`bot/run.js`) (+4 more)

### Community 2 - "rfb.js"
Cohesion: 0.06
Nodes (18): CopyRectDecoder, JPEGDecoder, RawDecoder, RREDecoder, ZlibDecoder, Deflator, encodings, _buildExtendedClipboardFlags() (+10 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.08
Nodes (19): assert, { createCallManager }, { createInvestigationManager }, { EventEmitter }, fakeClock(), finishSpeech(), flush(), fs (+11 more)

### Community 4 - "app.js"
Cohesion: 0.06
Nodes (69): Steps, ago(), clear(), clock(), day(), decide(), decideInvestigation(), decideShare() (+61 more)

### Community 5 - "createCallManager"
Cohesion: 0.23
Nodes (22): Steps, createCallManager(), addressed(), answer(), armQuiet(), audio(), captionSeen(), drain() (+14 more)

### Community 6 - "claude-cli.test.js"
Cohesion: 0.11
Nodes (17): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, LOOKUP_ERRORS, LOOKUP_SYSTEM_PROMPT (+9 more)

### Community 7 - "createLifecycle"
Cohesion: 0.11
Nodes (35): createLifecycle(), accept(), allowAccept(), attachAgent(), boot(), callAttach(), cancel(), cancelNow() (+27 more)

### Community 8 - "gateway.test.js"
Cohesion: 0.11
Nodes (20): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+12 more)

### Community 9 - "app.test.js"
Cohesion: 0.09
Nodes (15): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+7 more)

### Community 10 - "loadScope"
Cohesion: 0.11
Nodes (17): Captions vs own transcription, Environment and scope reference, How the bot hears, Language, `listen` values and the per-platform `auto` rule, Per-call worker environment variables (set internally), Privacy, Rollback (+9 more)

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "guard.test.js"
Cohesion: 0.06
Nodes (50): binding(), cidrFamily(), command(), createApi(), get(), createGuard(), apply(), counters() (+42 more)

### Community 13 - "RFB"
Cohesion: 0.06
Nodes (4): clientEncodings(), keyEvent(), RFB, setDesktopSize()

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 15 - "k8s-policy.js"
Cohesion: 0.05
Nodes (46): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+38 more)

### Community 16 - "join"
Cohesion: 0.17
Nodes (24): build(), canon(), compare(), { createCfactorySource }, { createHash }, facts(), fail(), FIXED (+16 more)

### Community 17 - "github.test.js"
Cohesion: 0.09
Nodes (23): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFile } (+15 more)

### Community 18 - "runner runner.js"
Cohesion: 0.09
Nodes (27): clearInterval(), createK8s(), { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade() (+19 more)

### Community 19 - "logging.js"
Cohesion: 0.08
Nodes (6): HextileDecoder, toSigned32bit(), toUnsigned32bit(), DataChannel, rawChannelProps, ReadyStates

### Community 20 - "test server.test.js"
Cohesion: 0.07
Nodes (24): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, GH_KEYS, ghItems, { handleCall } (+16 more)

### Community 21 - "rfactory-standup.js"
Cohesion: 0.11
Nodes (19): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+11 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.11
Nodes (13): installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState(), meshAt() (+5 more)

### Community 23 - "Profiles"
Cohesion: 0.17
Nodes (5): fs, LABEL, name(), Profiles, { randomUUID, hkdfSync }

### Community 25 - "Steps"
Cohesion: 0.11
Nodes (24): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+16 more)

### Community 26 - "el"
Cohesion: 0.15
Nodes (13): idle(), setCameraRenderer(), ctx(), Deviations after merge, Deviations (Codex review of the approved plan, 2026-11-17), Plan: A face for the bot that talks when it speaks, Rollback, Steps (+5 more)

### Community 27 - "checkFacts"
Cohesion: 0.14
Nodes (20): ageOf(), approveClaude(), causes(), { checkFacts }, { connect }, { createBrain }, { createCfactorySource }, { createClaudeBrain, ARGV: CLAUDE_ARGV } (+12 more)

### Community 28 - "Spec: see why Meet refuses the call bot, and recover from it"
Cohesion: 0.50
Nodes (3): Alternatives rejected, Spec: see why Meet refuses the call bot, and recover from it, Verification

### Community 29 - "web server.js"
Cohesion: 0.14
Nodes (19): @rfactory/core, { buildStandup, speakStandupHeadline }, composeLookups(), composeStandalone(), composeWrites(), DESKTOP_STATIC, EMPTY_LISTS, fs (+11 more)

### Community 30 - "lookups.test.js"
Cohesion: 0.09
Nodes (24): createLookups(), FACTORY, GITHUB, { mapCard }, specs, { STATES }, validate(), { validPath, validNumber } (+16 more)

### Community 31 - "viewer/board.test.js"
Cohesion: 0.18
Nodes (11): assert, board(), browser, column(), open(), { test }, { viewerRoute, URL_BOARD }, fs (+3 more)

### Community 32 - "createClaudeBrain"
Cohesion: 0.13
Nodes (16): claudeHash(), assert, { claudeHash, checkClaudeHome }, { createClaudeBrain }, { EventEmitter }, fs, lookup, lookupBrain() (+8 more)

### Community 33 - "k8s.test.js"
Cohesion: 0.18
Nodes (6): assert, { buildRendererSource }, { chromium }, fs, path, test

### Community 34 - "tts.test.js"
Cohesion: 0.17
Nodes (11): Deviations, after(), assert, { createTts }, { EventEmitter }, fs, os, { PassThrough } (+3 more)

### Community 35 - "client.test.js"
Cohesion: 0.10
Nodes (16): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+8 more)

### Community 36 - "profiles.test.js"
Cohesion: 0.15
Nodes (12): admin, assert, fakeK8s(), fixture(), fs, { hkdfSync }, MASTER, os (+4 more)

### Community 37 - "createHearing"
Cohesion: 0.09
Nodes (28): afterJoin(), captions(), heard(), When the bot starts to hear (Meet captions), Decisions (carried from the approved intent and spec), Deviations found during implementation, Deviations from the spec (made while planning, for approval with this plan), Approval (2026-11-27) (+20 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.08
Nodes (10): installSttBridge(), assert, fs, { installSttBridge }, path, RTCRtpReceiver, RTCRtpSender, setup() (+2 more)

### Community 39 - "deflate.js"
Cohesion: 0.08
Nodes (33): deflate(), deflateEnd(), deflateInit(), deflateInit2(), deflateReset(), deflateResetKeep(), deflateSetDictionary(), DeflateState() (+25 more)

### Community 40 - "cfactory-write.test.js"
Cohesion: 0.10
Nodes (19): createCfactoryWriter(), getClient(), invoke(), assert, bareBlocked, bareStarted, before, card (+11 more)

### Community 41 - "kyverno-scope.test.js"
Cohesion: 0.14
Nodes (16): assert, dir, { firstHost }, fs, path, policies, probeCidrs(), test (+8 more)

### Community 42 - "verify verify.test.js"
Cohesion: 0.12
Nodes (15): assert, beats(), CHECKS, fs, http, INPUT, { join }, LIB (+7 more)

### Community 43 - "state"
Cohesion: 0.14
Nodes (16): compareAfter(), checked(), gone(), 2. `core/bin/e2e-inventory.js`: the pure part (codex), 3. `core/bin/e2e-inventory.js`: readers and the command line (coder), 4. Full tests, review, commit (lead), 5. One live read-only run, and the list on issue #60 (lead), Decisions (2026-11-27) (+8 more)

### Community 44 - "heard"
Cohesion: 0.17
Nodes (11): 1. The service: `rfactory-stt`, 2. In the bot (`bot/run.js`, both deployments): cut speech, send segments, 3. In the call manager (`web/call.js`): transcribe and hear, 4. The listen setting, 5. Packaging and deploy, Design, Measured on p620 (2026-11-21), Owner decisions taken with this spec (2026-11-21) (+3 more)

### Community 45 - "toModel"
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

### Community 50 - "listProjects"
Cohesion: 0.22
Nodes (9): base(), Decisions (approved intent and spec, as delivered in slice A), Delivery in two slices (a plan decision; the approved spec is unchanged), Deviations, Plan: project-aware calls, slice A (project-aware reads), Rollback (in reverse order), Tests, Alternatives rejected (+1 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.12
Nodes (12): Steps, botName(), path, run(), assert, { EventEmitter }, fs, JoinError (+4 more)

### Community 52 - "share.test.js"
Cohesion: 0.18
Nodes (8): assert, browser, { createShare, titleFor, callLaunchArgs, installCaptureGuard }, http, pick(), { test }, { URL_BOARD }, titleFor()

### Community 53 - "vm-call.test.js"
Cohesion: 0.17
Nodes (10): assert, { createVmSpawn }, { Duplex }, { test }, createVmSpawn(), { EventEmitter }, firstLine(), { PassThrough } (+2 more)

### Community 54 - "test/call.test.js"
Cohesion: 0.12
Nodes (44): count(), COUNT_CLAIM, createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog(), endCall() (+36 more)

### Community 55 - "index.js"
Cohesion: 0.09
Nodes (25): octets(), parseCmdline(), startHeartbeat(), { createCallWorker }, { createControl }, { createProfile }, { dial }, { encode, createDecoder } (+17 more)

### Community 56 - "createProxy"
Cohesion: 0.23
Nodes (18): checkedAddresses(), createApi(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect() (+10 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.16
Nodes (23): label(), stopShare(), board(), boolean(), columns, count(), exact(), hosts() (+15 more)

### Community 58 - "guard.js"
Cohesion: 0.13
Nodes (11): { deriveEffects, describe }, FINAL, { randomUUID }, { validate, hashPayload, canonical }, approve(), assert, { createActionManager }, { loadRoles } (+3 more)

### Community 59 - "Plan: run RFactory in the factory cluster"
Cohesion: 0.47
Nodes (9): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+1 more)

### Community 60 - "proxy.js"
Cohesion: 0.16
Nodes (15): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, inRange() (+7 more)

### Community 61 - "lifecycle.js"
Cohesion: 0.22
Nodes (6): { buildPolicy }, { createDecoder, tag, encode, LANGUAGE }, crypto, net, { nonce: newNonce }, { StringDecoder }

### Community 62 - "share-desktop.test.js"
Cohesion: 0.24
Nodes (7): createShareDesktop(), schedule(), stopPolling(), assert, { createShareDesktop }, setup(), test

### Community 64 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Answers to the intent's open questions, Design, Driving apps, Feasibility gate (first plan step), Lifecycle and disposal, Live view, Network (+4 more)

### Community 65 - "reaper reaper.test.js"
Cohesion: 0.17
Nodes (13): createReaper(), leaseStale(), tick(), fs, main(), assert, { createReaper }, fake() (+5 more)

### Community 66 - "Design"
Cohesion: 0.20
Nodes (9): 1. The name, everywhere a person sees or hears it, 2. The wake rule (`core/src/call/hearing.js`), 3. Tests, Alternatives rejected, Amendment (owner, 2026-11-26): share requests in natural words (#63), Design, Risks, Spec: call the bot "Factory" (+1 more)

### Community 67 - "Steps"
Cohesion: 0.09
Nodes (27): tools(), listTools(), number(), raw(), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains), Recorded GitHub inventory (pinned 1.14.0, captured 2026-11-17) (+19 more)

### Community 68 - "ref_node_assert"
Cohesion: 0.09
Nodes (19): toSpeech(), assert, fs, path, root, test, assert, { loadRoles } (+11 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.11
Nodes (10): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, invReplies(), invWith(), { makeRedactor }, reply() (+2 more)

### Community 70 - "agent/call.test.js"
Cohesion: 0.14
Nodes (13): createCallWorker(), { createShare, callLaunchArgs }, fs, { PassThrough }, assert, { createCallWorker, withProxy, MEET_GUEST, TEAMS_CAPTIONS }, { EventEmitter }, fixture() (+5 more)

### Community 71 - "proxy.test.js"
Cohesion: 0.13
Nodes (11): assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard, os (+3 more)

### Community 72 - "scope.js"
Cohesion: 0.13
Nodes (13): source, commit, path, repo, DESTINATIONS, fs, LISTEN, { makeRedactor } (+5 more)

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

### Community 78 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, CFactory source (`core/src/sources/cfactory.js`), Data, Decisions on the intent's open questions (recommended), Design, Risks, Sign-in, Spec: Phase 1a, a text standup in the web UI (+4 more)

### Community 80 - "origin"
Cohesion: 0.13
Nodes (13): buildRendererSource(), { buildRendererSource }, { CALL_EVENTS }, crypto, fs, { installSttBridge }, { makeRedactor }, os (+5 more)

### Community 81 - "Design"
Cohesion: 0.06
Nodes (32): gateway(), Affected users and systems, Constraints, Decisions (2026-11-27), Intent: Enforce an egress limit for the RFactory pod, Open questions, Problem, Proposed outcome (+24 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "ref_node_crypto"
Cohesion: 0.12
Nodes (14): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+6 more)

### Community 84 - "test run.test.js"
Cohesion: 0.11
Nodes (11): assert, { EventEmitter }, fs, joined(), { PassThrough }, path, { run }, setup() (+3 more)

### Community 85 - "createShareManager"
Cohesion: 0.06
Nodes (52): Alternatives rejected, Control-channel additions (an additive change to #3), Design, Order and dependencies, Proposing, approving, stopping, Risks, Spec: Show the CFactory board in the call, Switches and record (+44 more)

### Community 86 - "web/call.js"
Cohesion: 0.08
Nodes (25): SELF_NAMES, Web server environment variables, BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts, checkFactsDetailed }, emitLimits(), lookupAnswer(), { createHearing, SELF_NAMES } (+17 more)

### Community 87 - "core/package.json"
Cohesion: 0.15
Nodes (12): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+4 more)

### Community 88 - "checkFacts"
Cohesion: 0.13
Nodes (18): checkFacts(), Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 1b, a voice standup in Google Meet, Rollback, Steps, Tests, 1. A turn context, not a model-chosen scope (+10 more)

### Community 89 - "bot run()"
Cohesion: 0.19
Nodes (22): pageLeft(), run(), abandon(), discardOpen(), failureReport(), guestHelper(), idleAvatar(), leftConfirmed() (+14 more)

### Community 90 - "Design"
Cohesion: 0.17
Nodes (12): speechLevel(), Decisions carried over (approved intent and spec), AI disclosure, Cost, Design, Licence (owner decision 2: the whole repository is AGPL-3.0), Packaging, Portraits and notices (+4 more)

### Community 91 - "scope.js"
Cohesion: 0.12
Nodes (11): assert, base, { createGateway }, fetchScope(), fs, { loadScope }, { makeRedactor }, os (+3 more)

### Community 92 - "test/board.test.js"
Cohesion: 0.09
Nodes (25): COLUMNS, projectBoard(), { repositoryOf }, STAGES, boundedFetch(), { Client }, inScope(), repositoryOf() (+17 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "investigations.test.js"
Cohesion: 0.13
Nodes (19): Claude Code CLI brain (`core/src/brains/claude-cli.js`), approve(), assert, { createInvestigationManager }, { createRecord }, fs, { loadRoles }, { makeRedactor } (+11 more)

### Community 95 - "ref_node_fs"
Cohesion: 0.08
Nodes (22): fs, os, path, fs, assert, { createK8s }, fs, http (+14 more)

### Community 96 - "Spec: an approved, read-only Claude investigation from the call"
Cohesion: 0.14
Nodes (14): code(), codes(), render(), 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), 3. RFactory: hearing, approval, the shared log, the spoken result, Alternatives rejected, Design (+6 more)

### Community 97 - "lookup-endpoint.js"
Cohesion: 0.22
Nodes (6): createLookupEndpoint(), http, { ListToolsRequestSchema, CallToolRequestSchema }, { randomBytes, timingSafeEqual }, { Server }, { StreamableHTTPServerTransport }

### Community 98 - "shell-browser.test.js"
Cohesion: 0.14
Nodes (11): connect(), handshake(), main(), [mode, url], out(), assert, { chromium }, { createApp } (+3 more)

### Community 99 - "Intent: in-call agents, the model with live tools, provider chosen per call"
Cohesion: 0.17
Nodes (11): Affected users and systems, Amendments (owner, 2026-11-26), Constraints, Decisions (owner, 2026-11-26: "approve with your recommendations"), Intent: in-call agents, the model with live tools, provider chosen per call, Open questions, Problem, Proposed outcome (+3 more)

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

### Community 105 - "Deviations"
Cohesion: 0.14
Nodes (13): 1. The inventory script (read-only), 2. The two gates, 3. The removal procedure (the owner runs it), Alternatives rejected, Approval (2026-11-27), Decisions carried from the approved intent, Design, First slice and what is deferred (+5 more)

### Community 106 - "verify lifecycle.sh"
Cohesion: 0.42
Nodes (7): case_hold(), egress_cut(), fresh(), hold(), settled(), lifecycle.sh script, watch_end()

### Community 107 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Bounded run time, Decisions on the intent's open questions (proposed), Design, PEM flag across polls (`web/shares.js:49-51`), PEM marker scanner, Risks, Spec: redact credentials that wrap across log lines (+2 more)

### Community 108 - "How the bot hears"
Cohesion: 0.12
Nodes (19): bridgeViewOnly(), createFilter(), assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session (+11 more)

### Community 109 - "Design"
Cohesion: 0.12
Nodes (15): Alternatives rejected, Design, Effects are derived, not trusted, Execution: re-check, claim, record, dispatch once, Keys and switches, Pending actions and approval, Reading CFactory's results, Recognising an action request (+7 more)

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "items.test.js"
Cohesion: 0.22
Nodes (5): assert, { mapGithub, summarise }, mapping, run(), test

### Community 112 - "createRecord"
Cohesion: 0.36
Nodes (9): Waves, Steps, createRecord(), files(), lastEntries(), prune(), unfinished(), unfinishedInvestigations() (+1 more)

### Community 113 - "des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 115 - "ref_node_http"
Cohesion: 0.29
Nodes (3): http, [portA, portB], state

### Community 116 - "ref_node_child_process"
Cohesion: 0.13
Nodes (13): assert, fs, os, path, realPod, { spawnSync }, test, createTts() (+5 more)

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

### Community 121 - "items.test.js"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: see why Meet refuses the call bot, and recover from it, Open questions, Problem, Proposed outcome

### Community 122 - "tts.test.js"
Cohesion: 0.39
Nodes (8): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), origin()

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

### Community 127 - "Spec: Agent workspace, a disposable desktop per call"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: the first question after the bot joins is heard in Meet captions mode, Open questions, Proposed outcome

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 129 - "Keyboard"
Cohesion: 0.22
Nodes (8): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Spec: Standalone mode, with a choice of source and brain

### Community 130 - "@modelcontextprotocol/sdk"
Cohesion: 0.33
Nodes (4): { ListToolsRequestSchema, CallToolRequestSchema }, { Server }, { StdioServerTransport }, @modelcontextprotocol/sdk

### Community 131 - "idle"
Cohesion: 0.67
Nodes (3): crc32(), makeTable(), read_buf()

### Community 133 - "Plan: A face for the bot that talks when it speaks"
Cohesion: 0.36
Nodes (10): createCfactorySource(), call(), connect(), view(), comments(), freshness(), scopedCards(), withClient() (+2 more)

### Community 134 - "Standalone mode S1: end-to-end results (#2 step 10)"
Cohesion: 0.20
Nodes (8): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass**

### Community 135 - "browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

### Community 137 - "loadRoles"
Cohesion: 0.18
Nodes (11): loadRoles(), has(), rolesOf(), commit(), Decisions carried over from the approved spec, Decisions for this plan, Deviations, Plan: v1 roles in code (admin, approver, member), slice "roles" of #2 (+3 more)

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

### Community 155 - "profile.test.js"
Cohesion: 0.24
Nodes (7): createProfile(), readHead(), assert, { createProfile }, KEY, setup(), { test }

### Community 156 - "Plan: Show the CFactory board in the call"
Cohesion: 0.27
Nodes (9): calls(), FAKE_ARGS, FAKE_CALLS, FAKE_OUT, FAKE_PROGRAM, fixture(), PATH, run() (+1 more)

### Community 157 - "Design"
Cohesion: 0.15
Nodes (12): 10. Intent constraints carried into slice 1, 1. Data comes from four CFactory read tools, all on the existing read key, 3. Failure and freshness, 5. The spoken headline is built by the server: `speakStandupHeadline(standup)`, 6. Review (`core/src/review.js`, new, pure), 8. `core/src/sources/cfactory.js`, 9. CFactory issues to file when this spec is approved (slice 2 dependencies), Alternatives rejected (+4 more)

### Community 158 - "web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 159 - "md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 161 - "createStt"
Cohesion: 0.40
Nodes (4): Gates, Plan: an approved, read-only Claude investigation from the call (RFactory side), Rollback, Tests

### Community 162 - "Design"
Cohesion: 0.18
Nodes (10): Source adapters, assert, fs, git(), guard, os, path, repo() (+2 more)

### Community 163 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.15
Nodes (12): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 8. Problems we hit (+4 more)

### Community 164 - "desktop-routes.test.js"
Cohesion: 0.18
Nodes (18): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+10 more)

### Community 165 - "anchors"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 166 - "gateway.js"
Cohesion: 0.29
Nodes (6): assert, build(), { buildStandup, speakStandupHeadline }, freshness(), { makeRedactor }, test

### Community 167 - "Intent: redact credentials that wrap across log lines"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text), Open questions, Problem, Proposed outcome

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 170 - "Design"
Cohesion: 0.11
Nodes (17): Decisions (the approved intent and spec), Deviations, Plan: finish the "Factory" rename and stop false wakes at a caption block start, Rollback, Steps, Tests, 1. The wake rule (`core/src/call/hearing.js:3`), 2. A rejected mention still ends the request before it (`hearing.js:50-71`) (+9 more)

### Community 171 - "Intent: the first question after the bot joins is heard in Meet captions mode"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: clean up the `e2e-*` test repositories (GitHub and CFactory), Open questions, Problem, Proposed outcome

### Community 172 - "Plan: Phase 0, the Linux call test"
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "H264Context"
Cohesion: 0.33
Nodes (5): Approved decisions (copied from the spec, so this plan stands alone), Plan: Review and standup from the board (#28, slice 1), Roles, Rollback, Tests

### Community 175 - "effects.js"
Cohesion: 0.15
Nodes (14): deriveEffects(), describe(), SERVICE, STAGE, stageFor(), stateOf(), WRITES, { Client } (+6 more)

### Community 176 - "Intent: run RFactory in the factory cluster like the other Factory services"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decided, Intent: run RFactory in the factory cluster like the other Factory services, Open questions, Problem, Proposed outcome

### Community 177 - "desktop.test.js"
Cohesion: 0.18
Nodes (12): createGateway(), call(), numberFrom(), snapshot(), assert, { createGateway }, { createSessions }, { makeRedactor } (+4 more)

### Community 178 - "Spec: Phase 0, the Linux call test"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Context for later phases (not decided here), Decisions on the intent's Phase 0 questions, Design, Goal, Pass / fail, Pieces, Risks (+2 more)

### Community 179 - "Intent: A face for the bot that talks when it speaks"
Cohesion: 0.22
Nodes (8): Affected users and systems, Constraints, Decisions (owner, 2026-11-17), Intent: A face for the bot that talks when it speaks, Open questions, Problem, Proposed outcome (first slice), Source of the portraits

### Community 180 - "H264Parser"
Cohesion: 0.12
Nodes (21): assert, { build, hashOf, compare, compareAfter, main }, clone(), endpointsOf(), { EventEmitter }, fixture(), fs, ghFake() (+13 more)

### Community 181 - "Plan: A face for the bot that talks when it speaks"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: redact credentials that wrap across log lines, Open questions, Problem, Proposed outcome

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
Cohesion: 0.11
Nodes (28): ACTIONS, bounded(), canonical(), CREATE_STATUSES, { createHash }, criteria(), FIELDS, hashPayload() (+20 more)

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

### Community 194 - "eyes"
Cohesion: 0.25
Nodes (8): anchors, file, sha256, file, sha256, portraits, f01, f09

### Community 195 - "Plan: enforce an egress limit for the RFactory pod"
Cohesion: 0.18
Nodes (10): ok(), hello(), Waking the bot, Approval (2026-11-27), Decisions (the approved intent and spec), Deviations, Plan: enforce an egress limit for the RFactory pod, Rollback (+2 more)

### Community 196 - "review.test.js"
Cohesion: 0.48
Nodes (5): _capturedElemChanged(), _captureObserver, _captureProxy(), releaseCapture(), setCapture()

### Community 197 - "How the bot hears"
Cohesion: 0.22
Nodes (8): Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Tests, Landing record (2026-11-24), Live check results (step 12), running()

### Community 199 - "theme.js"
Cohesion: 0.67
Nodes (3): applyTheme(), dark, observer

### Community 203 - "Intent: finish the "Factory" rename and stop false wakes at a caption block start"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: finish the "Factory" rename and stop false wakes at a caption block start, Open questions, Problem, Proposed outcome

### Community 206 - "repo"
Cohesion: 0.29
Nodes (6): Accepted risk, Decisions carried over (approved intent and spec), Deviations, Plan: the call Chrome runs with its sandbox on, so Meet admits the bot, Rollback, Tests

### Community 207 - "bootstrap-secrets.sh"
Cohesion: 0.83
Nodes (3): env_of(), bootstrap-secrets.sh script, write_secret()

### Community 208 - "createHearing"
Cohesion: 0.18
Nodes (12): createHearing(), assert, { createHearing }, fakeClock(), setup(), test, Decisions (the approved intent and spec, including the spec's amendment), Deviations (+4 more)

### Community 210 - "Plan: finish the "Factory" rename and stop false wakes at a caption block start"
Cohesion: 0.33
Nodes (5): Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Tests

### Community 211 - "mesh"
Cohesion: 0.33
Nodes (6): mesh, anchors, file, sha256, triangles, f17

### Community 212 - "move"
Cohesion: 0.33
Nodes (6): move, C, JL, JR, LB, LM

### Community 213 - "Intent: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (approved 2026-11-27), Intent: the call Chrome runs with its sandbox on, so Meet admits the bot, Open questions, Problem, Proposed outcome

### Community 214 - "fill_window"
Cohesion: 0.43
Nodes (8): deflate_fast(), deflate_huff(), deflate_rle(), deflate_slow(), deflate_stored(), fill_window(), flush_block_only(), longest_match()

### Community 215 - "maxDrop"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f02

### Community 216 - ".sendKey"
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

### Community 228 - "Intent: the bot hears in audio mode, and joins Meet on the first try"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: the bot hears in audio mode, and joins Meet on the first try, Open questions, Problem, Proposed outcome

### Community 237 - "anchors"
Cohesion: 0.67
Nodes (3): cap(), collect(), walk()

### Community 238 - "join"
Cohesion: 0.10
Nodes (23): releaseAttempt(), join(), Candidate causes, and what the code says, How a caption becomes a question today, Problem, Decisions (approved intent and spec), Deviations, Plan: see why Meet refuses the call bot, and recover from it (+15 more)

### Community 240 - "github-web.test.js"
Cohesion: 0.14
Nodes (12): assert, { connect }, { createGithubSource }, dir, fs, os, path, raw (+4 more)

### Community 241 - "._handleMouse"
Cohesion: 0.25
Nodes (3): extendedPointerEvent(), pointerEvent(), clientToElement()

### Community 242 - "Spec: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Design, Risks, Spec: the call Chrome runs with its sandbox on, so Meet admits the bot, Verification

### Community 243 - "Waves"
Cohesion: 0.29
Nodes (6): event(), exec(), Plan: the bot hears the call itself (its own speech-to-text), Rollback, Steps, Tests

### Community 244 - "loadScope"
Cohesion: 0.16
Nodes (12): loadScope(), Decisions (2026-11-27), Decisions for this plan, Open questions, Plan: the web page gives a standup for a GitHub repo, with no Factory (slice "web-github" of #2), Rollback, Tests, Where #2 stands (+4 more)

### Community 245 - "facts.js"
Cohesion: 0.18
Nodes (11): tableOf(), checkFactsDetailed(), CLAIM, COUNT, { summarise }, WORDS, summarise(), assert (+3 more)

### Community 246 - "createApp"
Cohesion: 0.23
Nodes (13): createApp(), bind(), decide(), githubStandup(), resolveSlug(), standup(), keepAlive(), readJson() (+5 more)

### Community 247 - "items.js"
Cohesion: 0.24
Nodes (10): FAIL, failing(), labelNames(), logins(), mapGithub(), { connect: defaultConnect }, createGithubSource(), read() (+2 more)

### Community 248 - "desktop-routes.test.js"
Cohesion: 0.17
Nodes (10): assert, { createApp }, { createDesktop }, grant, { loadRoles }, { makeRedactor }, open, roles (+2 more)

### Community 249 - "avatars.test.js"
Cohesion: 0.20
Nodes (8): assert, crypto, dir, fs, ids, manifest, path, test

### Community 250 - "ollama-standup.js"
Cohesion: 0.28
Nodes (7): { checkFacts }, count(), fs, main(), path, { setup }, setup()

### Community 251 - "createClaudeBrain"
Cohesion: 0.53
Nodes (9): createClaudeBrain(), answerTurn(), checkDestination(), lookupTurn(), propose(), run(), stop(), summarize() (+1 more)

### Community 252 - "scope.test.js"
Cohesion: 0.22
Nodes (8): assert, fixture(), fs, { loadScope, resolveListen }, { makeRedactor }, os, path, test

### Community 254 - "stt.test.js"
Cohesion: 0.22
Nodes (6): assert, { createStt }, fs, os, path, test

### Community 255 - "gateway.js"
Cohesion: 0.29
Nodes (6): DESKTOP, { mapGithub, summarise, STATES }, NAMES, { origin }, SCHEMAS, STATES

### Community 256 - "Plan: Agent workspace, a disposable desktop per call (#3)"
Cohesion: 0.29
Nodes (6): Facts checked in the real repos, Open questions for the owner, Plan: Agent workspace, a disposable desktop per call (#3), Prerequisites (named revisions), Rollback, Tests

### Community 257 - "share.js"
Cohesion: 0.40
Nodes (3): nonce(), { randomBytes }, { viewerRoute, URL_BOARD, ORIGIN }

### Community 258 - "Spec: A face for the bot that talks when it speaks"
Cohesion: 0.40
Nodes (4): Alternatives rejected, Evidence this spec rests on, Risks, Spec: A face for the bot that talks when it speaks

## Knowledge Gaps
- **40 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1843 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Websock` connect `Websock` to `rfb.js`, `logging.js`, `Websock`, `._updateConnectionState`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `createLifecycle()` (e.g. with `lifecycle.js` and `action()`) actually correct?**
  _`createLifecycle()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `Steps` to `toModel`, `Profiles`, `rfactory-standup.js`, `facts.js`, `items.js`, `checkFacts`, `createApp`, `._updateConnectionState`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Should `rfb.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06290471785383904 - nodes in this community are weakly interconnected._
- **Why does `makeRedactor()` connect `toModel` to `test/call.test.js`, `app.js`, `join`, `rfactory-standup.js`, `Steps`, `checkFacts`, `lookups.test.js`, `createClaudeBrain`, `gateway.js`, `cfactory-write.test.js`, `effects.js`, `desktop.test.js`, `core/test/actions.test.js`, `Steps`, `test cfactory.test.js`, `scope.js`, `origin`, `Design`, `bot run()`, `scope.js`, `test/board.test.js`, `loadScope`, `ollama-standup.js`, `scope.test.js`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._