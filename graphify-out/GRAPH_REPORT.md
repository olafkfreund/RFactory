# Graph Report - RFactory-t52  (2026-11-27)

## Corpus Check
- 324 files · ~496,278 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 10, .nix 6, .css 4)

## Summary
- 3659 nodes · 6546 edges · 232 communities (195 shown, 37 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 900 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ac4dc76c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verify lib.sh
- Design
- rfb.js
- test/call.test.js
- public app.js
- Steps
- claude-cli.js
- createLifecycle
- logging.js
- kubevirt.test.js
- How the bot hears
- test desktop-ui.test.js
- guard.test.js
- RFB
- runner runner.test.js
- k8s-policy.js
- state
- github.test.js
- runner runner.js
- run.js
- test server.test.js
- test brain.test.js
- test avatar-state.test.js
- Profiles
- ._updateConnectionState
- standup.test.js
- Plan: A face for the bot that talks when it speaks
- rfactory-standup.js
- logging.js
- web server.js
- lookups.test.js
- viewer/board.test.js
- test claude-cli.test.js
- ref_node_path
- tts.test.js
- client.test.js
- profiles.test.js
- repo
- stt-bridge.test.js
- deflate.js
- cfactory-write.test.js
- kyverno-scope.test.js
- verify verify.test.js
- Keyboard
- speak
- makeRedactor
- inflate.js
- verify net.sh
- verify profiles.sh
- lookup-endpoint.test.js
- Plan: project-aware calls, slice A (project-aware reads)
- spike hello-call.test.js
- share.test.js
- vm-call.test.js
- createInvestigationManager
- index.js
- createProxy
- runner protocol.js
- createActionManager
- createShare
- proxy.js
- lifecycle.js
- share-desktop.test.js
- test/board.test.js
- Design
- reaper reaper.test.js
- Spec: call the bot "Factory"
- loadScope
- ref_node_assert
- test cfactory.test.js
- agent/call.test.js
- proxy.test.js
- loadScope
- bot bot/package.json
- Design
- trees.js
- runner k8s-lifecycle.test.js
- web live-view.test.js
- ref_node_child_process
- Display
- ref_node_fs
- Design
- spike spike/package.json
- profile.test.js
- test run.test.js
- createShareManager
- web/call.js
- core/package.json
- createCallManager
- bot run()
- Design
- gateway.test.js
- test/board.test.js
- desktop desktop/package.json
- running
- state
- Spec: an approved, read-only Claude investigation from the call
- lookup-endpoint.js
- avatars.test.js
- Intent: in-call agents, the model with live tools, provider chosen per call
- Plan: A face for the bot that talks when it speaks
- k3d k14-env.sh
- verify handover.sh
- Intent: project-aware calls
- protocol.test.js
- source-guard.test.js
- verify lifecycle.sh
- Design
- vnc.test.js
- Design
- k3d gate.sh
- gateway.js
- scope.js
- des.js
- shell-browser.test.js
- ref_node_http
- repo
- boundary.test.js
- deflator.js
- Intent: call the bot "Factory"
- RSAAESAuthenticationState
- Intent: see why Meet refuses the call bot, and recover from it
- Websock
- verify e2e.sh
- H264Decoder
- k3d k11.sh
- k3d mk-tls.sh
- .text
- verify liveview.sh
- standup.test.js
- @modelcontextprotocol/sdk
- .expired
- GestureHandler
- ref_node_crypto
- Keyboard
- browser.js
- deflator.js
- Plan: v1 roles in code (admin, approver, member), slice "roles" of #2
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
- stt-languages.test.js
- .sendKey
- mapCard
- web/package.json
- md5.js
- TightDecoder
- events.js
- Design
- Desktop VMs on the k3d factory cluster
- desktop-routes.test.js
- eyes
- createControl
- Plan: Show the CFactory board in the call
- Socket
- teams-tap-spike.js
- Design
- .sendKey
- Plan: Phase 0, the Linux call test
- Intent: run a Claude terminal from the call, and show it
- Plan: in-call agents, slice 1: live read-only lookups
- Intent: run RFactory in the factory cluster like the other Factory services
- desktop.test.js
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
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
- portraits
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
- mesh
- move
- Intent: the call Chrome runs with its sandbox on, so Meet admits the bot
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
- Intent: the bot hears in audio mode, and joins Meet on the first try
- Buf16
- Buf32
- Buf8
- deflateInfo
- inflateInfo
- join
- check-egress.sh
- Spec: the call Chrome runs with its sandbox on, so Meet admits the bot

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `createLifecycle()` - 45 edges
3. `makeRedactor()` - 40 edges
4. `createInvestigationManager()` - 37 edges
5. `checkFacts()` - 34 edges
6. `createCallManager()` - 33 edges
7. `Display` - 32 edges
8. `Websock` - 32 edges
9. `run()` - 29 edges
10. `Steps` - 28 edges

## Surprising Connections (you probably didn't know these)
- `Alternatives rejected` --references--> `afterJoin()`  [INFERRED]
  spec/2026-11-27-56-first-question-captions.md → bot/run.js
- `3. Tests` --references--> `createHearing()`  [INFERRED]
  spec/2026-11-26-62-bot-name-factory.md → core/src/call/hearing.js
- `Verification` --references--> `heard()`  [INFERRED]
  spec/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `2. The wake rule (`core/src/call/hearing.js`)` --references--> `heard()`  [INFERRED]
  spec/2026-11-26-62-bot-name-factory.md → core/src/call/hearing.js
- `6. The record (#10)` --references--> `checkFacts()`  [INFERRED]
  spec/2026-11-26-51-in-call-agents.md → core/src/facts.js

## Import Cycles
- None detected.

## Communities (232 total, 37 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Design, Hearing: wake phrase and end of a question, Packaging, Risks, Spec: Phase 1b, a voice standup in Google Meet, Speech (TTS), Verification (+2 more)

### Community 2 - "rfb.js"
Cohesion: 0.06
Nodes (17): CopyRectDecoder, HextileDecoder, JPEGDecoder, RawDecoder, RREDecoder, ZlibDecoder, Deflator, encodings (+9 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.08
Nodes (19): assert, { createCallManager }, { createInvestigationManager }, { EventEmitter }, fakeClock(), finishSpeech(), flush(), fs (+11 more)

### Community 4 - "public app.js"
Cohesion: 0.05
Nodes (71): ago(), clear(), clock(), day(), decide(), decided(), decideInvestigation(), decideShare() (+63 more)

### Community 5 - "Steps"
Cohesion: 0.09
Nodes (25): number(), Steps, 1. A turn context, not a model-chosen scope, 2. The lookup tools (`core/src/lookups.js`, new), 3. The Claude brain gets the tools (`core/src/brains/claude-cli.js`), 5. The call (`web/call.js`), 6. The record (#10), Alternatives rejected (+17 more)

### Community 6 - "claude-cli.js"
Cohesion: 0.13
Nodes (14): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, LOOKUP_ERRORS, LOOKUP_SYSTEM_PROMPT (+6 more)

### Community 7 - "createLifecycle"
Cohesion: 0.11
Nodes (35): createLifecycle(), accept(), allowAccept(), attachAgent(), boot(), callAttach(), cancel(), cancelNow() (+27 more)

### Community 8 - "logging.js"
Cohesion: 0.09
Nodes (26): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+18 more)

### Community 9 - "kubevirt.test.js"
Cohesion: 0.09
Nodes (15): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+7 more)

### Community 10 - "How the bot hears"
Cohesion: 0.12
Nodes (15): hello(), Captions vs own transcription, How the bot hears, Language, `listen` values and the per-platform `auto` rule, Privacy, Rollback, Waking the bot (+7 more)

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "guard.test.js"
Cohesion: 0.08
Nodes (39): binding(), cidrFamily(), command(), createApi(), get(), createGuard(), apply(), counters() (+31 more)

### Community 13 - "RFB"
Cohesion: 0.07
Nodes (5): clientEncodings(), enableContinuousUpdates(), RFB, setDesktopSize(), xvpOp()

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
Cohesion: 0.10
Nodes (22): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFileSync } (+14 more)

