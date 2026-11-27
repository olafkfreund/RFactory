# Graph Report - RFactory-t27  (2026-11-27)

## Corpus Check
- 341 files · ~541,847 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 10, .nix 6, .css 4)

## Summary
- 3933 nodes · 7101 edges · 256 communities (219 shown, 37 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 1063 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `28c4d034`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verify lib.sh
- Spec: Phase 1b, a voice standup in Google Meet
- rfb.js
- test/call.test.js
- app.js
- createCallManager
- claude-cli.js
- createLifecycle
- agent.test.js
- checkFacts
- createShareManager
- test desktop-ui.test.js
- guard.test.js
- RFB
- runner runner.test.js
- agent-tools.js
- e2e-inventory.test.js
- github.test.js
- runner runner.js
- cli.test.js
- test server.test.js
- brain.test.js
- test avatar-state.test.js
- agent-tools.js
- .rQwait
- agents.test.js
- loadScope
- rfactory-standup.js
- How the bot hears
- web server.js
- lookups.test.js
- viewer/board.test.js
- claude-cli.test.js
- avatar-renderer.test.js
- tts.test.js
- client.test.js
- profiles.test.js
- agent-tools.js
- stt-bridge.test.js
- deflate.js
- cfactory-write.test.js
- preflight.test.js
- verify verify.test.js
- agents.test.js
- speak
- makeRedactor
- inflate.js
- verify net.sh
- verify profiles.sh
- lookup-endpoint.test.js
- e2e-inventory.js
- spike hello-call.test.js
- logging.js
- vm-call.test.js
- createInvestigationManager
- index.js
- createProxy
- runner protocol.js
- createActionManager
- gateway.js
- proxy.js
- el
- share-desktop.test.js
- .text
- agent-endpoint.js
- reaper reaper.test.js
- agent-endpoint.test.js
- stt.test.js
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
- checkFacts
- Display
- core/test/actions.test.js
- gateway
- spike spike/package.json
- C5. Tools and wrapper (`web/agent-tools.js`)
- test run.test.js
- createShareManager
- web/call.js
- core/package.json
- checkFacts
- bot run()
- desktop.test.js
- scope.js
- Steps
- desktop desktop/package.json
- Design
- ref_node_fs
- Spec: an approved, read-only Claude investigation from the call
- Design
- agent-endpoint.js
- Intent: in-call agents, the model with live tools, provider chosen per call
- Design
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
- How the bot hears
- Steps
- des.js
- k8s.test.js
- gateway.test.js
- ref_node_child_process
- boundary.test.js
- Design
- Intent: call the bot "Factory"
- RSAAESAuthenticationState
- Steps
- connect
- verify e2e.sh
- H264Decoder
- k3d k11.sh
- k3d mk-tls.sh
- compare
- verify liveview.sh
- Keyboard
- avatars.test.js
- ._updateConnectionState
- GestureHandler
- createClaudeBrain
- Standalone mode S1: end-to-end results (#2 step 10)
- browser.js
- inflator.js
- has
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
- Keyboard
- origin
- Intent: an MCP server for agents, slice A: read RFactory with a read key
- Steps
- web/package.json
- md5.js
- TightDecoder
- net.js
- Design
- Desktop VMs on the k3d factory cluster
- desktop-routes.test.js
- eyes
- lookup-endpoint.js
- Plan: A face for the bot that talks when it speaks
- Socket
- teams-tap-spike.js
- Design
- stt.test.js
- Plan: Phase 0, the Linux call test
- Intent: run a Claude terminal from the call, and show it
- profile.test.js
- cfactory-write.js
- Intent: run RFactory in the factory cluster like the other Factory services
- connect
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
- github-read.js
- Intent: an MCP server for agents, slice A: read RFactory with a read key
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
- ref_node_crypto
- stun.test.js
- ref_node_http
- LegacyCrypto
- theme.js
- RSACipher
- CLAUDE.md
- .claude/CLAUDE.md
- Intent: finish the "Factory" rename and stop false wakes at a caption block start
- check-image-stt.sh
- SHELL_INVENTORY.md
- Intent: redact credentials that wrap across log lines
- bootstrap-secrets.sh
- createHearing
- assert-signature-location.sh
- Intent: Enforce an egress limit for the RFactory pod
- mesh
- move
- Intent: the call Chrome runs with its sandbox on, so Meet admits the bot
- Plan: finish the "Factory" rename and stop false wakes at a caption block start
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
- events.js
- join
- check-egress.sh
- shares.test.js
- kyverno-scope.test.js
- Spec: the call Chrome runs with its sandbox on, so Meet admits the bot
- checkClaudeHome
- ollama-standup.js
- createClaudeBrain
- @modelcontextprotocol/sdk
- items.js
- cap
- loadShares
- scope.js
- Plan: the call Chrome runs with its sandbox on, so Meet admits the bot
- Spec: Phase 3, act on the Factories from the call
- profiles.js
- wireProjectCall

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `createLifecycle()` - 45 edges
3. `makeRedactor()` - 44 edges
4. `Steps` - 39 edges
5. `createInvestigationManager()` - 37 edges
6. `checkFacts()` - 34 edges
7. `createCallManager()` - 33 edges
8. `Display` - 32 edges
9. `Websock` - 32 edges
10. `loadScope()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `Proposed outcome` --references--> `propose()`  [INFERRED]
  intent/2026-11-27-27-mcp-server.md → core/src/brains/claude-cli.js
- `Verification` --references--> `heard()`  [INFERRED]
  spec/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `2. The wake rule (`core/src/call/hearing.js`)` --references--> `heard()`  [INFERRED]
  spec/2026-11-26-62-bot-name-factory.md → core/src/call/hearing.js
- `Risks` --references--> `checkFacts()`  [INFERRED]
  spec/2026-11-17-5-phase-1a-text-standup.md → core/src/facts.js
- `Verification` --references--> `checkFacts()`  [INFERRED]
  spec/2026-11-17-5-phase-1a-text-standup.md → core/src/facts.js

## Import Cycles
- None detected.

## Communities (256 total, 37 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "Spec: Phase 1b, a voice standup in Google Meet"
Cohesion: 0.40
Nodes (4): Alternatives rejected, Risks, Spec: Phase 1b, a voice standup in Google Meet, Verification

### Community 2 - "rfb.js"
Cohesion: 0.06
Nodes (17): CopyRectDecoder, JPEGDecoder, RawDecoder, RREDecoder, ZlibDecoder, encodings, _buildExtendedClipboardFlags(), clientCutText() (+9 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.08
Nodes (19): assert, { createCallManager }, { createInvestigationManager }, { EventEmitter }, fakeClock(), finishSpeech(), flush(), fs (+11 more)

### Community 4 - "app.js"
Cohesion: 0.14
Nodes (23): decide(), decided(), decideInvestigation(), decideShare(), githubMode, handleInvestigation(), INVESTIGATION_LIVE, investigationStateText() (+15 more)

### Community 5 - "createCallManager"
Cohesion: 0.19
Nodes (27): resolveListen(), Deviations (Codex review of the approved plan, 2026-11-17), createCallManager(), addressed(), answer(), armQuiet(), audio(), drain() (+19 more)

### Community 6 - "claude-cli.js"
Cohesion: 0.13
Nodes (14): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, LOOKUP_ERRORS, LOOKUP_SYSTEM_PROMPT (+6 more)

### Community 7 - "createLifecycle"
Cohesion: 0.10
Nodes (38): 8. Problems we hit, createLifecycle(), accept(), allowAccept(), attachAgent(), boot(), callAttach(), cancel() (+30 more)

### Community 8 - "agent.test.js"
Cohesion: 0.27
Nodes (10): capText(), createControl(), applyHosts(), closePage(), page(), start(), fs, originOf() (+2 more)

### Community 9 - "checkFacts"
Cohesion: 0.09
Nodes (15): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+7 more)

### Community 10 - "createShareManager"
Cohesion: 0.20
Nodes (8): Agents (MCP), Deployment, How the bot hears, Licence, RFactory, Roles, Standup and review, Without the Factories

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "guard.test.js"
Cohesion: 0.13
Nodes (14): assert, { buildPolicy }, cniResult(), entry, { execFileSync }, fake(), fs, https (+6 more)

### Community 13 - "RFB"
Cohesion: 0.06
Nodes (6): clientEncodings(), enableContinuousUpdates(), keyEvent(), QEMUExtendedKeyEvent(), RFB, setDesktopSize()

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 15 - "agent-tools.js"
Cohesion: 0.07
Nodes (28): action, atom(), { CARD_KEY }, createAgentTools(), invoke(), descriptions, freshness, investigation (+20 more)

### Community 16 - "e2e-inventory.test.js"
Cohesion: 0.11
Nodes (23): assert, { build, hashOf, compare, compareAfter, main }, clone(), endpointsOf(), { EventEmitter }, fixture(), fs, ghFake() (+15 more)

### Community 17 - "github.test.js"
Cohesion: 0.13
Nodes (13): fetchScope(), assert, conn(), { connect, RECORDED }, dir, fakeBin(), fs, issue() (+5 more)

### Community 18 - "runner runner.js"
Cohesion: 0.13
Nodes (22): clearInterval(), { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade(), crypto (+14 more)

### Community 19 - "cli.test.js"
Cohesion: 0.10
Nodes (4): HextileDecoder, DataChannel, rawChannelProps, ReadyStates

### Community 20 - "test server.test.js"
Cohesion: 0.07
Nodes (24): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, GH_KEYS, ghItems, { handleCall } (+16 more)

### Community 21 - "brain.test.js"
Cohesion: 0.11
Nodes (18): { createHash }, destinationHash(), fs, path, resolveDestination(), turn(), { destinationHash }, OpenAI (+10 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.11
Nodes (13): installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState(), meshAt() (+5 more)

### Community 24 - ".rQwait"
Cohesion: 0.12
Nodes (3): Verification, encodeUTF8(), Websock

### Community 25 - "agents.test.js"
Cohesion: 0.08
Nodes (21): Plan decisions (new here; the owner approves them with this plan), agents, assert, cards, { Client }, compose(), { createApp, composeAgents, composeWrites, refuseKeyEnv }, fs (+13 more)

### Community 26 - "loadScope"
Cohesion: 0.29
Nodes (6): ctx(), Decisions (approved intent and spec, with the owner's amendments of 2026-11-26), Plan: in-call agents, slice 1: live read-only lookups, Rollback, Shared contracts (steps 2 to 6 all follow these), Tests

### Community 27 - "rfactory-standup.js"
Cohesion: 0.07
Nodes (38): { checkFacts }, count(), fs, main(), path, { setup }, ageOf(), causes() (+30 more)

### Community 28 - "How the bot hears"
Cohesion: 0.13
Nodes (18): releaseAttempt(), code(), Decisions (approved intent and spec), Deviations, Plan: see why Meet refuses the call bot, and recover from it, Rollback, Steps, Tests (+10 more)

### Community 29 - "web server.js"
Cohesion: 0.11
Nodes (29): @rfactory/core, { buildStandup, speakStandupHeadline }, createReads(), { mapCard }, { reviewCard, reviewProject }, { summarise }, composeAgents(), composeStandalone() (+21 more)

### Community 30 - "lookups.test.js"
Cohesion: 0.10
Nodes (16): FACTORY, GITHUB, { mapCard }, specs, { STATES }, validate(), { validPath, validNumber }, validNumber() (+8 more)

### Community 31 - "viewer/board.test.js"
Cohesion: 0.06
Nodes (37): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+29 more)

### Community 32 - "claude-cli.test.js"
Cohesion: 0.13
Nodes (15): assert, { claudeHash, checkClaudeHome }, { createClaudeBrain }, { EventEmitter }, fs, lookup, lookupBrain(), { makeRedactor } (+7 more)

### Community 33 - "avatar-renderer.test.js"
Cohesion: 0.18
Nodes (6): assert, { buildRendererSource }, { chromium }, fs, path, test

### Community 34 - "tts.test.js"
Cohesion: 0.13
Nodes (15): assert, { createTts }, { EventEmitter }, fs, os, { PassThrough }, path, test (+7 more)

### Community 35 - "client.test.js"
Cohesion: 0.10
Nodes (16): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+8 more)

### Community 36 - "profiles.test.js"
Cohesion: 0.15
Nodes (12): admin, assert, fakeK8s(), fixture(), fs, { hkdfSync }, MASTER, os (+4 more)

### Community 37 - "agent-tools.js"
Cohesion: 0.07
Nodes (36): afterJoin(), captions(), heard(), When the bot starts to hear (Meet captions), Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text) (+28 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.07
Nodes (15): installSttBridge(), assert, event(), fs, { installSttBridge }, path, RTCRtpReceiver, RTCRtpSender (+7 more)

### Community 39 - "deflate.js"
Cohesion: 0.08
Nodes (39): deflate(), deflate_fast(), deflate_huff(), deflate_rle(), deflate_slow(), deflate_stored(), deflateEnd(), deflateInit() (+31 more)

### Community 40 - "cfactory-write.test.js"
Cohesion: 0.10
Nodes (19): createCfactoryWriter(), getClient(), invoke(), assert, bareBlocked, bareStarted, before, card (+11 more)

### Community 41 - "preflight.test.js"
Cohesion: 0.13
Nodes (16): assert, dir, { firstHost }, fs, path, policies, probeCidrs(), test (+8 more)

### Community 42 - "verify verify.test.js"
Cohesion: 0.12
Nodes (15): assert, beats(), CHECKS, fs, http, INPUT, { join }, LIB (+7 more)

### Community 43 - "agents.test.js"
Cohesion: 0.12
Nodes (17): 4. Full tests, review, commit (lead), 5. One live read-only run, and the list on issue #60 (lead), Decisions (2026-11-27), Decisions (approved intent and spec), Open questions, Plan: `e2e-*` cleanup, first slice: the read-only inventory script, Rollback, Rules for implementers (+9 more)

### Community 44 - "speak"
Cohesion: 0.15
Nodes (12): 1. The service: `rfactory-stt`, 2. In the bot (`bot/run.js`, both deployments): cut speech, send segments, 3. In the call manager (`web/call.js`): transcribe and hear, 4. The listen setting, 5. Packaging and deploy, Alternatives rejected, Design, Measured on p620 (2026-11-21) (+4 more)

### Community 45 - "makeRedactor"
Cohesion: 0.09
Nodes (36): base64(), JOINED_RULES, jwtSpans(), KEY_VALUE_AT, keyValueAt(), keyValueMatch(), keyValueSpans(), makeRedactor() (+28 more)

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

### Community 50 - "e2e-inventory.js"
Cohesion: 0.17
Nodes (22): build(), codes(), { createCfactorySource }, { createHash }, fail(), FIXED, fs, keyOf() (+14 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.07
Nodes (23): { buildRendererSource }, { CALL_EVENTS }, crypto, fs, { installSttBridge }, { makeRedactor }, os, path (+15 more)

### Community 52 - "logging.js"
Cohesion: 0.10
Nodes (15): renderFooter(), ALPHA, assert, base, BETA, card(), Node, projectPage() (+7 more)

### Community 53 - "vm-call.test.js"
Cohesion: 0.17
Nodes (10): assert, { createVmSpawn }, { Duplex }, { test }, createVmSpawn(), { EventEmitter }, firstLine(), { PassThrough } (+2 more)

### Community 54 - "createInvestigationManager"
Cohesion: 0.07
Nodes (64): count(), COUNT_CLAIM, createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog(), endCall() (+56 more)

### Community 55 - "index.js"
Cohesion: 0.06
Nodes (37): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+29 more)

### Community 56 - "createProxy"
Cohesion: 0.23
Nodes (18): checkedAddresses(), createApi(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect() (+10 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.24
Nodes (16): board(), boolean(), columns, count(), exact(), identity, log(), login() (+8 more)

### Community 58 - "createActionManager"
Cohesion: 0.05
Nodes (51): label(), stopShare(), hosts(), Decisions carried over from the approved spec, Deviations from the spec (for approval with this plan), Facts checked in the real repos, Open questions for the owner, Plan: Agent workspace, a disposable desktop per call (#3) (+43 more)

### Community 59 - "gateway.js"
Cohesion: 0.18
Nodes (14): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), origin() (+6 more)

### Community 60 - "proxy.js"
Cohesion: 0.16
Nodes (15): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, inRange() (+7 more)

### Community 61 - "el"
Cohesion: 0.21
Nodes (16): ago(), clear(), clock(), el(), fill(), handleCall(), loadReviewCard(), render() (+8 more)

### Community 62 - "share-desktop.test.js"
Cohesion: 0.24
Nodes (7): createShareDesktop(), schedule(), stopPolling(), assert, { createShareDesktop }, setup(), test

### Community 64 - "agent-endpoint.js"
Cohesion: 0.19
Nodes (14): BAD, createAgentEndpoint(), find(), handle(), valid(), { createHash, timingSafeEqual }, digest(), errorResult() (+6 more)

### Community 65 - "reaper reaper.test.js"
Cohesion: 0.17
Nodes (13): createReaper(), leaseStale(), tick(), fs, main(), assert, { createReaper }, fake() (+5 more)

### Community 66 - "agent-endpoint.test.js"
Cohesion: 0.15
Nodes (12): agents, assert, { Client }, { createAgentEndpoint }, fake, http, names, request() (+4 more)

### Community 67 - "stt.test.js"
Cohesion: 0.15
Nodes (9): Web server environment variables, createStt(), fs, assert, { createStt }, fs, os, path (+1 more)

### Community 68 - "ref_node_assert"
Cohesion: 0.06
Nodes (29): toSpeech(), assert, CURRENT, NOT_IN_CARD, { reviewCard, reviewProject }, STALE, test, UNAVAILABLE (+21 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.11
Nodes (10): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, invReplies(), invWith(), { makeRedactor }, reply() (+2 more)

### Community 70 - "agent/call.test.js"
Cohesion: 0.10
Nodes (19): createCallWorker(), { createShare, callLaunchArgs }, fs, { PassThrough }, assert, { createCallWorker, withProxy, MEET_GUEST, TEAMS_CAPTIONS }, { EventEmitter }, fixture() (+11 more)

### Community 71 - "proxy.test.js"
Cohesion: 0.13
Nodes (11): assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard, os (+3 more)

### Community 72 - "loadScope"
Cohesion: 0.14
Nodes (12): source, commit, path, repo, assert, fixture(), fs, { loadScope, resolveListen } (+4 more)

### Community 73 - "bot bot/package.json"
Cohesion: 0.14
Nodes (13): dependencies, playwright-core, @vibeconferencing/calls, engines, node, playwright-core, @vibeconferencing/calls, license (+5 more)

### Community 74 - "Design"
Cohesion: 0.21
Nodes (13): binding(), cidrFamily(), command(), apply(), { execFile }, execFileAsync, findVeth(), fs (+5 more)

### Community 75 - "trees.js"
Cohesion: 0.16
Nodes (28): bi_flush(), bi_reverse(), bi_windup(), build_bl_tree(), build_tree(), compress_block(), copy_block(), d_code() (+20 more)

### Community 76 - "runner k8s-lifecycle.test.js"
Cohesion: 0.19
Nodes (9): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+1 more)

### Community 77 - "web live-view.test.js"
Cohesion: 0.15
Nodes (11): assert, client(), clientSession, { createApp }, fbUpdate, includes(), { loadRoles }, net (+3 more)

### Community 78 - "checkFacts"
Cohesion: 0.14
Nodes (13): Alternatives rejected, CFactory source (`core/src/sources/cfactory.js`), Claude Code CLI brain (`core/src/brains/claude-cli.js`), Data, Decisions on the intent's open questions (recommended), Design, Risks, Sign-in (+5 more)

### Community 80 - "core/test/actions.test.js"
Cohesion: 0.18
Nodes (12): assert, card, context, { deriveEffects, describe }, { makeRedactor }, ok(), proposal(), refused() (+4 more)

### Community 81 - "gateway"
Cohesion: 0.14
Nodes (14): gateway(), Problem, Network (replaces the approved "Network" section), Alternatives rejected, Decisions (2026-11-27), Deferred, Design, How each decision is carried (+6 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "C5. Tools and wrapper (`web/agent-tools.js`)"
Cohesion: 0.12
Nodes (14): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+6 more)

### Community 84 - "test run.test.js"
Cohesion: 0.11
Nodes (12): assert, audioJoined(), { EventEmitter }, fs, joined(), { PassThrough }, path, { run } (+4 more)

### Community 85 - "createShareManager"
Cohesion: 0.06
Nodes (55): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+47 more)

### Community 86 - "web/call.js"
Cohesion: 0.10
Nodes (19): SELF_NAMES, BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts, checkFactsDetailed }, { createHearing, SELF_NAMES }, { createShareDesktop }, { createStt }, { FACTORY, GITHUB } (+11 more)

### Community 87 - "core/package.json"
Cohesion: 0.17
Nodes (11): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+3 more)

### Community 88 - "checkFacts"
Cohesion: 0.06
Nodes (47): checkFacts(), tools(), ask(), raw(), Deviations from the spec (approved with this plan), Steps, Before step 1 (gates, all needed), Decisions carried over from the approved spec (+39 more)

### Community 89 - "bot run()"
Cohesion: 0.17
Nodes (24): buildRendererSource(), pageLeft(), run(), abandon(), discardOpen(), failureReport(), guestHelper(), idleAvatar() (+16 more)

### Community 90 - "desktop.test.js"
Cohesion: 0.15
Nodes (12): AI disclosure, Alternatives rejected, Cost, Design, Evidence this spec rests on, Licence (owner decision 2: the whole repository is AGPL-3.0), Packaging, Portraits and notices (+4 more)

### Community 91 - "scope.js"
Cohesion: 0.14
Nodes (9): assert, base, { createGateway }, fs, { loadScope }, { makeRedactor }, os, path (+1 more)

### Community 92 - "Steps"
Cohesion: 0.06
Nodes (43): createLookups(), COLUMNS, projectBoard(), { repositoryOf }, STAGES, boundedFetch(), { Client }, createCfactorySource() (+35 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Design, Exposure, Facts this rests on (checked on p620, 2026-11-18), Lifecycle, Live view, Profiles, Risks (+4 more)

### Community 95 - "ref_node_fs"
Cohesion: 0.07
Nodes (24): assert, crypto, dir, fs, ids, manifest, path, test (+16 more)

### Community 96 - "Spec: an approved, read-only Claude investigation from the call"
Cohesion: 0.20
Nodes (9): 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), 3. RFactory: hearing, approval, the shared log, the spoken result, Alternatives rejected, Design, Order and dependencies, Risks, Spec: an approved, read-only Claude investigation from the call (+1 more)

### Community 97 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Design, Images: built, signed and promoted by CI, like CFactory, One pod, as today, Order and cutover, Owner decisions (proposed defaults), Pod security, Reach: tunnel, DNS, Keycloak (+4 more)

### Community 98 - "agent-endpoint.js"
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

### Community 105 - "Spec: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.29
Nodes (6): Alternatives rejected, Approval (2026-11-27), Open questions, Risks, Spec: clean up the `e2e-*` test repositories (GitHub and CFactory), Verification

### Community 106 - "verify lifecycle.sh"
Cohesion: 0.42
Nodes (7): case_hold(), egress_cut(), fresh(), hold(), settled(), lifecycle.sh script, watch_end()

### Community 107 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Bounded run time, Decisions on the intent's open questions (proposed), Design, PEM flag across polls (`web/shares.js:49-51`), PEM marker scanner, Risks, Spec: redact credentials that wrap across log lines (+2 more)

### Community 108 - "vnc.test.js"
Cohesion: 0.12
Nodes (19): bridgeViewOnly(), createFilter(), assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session (+11 more)

### Community 109 - "Design"
Cohesion: 0.15
Nodes (14): Design, Effects are derived, not trusted, Execution: re-check, claim, record, dispatch once, Keys and switches, Pending actions and approval, Reading CFactory's results, Recognising an action request, The action allowlist (the only things that can ever run) (+6 more)

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "How the bot hears"
Cohesion: 0.17
Nodes (12): hello(), Captions vs own transcription, Environment and scope reference, How the bot hears, Language, `listen` values and the per-platform `auto` rule, Per-call worker environment variables (set internally), Privacy (+4 more)

### Community 112 - "Steps"
Cohesion: 0.05
Nodes (65): idle(), setCameraRenderer(), hashPayload(), revalidate(), loadScope(), commit(), base(), source() (+57 more)

### Community 113 - "des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 114 - "k8s.test.js"
Cohesion: 0.17
Nodes (9): createK8s(), assert, { createK8s }, fs, http, { inClusterConfig }, os, path (+1 more)

### Community 115 - "gateway.test.js"
Cohesion: 0.35
Nodes (12): createApi(), get(), createGuard(), counters(), heartbeat(), reconcile(), reconcileOnce(), server() (+4 more)

### Community 116 - "ref_node_child_process"
Cohesion: 0.25
Nodes (6): { Client }, { execFile }, { promisify }, READ_TOOLS, RECORDED, { StdioClientTransport }

### Community 117 - "boundary.test.js"
Cohesion: 0.11
Nodes (12): assert, { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs, { loadRoles }, { makeRedactor } (+4 more)

### Community 118 - "Design"
Cohesion: 0.17
Nodes (11): 3. Shared reads (the one control API), 5. What an agent sees: the wrapper, 6. Project ids on proposals and record lines, 7. Limits and the page (constraint "agents must not get in the page's way"), 9. Deployment, Alternatives rejected, Decisions (2026-11-27), Design (+3 more)

### Community 119 - "Intent: call the bot "Factory""
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-26: "approved", with the recommendations), Intent: call the bot "Factory", Open questions, Problem, Proposed outcome

### Community 120 - "RSAAESAuthenticationState"
Cohesion: 0.12
Nodes (3): RA2Cipher, RSAAESAuthenticationState, EventTargetMixin

### Community 121 - "Steps"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: see why Meet refuses the call bot, and recover from it, Open questions, Problem, Proposed outcome

### Community 122 - "connect"
Cohesion: 0.27
Nodes (10): connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { connect: defaultConnect }, createGithubSource() (+2 more)

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

### Community 127 - "compare"
Cohesion: 0.39
Nodes (9): canon(), compare(), compareAfter(), facts(), hashOf(), number(), 2. `core/bin/e2e-inventory.js`: the pure part (codex), 3. `core/bin/e2e-inventory.js`: readers and the command line (coder) (+1 more)

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 129 - "Keyboard"
Cohesion: 0.22
Nodes (8): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Spec: Standalone mode, with a choice of source and brain

### Community 130 - "avatars.test.js"
Cohesion: 0.15
Nodes (15): BASE_PROTECTED, block(), buildPolicy(), contains(), ipNumber(), net, portRules(), ranges (+7 more)

### Community 131 - "._updateConnectionState"
Cohesion: 0.67
Nodes (3): crc32(), makeTable(), read_buf()

### Community 133 - "createClaudeBrain"
Cohesion: 0.53
Nodes (9): createClaudeBrain(), answerTurn(), checkDestination(), lookupTurn(), propose(), run(), stop(), summarize() (+1 more)

### Community 134 - "Standalone mode S1: end-to-end results (#2 step 10)"
Cohesion: 0.13
Nodes (13): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass** (+5 more)

### Community 135 - "browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

### Community 136 - "inflator.js"
Cohesion: 0.25
Nodes (5): Deflator, Z_DEFAULT_COMPRESSION, Z_FULL_FLUSH, inflateInit(), ZStream()

### Community 137 - "has"
Cohesion: 0.10
Nodes (19): loadRoles(), has(), rolesOf(), Decisions carried over from the approved spec, Decisions for this plan, Deviations, Plan: v1 roles in code (admin, approver, member), slice "roles" of #2, Rollback (+11 more)

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

### Community 154 - "Keyboard"
Cohesion: 0.09
Nodes (12): DOMKeyTable, Keyboard, codepoints, getKey(), getKeycode(), getKeysym(), _capturedElemChanged(), _captureObserver (+4 more)

### Community 155 - "origin"
Cohesion: 0.21
Nodes (7): createProfile(), readHead(), assert, { createProfile }, KEY, setup(), { test }

### Community 156 - "Intent: an MCP server for agents, slice A: read RFactory with a read key"
Cohesion: 0.27
Nodes (9): calls(), FAKE_ARGS, FAKE_CALLS, FAKE_OUT, FAKE_PROGRAM, fixture(), PATH, run() (+1 more)

### Community 157 - "Steps"
Cohesion: 0.07
Nodes (36): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+28 more)

### Community 158 - "web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 159 - "md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 161 - "net.js"
Cohesion: 0.17
Nodes (11): Branches and worktrees, Corrections to the approved spec, Deviations, Landing record (2026-11-24), Lead steps, in order, Plan: run RFactory in the factory cluster, Rollback, Steps (+3 more)

### Community 162 - "Design"
Cohesion: 0.18
Nodes (10): Source adapters, assert, fs, git(), guard, os, path, repo() (+2 more)

### Community 163 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.20
Nodes (9): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 9. Rollback (+1 more)

### Community 164 - "desktop-routes.test.js"
Cohesion: 0.10
Nodes (28): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+20 more)

### Community 165 - "eyes"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 166 - "lookup-endpoint.js"
Cohesion: 0.22
Nodes (6): createLookupEndpoint(), http, { ListToolsRequestSchema, CallToolRequestSchema }, { randomBytes, timingSafeEqual }, { Server }, { StreamableHTTPServerTransport }

### Community 167 - "Plan: A face for the bot that talks when it speaks"
Cohesion: 0.25
Nodes (7): speechLevel(), Decisions carried over (approved intent and spec), Deviations after merge, Plan: A face for the bot that talks when it speaks, Rollback, Tests, Timing and "never frozen"

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 170 - "Design"
Cohesion: 0.18
Nodes (10): 1. The wake rule (`core/src/call/hearing.js:3`), 2. A rejected mention still ends the request before it (`hearing.js:50-71`), 3. What people are told, 4. The shared views (`desktop/guest/agent/viewer/board.js:30`, `:35`), 5. Tests, Alternatives rejected, Design, Risks (+2 more)

### Community 171 - "stt.test.js"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: clean up the `e2e-*` test repositories (GitHub and CFactory), Open questions, Problem, Proposed outcome

### Community 172 - "Plan: Phase 0, the Linux call test"
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "profile.test.js"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Control-channel additions (an additive change to #3), Design, Order and dependencies, Proposing, approving, stopping, Risks, Spec: Show the CFactory board in the call, The constraint that shapes it (+2 more)

### Community 175 - "cfactory-write.js"
Cohesion: 0.15
Nodes (14): deriveEffects(), describe(), SERVICE, STAGE, stageFor(), stateOf(), WRITES, { Client } (+6 more)

### Community 176 - "Intent: run RFactory in the factory cluster like the other Factory services"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decided, Intent: run RFactory in the factory cluster like the other Factory services, Open questions, Problem, Proposed outcome

### Community 177 - "connect"
Cohesion: 0.18
Nodes (12): createGateway(), call(), numberFrom(), snapshot(), assert, { createGateway }, { createSessions }, { makeRedactor } (+4 more)

### Community 178 - "Spec: Phase 0, the Linux call test"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Context for later phases (not decided here), Decisions on the intent's Phase 0 questions, Design, Goal, Pass / fail, Risks, Spec: Phase 0, the Linux call test (+1 more)

### Community 179 - "Intent: A face for the bot that talks when it speaks"
Cohesion: 0.22
Nodes (8): Affected users and systems, Constraints, Decisions (owner, 2026-11-17), Intent: A face for the bot that talks when it speaks, Open questions, Problem, Proposed outcome (first slice), Source of the portraits

### Community 180 - "github-read.js"
Cohesion: 0.36
Nodes (6): boundedJson(), createGithubRead(), newest(), request(), repoUrl(), { TextDecoder }

### Community 181 - "Intent: an MCP server for agents, slice A: read RFactory with a read key"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: an MCP server for agents, slice A: read RFactory with a read key, Open questions, Problem, Proposed outcome

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
Cohesion: 0.46
Nodes (7): agent_fixture(), FAKE_LOG, fixture(), PATH, refused(), run(), bootstrap-secrets.test.sh script

### Community 188 - "allowlist.js"
Cohesion: 0.19
Nodes (15): ACTIONS, bounded(), canonical(), CREATE_STATUSES, { createHash }, criteria(), FIELDS, INVESTIGATION_FIELDS (+7 more)

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

### Community 195 - "ref_node_crypto"
Cohesion: 0.29
Nodes (6): Approval (2026-11-27), Decisions (the approved intent and spec), Deviations, Plan: enforce an egress limit for the RFactory pod, Rollback, Tests

### Community 196 - "stun.test.js"
Cohesion: 0.29
Nodes (4): assert, dgram, { stunProbe }, test

### Community 197 - "ref_node_http"
Cohesion: 0.29
Nodes (3): http, [portA, portB], state

### Community 199 - "theme.js"
Cohesion: 0.67
Nodes (3): applyTheme(), dark, observer

### Community 203 - "Intent: finish the "Factory" rename and stop false wakes at a caption block start"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: finish the "Factory" rename and stop false wakes at a caption block start, Open questions, Problem, Proposed outcome

### Community 206 - "Intent: redact credentials that wrap across log lines"
Cohesion: 0.36
Nodes (10): Steps, handleAction(), loadActions(), loadPanels(), loadReview(), openPage(), renderActions(), run() (+2 more)

### Community 207 - "bootstrap-secrets.sh"
Cohesion: 0.83
Nodes (3): env_of(), bootstrap-secrets.sh script, write_secret()

### Community 208 - "createHearing"
Cohesion: 0.09
Nodes (21): createHearing(), assert, { createHearing }, fakeClock(), setup(), test, Decisions (the approved intent and spec, including the spec's amendment), Deviations (+13 more)

### Community 210 - "Intent: Enforce an egress limit for the RFactory pod"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: Enforce an egress limit for the RFactory pod, Open questions, Proposed outcome

### Community 211 - "mesh"
Cohesion: 0.33
Nodes (6): mesh, anchors, file, sha256, triangles, f17

### Community 212 - "move"
Cohesion: 0.33
Nodes (6): move, C, JL, JR, LB, LM

### Community 213 - "Intent: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (approved 2026-11-27), Intent: the call Chrome runs with its sandbox on, so Meet admits the bot, Open questions, Problem, Proposed outcome

### Community 214 - "Plan: finish the "Factory" rename and stop false wakes at a caption block start"
Cohesion: 0.29
Nodes (6): Decisions (the approved intent and spec), Deviations, Plan: finish the "Factory" rename and stop false wakes at a caption block start, Rollback, Steps, Tests

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
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: the bot hears in audio mode, and joins Meet on the first try, Open questions, Problem, Proposed outcome

### Community 237 - "events.js"
Cohesion: 0.28
Nodes (8): addressBits(), assert, assertPolicySchema(), { buildPolicy }, cidrContains(), input, ranges, test

### Community 238 - "join"
Cohesion: 0.10
Nodes (21): join(), Affected users and systems, Candidate causes, and what the code says, Constraints, Decisions (2026-11-27), How a caption becomes a question today, Intent: the first question after the bot joins is heard in Meet captions mode, Open questions (+13 more)

### Community 240 - "shares.test.js"
Cohesion: 0.13
Nodes (13): assert, { connect }, { createGithubSource }, dir, fs, gone(), os, path (+5 more)

### Community 241 - "kyverno-scope.test.js"
Cohesion: 0.25
Nodes (3): extendedPointerEvent(), pointerEvent(), clientToElement()

### Community 242 - "Spec: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Design, Risks, Spec: the call Chrome runs with its sandbox on, so Meet admits the bot, Verification

### Community 243 - "checkClaudeHome"
Cohesion: 0.33
Nodes (6): approveClaude(), runClaude(), checkClaudeHome(), hasOverride(), claudeHash(), Claude login: the shared `factory-cli-creds`, like CFactory

### Community 244 - "ollama-standup.js"
Cohesion: 0.22
Nodes (8): listTools(), Decisions (2026-11-27), Open questions, Out of scope, Plan: the web page gives a standup for a GitHub repo, with no Factory (slice "web-github" of #2), Rollback, Tests, Where #2 stands

### Community 245 - "createClaudeBrain"
Cohesion: 0.22
Nodes (8): Approval (2026-11-27), Decisions (approved intent and spec, as they apply to slice B), Deviations, Open questions, Plan: project-aware calls, slice B (writes for every project), Rollback, State on 2026-11-27 (checked read-only), Tests

### Community 246 - "@modelcontextprotocol/sdk"
Cohesion: 0.33
Nodes (4): { ListToolsRequestSchema, CallToolRequestSchema }, { Server }, { StdioServerTransport }, @modelcontextprotocol/sdk

### Community 247 - "items.js"
Cohesion: 0.15
Nodes (12): FAIL, failing(), labelNames(), logins(), mapGithub(), STATES, assert, { mapGithub, summarise } (+4 more)

### Community 248 - "cap"
Cohesion: 0.67
Nodes (3): cap(), collect(), walk()

### Community 249 - "loadShares"
Cohesion: 0.83
Nodes (4): handleShare(), loadShares(), renderShare(), shareStoreOf()

### Community 251 - "scope.js"
Cohesion: 0.16
Nodes (12): DESTINATIONS, fs, LISTEN, { makeRedactor }, name(), path, { toWhisperLanguage }, toWhisperLanguage() (+4 more)

### Community 252 - "Plan: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.57
Nodes (6): cidr(), contains(), ipValue(), net, preview(), validatePreview()

### Community 257 - "Spec: Phase 3, act on the Factories from the call"
Cohesion: 0.40
Nodes (4): Alternatives rejected, Risks, Spec: Phase 3, act on the Factories from the call, Verification

### Community 259 - "profiles.js"
Cohesion: 0.50
Nodes (3): fs, LABEL, { randomUUID, hkdfSync }

### Community 260 - "wireProjectCall"
Cohesion: 0.83
Nodes (4): wireProjectCall(), open(), refresh(), send()

## Knowledge Gaps
- **40 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1934 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Websock` connect `.rQwait` to `rfb.js`, `cli.test.js`, `Design`, `Spec: Agent workspace, a disposable desktop per call`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `Steps` to `Intent: in-call agents, the model with live tools, provider chosen per call`, `createCallManager`, `has`, `makeRedactor`, `web server.js`, `createShareManager`, `createInvestigationManager`, `checkFacts`, `Spec: Agent workspace, a disposable desktop per call`, `createActionManager`, `rfactory-standup.js`, `Steps`, `Steps`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Should `rfb.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06207482993197279 - nodes in this community are weakly interconnected._
- **Why does `Display` connect `Display` to `rfb.js`, `createInvestigationManager`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Should `test/call.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07765151515151515 - nodes in this community are weakly interconnected._