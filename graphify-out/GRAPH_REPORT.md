# Graph Report - RFactory-t22  (2026-11-28)

## Corpus Check
- 367 files · ~617,722 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 10, .nix 6, .css 4)

## Summary
- 4293 nodes · 7807 edges · 279 communities (243 shown, 36 thin omitted)
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 1248 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8f14644d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verify lib.sh
- Design
- rfb.js
- test/call.test.js
- web/test/notes.test.js
- createCallManager
- claude-cli.js
- createLifecycle
- Steps
- cli.test.js
- RFactory
- test desktop-ui.test.js
- guard.test.js
- RFB
- runner runner.test.js
- agent-tools.js
- e2e-inventory.test.js
- heard
- runner runner.js
- core/test/actions.test.js
- test server.test.js
- brain.test.js
- test avatar-state.test.js
- Profiles
- .off
- agents.test.js
- Steps
- rfactory-standup.js
- error
- server.js
- lookups.test.js
- share.test.js
- claude-cli.test.js
- ref_node_assert
- tts.test.js
- client.test.js
- app.test.js
- captions
- stt-bridge.test.js
- deflate.js
- cfactory-write.test.js
- kyverno-scope.test.js
- verify verify.test.js
- createGrantManager
- Spec: the bot hears the call itself (its own speech-to-text)
- makeRedactor
- inflate.js
- verify net.sh
- verify profiles.sh
- lookup-endpoint.test.js
- schedule.test.js
- spike hello-call.test.js
- app.js
- ref_node_stream
- createInvestigationManager
- index.js
- createProxy
- runner protocol.js
- createActionManager
- logging.js
- proxy.js
- Design
- share-desktop.test.js
- a
- agent-endpoint.js
- reaper reaper.test.js
- agent-endpoint.test.js
- e2e-inventory.js
- ref_node_path
- test cfactory.test.js
- agent/call.test.js
- proxy.test.js
- profiles.test.js
- bot bot/package.json
- review.js
- trees.js
- runner k8s-lifecycle.test.js
- web live-view.test.js
- checkFacts
- Display
- standup.test.js
- Design
- spike spike/package.json
- k14 results: agent workspace desktops on k3d with KubeVirt
- test run.test.js
- createShareManager
- web/call.js
- core/package.json
- ._handleMouse
- bot run()
- Design
- loadScope
- client.js
- desktop desktop/package.json
- kubevirt.test.js
- ref_node_fs
- Design
- Design
- shell-browser.test.js
- items.test.js
- .rQwait
- k3d k14-env.sh
- verify handover.sh
- Intent: project-aware calls
- protocol.test.js
- Design
- verify lifecycle.sh
- Design
- vnc.test.js
- web/test/actions.test.js
- k3d gate.sh
- Plan: an MCP server for agents, slice A: read RFactory with a read key
- Steps
- des.js
- Design
- control.js
- github.test.js
- boundary.test.js
- Design
- Intent: call the bot "Factory"
- RSAAESAuthenticationState
- inflator.js
- Steps
- verify e2e.sh
- H264Decoder
- k3d k11.sh
- k3d mk-tls.sh
- viewer/board.test.js
- verify liveview.sh
- jira.test.js
- k8s-policy.js
- github-web.test.js
- GestureHandler
- mapCard
- web/package.json
- browser.js
- run.js
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
- Steps
- check-egress.test.sh
- queueSpeech
- avatar-renderer.test.js
- md5.js
- TightDecoder
- readiness.sh
- createClaudeBrain
- Desktop VMs on the k3d factory cluster
- desktop-routes.test.js
- eyes
- Keyboard
- .text
- Socket
- teams-tap-spike.js
- Plan: finish the "Factory" rename and stop false wakes at a caption block start
- Intent: clean up the `e2e-*` test repositories (GitHub and CFactory)
- Plan: Phase 0, the Linux call test
- Intent: run a Claude terminal from the call, and show it
- Spec: one live test call with 5-10 team members talking to Factory
- @modelcontextprotocol/sdk
- Intent: run RFactory in the factory cluster like the other Factory services
- desktop.test.js
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
- createCfactorySource
- Intent: an MCP server for agents, slice A: read RFactory with a read key
- ZRLEDecoder
- Intent: Meeting agent Phase 3, act on the Factories from the call
- Intent: Show the Factories in the call
- Intent: Meeting agent Phase 1b, a voice standup in Google Meet
- Intent: Review and control the Factories from the standup and the bot
- bootstrap-secrets.test.sh
- wireElevation
- Intent: Meeting agent web app for the Factories
- Intent: Standalone mode, without the Factories
- Intent: Agent workspace, a disposable desktop per call
- Intent: Meeting agent Phase 1a, a text standup in the web UI
- Third-party notices
- portraits
- ok
- source-guard.test.js
- ref_node_http
- LegacyCrypto
- theme.js
- RSACipher
- CLAUDE.md
- .claude/CLAUDE.md
- Intent: finish the "Factory" rename and stop false wakes at a caption block start
- check-image-stt.sh
- SHELL_INVENTORY.md
- Intent: standup notes: record what is agreed, turn it into cards, publish the notes
- bootstrap-secrets.sh
- hearing.test.js
- assert-signature-location.sh
- lookup-endpoint.js
- mesh
- move
- Intent: the call Chrome runs with its sandbox on, so Meet admits the bot
- Plan: project-aware calls, slice B (writes for every project)
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
- stt.test.js
- join
- check-egress.sh
- .expired
- Intent: one live test call with 5-10 team members talking to Factory
- Spec: the call Chrome runs with its sandbox on, so Meet admits the bot
- callevents.js
- loadScope
- Standalone mode S1: end-to-end results (#2 step 10)
- lifecycle.js
- gateway.js
- Design
- createShare
- observer.js
- scope.js
- Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence
- Plan: `e2e-*` cleanup, first slice: the read-only inventory script
- origin
- Intent: elevated calls, slice 1: pair a call in the portal and hold a grant for it
- Deviations (Codex review of the approved plan, 2026-11-17)
- cfactory-write.js
- Plan: the call Chrome runs with its sandbox on, so Meet admits the bot
- handleCall
- Design
- Intent: redact credentials that wrap across log lines
- running
- github-read.js
- Spec: call the bot "Factory"
- fill_window
- Steps
- Steps
- compare
- test/board.test.js
- Plan: Elevated calls, slice 1 — portal-verified pairing, schedule, and grant
- renderInvestigation
- Intent: in-call agents, the model with live tools, provider chosen per call
- loadShares
- ollama-standup.js
- makeTable
- Intent: the bot hears the call itself (its own speech-to-text)
- Plan: project-aware calls, slice A (project-aware reads)
- Spec: a read-only standup from one Jira project, on the page (first slice of #59)

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `makeRedactor()` - 47 edges
3. `createLifecycle()` - 45 edges
4. `createCallManager()` - 41 edges
5. `Steps` - 39 edges
6. `createInvestigationManager()` - 37 edges
7. `Steps` - 36 edges
8. `loadScope()` - 35 edges
9. `createApp()` - 35 edges
10. `checkFacts()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `B. The manager holds the greeting (`web/call.js`)` --references--> `captions()`  [INFERRED]
  spec/2026-11-27-56-first-question-captions.md → bot/run.js
- `Verification` --references--> `captions()`  [INFERRED]
  spec/2026-11-27-56-first-question-captions.md → bot/run.js
- `Steps` --references--> `event()`  [INFERRED]
  plan/2026-11-21-16-own-speech-to-text.md → bot/test/stt-bridge.test.js
- `Findings this design rests on (checked 2026-11-19)` --references--> `code()`  [INFERRED]
  spec/2026-11-19-18-claude-terminals.md → core/bin/e2e-inventory.js
- `Decisions carried over (approved intent and spec)` --references--> `hashPayload()`  [INFERRED]
  plan/2026-11-19-18-claude-terminals.md → core/src/actions/allowlist.js

## Import Cycles
- None detected.

## Communities (279 total, 36 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Design, Hearing: wake phrase and end of a question, Packaging, Risks, Spec: Phase 1b, a voice standup in Google Meet, Speech (TTS), Understanding and answering (+3 more)

### Community 2 - "rfb.js"
Cohesion: 0.06
Nodes (17): CopyRectDecoder, JPEGDecoder, RawDecoder, RREDecoder, ZlibDecoder, Deflator, encodings, _buildExtendedClipboardFlags() (+9 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.07
Nodes (24): hashLink(), assert, { createCallManager }, { createGrantManager }, { createInvestigationManager }, { EventEmitter }, fakeClock(), finishSpeech() (+16 more)

### Community 4 - "web/test/notes.test.js"
Cohesion: 0.10
Nodes (31): Contracts between the steps, createNotesManager(), approve(), closeIntake(), discard(), download(), edit(), emit() (+23 more)

### Community 5 - "createCallManager"
Cohesion: 0.26
Nodes (17): resolveListen(), Steps, createCallManager(), armQuiet(), audio(), captionSeen(), grantStatus(), incoming() (+9 more)

### Community 6 - "claude-cli.js"
Cohesion: 0.11
Nodes (18): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, LOOKUP_ERRORS, LOOKUP_SYSTEM_PROMPT (+10 more)

### Community 7 - "createLifecycle"
Cohesion: 0.11
Nodes (34): createLifecycle(), accept(), allowAccept(), attachAgent(), boot(), callAttach(), cancel(), cancelNow() (+26 more)

### Community 8 - "Steps"
Cohesion: 0.11
Nodes (34): base(), source(), Deviations, Decisions (approved intent and spec, as delivered in slice A), C5. Tools and wrapper (`web/agent-tools.js`), Steps, Choices made in this plan (for approval with it), Alternatives rejected (+26 more)

### Community 9 - "cli.test.js"
Cohesion: 0.09
Nodes (15): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+7 more)

### Community 10 - "RFactory"
Cohesion: 0.11
Nodes (16): a. The invitation, b. The timeline, c. The script, d. The score sheet, e. The results comment template, Multi-participant live test, The 10 questions, Agents (MCP) (+8 more)

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "guard.test.js"
Cohesion: 0.05
Nodes (55): binding(), cidrFamily(), command(), createApi(), get(), createGuard(), apply(), counters() (+47 more)

### Community 13 - "RFB"
Cohesion: 0.06
Nodes (5): clientEncodings(), enableContinuousUpdates(), RFB, setDesktopSize(), xvpOp()

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 15 - "agent-tools.js"
Cohesion: 0.07
Nodes (28): action, atom(), { CARD_KEY }, createAgentTools(), invoke(), descriptions, freshness, investigation (+20 more)

### Community 16 - "e2e-inventory.test.js"
Cohesion: 0.11
Nodes (23): assert, { build, hashOf, compare, compareAfter, main }, clone(), endpointsOf(), { EventEmitter }, fixture(), fs, ghFake() (+15 more)

### Community 17 - "heard"
Cohesion: 0.08
Nodes (32): captions(), heard(), Captions vs own transcription, How the bot hears, Language, `listen` values and the per-platform `auto` rule, Privacy, Rollback (+24 more)

### Community 18 - "runner runner.js"
Cohesion: 0.09
Nodes (22): clearInterval(), createK8s(), { bridgeViewOnly }, { createK8s }, { createLifecycle }, crypto, dgram, fs (+14 more)

### Community 19 - "core/test/actions.test.js"
Cohesion: 0.12
Nodes (25): ACTIONS, bounded(), canonical(), CREATE_STATUSES, { createHash }, criteria(), FIELDS, INVESTIGATION_FIELDS (+17 more)

### Community 20 - "test server.test.js"
Cohesion: 0.06
Nodes (29): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, GH_KEYS, ghItems, { handleCall } (+21 more)

### Community 21 - "brain.test.js"
Cohesion: 0.11
Nodes (19): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+11 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.11
Nodes (14): installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState(), meshAt() (+6 more)

### Community 23 - "Profiles"
Cohesion: 0.17
Nodes (5): fs, LABEL, name(), Profiles, { randomUUID, hkdfSync }

### Community 25 - "agents.test.js"
Cohesion: 0.09
Nodes (20): composeAgents(), agents, assert, cards, { Client }, compose(), { createApp, composeAgents, composeWrites, refuseKeyEnv }, fs (+12 more)

### Community 26 - "Steps"
Cohesion: 0.13
Nodes (20): hashPayload(), checkNote(), closeEvidence(), { FAILED }, { hashPayload }, KINDS, notesHash(), { reviewCard, ACTIVE } (+12 more)

### Community 27 - "rfactory-standup.js"
Cohesion: 0.13
Nodes (22): ageOf(), approveClaude(), causes(), { checkFacts }, { connect }, { createBrain }, { createCfactorySource }, { createClaudeBrain, ARGV: CLAUDE_ARGV } (+14 more)

### Community 28 - "error"
Cohesion: 0.11
Nodes (25): releaseAttempt(), code(), Affected users and systems, Constraints, Intent: see why Meet refuses the call bot, and recover from it, Open questions, Problem, Proposed outcome (+17 more)

### Community 29 - "server.js"
Cohesion: 0.09
Nodes (28): inScope(), nonce(), Deviations, Deviations, Steps, @rfactory/core, 3. RFactory: one CFactory client, views per repository set (`core/src/sources/cfactory.js`), { checkNote, sentence, headline, toMarkdown, notesHash } (+20 more)

### Community 30 - "lookups.test.js"
Cohesion: 0.09
Nodes (21): cap(), collect(), walk(), createLookups(), FACTORY, GITHUB, { mapCard }, specs (+13 more)

### Community 31 - "share.test.js"
Cohesion: 0.18
Nodes (8): assert, browser, { createShare, titleFor, callLaunchArgs, installCaptureGuard }, http, pick(), { test }, { URL_BOARD }, titleFor()

### Community 32 - "claude-cli.test.js"
Cohesion: 0.13
Nodes (16): claudeHash(), assert, { claudeHash, checkClaudeHome }, { createClaudeBrain }, { EventEmitter }, fs, lookup, lookupBrain() (+8 more)

### Community 33 - "ref_node_assert"
Cohesion: 0.10
Nodes (16): toSpeech(), assert, fs, path, root, test, assert, { loadRoles } (+8 more)

### Community 34 - "tts.test.js"
Cohesion: 0.13
Nodes (14): assert, { createTts }, { EventEmitter }, fs, os, { PassThrough }, path, test (+6 more)

### Community 35 - "client.test.js"
Cohesion: 0.11
Nodes (17): assert, { createHandler, createUpgrade }, { createRunnerClient }, { execFileSync }, fs, https, os, { PassThrough, Duplex } (+9 more)

### Community 36 - "app.test.js"
Cohesion: 0.10
Nodes (13): renderFooter(), ALPHA, assert, base, BETA, Node, notesShim(), page (+5 more)

### Community 37 - "captions"
Cohesion: 0.13
Nodes (15): afterJoin(), Steps, Turning the camera on, A. The bot reports caption readiness (`bot/run.js`), Alternatives rejected, B. The manager holds the greeting (`web/call.js`), D. The page (`web/public/app.js`), Decisions (2026-11-27) (+7 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.08
Nodes (11): installSttBridge(), assert, event(), fs, { installSttBridge }, path, RTCRtpReceiver, RTCRtpSender (+3 more)

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
Cohesion: 0.10
Nodes (19): assert, beats(), CHECKS, fs, http, INPUT, { join }, LIB (+11 more)

### Community 43 - "createGrantManager"
Cohesion: 0.16
Nodes (25): allows(), binding(), createGrantManager(), check(), clearCode(), clearGrant(), emit(), endCall() (+17 more)

### Community 44 - "Spec: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.17
Nodes (11): 1. The service: `rfactory-stt`, 2. In the bot (`bot/run.js`, both deployments): cut speech, send segments, 3. In the call manager (`web/call.js`): transcribe and hear, 4. The listen setting, 5. Packaging and deploy, Design, Measured on p620 (2026-11-21), Owner decisions taken with this spec (2026-11-21) (+3 more)

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

### Community 50 - "schedule.test.js"
Cohesion: 0.14
Nodes (18): { createHash, randomUUID }, createScheduleRegistry(), add(), list(), match(), remove(), save(), fs (+10 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.14
Nodes (10): botName(), path, run(), assert, { EventEmitter }, fs, os, path (+2 more)

### Community 52 - "app.js"
Cohesion: 0.11
Nodes (30): Deviations from the spec (for approval with this plan), ago(), clear(), clock(), el(), fill(), grantRefresh, INVESTIGATION_LIVE (+22 more)

### Community 53 - "ref_node_stream"
Cohesion: 0.17
Nodes (10): assert, { createVmSpawn }, { Duplex }, { test }, createVmSpawn(), { EventEmitter }, firstLine(), { PassThrough } (+2 more)

### Community 54 - "createInvestigationManager"
Cohesion: 0.07
Nodes (64): count(), COUNT_CLAIM, createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog(), endCall() (+56 more)

### Community 55 - "index.js"
Cohesion: 0.08
Nodes (27): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+19 more)

### Community 56 - "createProxy"
Cohesion: 0.24
Nodes (18): checkedAddresses(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect(), handleForward() (+10 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.23
Nodes (17): board(), boolean(), columns, count(), exact(), hosts(), identity, log() (+9 more)

### Community 58 - "createActionManager"
Cohesion: 0.20
Nodes (20): Steps, { closeEvidence }, createActionManager(), approve(), emit(), endCall(), expire(), finish() (+12 more)

### Community 59 - "logging.js"
Cohesion: 0.10
Nodes (4): HextileDecoder, DataChannel, rawChannelProps, ReadyStates

### Community 60 - "proxy.js"
Cohesion: 0.17
Nodes (14): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, inRange() (+6 more)

### Community 61 - "Design"
Cohesion: 0.08
Nodes (25): label(), stopShare(), exec(), Decisions carried over from the approved spec, Facts checked in the real repos, Open questions for the owner, Plan: Agent workspace, a disposable desktop per call (#3), Prerequisites (named revisions) (+17 more)

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

### Community 67 - "e2e-inventory.js"
Cohesion: 0.17
Nodes (22): build(), codes(), { createCfactorySource }, { createHash }, fail(), FIXED, fs, keyOf() (+14 more)

### Community 68 - "ref_node_path"
Cohesion: 0.09
Nodes (18): assert, crypto, dir, fs, ids, manifest, path, test (+10 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.11
Nodes (10): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, invReplies(), invWith(), { makeRedactor }, reply() (+2 more)

### Community 70 - "agent/call.test.js"
Cohesion: 0.16
Nodes (12): createCallWorker(), { createShare, callLaunchArgs }, fs, { PassThrough }, assert, { createCallWorker, withProxy, MEET_GUEST, TEAMS_CAPTIONS }, { EventEmitter }, fixture() (+4 more)

### Community 71 - "proxy.test.js"
Cohesion: 0.12
Nodes (12): createApi(), assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard (+4 more)

### Community 72 - "profiles.test.js"
Cohesion: 0.15
Nodes (12): admin, assert, fakeK8s(), fixture(), fs, { hkdfSync }, MASTER, os (+4 more)

### Community 73 - "bot bot/package.json"
Cohesion: 0.14
Nodes (13): dependencies, playwright-core, @vibeconferencing/calls, engines, node, playwright-core, @vibeconferencing/calls, license (+5 more)

### Community 74 - "review.js"
Cohesion: 0.15
Nodes (17): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+9 more)

### Community 75 - "trees.js"
Cohesion: 0.16
Nodes (28): bi_flush(), bi_reverse(), bi_windup(), build_bl_tree(), build_tree(), compress_block(), copy_block(), d_code() (+20 more)

### Community 76 - "runner k8s-lifecycle.test.js"
Cohesion: 0.19
Nodes (9): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+1 more)

### Community 77 - "web live-view.test.js"
Cohesion: 0.17
Nodes (10): assert, clientSession, { createApp }, fbUpdate, includes(), { loadRoles }, net, start() (+2 more)

### Community 78 - "checkFacts"
Cohesion: 0.10
Nodes (24): checkFacts(), checkFactsDetailed(), CLAIM, COUNT, { summarise }, WORDS, summarise(), assert (+16 more)

### Community 80 - "standup.test.js"
Cohesion: 0.13
Nodes (15): buildStandup(), { FAILED, mapCard }, speakStandupHeadline(), assert, build(), { buildStandup, speakStandupHeadline }, freshness(), { makeRedactor } (+7 more)

### Community 81 - "Design"
Cohesion: 0.06
Nodes (32): gateway(), Affected users and systems, Constraints, Decisions (2026-11-27), Intent: Enforce an egress limit for the RFactory pod, Open questions, Problem, Proposed outcome (+24 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "k14 results: agent workspace desktops on k3d with KubeVirt"
Cohesion: 0.13
Nodes (13): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+5 more)

### Community 84 - "test run.test.js"
Cohesion: 0.11
Nodes (11): assert, { EventEmitter }, fs, joined(), { PassThrough }, path, { run }, setup() (+3 more)

### Community 85 - "createShareManager"
Cohesion: 0.12
Nodes (33): createShareManager(), approve(), cleanup(), close(), emit(), endCall(), expire(), frameFor() (+25 more)

### Community 86 - "web/call.js"
Cohesion: 0.10
Nodes (23): BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts, checkFactsDetailed }, emitLimits(), lookupAnswer(), { createHearing, SELF_NAMES }, { createShareDesktop }, { createStt } (+15 more)

### Community 87 - "core/package.json"
Cohesion: 0.17
Nodes (11): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+3 more)

### Community 88 - "._handleMouse"
Cohesion: 0.15
Nodes (5): extendedPointerEvent(), keyEvent(), pointerEvent(), QEMUExtendedKeyEvent(), clientToElement()

### Community 89 - "bot run()"
Cohesion: 0.15
Nodes (27): buildRendererSource(), pageLeft(), run(), abandon(), discardOpen(), failureReport(), guestHelper(), idleAvatar() (+19 more)

### Community 90 - "Design"
Cohesion: 0.14
Nodes (13): AI disclosure, Alternatives rejected, Cost, Design, Evidence this spec rests on, Licence (owner decision 2: the whole repository is AGPL-3.0), Packaging, Portraits and notices (+5 more)

### Community 91 - "loadScope"
Cohesion: 0.13
Nodes (9): assert, base, { createGateway }, fs, { loadScope }, { makeRedactor }, os, path (+1 more)

### Community 92 - "client.js"
Cohesion: 0.17
Nodes (10): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, connect(), handshake(), main() (+2 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "kubevirt.test.js"
Cohesion: 0.14
Nodes (11): assert, { createAgent }, { createCallWorker }, { createControl }, { dial }, { encode, createDecoder }, net, { parseCmdline } (+3 more)

### Community 95 - "ref_node_fs"
Cohesion: 0.08
Nodes (20): assert, { createProfile }, KEY, { test }, fs, assert, { createK8s }, fs (+12 more)

### Community 96 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, CFactory source (`core/src/sources/cfactory.js`), Data, Decisions on the intent's open questions (recommended), Design, Risks, Sign-in, Spec: Phase 1a, a text standup in the web UI (+4 more)

### Community 97 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Design, Images: built, signed and promoted by CI, like CFactory, One pod, as today, Order and cutover, Owner decisions (proposed defaults), Pod security, Reach: tunnel, DNS, Keycloak (+4 more)

### Community 98 - "shell-browser.test.js"
Cohesion: 0.18
Nodes (7): assert, { chromium }, { createApp }, { loadRoles }, { makeRedactor }, { spawnSync }, test

### Community 99 - "items.test.js"
Cohesion: 0.18
Nodes (6): assert, jiraScope, { mapGithub, mapJira, summarise }, mapping, run(), test

### Community 100 - ".rQwait"
Cohesion: 0.11
Nodes (3): fbUpdateRequest(), decodeUTF8(), Websock

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

### Community 105 - "Design"
Cohesion: 0.14
Nodes (13): 1. The inventory script (read-only), 2. The two gates, 3. The removal procedure (the owner runs it), Alternatives rejected, Approval (2026-11-27), Decisions carried from the approved intent, Design, First slice and what is deferred (+5 more)

### Community 106 - "verify lifecycle.sh"
Cohesion: 0.42
Nodes (7): case_hold(), egress_cut(), fresh(), hold(), settled(), lifecycle.sh script, watch_end()

### Community 107 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Bounded run time, Decisions on the intent's open questions (proposed), Design, PEM flag across polls (`web/shares.js:49-51`), PEM marker scanner, Risks, Spec: redact credentials that wrap across log lines (+2 more)

### Community 108 - "vnc.test.js"
Cohesion: 0.12
Nodes (19): bridgeViewOnly(), createFilter(), assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session (+11 more)

### Community 109 - "web/test/actions.test.js"
Cohesion: 0.12
Nodes (12): approve(), assert, binding, create, { createActionManager }, { hashPayload }, { loadRoles }, { makeRedactor } (+4 more)

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "Plan: an MCP server for agents, slice A: read RFactory with a read key"
Cohesion: 0.13
Nodes (14): Approval (2026-11-27), C1. Scope (`core/src/scope.js`), C2. Shared reads (`web/reads.js`), C3. Project ids on entries, C4. The listener (`core/src/agent-endpoint.js`), Contracts (fixed; steps refer to them), Deviations, Open questions (+6 more)

### Community 112 - "Steps"
Cohesion: 0.12
Nodes (20): Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Steps, Tests, Decisions carried over (approved intent and spec), Gates (+12 more)

### Community 113 - "des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 114 - "Design"
Cohesion: 0.13
Nodes (14): 11. Not in this slice, 1. The switch, 2. Hearing a note, 3. Shaping a note, 4. The notes of a call, 6. Approving and downloading, 8. The spoken headline, 9. The record (+6 more)

### Community 115 - "control.js"
Cohesion: 0.27
Nodes (10): capText(), createControl(), applyHosts(), closePage(), page(), start(), fs, originOf() (+2 more)

### Community 116 - "github.test.js"
Cohesion: 0.08
Nodes (27): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFile } (+19 more)

### Community 117 - "boundary.test.js"
Cohesion: 0.10
Nodes (14): card(), assert, callTool(), { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs (+6 more)

### Community 118 - "Design"
Cohesion: 0.20
Nodes (9): 1. CFactory: projects on the server (CFactory PR A, then PR B), 2. RFactory: the allowlist and its secrets (`core/src/scope.js`), 5. RFactory: each proposal keeps its target (`web/actions.js`, `web/shares.js`, `web/investigations.js`), 6. Rollout order, Alternatives rejected, Design, Risks, Spec: project-aware calls (+1 more)

### Community 119 - "Intent: call the bot "Factory""
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-26: "approved", with the recommendations), Intent: call the bot "Factory", Open questions, Problem, Proposed outcome

### Community 120 - "RSAAESAuthenticationState"
Cohesion: 0.12
Nodes (4): RA2Cipher, RSAAESAuthenticationState, EventTargetMixin, encodeUTF8()

### Community 122 - "Steps"
Cohesion: 0.10
Nodes (22): tools(), ask(), listTools(), required(), raw(), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains) (+14 more)

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

### Community 127 - "viewer/board.test.js"
Cohesion: 0.14
Nodes (13): { randomBytes }, { viewerRoute, URL_BOARD, ORIGIN }, assert, board(), browser, column(), open(), { test } (+5 more)

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 129 - "jira.test.js"
Cohesion: 0.13
Nodes (16): mapJira(), boundedJson(), { boundedJson }, createJiraSource(), snapshot(), { mapJira }, assert, base64 (+8 more)

### Community 130 - "k8s-policy.js"
Cohesion: 0.05
Nodes (45): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+37 more)

### Community 131 - "github-web.test.js"
Cohesion: 0.13
Nodes (13): assert, { connect }, { createGithubSource }, dir, fs, gone(), os, path (+5 more)

### Community 133 - "mapCard"
Cohesion: 0.14
Nodes (15): headline(), mapCard(), 10. Intent constraints carried into slice 1, 1. Data comes from four CFactory read tools, all on the existing read key, 3. Failure and freshness, 4. `core/src/standup.js` (new, pure): `buildStandup(cards, freshness)`, 6. Review (`core/src/review.js`, new, pure), 7. Where data goes (+7 more)

### Community 134 - "web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 135 - "browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

### Community 136 - "run.js"
Cohesion: 0.17
Nodes (10): { buildRendererSource }, { CALL_EVENTS }, crypto, fs, { installSttBridge }, { makeRedactor }, os, path (+2 more)

### Community 137 - "has"
Cohesion: 0.08
Nodes (22): loadRoles(), has(), rolesOf(), Decisions carried over from the approved spec, Decisions for this plan, Deviations, Plan: v1 roles in code (admin, approver, member), slice "roles" of #2, Rollback (+14 more)

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

### Community 155 - "Steps"
Cohesion: 0.28
Nodes (13): Steps, handleAction(), handleCall(), loadActions(), loadPanels(), renderAction(), renderActions(), renderLimits() (+5 more)

### Community 156 - "check-egress.test.sh"
Cohesion: 0.27
Nodes (9): calls(), FAKE_ARGS, FAKE_CALLS, FAKE_OUT, FAKE_PROGRAM, fixture(), PATH, run() (+1 more)

### Community 157 - "queueSpeech"
Cohesion: 0.36
Nodes (11): addressed(), answer(), drain(), queueSpeech(), requestAction(), requestInvestigation(), requestNote(), requestShare() (+3 more)

### Community 158 - "avatar-renderer.test.js"
Cohesion: 0.18
Nodes (6): assert, { buildRendererSource }, { chromium }, fs, path, test

### Community 159 - "md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 161 - "readiness.sh"
Cohesion: 0.35
Nodes (10): alive(), extra_cleanup(), mode_checks(), settle(), readiness.sh script, stop_call(), stop_helpers(), wait_event() (+2 more)

### Community 162 - "createClaudeBrain"
Cohesion: 0.49
Nodes (10): createClaudeBrain(), answerTurn(), checkDestination(), lookupTurn(), note(), propose(), run(), stop() (+2 more)

### Community 163 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.14
Nodes (13): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 8. Problems we hit (+5 more)

### Community 164 - "desktop-routes.test.js"
Cohesion: 0.10
Nodes (28): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+20 more)

### Community 165 - "eyes"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 166 - "Keyboard"
Cohesion: 0.17
Nodes (7): Keyboard, _capturedElemChanged(), _captureObserver, _captureProxy(), releaseCapture(), setCapture(), stopEvent()

### Community 167 - ".text"
Cohesion: 0.15
Nodes (17): idle(), bash(), Approved decisions (copied from the spec, so this plan stands alone), Deviations, Decisions (the approved intent and spec), Deviations, Open questions, Plan: one live test call with 5-10 team members talking to Factory (+9 more)

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 170 - "Plan: finish the "Factory" rename and stop false wakes at a caption block start"
Cohesion: 0.11
Nodes (17): Decisions (the approved intent and spec), Deviations, Plan: finish the "Factory" rename and stop false wakes at a caption block start, Rollback, Steps, Tests, 1. The wake rule (`core/src/call/hearing.js:3`), 2. A rejected mention still ends the request before it (`hearing.js:50-71`) (+9 more)

### Community 171 - "Intent: clean up the `e2e-*` test repositories (GitHub and CFactory)"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: clean up the `e2e-*` test repositories (GitHub and CFactory), Open questions, Problem, Proposed outcome

### Community 172 - "Plan: Phase 0, the Linux call test"
Cohesion: 0.12
Nodes (13): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Steps, Tests, JoinError, Findings (+5 more)

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "Spec: one live test call with 5-10 team members talking to Factory"
Cohesion: 0.17
Nodes (11): 1. The readiness-check tool (slice 1, code), 2. The runbook page (slice 1, docs), 3. How the results are scored without a code change, 4. The day (slice 2, no code), 5. Deferred, Alternatives rejected, Approval (2026-11-27), Design (+3 more)

### Community 175 - "@modelcontextprotocol/sdk"
Cohesion: 0.33
Nodes (4): { ListToolsRequestSchema, CallToolRequestSchema }, { Server }, { StdioServerTransport }, @modelcontextprotocol/sdk

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

### Community 180 - "createCfactorySource"
Cohesion: 0.36
Nodes (10): createCfactorySource(), call(), connect(), view(), comments(), freshness(), scopedCards(), withClient() (+2 more)

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

### Community 188 - "wireElevation"
Cohesion: 0.32
Nodes (12): decide(), decided(), decideInvestigation(), decideShare(), localTime(), scoped(), wireElevation(), changeGrant() (+4 more)

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

### Community 195 - "ok"
Cohesion: 0.17
Nodes (11): ok(), hello(), Waking the bot, Approval (2026-11-27), Decisions (the approved intent and spec), Deviations, Plan: enforce an egress limit for the RFactory pod, Rollback (+3 more)

### Community 196 - "source-guard.test.js"
Cohesion: 0.18
Nodes (10): Source adapters, assert, fs, git(), guard, os, path, repo() (+2 more)

### Community 197 - "ref_node_http"
Cohesion: 0.29
Nodes (3): http, [portA, portB], state

### Community 199 - "theme.js"
Cohesion: 0.67
Nodes (3): applyTheme(), dark, observer

### Community 203 - "Intent: finish the "Factory" rename and stop false wakes at a caption block start"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: finish the "Factory" rename and stop false wakes at a caption block start, Open questions, Problem, Proposed outcome

### Community 206 - "Intent: standup notes: record what is agreed, turn it into cards, publish the notes"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: standup notes: record what is agreed, turn it into cards, publish the notes, Open questions, Problem, Proposed outcome

### Community 207 - "bootstrap-secrets.sh"
Cohesion: 0.83
Nodes (3): env_of(), bootstrap-secrets.sh script, write_secret()

### Community 208 - "hearing.test.js"
Cohesion: 0.11
Nodes (18): createHearing(), NOTE, NOTES, SELF_NAMES, assert, { createHearing }, fakeClock(), headlineRequests (+10 more)

### Community 210 - "lookup-endpoint.js"
Cohesion: 0.22
Nodes (6): createLookupEndpoint(), http, { ListToolsRequestSchema, CallToolRequestSchema }, { randomBytes, timingSafeEqual }, { Server }, { StreamableHTTPServerTransport }

### Community 211 - "mesh"
Cohesion: 0.33
Nodes (6): mesh, anchors, file, sha256, triangles, f17

### Community 212 - "move"
Cohesion: 0.33
Nodes (6): move, C, JL, JR, LB, LM

### Community 213 - "Intent: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (approved 2026-11-27), Intent: the call Chrome runs with its sandbox on, so Meet admits the bot, Open questions, Problem, Proposed outcome

### Community 214 - "Plan: project-aware calls, slice B (writes for every project)"
Cohesion: 0.22
Nodes (8): Approval (2026-11-27), Decisions (approved intent and spec, as they apply to slice B), Deviations, Open questions, Plan: project-aware calls, slice B (writes for every project), Rollback, State on 2026-11-27 (checked read-only), Tests

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

### Community 237 - "stt.test.js"
Cohesion: 0.15
Nodes (9): Web server environment variables, createStt(), fs, assert, { createStt }, fs, os, path (+1 more)

### Community 238 - "join"
Cohesion: 0.10
Nodes (21): join(), Affected users and systems, Candidate causes, and what the code says, Constraints, Decisions (2026-11-27), How a caption becomes a question today, Intent: the first question after the bot joins is heard in Meet captions mode, Open questions (+13 more)

### Community 240 - ".expired"
Cohesion: 0.07
Nodes (28): action(), Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Tests, Waves, Approval (2026-11-27) (+20 more)

### Community 241 - "Intent: one live test call with 5-10 team members talking to Factory"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: one live test call with 5-10 team members talking to Factory, Open questions, Problem, Proposed outcome

### Community 242 - "Spec: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Design, Risks, Spec: the call Chrome runs with its sandbox on, so Meet admits the bot, Verification

### Community 243 - "callevents.js"
Cohesion: 0.29
Nodes (5): filter(), GREETING, HEARING, LOG_CLASSES, STATES

### Community 244 - "loadScope"
Cohesion: 0.07
Nodes (33): loadScope(), Environment and scope reference, Per-call worker environment variables (set internally), Scope fields (`RFACTORY_SCOPE_FILE`), Decisions (2026-11-27), Decisions carried over from the approved spec, Decisions for this plan, Deviations from the spec (approved with this plan) (+25 more)

### Community 245 - "Standalone mode S1: end-to-end results (#2 step 10)"
Cohesion: 0.20
Nodes (8): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass**

### Community 246 - "lifecycle.js"
Cohesion: 0.20
Nodes (7): { buildPolicy }, { createDecoder, tag, encode, LANGUAGE }, crypto, net, { nonce: newNonce }, { StringDecoder }, createDecoder()

### Community 247 - "gateway.js"
Cohesion: 0.22
Nodes (11): DESKTOP, { mapGithub, summarise, STATES }, NAMES, { origin }, SCHEMAS, FAIL, failing(), labelNames() (+3 more)

### Community 248 - "Design"
Cohesion: 0.22
Nodes (8): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Spec: Standalone mode, with a choice of source and brain

### Community 249 - "createShare"
Cohesion: 0.47
Nodes (9): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+1 more)

### Community 250 - "observer.js"
Cohesion: 0.24
Nodes (8): [chrome, dir], close(), controller, endWatch, fs, path, stop(), stopped

### Community 251 - "scope.js"
Cohesion: 0.08
Nodes (25): source, commit, path, repo, DESTINATIONS, fs, LISTEN, { makeRedactor } (+17 more)

### Community 252 - "Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence, Open questions, Problem, Proposed outcome

### Community 253 - "Plan: `e2e-*` cleanup, first slice: the read-only inventory script"
Cohesion: 0.17
Nodes (11): 1. `core/src/sources/cfactory.js`: one tenant-wide read (coder), 4. Full tests, review, commit (lead), 5. One live read-only run, and the list on issue #60 (lead), Decisions (2026-11-27), Decisions (approved intent and spec), Open questions, Plan: `e2e-*` cleanup, first slice: the read-only inventory script, Rollback (+3 more)

### Community 254 - "origin"
Cohesion: 0.33
Nodes (9): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), origin() (+1 more)

### Community 255 - "Intent: elevated calls, slice 1: pair a call in the portal and hold a grant for it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: elevated calls, slice 1: pair a call in the portal and hold a grant for it, Open questions, Problem, Proposed outcome

### Community 256 - "Deviations (Codex review of the approved plan, 2026-11-17)"
Cohesion: 0.22
Nodes (8): speechLevel(), Decisions carried over (approved intent and spec), Deviations after merge, Deviations (Codex review of the approved plan, 2026-11-17), Plan: A face for the bot that talks when it speaks, Rollback, Tests, Timing and "never frozen"

### Community 257 - "cfactory-write.js"
Cohesion: 0.15
Nodes (14): deriveEffects(), describe(), SERVICE, STAGE, stageFor(), stateOf(), WRITES, { Client } (+6 more)

### Community 258 - "Plan: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.29
Nodes (6): Accepted risk, Decisions carried over (approved intent and spec), Deviations, Plan: the call Chrome runs with its sandbox on, so Meet admits the bot, Rollback, Tests

### Community 259 - "handleCall"
Cohesion: 0.67
Nodes (6): handleNotes(), loadNotes(), notesStoreOf(), postNote(), renderNote(), renderNotes()

### Community 260 - "Design"
Cohesion: 0.17
Nodes (11): 1. Keys and the scope file (decisions 1, 8), 5. What an agent sees: the wrapper, 6. Project ids on proposals and record lines, 7. Limits and the page (constraint "agents must not get in the page's way"), 9. Deployment, Alternatives rejected, Decisions (2026-11-27), Design (+3 more)

### Community 261 - "Intent: redact credentials that wrap across log lines"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: redact credentials that wrap across log lines, Open questions, Problem, Proposed outcome

### Community 262 - "running"
Cohesion: 0.09
Nodes (23): Branches and worktrees, Corrections to the approved spec, Deviations, Landing record (2026-11-24), Live check results (step 12), Plan: run RFactory in the factory cluster, Rollback, Tests (+15 more)

### Community 263 - "github-read.js"
Cohesion: 0.24
Nodes (8): createGithubRead(), commit(), newest(), request(), repoUrl(), { TextDecoder }, 4. The tools, 2. The connection: Jira Cloud's REST API, directly

### Community 264 - "Spec: call the bot "Factory""
Cohesion: 0.20
Nodes (9): 1. The name, everywhere a person sees or hears it, 2. The wake rule (`core/src/call/hearing.js`), 3. Tests, Alternatives rejected, Amendment (owner, 2026-11-26): share requests in natural words (#63), Design, Risks, Spec: call the bot "Factory" (+1 more)

### Community 265 - "fill_window"
Cohesion: 0.43
Nodes (8): deflate_fast(), deflate_huff(), deflate_rle(), deflate_slow(), deflate_stored(), fill_window(), flush_block_only(), longest_match()

### Community 266 - "Steps"
Cohesion: 0.43
Nodes (8): Steps, Steps, loadReview(), openPage(), run(), wireCall(), composeStandalone(), projectPage()

### Community 267 - "Steps"
Cohesion: 0.25
Nodes (8): setCameraRenderer(), ctx(), Decisions (approved intent and spec, with the owner's amendments of 2026-11-26), Plan: in-call agents, slice 1: live read-only lookups, Rollback, Shared contracts (steps 2 to 6 all follow these), Steps, Tests

### Community 268 - "compare"
Cohesion: 0.39
Nodes (9): canon(), compare(), compareAfter(), facts(), hashOf(), number(), 2. `core/bin/e2e-inventory.js`: the pure part (codex), 3. `core/bin/e2e-inventory.js`: readers and the command line (coder) (+1 more)

### Community 269 - "test/board.test.js"
Cohesion: 0.10
Nodes (22): COLUMNS, projectBoard(), { repositoryOf }, STAGES, boundedFetch(), { Client }, repositoryOf(), STATE (+14 more)

### Community 270 - "Plan: Elevated calls, slice 1 — portal-verified pairing, schedule, and grant"
Cohesion: 0.29
Nodes (6): Decisions (2026-11-28), Deviations, Open questions, Plan: Elevated calls, slice 1 — portal-verified pairing, schedule, and grant, Rollback, Tests

### Community 271 - "renderInvestigation"
Cohesion: 0.60
Nodes (5): handleInvestigation(), investigationStateText(), investigationStoreOf(), loadInvestigations(), renderInvestigation()

### Community 272 - "Intent: in-call agents, the model with live tools, provider chosen per call"
Cohesion: 0.22
Nodes (8): Affected users and systems, Amendments (owner, 2026-11-26), Constraints, Decisions (owner, 2026-11-26: "approve with your recommendations"), Intent: in-call agents, the model with live tools, provider chosen per call, Open questions, Problem, Proposed outcome

### Community 273 - "loadShares"
Cohesion: 0.83
Nodes (4): handleShare(), loadShares(), renderShare(), shareStoreOf()

### Community 274 - "ollama-standup.js"
Cohesion: 0.29
Nodes (6): { checkFacts }, count(), fs, main(), path, { setup }

### Community 275 - "makeTable"
Cohesion: 0.67
Nodes (3): crc32(), makeTable(), read_buf()

### Community 276 - "Intent: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text), Open questions, Problem, Proposed outcome

### Community 277 - "Plan: project-aware calls, slice A (project-aware reads)"
Cohesion: 0.29
Nodes (6): Delivery in two slices (a plan decision; the approved spec is unchanged), Plan: project-aware calls, slice A (project-aware reads), Rollback (in reverse order), Steps, Tests, recordLookup()

### Community 278 - "Spec: a read-only standup from one Jira project, on the page (first slice of #59)"
Cohesion: 0.33
Nodes (5): Approval (2026-11-27), Open questions, Risks, Spec: a read-only standup from one Jira project, on the page (first slice of #59), Verification

## Knowledge Gaps
- **41 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+36 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2120 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Websock` connect `.rQwait` to `.off`, `rfb.js`, `logging.js`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _41 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `Steps` to `createActionManager`, `createCallManager`, `Steps`, `.text`, `running`, `review.js`, `makeRedactor`, `checkFacts`, `Plan: an MCP server for agents, slice A: read RFactory with a read key`, `Steps`, `core/test/actions.test.js`, `loadScope`, `createShareManager`, `createInvestigationManager`, `.off`, `agents.test.js`, `Steps`, `server.js`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Should `rfb.js` be split into smaller, more focused modules?**
  _Cohesion score 0.062040816326530614 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `Steps` to `handleCall`, `createActionManager`, `createCallManager`, `Steps`, `.text`, `web/test/notes.test.js`, `Steps`, `review.js`, `.expired`, `hearing.test.js`, `server.js`, `app.js`, `createInvestigationManager`, `.off`, `Steps`, `proxy.js`, `queueSpeech`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Should `test/call.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._