### Community 18 - "runner runner.js"
Cohesion: 0.07
Nodes (35): clearInterval(), { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade(), crypto (+27 more)

### Community 19 - "run.js"
Cohesion: 0.11
Nodes (16): buildRendererSource(), { buildRendererSource }, { CALL_EVENTS }, crypto, fs, { installSttBridge }, { makeRedactor }, os (+8 more)

### Community 20 - "test server.test.js"
Cohesion: 0.08
Nodes (20): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, { handleCall }, items, { loadRoles } (+12 more)

### Community 21 - "test brain.test.js"
Cohesion: 0.11
Nodes (20): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+12 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.11
Nodes (13): installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState(), meshAt() (+5 more)

### Community 25 - "standup.test.js"
Cohesion: 0.12
Nodes (22): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+14 more)

### Community 26 - "Plan: A face for the bot that talks when it speaks"
Cohesion: 0.25
Nodes (7): speechLevel(), Decisions carried over (approved intent and spec), Deviations after merge, Plan: A face for the bot that talks when it speaks, Rollback, Tests, Timing and "never frozen"

### Community 27 - "rfactory-standup.js"
Cohesion: 0.09
Nodes (29): { checkFacts }, count(), fs, main(), path, { setup }, ageOf(), approveClaude() (+21 more)

