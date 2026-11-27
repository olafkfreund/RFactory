# Graph Report - RFactory-t27  (2026-11-27)

## Corpus Check
- 332 files · ~506,843 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 10, .nix 6, .css 4)

## Summary
- 3774 nodes · 6776 edges · 244 communities (202 shown, 42 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 982 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `844aa905`
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
- index.js
- checkFacts
- createStt
- test desktop-ui.test.js
- guard.test.js
- RFB
- runner runner.test.js
- k8s-policy.js
- error
- github.test.js
- runner runner.js
- cli.test.js
- test server.test.js
- test brain.test.js
- test avatar-state.test.js
- agent-tools.js
- .rQwait
- standup.test.js
- Plan: in-call agents, slice 1: live read-only lookups
- rfactory-standup.js
- How the bot hears
- web server.js
- lookups.test.js
- share.test.js
- test claude-cli.test.js
- avatar-renderer.test.js
- tts.test.js
- client.test.js
- profiles.test.js
- agent-tools.js
- stt-bridge.test.js
- deflate.js
- cfactory-write.test.js
- kyverno-scope.test.js
- verify verify.test.js
- agents.test.js
- speak
- makeRedactor
- inflate.js
- verify net.sh
- verify profiles.sh
- lookup-endpoint.test.js
- running
- spike hello-call.test.js
- logging.js
- vm-call.test.js
- createInvestigationManager
- kubevirt.test.js
- createProxy
- runner protocol.js
- investigations.test.js
- proxy.js
- Design
- share-desktop.test.js
- .text
- logging.js
- reaper reaper.test.js
- Spec: call the bot "Factory"
- Steps
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
- agents.test.js
- Display
- ref_node_fs
- Design
- spike spike/package.json
- C5. Tools and wrapper (`web/agent-tools.js`)
- test run.test.js
- Profiles
- web/call.js
- core/package.json
- agent-endpoint.js
- bot run()
- desktop.test.js
- scope.js
- test/board.test.js
- desktop desktop/package.json
- composeWrites
- ref_node_path
- Spec: an approved, read-only Claude investigation from the call
- redact.js
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
- gateway.js
- createActionManager
- des.js
- shell-browser.test.js
- gateway.test.js
- redact.js
- boundary.test.js
- agent-endpoint.test.js
- Intent: call the bot "Factory"
- RSAAESAuthenticationState
- error
- Websock
- verify e2e.sh
- H264Decoder
- k3d k11.sh
- k3d mk-tls.sh
- Plan: an MCP server for agents, slice A: read RFactory with a read key
- verify liveview.sh
- Keyboard
- avatars.test.js
- ._updateConnectionState
- GestureHandler
- cfactory.js
- Steps
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
- util.js
- origin
- Intent: an MCP server for agents, slice A: read RFactory with a read key
- Design
- web/package.json
- md5.js
- TightDecoder
- items.test.js
- Design
- Desktop VMs on the k3d factory cluster
- desktop-routes.test.js
- eyes
- pod.test.js
- source-guard.test.js
- Socket
- teams-tap-spike.js
- Design
- stt.test.js
- Plan: Phase 0, the Linux call test
- Intent: run a Claude terminal from the call, and show it
- Steps
- cfactory-write.js
- Intent: run RFactory in the factory cluster like the other Factory services
- connect
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
- k14 results: agent workspace desktops on k3d with KubeVirt
- Intent: an MCP server for agents, slice A: read RFactory with a read key
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
- stt-languages.test.js
- review.js
- RFactory
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
- HextileDecoder
- mesh
- move
- Intent: the call Chrome runs with its sandbox on, so Meet admits the bot
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
- makeTable
- Buf16
- Buf32
- Buf8
- deflateInfo
- inflateInfo
- events.js
- join
- check-egress.sh
- Spec: A face for the bot that talks when it speaks
- createGateway
- Spec: the call Chrome runs with its sandbox on, so Meet admits the bot
- JPEGDecoder

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `createLifecycle()` - 45 edges
3. `makeRedactor()` - 41 edges
4. `Steps` - 41 edges
5. `createInvestigationManager()` - 37 edges
6. `checkFacts()` - 33 edges
7. `createCallManager()` - 33 edges
8. `Display` - 32 edges
9. `Websock` - 32 edges
10. `run()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `Proposed outcome` --references--> `propose()`  [INFERRED]
  intent/2026-11-27-27-mcp-server.md → core/src/brains/claude-cli.js
- `3. Tests` --references--> `createHearing()`  [INFERRED]
  spec/2026-11-26-62-bot-name-factory.md → core/src/call/hearing.js
- `Verification` --references--> `heard()`  [INFERRED]
  spec/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `2. The wake rule (`core/src/call/hearing.js`)` --references--> `heard()`  [INFERRED]
  spec/2026-11-26-62-bot-name-factory.md → core/src/call/hearing.js
- `Decisions carried over from the approved spec` --references--> `toModel()`  [INFERRED]
  plan/2026-11-17-2-standalone-mode.md → core/src/redact.js

## Import Cycles
- None detected.

## Communities (244 total, 42 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Design, Hearing: wake phrase and end of a question, Packaging, Risks, Spec: Phase 1b, a voice standup in Google Meet, Speech (TTS), The bot process (`bot/run.js`) (+3 more)

### Community 2 - "rfb.js"
Cohesion: 0.06
Nodes (19): CopyRectDecoder, RawDecoder, RREDecoder, ZlibDecoder, Deflator, encodings, _buildExtendedClipboardFlags(), clientCutText() (+11 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.08
Nodes (18): assert, { createCallManager }, { createInvestigationManager }, { EventEmitter }, fakeClock(), finishSpeech(), flush(), fs (+10 more)

### Community 4 - "public app.js"
Cohesion: 0.05
Nodes (69): Deviations from the spec (for approval with this plan), ago(), clear(), clock(), decide(), decideInvestigation(), decideShare(), el() (+61 more)

### Community 5 - "createCallManager"
Cohesion: 0.25
Nodes (21): Steps, createCallManager(), addressed(), answer(), armQuiet(), audio(), drain(), incoming() (+13 more)

### Community 6 - "claude-cli.js"
Cohesion: 0.13
Nodes (14): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, LOOKUP_ERRORS, LOOKUP_SYSTEM_PROMPT (+6 more)

### Community 7 - "createLifecycle"
Cohesion: 0.11
Nodes (35): createLifecycle(), accept(), action(), allowAccept(), attachAgent(), boot(), callAttach(), cancel() (+27 more)

### Community 8 - "index.js"
Cohesion: 0.07
Nodes (34): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+26 more)

### Community 9 - "checkFacts"
Cohesion: 0.09
Nodes (15): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+7 more)

### Community 10 - "createStt"
Cohesion: 0.25
Nodes (6): Environment and scope reference, Per-call worker environment variables (set internally), Scope fields (`RFACTORY_SCOPE_FILE`), Web server environment variables, createStt(), fs

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "guard.test.js"
Cohesion: 0.13
Nodes (14): assert, { buildPolicy }, cniResult(), entry, { execFileSync }, fake(), fs, https (+6 more)

### Community 13 - "RFB"
Cohesion: 0.07
Nodes (4): clientEncodings(), keyEvent(), RFB, xvpOp()

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 15 - "k8s-policy.js"
Cohesion: 0.05
Nodes (46): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+38 more)

### Community 16 - "error"
Cohesion: 0.25
Nodes (3): extendedPointerEvent(), pointerEvent(), clientToElement()

### Community 17 - "github.test.js"
Cohesion: 0.09
Nodes (24): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFileSync } (+16 more)

### Community 18 - "runner runner.js"
Cohesion: 0.09
Nodes (27): clearInterval(), createK8s(), { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade() (+19 more)

### Community 19 - "cli.test.js"
Cohesion: 0.20
Nodes (12): binding(), cidrFamily(), command(), apply(), { execFile }, execFileAsync, fs, https (+4 more)

### Community 20 - "test server.test.js"
Cohesion: 0.08
Nodes (21): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, { handleCall }, items, { loadRoles } (+13 more)

### Community 21 - "test brain.test.js"
Cohesion: 0.11
Nodes (20): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+12 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.11
Nodes (13): installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState(), meshAt() (+5 more)

### Community 23 - "agent-tools.js"
Cohesion: 0.08
Nodes (26): action, atom(), { CARD_KEY }, createAgentTools(), invoke(), descriptions, freshness, investigation (+18 more)

### Community 25 - "standup.test.js"
Cohesion: 0.21
Nodes (9): buildStandup(), { FAILED, mapCard }, speakStandupHeadline(), assert, build(), { buildStandup, speakStandupHeadline }, freshness(), { makeRedactor } (+1 more)

### Community 26 - "Plan: in-call agents, slice 1: live read-only lookups"
Cohesion: 0.29
Nodes (6): ctx(), Decisions (approved intent and spec, with the owner's amendments of 2026-11-26), Plan: in-call agents, slice 1: live read-only lookups, Rollback, Shared contracts (steps 2 to 6 all follow these), Tests

### Community 27 - "rfactory-standup.js"
Cohesion: 0.08
Nodes (35): { checkFacts }, count(), fs, main(), path, { setup }, ageOf(), approveClaude() (+27 more)

### Community 28 - "How the bot hears"
Cohesion: 0.12
Nodes (14): How the bot hears, Language, `listen` values and the per-platform `auto` rule, Privacy, Rollback, When own transcription is not configured, When the bot starts to hear (Meet captions), Agents (MCP) (+6 more)

### Community 29 - "web server.js"
Cohesion: 0.09
Nodes (36): Steps, Understanding and answering, 3. RFactory: one CFactory client, views per repository set (`core/src/sources/cfactory.js`), { buildStandup, speakStandupHeadline }, createReads(), bind(), standupBody(), describe() (+28 more)

### Community 30 - "lookups.test.js"
Cohesion: 0.08
Nodes (28): cap(), collect(), walk(), createLookups(), FACTORY, GITHUB, { mapCard }, specs (+20 more)

### Community 31 - "share.test.js"
Cohesion: 0.08
Nodes (30): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+22 more)

### Community 32 - "test claude-cli.test.js"
Cohesion: 0.13
Nodes (25): createClaudeBrain(), answerTurn(), checkDestination(), lookupTurn(), propose(), run(), stop(), summarize() (+17 more)

### Community 33 - "avatar-renderer.test.js"
Cohesion: 0.18
Nodes (6): assert, { buildRendererSource }, { chromium }, fs, path, test

### Community 34 - "tts.test.js"
Cohesion: 0.14
Nodes (14): assert, { createTts }, { EventEmitter }, fs, os, { PassThrough }, path, test (+6 more)

### Community 35 - "client.test.js"
Cohesion: 0.10
Nodes (16): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+8 more)

### Community 36 - "profiles.test.js"
Cohesion: 0.15
Nodes (12): admin, assert, fakeK8s(), fixture(), fs, { hkdfSync }, MASTER, os (+4 more)

### Community 37 - "agent-tools.js"
Cohesion: 0.14
Nodes (16): afterJoin(), captions(), Turning the camera on, A. The bot reports caption readiness (`bot/run.js`), Alternatives rejected, B. The manager holds the greeting (`web/call.js`), C. The call log places a miss (`web/call.js`), D. The page (`web/public/app.js`) (+8 more)

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

### Community 43 - "agents.test.js"
Cohesion: 0.09
Nodes (20): composeAgents(), agents, assert, cards, { Client }, compose(), { createApp, composeAgents, composeWrites, refuseKeyEnv }, fs (+12 more)

### Community 44 - "speak"
Cohesion: 0.15
Nodes (12): 1. The service: `rfactory-stt`, 2. In the bot (`bot/run.js`, both deployments): cut speech, send segments, 3. In the call manager (`web/call.js`): transcribe and hear, 4. The listen setting, 5. Packaging and deploy, Alternatives rejected, Design, Measured on p620 (2026-11-21) (+4 more)

### Community 45 - "makeRedactor"
Cohesion: 0.20
Nodes (16): makeRedactor(), logSafeWindow(), redactString(), toModel(), pemSpans(), assert, { makeRedactor }, test (+8 more)

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
Cohesion: 0.13
Nodes (10): DESKTOP, createLookupEndpoint(), assert, { Client }, { createLookupEndpoint }, { DESKTOP }, http, { StreamableHTTPClientTransport } (+2 more)

### Community 50 - "running"
Cohesion: 0.08
Nodes (32): idle(), setCameraRenderer(), source(), Deviations after merge, Deviations (Codex review of the approved plan, 2026-11-17), Plan: A face for the bot that talks when it speaks, Rollback, Steps (+24 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.07
Nodes (23): { buildRendererSource }, { CALL_EVENTS }, crypto, fs, { installSttBridge }, { makeRedactor }, os, path (+15 more)

### Community 52 - "logging.js"
Cohesion: 0.09
Nodes (5): toSigned32bit(), toUnsigned32bit(), DataChannel, rawChannelProps, ReadyStates

### Community 53 - "vm-call.test.js"
Cohesion: 0.17
Nodes (10): assert, { createVmSpawn }, { Duplex }, { test }, createVmSpawn(), { EventEmitter }, firstLine(), { PassThrough } (+2 more)

### Community 54 - "createInvestigationManager"
Cohesion: 0.11
Nodes (46): 6. Project ids on proposals and record lines, count(), COUNT_CLAIM, createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog() (+38 more)

### Community 55 - "kubevirt.test.js"
Cohesion: 0.14
Nodes (11): assert, { createAgent }, { createCallWorker }, { createControl }, { dial }, { encode, createDecoder }, net, { parseCmdline } (+3 more)

### Community 56 - "createProxy"
Cohesion: 0.23
Nodes (18): checkedAddresses(), createApi(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect() (+10 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.24
Nodes (16): board(), boolean(), columns, count(), exact(), identity, log(), login() (+8 more)

### Community 59 - "investigations.test.js"
Cohesion: 0.14
Nodes (18): approve(), assert, { createInvestigationManager }, { createRecord }, fs, { loadRoles }, { makeRedactor }, os (+10 more)

### Community 60 - "proxy.js"
Cohesion: 0.16
Nodes (15): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, inRange() (+7 more)

### Community 61 - "Design"
Cohesion: 0.13
Nodes (15): 3. Shared reads (the one control API), 4. The tools, 5. What an agent sees: the wrapper, 7. Limits and the page (constraint "agents must not get in the page's way"), 9. Deployment, Alternatives rejected, Decisions (2026-11-27), Design (+7 more)

### Community 62 - "share-desktop.test.js"
Cohesion: 0.24
Nodes (7): createShareDesktop(), schedule(), stopPolling(), assert, { createShareDesktop }, setup(), test

### Community 64 - "logging.js"
Cohesion: 0.12
Nodes (20): label(), stopShare(), exec(), hosts(), Decisions carried over from the approved spec, Steps, Alternatives rejected, Answers to the intent's open questions (+12 more)

### Community 65 - "reaper reaper.test.js"
Cohesion: 0.17
Nodes (13): createReaper(), leaseStale(), tick(), fs, main(), assert, { createReaper }, fake() (+5 more)

### Community 66 - "Spec: call the bot "Factory""
Cohesion: 0.20
Nodes (9): 1. The name, everywhere a person sees or hears it, 2. The wake rule (`core/src/call/hearing.js`), 3. Tests, Alternatives rejected, Amendment (owner, 2026-11-26): share requests in natural words (#63), Design, Risks, Spec: call the bot "Factory" (+1 more)

### Community 67 - "Steps"
Cohesion: 0.22
Nodes (9): tools(), Before step 1 (gates, all needed), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 1a, a text standup in the web UI, Rollback, Steps, Tests (+1 more)

### Community 68 - "ref_node_assert"
Cohesion: 0.10
Nodes (16): toSpeech(), assert, fs, path, root, test, assert, { loadRoles } (+8 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.12
Nodes (8): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, { makeRedactor }, reply(), repos, test

### Community 70 - "agent/call.test.js"
Cohesion: 0.10
Nodes (17): createCallWorker(), { createShare, callLaunchArgs }, fs, { PassThrough }, assert, { createCallWorker, withProxy, MEET_GUEST, TEAMS_CAPTIONS }, { EventEmitter }, fixture() (+9 more)

### Community 71 - "proxy.test.js"
Cohesion: 0.13
Nodes (11): assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard, os (+3 more)

### Community 72 - "loadScope"
Cohesion: 0.10
Nodes (20): source, commit, path, repo, DESTINATIONS, fs, LISTEN, loadScope() (+12 more)

### Community 73 - "bot bot/package.json"
Cohesion: 0.14
Nodes (13): dependencies, playwright-core, @vibeconferencing/calls, engines, node, playwright-core, @vibeconferencing/calls, license (+5 more)

### Community 74 - "Design"
Cohesion: 0.12
Nodes (16): checkClaudeHome(), hasOverride(), Alternatives rejected, Claude login: the shared `factory-cli-creds`, like CFactory, Design, Images: built, signed and promoted by CI, like CFactory, One pod, as today, Order and cutover (+8 more)

### Community 75 - "trees.js"
Cohesion: 0.16
Nodes (28): bi_flush(), bi_reverse(), bi_windup(), build_bl_tree(), build_tree(), compress_block(), copy_block(), d_code() (+20 more)

### Community 76 - "runner k8s-lifecycle.test.js"
Cohesion: 0.10
Nodes (16): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+8 more)

### Community 77 - "web live-view.test.js"
Cohesion: 0.17
Nodes (10): assert, clientSession, { createApp }, fbUpdate, includes(), { loadRoles }, net, start() (+2 more)

### Community 78 - "agents.test.js"
Cohesion: 0.06
Nodes (38): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass** (+30 more)

### Community 80 - "ref_node_fs"
Cohesion: 0.10
Nodes (16): fs, os, path, assert, { createProfile }, KEY, { test }, fs (+8 more)

### Community 81 - "Design"
Cohesion: 0.06
Nodes (32): gateway(), Affected users and systems, Constraints, Decisions (2026-11-27), Intent: Enforce an egress limit for the RFactory pod, Open questions, Problem, Proposed outcome (+24 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "C5. Tools and wrapper (`web/agent-tools.js`)"
Cohesion: 0.22
Nodes (9): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+1 more)

### Community 84 - "test run.test.js"
Cohesion: 0.11
Nodes (12): assert, audioJoined(), { EventEmitter }, fs, joined(), { PassThrough }, path, { run } (+4 more)

### Community 85 - "Profiles"
Cohesion: 0.05
Nodes (50): fs, LABEL, name(), Profiles, { randomUUID, hkdfSync }, The action record, Alternatives rejected, Control-channel additions (an additive change to #3) (+42 more)

### Community 86 - "web/call.js"
Cohesion: 0.10
Nodes (23): SELF_NAMES, resolveListen(), BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts, checkFactsDetailed }, emitLimits(), lookupAnswer(), { createHearing, SELF_NAMES } (+15 more)

### Community 87 - "core/package.json"
Cohesion: 0.17
Nodes (11): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+3 more)

### Community 88 - "agent-endpoint.js"
Cohesion: 0.07
Nodes (31): event(), heard(), Captions vs own transcription, Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text), Open questions (+23 more)

### Community 89 - "bot run()"
Cohesion: 0.17
Nodes (24): buildRendererSource(), pageLeft(), run(), abandon(), discardOpen(), failureReport(), guestHelper(), idleAvatar() (+16 more)

### Community 90 - "desktop.test.js"
Cohesion: 0.18
Nodes (11): speechLevel(), Decisions carried over (approved intent and spec), AI disclosure, Cost, Design, Licence (owner decision 2: the whole repository is AGPL-3.0), Packaging, Portraits and notices (+3 more)

### Community 91 - "scope.js"
Cohesion: 0.14
Nodes (9): assert, base, { createGateway }, fs, { loadScope }, { makeRedactor }, os, path (+1 more)

### Community 92 - "test/board.test.js"
Cohesion: 0.13
Nodes (16): COLUMNS, projectBoard(), { repositoryOf }, STAGES, assert, callTool(), card(), { createCfactorySource } (+8 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "composeWrites"
Cohesion: 0.20
Nodes (9): nonce(), viewData(), Decisions carried over (approved intent and spec), Deviations, Gates, Plan: Show the CFactory board in the call, Rollback, Tests (+1 more)

### Community 95 - "ref_node_path"
Cohesion: 0.17
Nodes (9): fs, path, assert, { createRecord }, fs, { makeRedactor }, os, path (+1 more)

### Community 96 - "Spec: an approved, read-only Claude investigation from the call"
Cohesion: 0.20
Nodes (9): 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), Alternatives rejected, Design, Findings this design rests on (checked 2026-11-19), Order and dependencies, Risks, Spec: an approved, read-only Claude investigation from the call (+1 more)

### Community 97 - "redact.js"
Cohesion: 0.15
Nodes (9): http, { ListToolsRequestSchema, CallToolRequestSchema }, { randomBytes, timingSafeEqual }, { Server }, { StreamableHTTPServerTransport }, { ListToolsRequestSchema, CallToolRequestSchema }, { Server }, { StdioServerTransport } (+1 more)

### Community 98 - "agent-endpoint.js"
Cohesion: 0.19
Nodes (14): BAD, createAgentEndpoint(), find(), handle(), valid(), { createHash, timingSafeEqual }, digest(), errorResult() (+6 more)

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
Cohesion: 0.35
Nodes (12): createApi(), get(), createGuard(), counters(), heartbeat(), reconcile(), reconcileOnce(), server() (+4 more)

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
Cohesion: 0.14
Nodes (13): Alternatives rejected, Design, Effects are derived, not trusted, Execution: re-check, claim, record, dispatch once, Pending actions and approval, Reading CFactory's results, Recognising an action request, Risks (+5 more)

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "gateway.js"
Cohesion: 0.24
Nodes (10): { mapGithub, summarise, STATES }, NAMES, { origin }, SCHEMAS, FAIL, failing(), labelNames(), logins() (+2 more)

### Community 112 - "createActionManager"
Cohesion: 0.07
Nodes (44): Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Steps, Tests, Waves, Facts checked in the real repos (+36 more)

### Community 113 - "des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 114 - "shell-browser.test.js"
Cohesion: 0.12
Nodes (11): @rfactory/core, { deriveEffects, describe }, FINAL, { randomUUID }, { validate, hashPayload, canonical }, assert, { chromium }, { createApp } (+3 more)

### Community 115 - "gateway.test.js"
Cohesion: 0.29
Nodes (3): http, [portA, portB], state

### Community 116 - "redact.js"
Cohesion: 0.18
Nodes (14): base64(), JOINED_RULES, jwtSpans(), KEY_VALUE_AT, keyValueAt(), keyValueMatch(), keyValueSpans(), occurrences() (+6 more)

### Community 117 - "boundary.test.js"
Cohesion: 0.11
Nodes (12): assert, { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs, { loadRoles }, { makeRedactor } (+4 more)

### Community 118 - "agent-endpoint.test.js"
Cohesion: 0.15
Nodes (12): agents, assert, { Client }, { createAgentEndpoint }, fake, http, names, request() (+4 more)

### Community 119 - "Intent: call the bot "Factory""
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-26: "approved", with the recommendations), Intent: call the bot "Factory", Open questions, Problem, Proposed outcome

### Community 121 - "error"
Cohesion: 0.09
Nodes (27): releaseAttempt(), withProxy(), Affected users and systems, Constraints, Intent: see why Meet refuses the call bot, and recover from it, Open questions, Problem, Proposed outcome (+19 more)

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

### Community 127 - "Plan: an MCP server for agents, slice A: read RFactory with a read key"
Cohesion: 0.15
Nodes (12): Approval (2026-11-27), C1. Scope (`core/src/scope.js`), C2. Shared reads (`web/reads.js`), C3. Project ids on entries, C4. The listener (`core/src/agent-endpoint.js`), Contracts (fixed; steps refer to them), Deviations, Open questions (+4 more)

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 130 - "avatars.test.js"
Cohesion: 0.20
Nodes (8): assert, crypto, dir, fs, ids, manifest, path, test

### Community 131 - "._updateConnectionState"
Cohesion: 0.67
Nodes (3): crc32(), makeTable(), read_buf()

### Community 133 - "cfactory.js"
Cohesion: 0.24
Nodes (9): boundedFetch(), { Client }, createCfactorySource(), connect(), withClient(), within(), STATE, { StreamableHTTPClientTransport } (+1 more)

### Community 134 - "Steps"
Cohesion: 0.20
Nodes (9): listTools(), raw(), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains), Recorded GitHub inventory (pinned 1.14.0, captured 2026-11-17), Rollback, Steps (+1 more)

### Community 135 - "browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

### Community 137 - "has"
Cohesion: 0.15
Nodes (13): loadRoles(), has(), rolesOf(), commit(), Decisions carried over from the approved spec, Decisions for this plan, Deviations, Plan: v1 roles in code (admin, approver, member), slice "roles" of #2 (+5 more)

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

### Community 155 - "origin"
Cohesion: 0.33
Nodes (9): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), origin() (+1 more)

### Community 156 - "Intent: an MCP server for agents, slice A: read RFactory with a read key"
Cohesion: 0.27
Nodes (9): calls(), FAKE_ARGS, FAKE_CALLS, FAKE_OUT, FAKE_PROGRAM, fixture(), PATH, run() (+1 more)

### Community 157 - "Design"
Cohesion: 0.14
Nodes (14): mapCard(), 10. Intent constraints carried into slice 1, 1. Data comes from four CFactory read tools, all on the existing read key, 2. Scope: one rule, used everywhere, 3. Failure and freshness, 4. `core/src/standup.js` (new, pure): `buildStandup(cards, freshness)`, 6. Review (`core/src/review.js`, new, pure), 8. `core/src/sources/cfactory.js` (+6 more)

### Community 158 - "web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 159 - "md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 161 - "items.test.js"
Cohesion: 0.22
Nodes (5): assert, { mapGithub, summarise }, mapping, run(), test

### Community 162 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Source adapters (+2 more)

### Community 163 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.17
Nodes (11): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 8. Problems we hit (+3 more)

### Community 164 - "desktop-routes.test.js"
Cohesion: 0.10
Nodes (28): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+20 more)

### Community 165 - "eyes"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 166 - "pod.test.js"
Cohesion: 0.22
Nodes (7): assert, fs, os, path, realPod, { spawnSync }, test

### Community 167 - "source-guard.test.js"
Cohesion: 0.22
Nodes (7): assert, fs, guard, os, path, { spawnSync }, test

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 170 - "Design"
Cohesion: 0.11
Nodes (17): Decisions (the approved intent and spec), Deviations, Plan: finish the "Factory" rename and stop false wakes at a caption block start, Rollback, Steps, Tests, 1. The wake rule (`core/src/call/hearing.js:3`), 2. A rejected mention still ends the request before it (`hearing.js:50-71`) (+9 more)

### Community 171 - "stt.test.js"
Cohesion: 0.22
Nodes (6): assert, { createStt }, fs, os, path, test

### Community 172 - "Plan: Phase 0, the Linux call test"
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "Steps"
Cohesion: 0.22
Nodes (13): call(), view(), comments(), freshness(), scopedCards(), inScope(), repositoryOf(), Approved decisions (copied from the spec, so this plan stands alone) (+5 more)

### Community 175 - "cfactory-write.js"
Cohesion: 0.25
Nodes (7): { Client }, { deriveEffects }, fs, { makeRedactor }, STAGES, { StreamableHTTPClientTransport }, TOOLS

### Community 176 - "Intent: run RFactory in the factory cluster like the other Factory services"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decided, Intent: run RFactory in the factory cluster like the other Factory services, Open questions, Problem, Proposed outcome

### Community 177 - "connect"
Cohesion: 0.22
Nodes (7): assert, { createGateway }, { createSessions }, { makeRedactor }, running, scope, test

### Community 178 - "Spec: Phase 0, the Linux call test"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Context for later phases (not decided here), Decisions on the intent's Phase 0 questions, Design, Goal, Pass / fail, Risks, Spec: Phase 0, the Linux call test (+1 more)

### Community 179 - "Intent: A face for the bot that talks when it speaks"
Cohesion: 0.22
Nodes (8): Affected users and systems, Constraints, Decisions (owner, 2026-11-17), Intent: A face for the bot that talks when it speaks, Open questions, Problem, Proposed outcome (first slice), Source of the portraits

### Community 180 - "k14 results: agent workspace desktops on k3d with KubeVirt"
Cohesion: 0.22
Nodes (7): findVeth(), Decisions carried over from the approved spec revision, Deviations from the spec revision (Codex re-check and plan review, for approval with this plan), Plan: desktops as KubeVirt VMs in the k3d cluster (#3, revision), Rollback, Steps, Tests

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

### Community 188 - "core/test/actions.test.js"
Cohesion: 0.05
Nodes (51): ACTIONS, bounded(), canonical(), CREATE_STATUSES, { createHash }, criteria(), FIELDS, hashPayload() (+43 more)

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

### Community 195 - "stt-languages.test.js"
Cohesion: 0.38
Nodes (5): toWhisperLanguage(), WHISPER_LANGUAGES, assert, test, { WHISPER_LANGUAGES, toWhisperLanguage }

### Community 196 - "review.js"
Cohesion: 0.15
Nodes (17): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+9 more)

### Community 197 - "RFactory"
Cohesion: 0.43
Nodes (5): connect(), handshake(), main(), [mode, url], out()

### Community 199 - "theme.js"
Cohesion: 0.67
Nodes (3): applyTheme(), dark, observer

### Community 203 - "Intent: finish the "Factory" rename and stop false wakes at a caption block start"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: finish the "Factory" rename and stop false wakes at a caption block start, Open questions, Problem, Proposed outcome

### Community 206 - "Intent: redact credentials that wrap across log lines"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: redact credentials that wrap across log lines, Open questions, Problem, Proposed outcome

### Community 207 - "bootstrap-secrets.sh"
Cohesion: 0.83
Nodes (3): env_of(), bootstrap-secrets.sh script, write_secret()

### Community 208 - "createHearing"
Cohesion: 0.18
Nodes (12): createHearing(), assert, { createHearing }, fakeClock(), setup(), test, Decisions (the approved intent and spec, including the spec's amendment), Deviations (+4 more)

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
Cohesion: 0.48
Nodes (5): _capturedElemChanged(), _captureObserver, _captureProxy(), releaseCapture(), setCapture()

### Community 238 - "join"
Cohesion: 0.10
Nodes (21): join(), Affected users and systems, Candidate causes, and what the code says, Constraints, Decisions (2026-11-27), How a caption becomes a question today, Intent: the first question after the bot joins is heard in Meet captions mode, Open questions (+13 more)

### Community 240 - "Spec: A face for the bot that talks when it speaks"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Evidence this spec rests on, Risks, Spec: A face for the bot that talks when it speaks, Verification

### Community 241 - "createGateway"
Cohesion: 0.60
Nodes (5): createGateway(), call(), numberFrom(), snapshot(), setup()

### Community 242 - "Spec: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Design, Risks, Spec: the call Chrome runs with its sandbox on, so Meet admits the bot, Verification

## Knowledge Gaps
- **40 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1855 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Websock` connect `.rQwait` to `Design`, `rfb.js`, `logging.js`, `.flush`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `createLifecycle()` (e.g. with `lifecycle.js` and `action()`) actually correct?**
  _`createLifecycle()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `web server.js` to `Steps`, `review.js`, `createCallManager`, `Intent: in-call agents, the model with live tools, provider chosen per call`, `loadScope`, `agents.test.js`, `makeRedactor`, `createActionManager`, `running`, `Profiles`, `createInvestigationManager`, `.rQwait`, `error`, `rfactory-standup.js`, `core/test/actions.test.js`, `Design`, `composeWrites`, `Plan: an MCP server for agents, slice A: read RFactory with a read key`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Should `rfb.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06037414965986394 - nodes in this community are weakly interconnected._
- **Why does `makeRedactor()` connect `makeRedactor` to `test/call.test.js`, `test brain.test.js`, `standup.test.js`, `rfactory-standup.js`, `web server.js`, `lookups.test.js`, `test claude-cli.test.js`, `cfactory-write.test.js`, `Steps`, `cfactory-write.js`, `connect`, `spike hello-call.test.js`, `core/test/actions.test.js`, `Steps`, `test cfactory.test.js`, `loadScope`, `Design`, `bot run()`, `scope.js`, `test/board.test.js`, `createGateway`, `redact.js`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._