### Community 28 - "logging.js"
Cohesion: 0.12
Nodes (3): DataChannel, rawChannelProps, ReadyStates

### Community 29 - "web server.js"
Cohesion: 0.12
Nodes (29): Steps, @rfactory/core, { buildStandup, speakStandupHeadline }, composeLookups(), composeWrites(), createApp(), decide(), resolveSlug() (+21 more)

### Community 30 - "lookups.test.js"
Cohesion: 0.08
Nodes (25): createLookups(), FACTORY, GITHUB, { mapCard }, specs, { STATES }, validate(), { validPath, validNumber } (+17 more)

### Community 31 - "viewer/board.test.js"
Cohesion: 0.13
Nodes (14): nonce(), { randomBytes }, { viewerRoute, URL_BOARD, ORIGIN }, assert, board(), browser, column(), open() (+6 more)

### Community 32 - "test claude-cli.test.js"
Cohesion: 0.11
Nodes (27): createClaudeBrain(), answerTurn(), checkDestination(), lookupTurn(), propose(), run(), stop(), summarize() (+19 more)

### Community 33 - "ref_node_path"
Cohesion: 0.13
Nodes (11): assert, { buildRendererSource }, { chromium }, fs, path, test, connect(), handshake() (+3 more)

### Community 34 - "tts.test.js"
Cohesion: 0.12
Nodes (17): Deviations, after(), assert, { createTts }, { EventEmitter }, fs, os, { PassThrough } (+9 more)

### Community 35 - "client.test.js"
Cohesion: 0.10
Nodes (16): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+8 more)

### Community 36 - "profiles.test.js"
Cohesion: 0.12
Nodes (15): fs, LABEL, { randomUUID, hkdfSync }, admin, assert, fakeK8s(), fixture(), fs (+7 more)

### Community 37 - "repo"
Cohesion: 0.06
Nodes (35): captions(), heard(), When the bot starts to hear (Meet captions), Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text), Open questions (+27 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.08
Nodes (13): installSttBridge(), assert, event(), fs, { installSttBridge }, path, RTCRtpReceiver, RTCRtpSender (+5 more)

### Community 39 - "deflate.js"
Cohesion: 0.08
Nodes (38): deflate(), deflate_fast(), deflate_huff(), deflate_rle(), deflate_slow(), deflate_stored(), deflateEnd(), deflateInit2() (+30 more)

### Community 40 - "cfactory-write.test.js"
Cohesion: 0.08
Nodes (26): { Client }, createCfactoryWriter(), getClient(), invoke(), { deriveEffects }, fs, { makeRedactor }, STAGES (+18 more)

### Community 41 - "kyverno-scope.test.js"
Cohesion: 0.14
Nodes (16): assert, dir, { firstHost }, fs, path, policies, probeCidrs(), test (+8 more)

### Community 42 - "verify verify.test.js"
Cohesion: 0.12
Nodes (15): assert, beats(), CHECKS, fs, http, INPUT, { join }, LIB (+7 more)

### Community 44 - "speak"
Cohesion: 0.15
Nodes (12): 1. The service: `rfactory-stt`, 2. In the bot (`bot/run.js`, both deployments): cut speech, send segments, 3. In the call manager (`web/call.js`): transcribe and hear, 4. The listen setting, 5. Packaging and deploy, Alternatives rejected, Design, Measured on p620 (2026-11-21) (+4 more)

### Community 45 - "makeRedactor"
Cohesion: 0.08
Nodes (34): base64(), JOINED_RULES, jwtSpans(), KEY_VALUE_AT, keyValueAt(), keyValueMatch(), keyValueSpans(), makeRedactor() (+26 more)

### Community 46 - "inflate.js"
Cohesion: 0.08
Nodes (27): adler32(), crc32(), makeTable(), read_buf(), inflate_fast(), fixedtables(), inflate(), inflateInit2() (+19 more)

### Community 47 - "verify net.sh"
Cohesion: 0.16
Nodes (17): BP, connect(), deadline_left(), hello(), mk_target(), mkp(), NIP, node_ip() (+9 more)

### Community 48 - "verify profiles.sh"
Cohesion: 0.23
Nodes (18): app_restore(), app_sync(), argo_app(), attach(), ciphertext(), cm_field(), errmatch(), extra_cleanup() (+10 more)

### Community 49 - "lookup-endpoint.test.js"
Cohesion: 0.17
Nodes (8): assert, { Client }, { createLookupEndpoint }, { DESKTOP }, http, { StreamableHTTPClientTransport }, test, tools

### Community 50 - "Plan: project-aware calls, slice A (project-aware reads)"
Cohesion: 0.16
Nodes (18): idle(), setCameraRenderer(), ctx(), source(), Steps, Shared contracts (steps 2 to 6 all follow these), Decisions (approved intent and spec, as delivered in slice A), Delivery in two slices (a plan decision; the approved spec is unchanged) (+10 more)

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
Cohesion: 0.07
Nodes (64): count(), COUNT_CLAIM, createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog(), endCall() (+56 more)

### Community 55 - "index.js"
Cohesion: 0.13
Nodes (13): octets(), parseCmdline(), assert, { createAgent }, { createCallWorker }, { createControl }, { dial }, { encode, createDecoder } (+5 more)

### Community 56 - "createProxy"
Cohesion: 0.23
Nodes (18): checkedAddresses(), createApi(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect() (+10 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.11
Nodes (31): label(), stopShare(), action(), board(), boolean(), columns, count(), exact() (+23 more)

### Community 58 - "createActionManager"
Cohesion: 0.12
Nodes (12): { deriveEffects, describe }, FINAL, { randomUUID }, { validate, hashPayload, canonical }, approve(), assert, binding, { createActionManager } (+4 more)

### Community 59 - "createShare"
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

### Community 63 - "test/board.test.js"
Cohesion: 0.18
Nodes (11): assert, callTool(), card(), { createCfactorySource }, { encode }, { makeRedactor }, { projectBoard }, redactor (+3 more)

### Community 64 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Answers to the intent's open questions, Design, Driving apps, Feasibility gate (first plan step), Lifecycle and disposal, Live view, Network (+4 more)

### Community 65 - "reaper reaper.test.js"
Cohesion: 0.17
Nodes (13): createReaper(), leaseStale(), tick(), fs, main(), assert, { createReaper }, fake() (+5 more)

### Community 66 - "Spec: call the bot "Factory""
Cohesion: 0.20
Nodes (9): 1. The name, everywhere a person sees or hears it, 2. The wake rule (`core/src/call/hearing.js`), 3. Tests, Alternatives rejected, Amendment (owner, 2026-11-26): share requests in natural words (#63), Design, Risks, Spec: call the bot "Factory" (+1 more)

### Community 67 - "loadScope"
Cohesion: 0.09
Nodes (28): tools(), toModel(), listTools(), required(), raw(), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains) (+20 more)

### Community 68 - "ref_node_assert"
Cohesion: 0.07
Nodes (23): toSpeech(), assert, fs, path, root, test, assert, { loadRoles } (+15 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.12
Nodes (8): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, { makeRedactor }, reply(), repos, test

### Community 70 - "agent/call.test.js"
Cohesion: 0.14
Nodes (13): createCallWorker(), { createShare, callLaunchArgs }, fs, { PassThrough }, assert, { createCallWorker, withProxy, MEET_GUEST, TEAMS_CAPTIONS }, { EventEmitter }, fixture() (+5 more)

### Community 71 - "proxy.test.js"
Cohesion: 0.13
Nodes (11): assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard, os (+3 more)

### Community 72 - "loadScope"
Cohesion: 0.10
Nodes (22): source, commit, path, repo, DESTINATIONS, fs, LISTEN, loadScope() (+14 more)

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
Cohesion: 0.09
Nodes (26): checkFacts(), checkFactsDetailed(), CLAIM, COUNT, { summarise }, WORDS, summarise(), assert (+18 more)

### Community 80 - "ref_node_fs"
Cohesion: 0.06
Nodes (30): assert, { createProfile }, KEY, { test }, createK8s(), fs, assert, { createK8s } (+22 more)

### Community 81 - "Design"
Cohesion: 0.06
Nodes (32): gateway(), Affected users and systems, Constraints, Decisions (2026-11-27), Intent: Enforce an egress limit for the RFactory pod, Open questions, Problem, Proposed outcome (+24 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "profile.test.js"
Cohesion: 0.13
Nodes (13): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+5 more)

### Community 84 - "test run.test.js"
Cohesion: 0.11
Nodes (12): assert, audioJoined(), { EventEmitter }, fs, joined(), { PassThrough }, path, { run } (+4 more)

### Community 85 - "createShareManager"
Cohesion: 0.12
Nodes (33): createShareManager(), approve(), cleanup(), close(), emit(), endCall(), expire(), frameFor() (+25 more)

### Community 86 - "web/call.js"
Cohesion: 0.08
Nodes (27): Environment and scope reference, Per-call worker environment variables (set internally), Scope fields (`RFACTORY_SCOPE_FILE`), Web server environment variables, BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts, checkFactsDetailed }, emitLimits() (+19 more)

### Community 87 - "core/package.json"
Cohesion: 0.17
Nodes (11): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+3 more)

### Community 88 - "createCallManager"
Cohesion: 0.35
Nodes (13): Deviations (Codex review of the approved plan, 2026-11-17), createCallManager(), armQuiet(), audio(), captionSeen(), incoming(), killGroup(), say() (+5 more)

### Community 89 - "bot run()"
Cohesion: 0.20
Nodes (21): pageLeft(), run(), abandon(), discardOpen(), failureReport(), guestHelper(), idleAvatar(), leftConfirmed() (+13 more)

### Community 90 - "Design"
Cohesion: 0.14
Nodes (13): AI disclosure, Alternatives rejected, Cost, Design, Evidence this spec rests on, Licence (owner decision 2: the whole repository is AGPL-3.0), Packaging, Portraits and notices (+5 more)

### Community 91 - "gateway.test.js"
Cohesion: 0.12
Nodes (11): assert, base, { createGateway }, fetchScope(), fs, { loadScope }, { makeRedactor }, os (+3 more)

### Community 92 - "test/board.test.js"
Cohesion: 0.12
Nodes (17): cap(), collect(), walk(), COLUMNS, projectBoard(), { repositoryOf }, STAGES, boundedFetch() (+9 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "running"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Control-channel additions (an additive change to #3), Design, Order and dependencies, Proposing, approving, stopping, Risks, Spec: Show the CFactory board in the call, The constraint that shapes it (+3 more)

### Community 95 - "state"
Cohesion: 0.20
Nodes (10): The bot process (`bot/run.js`), 1. The bot reports a failed join (`bot/run.js` `start()`), 3. The desktop worker closes what it launched on setup failure (`desktop/guest/agent/call.js:83-90`), 4. The server logs it (`web/call.js` `incoming()`), Alternatives rejected, Design, Spec: see why Meet refuses the call bot, and recover from it, The intent's open questions (+2 more)

### Community 96 - "Spec: an approved, read-only Claude investigation from the call"
Cohesion: 0.18
Nodes (10): 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), 3. RFactory: hearing, approval, the shared log, the spoken result, Alternatives rejected, Design, Findings this design rests on (checked 2026-11-19), Order and dependencies, Risks (+2 more)

### Community 97 - "lookup-endpoint.js"
Cohesion: 0.22
Nodes (6): createLookupEndpoint(), http, { ListToolsRequestSchema, CallToolRequestSchema }, { randomBytes, timingSafeEqual }, { Server }, { StreamableHTTPServerTransport }

### Community 98 - "avatars.test.js"
Cohesion: 0.20
Nodes (8): assert, crypto, dir, fs, ids, manifest, path, test

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

### Community 105 - "source-guard.test.js"
Cohesion: 0.22
Nodes (7): assert, fs, guard, os, path, { spawnSync }, test

### Community 106 - "verify lifecycle.sh"
Cohesion: 0.42
Nodes (7): case_hold(), egress_cut(), fresh(), hold(), settled(), lifecycle.sh script, watch_end()

### Community 107 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Bounded run time, Decisions on the intent's open questions (proposed), Design, Find first, replace once (`core/src/redact.js` `logSafeWindow`), PEM flag across polls (`web/shares.js:49-51`), PEM marker scanner, Risks (+3 more)

### Community 108 - "vnc.test.js"
Cohesion: 0.17
Nodes (11): assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session, setEnc, setPixel (+3 more)

### Community 109 - "Design"
Cohesion: 0.14
Nodes (13): Alternatives rejected, Design, Effects are derived, not trusted, Keys and switches, Pending actions and approval, Reading CFactory's results, Recognising an action request, Risks (+5 more)

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "gateway.js"
Cohesion: 0.12
Nodes (16): DESKTOP, { mapGithub, summarise, STATES }, NAMES, { origin }, SCHEMAS, FAIL, failing(), labelNames() (+8 more)

### Community 112 - "scope.js"
Cohesion: 0.19
Nodes (13): Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Tests, Waves, Steps, createRecord(), files() (+5 more)

### Community 113 - "des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 114 - "shell-browser.test.js"
Cohesion: 0.20
Nodes (6): assert, { chromium }, { createApp }, { loadRoles }, { spawnSync }, test

### Community 115 - "ref_node_http"
Cohesion: 0.29
Nodes (3): http, [portA, portB], state

### Community 116 - "repo"
Cohesion: 0.11
Nodes (18): Approval (2026-11-27), Decisions (approved intent and spec, as they apply to slice B), Deviations, Open questions, Plan: project-aware calls, slice B (writes for every project), Rollback, State on 2026-11-27 (checked read-only), Tests (+10 more)

### Community 117 - "boundary.test.js"
Cohesion: 0.11
Nodes (12): assert, { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs, { loadRoles }, { makeRedactor } (+4 more)

### Community 118 - "deflator.js"
Cohesion: 0.36
Nodes (14): Steps, createActionManager(), approve(), emit(), endCall(), expire(), finish(), list() (+6 more)

### Community 119 - "Intent: call the bot "Factory""
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-26: "approved", with the recommendations), Intent: call the bot "Factory", Open questions, Problem, Proposed outcome

### Community 120 - "RSAAESAuthenticationState"
Cohesion: 0.09
Nodes (5): RA2Cipher, RSAAESAuthenticationState, EventTargetMixin, decodeUTF8(), encodeUTF8()

### Community 121 - "Intent: see why Meet refuses the call bot, and recover from it"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: see why Meet refuses the call bot, and recover from it, Open questions, Problem, Proposed outcome

### Community 122 - "Websock"
Cohesion: 0.17
Nodes (11): Branches and worktrees, Corrections to the approved spec, Decisions (from the approved spec; owner defaults accepted 2026-11-24), Deviations, Lead steps, in order, Plan: run RFactory in the factory cluster, Rollback, Steps (+3 more)

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

### Community 127 - ".text"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: the first question after the bot joins is heard in Meet captions mode, Open questions, Proposed outcome

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 129 - "standup.test.js"
Cohesion: 0.29
Nodes (6): assert, build(), { buildStandup, speakStandupHeadline }, freshness(), { makeRedactor }, test

### Community 130 - "@modelcontextprotocol/sdk"
Cohesion: 0.33
Nodes (4): { ListToolsRequestSchema, CallToolRequestSchema }, { Server }, { StdioServerTransport }, @modelcontextprotocol/sdk

### Community 131 - ".expired"
Cohesion: 0.29
Nodes (7): Landing record (2026-11-24), Live check results (step 12), Execution: re-check, claim, record, dispatch once, The action record, Switches and record, proposed(), ready()

### Community 133 - "ref_node_crypto"
Cohesion: 0.18
Nodes (15): createCfactorySource(), call(), connect(), view(), comments(), freshness(), scopedCards(), withClient() (+7 more)

### Community 134 - "Keyboard"
Cohesion: 0.20
Nodes (8): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass**

### Community 135 - "browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

### Community 136 - "deflator.js"
Cohesion: 0.38
Nodes (4): deflateInit(), Z_DEFAULT_COMPRESSION, Z_FULL_FLUSH, ZStream()

### Community 137 - "Plan: v1 roles in code (admin, approver, member), slice "roles" of #2"
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

### Community 155 - "stt-languages.test.js"
Cohesion: 0.38
Nodes (5): toWhisperLanguage(), WHISPER_LANGUAGES, assert, test, { WHISPER_LANGUAGES, toWhisperLanguage }

### Community 156 - ".sendKey"
Cohesion: 0.27
Nodes (9): calls(), FAKE_ARGS, FAKE_CALLS, FAKE_OUT, FAKE_PROGRAM, fixture(), PATH, run() (+1 more)

### Community 157 - "mapCard"
Cohesion: 0.15
Nodes (12): 10. Intent constraints carried into slice 1, 1. Data comes from four CFactory read tools, all on the existing read key, 3. Failure and freshness, 4. `core/src/standup.js` (new, pure): `buildStandup(cards, freshness)`, 6. Review (`core/src/review.js`, new, pure), 8. `core/src/sources/cfactory.js`, 9. CFactory issues to file when this spec is approved (slice 2 dependencies), Alternatives rejected (+4 more)

### Community 158 - "web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 159 - "md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 161 - "events.js"
Cohesion: 0.48
Nodes (5): _capturedElemChanged(), _captureObserver, _captureProxy(), releaseCapture(), setCapture()

### Community 162 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Source adapters (+2 more)

### Community 163 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.15
Nodes (12): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 8. Problems we hit (+4 more)

### Community 164 - "desktop-routes.test.js"
Cohesion: 0.10
Nodes (28): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+20 more)

### Community 165 - "eyes"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 166 - "createControl"
Cohesion: 0.27
Nodes (10): capText(), createControl(), applyHosts(), closePage(), page(), start(), fs, originOf() (+2 more)

### Community 167 - "Plan: Show the CFactory board in the call"
Cohesion: 0.33
Nodes (5): Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Tests

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 170 - "Design"
Cohesion: 0.11
Nodes (17): Decisions (the approved intent and spec), Deviations, Plan: finish the "Factory" rename and stop false wakes at a caption block start, Rollback, Steps, Tests, 1. The wake rule (`core/src/call/hearing.js:3`), 2. A rejected mention still ends the request before it (`hearing.js:50-71`) (+9 more)

### Community 172 - "Plan: Phase 0, the Linux call test"
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "Plan: in-call agents, slice 1: live read-only lookups"
Cohesion: 0.40
Nodes (4): Decisions (approved intent and spec, with the owner's amendments of 2026-11-26), Plan: in-call agents, slice 1: live read-only lookups, Rollback, Tests

### Community 176 - "Intent: run RFactory in the factory cluster like the other Factory services"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decided, Intent: run RFactory in the factory cluster like the other Factory services, Open questions, Problem, Proposed outcome

### Community 177 - "desktop.test.js"
Cohesion: 0.13
Nodes (21): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), origin() (+13 more)

### Community 178 - "Spec: Phase 0, the Linux call test"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Context for later phases (not decided here), Decisions on the intent's Phase 0 questions, Design, Goal, Pass / fail, Risks, Spec: Phase 0, the Linux call test (+1 more)

### Community 179 - "Intent: A face for the bot that talks when it speaks"
Cohesion: 0.22
Nodes (8): Affected users and systems, Constraints, Decisions (owner, 2026-11-17), Intent: A face for the bot that talks when it speaks, Open questions, Problem, Proposed outcome (first slice), Source of the portraits

### Community 182 - "ZRLEDecoder"
Cohesion: 0.24
Nodes (3): ZRLEDecoder, Inflate, inflateInit()

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
Nodes (48): ACTIONS, bounded(), canonical(), CREATE_STATUSES, { createHash }, criteria(), FIELDS, hashPayload() (+40 more)

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
Cohesion: 0.16
Nodes (13): createHearing(), SELF_NAMES, assert, { createHearing }, fakeClock(), setup(), test, Decisions (the approved intent and spec, including the spec's amendment) (+5 more)

### Community 211 - "mesh"
Cohesion: 0.33
Nodes (6): mesh, anchors, file, sha256, triangles, f17

### Community 212 - "move"
Cohesion: 0.33
Nodes (6): move, C, JL, JR, LB, LM

### Community 213 - "Intent: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (approved 2026-11-27), Intent: the call Chrome runs with its sandbox on, so Meet admits the bot, Open questions, Problem, Proposed outcome

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

### Community 228 - "Intent: the bot hears in audio mode, and joins Meet on the first try"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: the bot hears in audio mode, and joins Meet on the first try, Open questions, Problem, Proposed outcome

### Community 238 - "join"
Cohesion: 0.10
Nodes (23): releaseAttempt(), join(), Candidate causes, and what the code says, How a caption becomes a question today, Problem, Decisions (approved intent and spec), Deviations, Plan: see why Meet refuses the call bot, and recover from it (+15 more)

### Community 242 - "Spec: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Design, Risks, Spec: the call Chrome runs with its sandbox on, so Meet admits the bot, Verification

## Knowledge Gaps
- **40 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1793 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Display` connect `Display` to `rfb.js`, `logging.js`, `createInvestigationManager`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `createLifecycle()` (e.g. with `lifecycle.js` and `action()`) actually correct?**
  _`createLifecycle()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `web server.js` to `public app.js`, `guard.test.js`, `ref_node_child_process`, `test/board.test.js`, `proxy.js`, `Plan: project-aware calls, slice A (project-aware reads)`, `repo`, `createShareManager`, `web/call.js`, `createInvestigationManager`, `core/test/actions.test.js`, `lookups.test.js`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Should `rfb.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06033182503770739 - nodes in this community are weakly interconnected._
- **Why does `Websock` connect `Plan: A face for the bot that talks when it speaks` to `._updateConnectionState`, `rfb.js`, `logging.js`, `RFB`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._