# Graph Report - RFactory-t59  (2026-11-28)

## Corpus Check
- 360 files · ~603,639 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 10, .nix 6, .css 4)

## Summary
- 4189 nodes · 7589 edges · 272 communities (235 shown, 37 thin omitted)
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 1203 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5f7dd274`
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
- Plan: Phase 3, act on the Factories from the call
- cli.test.js
- How the bot hears
- test desktop-ui.test.js
- guard.test.js
- RFB
- runner runner.test.js
- agent-tools.js
- e2e-inventory.test.js
- state
- runner runner.js
- cfactory-write.js
- test server.test.js
- brain.test.js
- test avatar-state.test.js
- Profiles
- Websock
- agents.test.js
- Steps
- rfactory-standup.js
- error
- server.js
- lookups.js
- share.js
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
- compare
- Plan: project-aware calls, slice A (project-aware reads)
- makeRedactor
- inflate.js
- verify net.sh
- verify profiles.sh
- lookup-endpoint.test.js
- e2e-inventory.js
- spike hello-call.test.js
- app.js
- ref_node_stream
- createInvestigationManager
- index.js
- createProxy
- runner protocol.js
- createActionManager
- Plan: run RFactory in the factory cluster
- proxy.js
- Deviations from the spec (for approval with this plan)
- share-desktop.test.js
- a
- agent-endpoint.js
- reaper reaper.test.js
- agent-endpoint.test.js
- C5. Tools and wrapper (`web/agent-tools.js`)
- ref_node_fs
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
- mapCard
- Design
- spike spike/package.json
- k14 results: agent workspace desktops on k3d with KubeVirt
- test run.test.js
- createShareManager
- web/call.js
- core/package.json
- el
- bot run()
- Design
- gateway.test.js
- investigations.test.js
- desktop desktop/package.json
- kubevirt.test.js
- k8s.test.js
- Spec: an approved, read-only Claude investigation from the call
- Design
- shell-browser.test.js
- main
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
- shares.test.js
- github.test.js
- boundary.test.js
- listProjects
- Intent: call the bot "Factory"
- RSAAESAuthenticationState
- inflator.js
- Plan: one live test call with 5-10 team members talking to Factory
- verify e2e.sh
- H264Decoder
- k3d k11.sh
- k3d mk-tls.sh
- test/board.test.js
- verify liveview.sh
- jira.test.js
- k8s-policy.js
- ._handleMouse
- GestureHandler
- guard.js
- createGuard
- browser.js
- run.js
- Design
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
- Spec: call the bot "Factory"
- check-egress.test.sh
- Spec: a read-only standup from one Jira project, on the page (first slice of #59)
- avatar-renderer.test.js
- md5.js
- TightDecoder
- readiness.sh
- refresh.js
- Desktop VMs on the k3d factory cluster
- desktop-routes.test.js
- eyes
- share.test.js
- Spec: one live test call with 5-10 team members talking to Factory
- Socket
- teams-tap-spike.js
- Plan: finish the "Factory" rename and stop false wakes at a caption block start
- Intent: clean up the `e2e-*` test repositories (GitHub and CFactory)
- Plan: Phase 0, the Linux call test
- Intent: run a Claude terminal from the call, and show it
- profile.test.js
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
- core/test/actions.test.js
- Intent: Meeting agent web app for the Factories
- Intent: Standalone mode, without the Factories
- Intent: Agent workspace, a disposable desktop per call
- Intent: Meeting agent Phase 1a, a text standup in the web UI
- Third-party notices
- portraits
- ok
- observer.js
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
- Design
- Intent: one live test call with 5-10 team members talking to Factory
- Spec: the call Chrome runs with its sandbox on, so Meet admits the bot
- callevents.js
- refuseKeyEnv
- createShare
- lifecycle.js
- gateway.js
- Design
- main
- Deviations from the spec revision (Codex re-check and plan review, for approval with this plan)
- scope.js
- Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence
- Plan: `e2e-*` cleanup, first slice: the read-only inventory script
- fill_window
- stt-languages.test.js
- Steps
- lookups.test.js
- Plan: the call Chrome runs with its sandbox on, so Meet admits the bot
- net.js
- running
- makeTable
- Design
- avatars.test.js
- github-read.js
- k8s-policy.test.js
- Steps
- Intent: see why Meet refuses the call bot, and recover from it
- Steps
- cfactory.js
- actions.js
- wireProjectCall

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `makeRedactor()` - 46 edges
3. `createLifecycle()` - 45 edges
4. `Steps` - 39 edges
5. `createInvestigationManager()` - 37 edges
6. `Steps` - 36 edges
7. `loadScope()` - 35 edges
8. `createCallManager()` - 35 edges
9. `checkFacts()` - 34 edges
10. `createApp()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Findings this design rests on (checked 2026-11-19)` --references--> `code()`  [INFERRED]
  spec/2026-11-19-18-claude-terminals.md → core/bin/e2e-inventory.js
- `3. Tests` --references--> `createHearing()`  [INFERRED]
  spec/2026-11-26-62-bot-name-factory.md → core/src/call/hearing.js
- `2. Hearing a note` --references--> `createHearing()`  [INFERRED]
  spec/2026-11-27-58-standup-notes.md → core/src/call/hearing.js
- `Verification` --references--> `heard()`  [INFERRED]
  spec/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `2. The wake rule (`core/src/call/hearing.js`)` --references--> `heard()`  [INFERRED]
  spec/2026-11-26-62-bot-name-factory.md → core/src/call/hearing.js

## Import Cycles
- None detected.

## Communities (272 total, 37 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Design, Hearing: wake phrase and end of a question, Packaging, Risks, Spec: Phase 1b, a voice standup in Google Meet, Speech (TTS), The bot process (`bot/run.js`) (+4 more)

### Community 2 - "rfb.js"
Cohesion: 0.05
Nodes (19): CopyRectDecoder, HextileDecoder, JPEGDecoder, RawDecoder, RREDecoder, ZlibDecoder, Deflator, encodings (+11 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.07
Nodes (19): assert, { createCallManager }, { createInvestigationManager }, { EventEmitter }, fakeClock(), finishSpeech(), flush(), fs (+11 more)

### Community 4 - "web/test/notes.test.js"
Cohesion: 0.08
Nodes (39): 1. CFactory: projects on the server (CFactory PR A, then PR B), 2. RFactory: the allowlist and its secrets (`core/src/scope.js`), 5. RFactory: each proposal keeps its target (`web/actions.js`, `web/shares.js`, `web/investigations.js`), 6. Rollout order, Alternatives rejected, Design, Risks, Spec: project-aware calls (+31 more)

### Community 5 - "createCallManager"
Cohesion: 0.26
Nodes (21): createCallManager(), addressed(), answer(), armQuiet(), audio(), captionSeen(), drain(), incoming() (+13 more)

### Community 6 - "claude-cli.js"
Cohesion: 0.12
Nodes (15): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, LOOKUP_ERRORS, LOOKUP_SYSTEM_PROMPT (+7 more)

### Community 7 - "createLifecycle"
Cohesion: 0.11
Nodes (36): createLifecycle(), accept(), action(), allowAccept(), attachAgent(), boot(), callAttach(), cancel() (+28 more)

### Community 8 - "Plan: Phase 3, act on the Factories from the call"
Cohesion: 0.33
Nodes (5): Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Tests

### Community 9 - "cli.test.js"
Cohesion: 0.09
Nodes (15): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+7 more)

### Community 10 - "How the bot hears"
Cohesion: 0.11
Nodes (16): a. The invitation, b. The timeline, c. The script, d. The score sheet, e. The results comment template, Multi-participant live test, The 10 questions, Agents (MCP) (+8 more)

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "guard.test.js"
Cohesion: 0.13
Nodes (14): assert, { buildPolicy }, cniResult(), entry, { execFileSync }, fake(), fs, https (+6 more)

### Community 13 - "RFB"
Cohesion: 0.06
Nodes (6): clientEncodings(), enableContinuousUpdates(), keyEvent(), RFB, setDesktopSize(), xvpOp()

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 15 - "agent-tools.js"
Cohesion: 0.07
Nodes (28): action, atom(), { CARD_KEY }, createAgentTools(), invoke(), descriptions, freshness, investigation (+20 more)

### Community 16 - "e2e-inventory.test.js"
Cohesion: 0.12
Nodes (22): assert, { build, hashOf, compare, compareAfter, main }, clone(), endpointsOf(), { EventEmitter }, fixture(), fs, ghFake() (+14 more)

### Community 17 - "state"
Cohesion: 0.09
Nodes (26): heard(), Captions vs own transcription, How the bot hears, Language, `listen` values and the per-platform `auto` rule, Privacy, Rollback, When own transcription is not configured (+18 more)

### Community 18 - "runner runner.js"
Cohesion: 0.09
Nodes (26): clearInterval(), { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade(), crypto (+18 more)

### Community 19 - "cfactory-write.js"
Cohesion: 0.15
Nodes (14): deriveEffects(), describe(), SERVICE, STAGE, stageFor(), stateOf(), WRITES, { Client } (+6 more)

### Community 20 - "test server.test.js"
Cohesion: 0.06
Nodes (29): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, GH_KEYS, ghItems, { handleCall } (+21 more)

### Community 21 - "brain.test.js"
Cohesion: 0.08
Nodes (26): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+18 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.11
Nodes (13): installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState(), meshAt() (+5 more)

### Community 23 - "Profiles"
Cohesion: 0.21
Nodes (3): name(), Profiles, The action record

### Community 25 - "agents.test.js"
Cohesion: 0.09
Nodes (20): composeAgents(), agents, assert, cards, { Client }, compose(), { createApp, composeAgents, composeWrites, refuseKeyEnv }, fs (+12 more)

### Community 26 - "Steps"
Cohesion: 0.11
Nodes (22): hashPayload(), checkNote(), closeEvidence(), { FAILED }, { hashPayload }, KINDS, notesHash(), { reviewCard, ACTIVE } (+14 more)

### Community 27 - "rfactory-standup.js"
Cohesion: 0.09
Nodes (29): { checkFacts }, count(), fs, main(), path, { setup }, ageOf(), approveClaude() (+21 more)

### Community 28 - "error"
Cohesion: 0.10
Nodes (28): releaseAttempt(), code(), bash(), Approved decisions (copied from the spec, so this plan stands alone), Plan: Review and standup from the board (#28, slice 1), Roles, Rollback, Tests (+20 more)

### Community 29 - "server.js"
Cohesion: 0.14
Nodes (21): Steps, 5. The web app and the page (`web/server.js`, `web/public/app.js`), renderItem(), createApp(), standaloneStandup(), standup(), { createReads, refusal, describe, CARD_KEY }, DESKTOP_STATIC (+13 more)

### Community 30 - "lookups.js"
Cohesion: 0.13
Nodes (11): cap(), collect(), walk(), FACTORY, GITHUB, { mapCard }, specs, { STATES } (+3 more)

### Community 31 - "share.js"
Cohesion: 0.14
Nodes (13): { randomBytes }, { viewerRoute, URL_BOARD, ORIGIN }, assert, board(), browser, column(), open(), { test } (+5 more)

### Community 32 - "claude-cli.test.js"
Cohesion: 0.11
Nodes (28): createClaudeBrain(), answerTurn(), checkDestination(), lookupTurn(), note(), propose(), run(), stop() (+20 more)

### Community 33 - "ref_node_assert"
Cohesion: 0.12
Nodes (13): toSpeech(), assert, fs, path, root, test, assert, test (+5 more)

### Community 34 - "tts.test.js"
Cohesion: 0.08
Nodes (22): Recorded GitHub inventory (pinned 1.14.0, captured 2026-11-17), Deviations, Gates, Plan: an approved, read-only Claude investigation from the call (RFactory side), Rollback, Tests, Alternatives rejected, Decisions (2026-11-27) (+14 more)

### Community 35 - "client.test.js"
Cohesion: 0.10
Nodes (16): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+8 more)

### Community 36 - "app.test.js"
Cohesion: 0.10
Nodes (14): renderFooter(), sourceUrl(), ALPHA, assert, base, BETA, Node, notesShim() (+6 more)

### Community 37 - "captions"
Cohesion: 0.10
Nodes (23): afterJoin(), captions(), Approval (2026-11-27), Decisions (the approved intent and spec), Deviations, Plan: the first question after the bot joins is heard in Meet captions mode, Rollback, Steps (+15 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.07
Nodes (16): installSttBridge(), assert, event(), fs, { installSttBridge }, path, RTCRtpReceiver, RTCRtpSender (+8 more)

### Community 39 - "deflate.js"
Cohesion: 0.08
Nodes (33): deflate(), deflateEnd(), deflateInit(), deflateInit2(), deflateReset(), deflateResetKeep(), deflateSetDictionary(), DeflateState() (+25 more)

### Community 40 - "cfactory-write.test.js"
Cohesion: 0.10
Nodes (19): createCfactoryWriter(), getClient(), invoke(), assert, bareBlocked, bareStarted, before, card (+11 more)

### Community 41 - "kyverno-scope.test.js"
Cohesion: 0.13
Nodes (16): assert, dir, { firstHost }, fs, path, policies, probeCidrs(), test (+8 more)

### Community 42 - "verify verify.test.js"
Cohesion: 0.10
Nodes (19): assert, beats(), CHECKS, fs, http, INPUT, { join }, LIB (+11 more)

### Community 43 - "compare"
Cohesion: 0.39
Nodes (9): canon(), compare(), compareAfter(), facts(), hashOf(), number(), 2. `core/bin/e2e-inventory.js`: the pure part (codex), 3. `core/bin/e2e-inventory.js`: readers and the command line (coder) (+1 more)

### Community 44 - "Plan: project-aware calls, slice A (project-aware reads)"
Cohesion: 0.17
Nodes (11): 1. The service: `rfactory-stt`, 2. In the bot (`bot/run.js`, both deployments): cut speech, send segments, 3. In the call manager (`web/call.js`): transcribe and hear, 4. The listen setting, 5. Packaging and deploy, Design, Measured on p620 (2026-11-21), Owner decisions taken with this spec (2026-11-21) (+3 more)

### Community 45 - "makeRedactor"
Cohesion: 0.08
Nodes (40): tools(), base64(), JOINED_RULES, jwtSpans(), KEY_VALUE_AT, keyValueAt(), keyValueMatch(), keyValueSpans() (+32 more)

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
Cohesion: 0.15
Nodes (9): DESKTOP, assert, { Client }, { createLookupEndpoint }, { DESKTOP }, http, { StreamableHTTPClientTransport }, test (+1 more)

### Community 50 - "e2e-inventory.js"
Cohesion: 0.17
Nodes (22): build(), codes(), { createCfactorySource }, { createHash }, fail(), FIXED, fs, keyOf() (+14 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.11
Nodes (13): Steps, Pieces, botName(), path, run(), assert, { EventEmitter }, fs (+5 more)

### Community 52 - "app.js"
Cohesion: 0.12
Nodes (28): decide(), decided(), decideInvestigation(), decideShare(), handleInvestigation(), handleShare(), INVESTIGATION_LIVE, investigationStateText() (+20 more)

### Community 53 - "ref_node_stream"
Cohesion: 0.17
Nodes (10): assert, { createVmSpawn }, { Duplex }, { test }, createVmSpawn(), { EventEmitter }, firstLine(), { PassThrough } (+2 more)

### Community 54 - "createInvestigationManager"
Cohesion: 0.12
Nodes (45): count(), COUNT_CLAIM, createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog(), endCall() (+37 more)

### Community 55 - "index.js"
Cohesion: 0.12
Nodes (19): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+11 more)

### Community 56 - "createProxy"
Cohesion: 0.24
Nodes (18): checkedAddresses(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect(), handleForward() (+10 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.23
Nodes (17): board(), boolean(), columns, count(), exact(), hosts(), identity, log() (+9 more)

### Community 58 - "createActionManager"
Cohesion: 0.34
Nodes (15): Steps, createActionManager(), approve(), emit(), endCall(), expire(), finish(), list() (+7 more)

### Community 59 - "Plan: run RFactory in the factory cluster"
Cohesion: 0.14
Nodes (13): Branches and worktrees, Corrections to the approved spec, Decisions (from the approved spec; owner defaults accepted 2026-11-24), Deviations, Landing record (2026-11-24), Lead steps, in order, Live check results (step 12), Plan: run RFactory in the factory cluster (+5 more)

### Community 60 - "proxy.js"
Cohesion: 0.17
Nodes (14): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, inRange() (+6 more)

### Community 61 - "Deviations from the spec (for approval with this plan)"
Cohesion: 0.09
Nodes (24): label(), stopShare(), Decisions carried over from the approved spec, Facts checked in the real repos, Open questions for the owner, Plan: Agent workspace, a disposable desktop per call (#3), Prerequisites (named revisions), Rollback (+16 more)

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

### Community 67 - "C5. Tools and wrapper (`web/agent-tools.js`)"
Cohesion: 0.11
Nodes (18): headline(), source(), C1. Scope (`core/src/scope.js`), C3. Project ids on entries, C4. The listener (`core/src/agent-endpoint.js`), C5. Tools and wrapper (`web/agent-tools.js`), Contracts (fixed; steps refer to them), Approval (2026-11-27) (+10 more)

### Community 68 - "ref_node_fs"
Cohesion: 0.06
Nodes (29): fs, os, path, fs, fs, path, assert, { createRecord } (+21 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.11
Nodes (10): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, invReplies(), invWith(), { makeRedactor }, reply() (+2 more)

### Community 70 - "agent/call.test.js"
Cohesion: 0.15
Nodes (13): createCallWorker(), { createShare, callLaunchArgs }, fs, { PassThrough }, assert, { createCallWorker, withProxy, MEET_GUEST, TEAMS_CAPTIONS }, { EventEmitter }, fixture() (+5 more)

### Community 71 - "proxy.test.js"
Cohesion: 0.12
Nodes (12): createApi(), assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard (+4 more)

### Community 72 - "profiles.test.js"
Cohesion: 0.10
Nodes (17): fs, LABEL, { randomUUID, hkdfSync }, admin, assert, fakeK8s(), fixture(), fs (+9 more)

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
Cohesion: 0.06
Nodes (37): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass** (+29 more)

### Community 80 - "mapCard"
Cohesion: 0.08
Nodes (26): mapCard(), buildStandup(), { FAILED, mapCard }, speakStandupHeadline(), assert, build(), { buildStandup, speakStandupHeadline }, freshness() (+18 more)

### Community 81 - "Design"
Cohesion: 0.06
Nodes (32): gateway(), Affected users and systems, Constraints, Decisions (2026-11-27), Intent: Enforce an egress limit for the RFactory pod, Open questions, Problem, Proposed outcome (+24 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "k14 results: agent workspace desktops on k3d with KubeVirt"
Cohesion: 0.18
Nodes (9): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+1 more)

### Community 84 - "test run.test.js"
Cohesion: 0.11
Nodes (12): assert, audioJoined(), { EventEmitter }, fs, joined(), { PassThrough }, path, { run } (+4 more)

### Community 85 - "createShareManager"
Cohesion: 0.31
Nodes (19): createShareManager(), approve(), cleanup(), close(), emit(), endCall(), expire(), frameFor() (+11 more)

### Community 86 - "web/call.js"
Cohesion: 0.11
Nodes (21): BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts, checkFactsDetailed }, emitLimits(), lookupAnswer(), { createHearing, SELF_NAMES }, { createShareDesktop }, { createStt } (+13 more)

### Community 87 - "core/package.json"
Cohesion: 0.15
Nodes (12): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+4 more)

### Community 88 - "el"
Cohesion: 0.18
Nodes (22): 4. The tools, ago(), clear(), clock(), day(), el(), fill(), handleCall() (+14 more)

### Community 89 - "bot run()"
Cohesion: 0.20
Nodes (21): pageLeft(), run(), abandon(), discardOpen(), failureReport(), guestHelper(), idleAvatar(), leftConfirmed() (+13 more)

### Community 90 - "Design"
Cohesion: 0.12
Nodes (15): speechLevel(), Decisions carried over (approved intent and spec), AI disclosure, Alternatives rejected, Cost, Design, Evidence this spec rests on, Licence (owner decision 2: the whole repository is AGPL-3.0) (+7 more)

### Community 91 - "gateway.test.js"
Cohesion: 0.13
Nodes (9): assert, base, { createGateway }, fs, { loadScope }, { makeRedactor }, os, path (+1 more)

### Community 92 - "investigations.test.js"
Cohesion: 0.12
Nodes (19): approve(), assert, binding, { createInvestigationManager }, { createRecord }, fs, { loadRoles }, { makeRedactor } (+11 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "kubevirt.test.js"
Cohesion: 0.08
Nodes (25): octets(), parseCmdline(), startHeartbeat(), { createCallWorker }, { createControl }, { createProfile }, { dial }, { encode, createDecoder } (+17 more)

### Community 95 - "k8s.test.js"
Cohesion: 0.17
Nodes (9): createK8s(), assert, { createK8s }, fs, http, { inClusterConfig }, os, path (+1 more)

### Community 96 - "Spec: an approved, read-only Claude investigation from the call"
Cohesion: 0.18
Nodes (10): 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), 3. RFactory: hearing, approval, the shared log, the spoken result, Alternatives rejected, Design, Findings this design rests on (checked 2026-11-19), Order and dependencies, Risks (+2 more)

### Community 97 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Design, Images: built, signed and promoted by CI, like CFactory, One pod, as today, Order and cutover, Owner decisions (proposed defaults), Pod security, Reach: tunnel, DNS, Keycloak (+4 more)

### Community 98 - "shell-browser.test.js"
Cohesion: 0.11
Nodes (13): nonce(), Deviations, @rfactory/core, { checkNote, sentence, headline, toMarkdown, notesHash }, { randomUUID }, same(), composeWrites(), assert (+5 more)

### Community 99 - "main"
Cohesion: 0.13
Nodes (16): Decisions (2026-11-27), Decisions (copied from the approved intent and spec), Deviations from the spec (approved with this plan), Open questions, Plan: a read-only standup from one Jira project, on the page (first slice of #59), Rollback, Tests, main() (+8 more)

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
Cohesion: 0.20
Nodes (9): Approval (2026-11-27), Deviations, Open questions, Plan: an MCP server for agents, slice A: read RFactory with a read key, Plan decisions (new here; the owner approves them with this plan), Rollback, Tests, readDay() (+1 more)

### Community 112 - "Steps"
Cohesion: 0.27
Nodes (12): Waves, Steps, 6. Project ids on proposals and record lines, createRecord(), append(), files(), lastEntries(), prune() (+4 more)

### Community 113 - "des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 114 - "Design"
Cohesion: 0.13
Nodes (14): 11. Not in this slice, 1. The switch, 2. Hearing a note, 3. Shaping a note, 4. The notes of a call, 6. Approving and downloading, 8. The spoken headline, 9. The record (+6 more)

### Community 115 - "shares.test.js"
Cohesion: 0.14
Nodes (15): Switches and record, approve(), assert, binding, callOf(), { createShareManager }, { loadRoles }, { makeRedactor } (+7 more)

### Community 116 - "github.test.js"
Cohesion: 0.06
Nodes (36): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFile } (+28 more)

### Community 117 - "boundary.test.js"
Cohesion: 0.10
Nodes (14): card(), assert, callTool(), { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs (+6 more)

### Community 118 - "listProjects"
Cohesion: 0.10
Nodes (24): base(), Decisions (approved intent and spec, as delivered in slice A), Delivery in two slices (a plan decision; the approved spec is unchanged), Deviations, Plan: project-aware calls, slice A (project-aware reads), Rollback (in reverse order), Steps, Tests (+16 more)

### Community 119 - "Intent: call the bot "Factory""
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-26: "approved", with the recommendations), Intent: call the bot "Factory", Open questions, Problem, Proposed outcome

### Community 120 - "RSAAESAuthenticationState"
Cohesion: 0.12
Nodes (4): RA2Cipher, RSAAESAuthenticationState, EventTargetMixin, encodeUTF8()

### Community 122 - "Plan: one live test call with 5-10 team members talking to Factory"
Cohesion: 0.33
Nodes (5): Deviations, Open questions, Plan: one live test call with 5-10 team members talking to Factory, Rollback, Tests

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

### Community 127 - "test/board.test.js"
Cohesion: 0.14
Nodes (15): COLUMNS, projectBoard(), { repositoryOf }, STAGES, assert, callTool(), card(), { createCfactorySource } (+7 more)

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 129 - "jira.test.js"
Cohesion: 0.13
Nodes (16): mapJira(), boundedJson(), { boundedJson }, createJiraSource(), snapshot(), { mapJira }, assert, base64 (+8 more)

### Community 130 - "k8s-policy.js"
Cohesion: 0.15
Nodes (15): BASE_PROTECTED, block(), buildPolicy(), contains(), ipNumber(), net, portRules(), ranges (+7 more)

### Community 131 - "._handleMouse"
Cohesion: 0.25
Nodes (3): extendedPointerEvent(), pointerEvent(), clientToElement()

### Community 133 - "guard.js"
Cohesion: 0.22
Nodes (12): binding(), cidrFamily(), command(), apply(), { execFile }, execFileAsync, fs, https (+4 more)

### Community 134 - "createGuard"
Cohesion: 0.35
Nodes (12): createApi(), get(), createGuard(), counters(), heartbeat(), reconcile(), reconcileOnce(), server() (+4 more)

### Community 135 - "browser.js"
Cohesion: 0.06
Nodes (8): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode, DataChannel, rawChannelProps, ReadyStates

### Community 136 - "run.js"
Cohesion: 0.13
Nodes (13): buildRendererSource(), { buildRendererSource }, { CALL_EVENTS }, crypto, fs, { installSttBridge }, { makeRedactor }, os (+5 more)

### Community 137 - "Design"
Cohesion: 0.13
Nodes (15): loadRoles(), has(), rolesOf(), assert, { loadRoles }, test, Decisions carried over from the approved spec, Decisions for this plan (+7 more)

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

### Community 155 - "Spec: call the bot "Factory""
Cohesion: 0.20
Nodes (9): 1. The name, everywhere a person sees or hears it, 2. The wake rule (`core/src/call/hearing.js`), 3. Tests, Alternatives rejected, Amendment (owner, 2026-11-26): share requests in natural words (#63), Design, Risks, Spec: call the bot "Factory" (+1 more)

### Community 156 - "check-egress.test.sh"
Cohesion: 0.27
Nodes (9): calls(), FAKE_ARGS, FAKE_CALLS, FAKE_OUT, FAKE_PROGRAM, fixture(), PATH, run() (+1 more)

### Community 157 - "Spec: a read-only standup from one Jira project, on the page (first slice of #59)"
Cohesion: 0.29
Nodes (6): Alternatives rejected, Approval (2026-11-27), Open questions, Risks, Spec: a read-only standup from one Jira project, on the page (first slice of #59), Verification

### Community 158 - "avatar-renderer.test.js"
Cohesion: 0.12
Nodes (10): source, commit, path, repo, assert, { buildRendererSource }, { chromium }, fs (+2 more)

### Community 159 - "md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 161 - "readiness.sh"
Cohesion: 0.35
Nodes (10): alive(), extra_cleanup(), mode_checks(), settle(), readiness.sh script, stop_call(), stop_helpers(), wait_event() (+2 more)

### Community 162 - "refresh.js"
Cohesion: 0.18
Nodes (13): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+5 more)

### Community 163 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.18
Nodes (10): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 8. Problems we hit (+2 more)

### Community 164 - "desktop-routes.test.js"
Cohesion: 0.06
Nodes (41): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+33 more)

### Community 165 - "eyes"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 166 - "share.test.js"
Cohesion: 0.18
Nodes (8): assert, browser, { createShare, titleFor, callLaunchArgs, installCaptureGuard }, http, pick(), { test }, { URL_BOARD }, titleFor()

### Community 167 - "Spec: one live test call with 5-10 team members talking to Factory"
Cohesion: 0.09
Nodes (21): idle(), setCameraRenderer(), Deviations after merge, Deviations (Codex review of the approved plan, 2026-11-17), Plan: A face for the bot that talks when it speaks, Rollback, Steps, Tests (+13 more)

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
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "profile.test.js"
Cohesion: 0.24
Nodes (7): createProfile(), readHead(), assert, { createProfile }, KEY, setup(), { test }

### Community 175 - "@modelcontextprotocol/sdk"
Cohesion: 0.33
Nodes (4): { ListToolsRequestSchema, CallToolRequestSchema }, { Server }, { StdioServerTransport }, @modelcontextprotocol/sdk

### Community 176 - "Intent: run RFactory in the factory cluster like the other Factory services"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decided, Intent: run RFactory in the factory cluster like the other Factory services, Open questions, Problem, Proposed outcome

### Community 177 - "desktop.test.js"
Cohesion: 0.14
Nodes (17): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), origin() (+9 more)

### Community 178 - "Spec: Phase 0, the Linux call test"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Context for later phases (not decided here), Decisions on the intent's Phase 0 questions, Design, Goal, Pass / fail, Risks, Spec: Phase 0, the Linux call test (+1 more)

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

### Community 188 - "core/test/actions.test.js"
Cohesion: 0.12
Nodes (26): ACTIONS, bounded(), canonical(), CREATE_STATUSES, { createHash }, criteria(), FIELDS, INVESTIGATION_FIELDS (+18 more)

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

### Community 196 - "observer.js"
Cohesion: 0.24
Nodes (8): [chrome, dir], close(), controller, endWatch, fs, path, stop(), stopped

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
Cohesion: 0.17
Nodes (10): Approval (2026-11-27), Decisions (approved intent and spec, as they apply to slice B), Deviations, Open questions, Plan: project-aware calls, slice B (writes for every project), Rollback, State on 2026-11-27 (checked read-only), Steps (+2 more)

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
Cohesion: 0.12
Nodes (12): Environment and scope reference, Per-call worker environment variables (set internally), Scope fields (`RFACTORY_SCOPE_FILE`), Web server environment variables, createStt(), fs, assert, { createStt } (+4 more)

### Community 238 - "join"
Cohesion: 0.10
Nodes (21): join(), Affected users and systems, Candidate causes, and what the code says, Constraints, Decisions (2026-11-27), How a caption becomes a question today, Intent: the first question after the bot joins is heard in Meet captions mode, Open questions (+13 more)

### Community 240 - "Design"
Cohesion: 0.14
Nodes (13): Alternatives rejected, Design, Effects are derived, not trusted, Keys and switches, Pending actions and approval, Reading CFactory's results, Recognising an action request, Risks (+5 more)

### Community 241 - "Intent: one live test call with 5-10 team members talking to Factory"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: one live test call with 5-10 team members talking to Factory, Open questions, Problem, Proposed outcome

### Community 242 - "Spec: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Design, Risks, Spec: the call Chrome runs with its sandbox on, so Meet admits the bot, Verification

### Community 243 - "callevents.js"
Cohesion: 0.29
Nodes (5): filter(), GREETING, HEARING, LOG_CLASSES, STATES

### Community 244 - "refuseKeyEnv"
Cohesion: 0.10
Nodes (20): Affected users and systems, Amendments (owner, 2026-11-26), Constraints, Decisions (owner, 2026-11-26: "approve with your recommendations"), Intent: in-call agents, the model with live tools, provider chosen per call, Open questions, Problem, Proposed outcome (+12 more)

### Community 245 - "createShare"
Cohesion: 0.47
Nodes (9): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+1 more)

### Community 246 - "lifecycle.js"
Cohesion: 0.22
Nodes (6): { buildPolicy }, { createDecoder, tag, encode, LANGUAGE }, crypto, net, { nonce: newNonce }, { StringDecoder }

### Community 247 - "gateway.js"
Cohesion: 0.06
Nodes (37): checkFactsDetailed(), CLAIM, COUNT, { summarise }, WORDS, createGateway(), call(), numberFrom() (+29 more)

### Community 248 - "Design"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Source adapters (+1 more)

### Community 249 - "main"
Cohesion: 0.53
Nodes (5): connect(), handshake(), main(), [mode, url], out()

### Community 250 - "Deviations from the spec revision (Codex re-check and plan review, for approval with this plan)"
Cohesion: 0.25
Nodes (8): findVeth(), wait(), Decisions carried over from the approved spec revision, Deviations from the spec revision (Codex re-check and plan review, for approval with this plan), Plan: desktops as KubeVirt VMs in the k3d cluster (#3, revision), Rollback, Steps, Tests

### Community 251 - "scope.js"
Cohesion: 0.08
Nodes (28): DESTINATIONS, fs, LISTEN, loadScope(), { makeRedactor }, name(), path, resolveListen() (+20 more)

### Community 252 - "Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence, Open questions, Problem, Proposed outcome

### Community 253 - "Plan: `e2e-*` cleanup, first slice: the read-only inventory script"
Cohesion: 0.17
Nodes (11): 1. `core/src/sources/cfactory.js`: one tenant-wide read (coder), 4. Full tests, review, commit (lead), 5. One live read-only run, and the list on issue #60 (lead), Decisions (2026-11-27), Decisions (approved intent and spec), Open questions, Plan: `e2e-*` cleanup, first slice: the read-only inventory script, Rollback (+3 more)

### Community 254 - "fill_window"
Cohesion: 0.43
Nodes (8): deflate_fast(), deflate_huff(), deflate_rle(), deflate_slow(), deflate_stored(), fill_window(), flush_block_only(), longest_match()

### Community 255 - "stt-languages.test.js"
Cohesion: 0.38
Nodes (5): toWhisperLanguage(), WHISPER_LANGUAGES, assert, test, { WHISPER_LANGUAGES, toWhisperLanguage }

### Community 256 - "Steps"
Cohesion: 0.17
Nodes (14): inScope(), repositoryOf(), validPath(), size(), ctx(), Decisions (approved intent and spec, with the owner's amendments of 2026-11-26), Deviations, Plan: in-call agents, slice 1: live read-only lookups (+6 more)

### Community 257 - "lookups.test.js"
Cohesion: 0.17
Nodes (9): createLookups(), assert, card, { createCfactorySource }, { createGithubRead, validPath, repoUrl }, { createLookups, FACTORY, GITHUB, validate }, lookup(), { makeRedactor } (+1 more)

### Community 258 - "Plan: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.29
Nodes (6): Accepted risk, Decisions carried over (approved intent and spec), Deviations, Plan: the call Chrome runs with its sandbox on, so Meet admits the bot, Rollback, Tests

### Community 259 - "net.js"
Cohesion: 0.27
Nodes (10): cidr(), contains(), ipValue(), net, preview(), assert, protectedRanges, test (+2 more)

### Community 260 - "running"
Cohesion: 0.17
Nodes (11): Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Tests, 1. Keys and the scope file (decisions 1, 8), 5. What an agent sees: the wrapper, 7. Limits and the page (constraint "agents must not get in the page's way") (+3 more)

### Community 261 - "makeTable"
Cohesion: 0.67
Nodes (3): crc32(), makeTable(), read_buf()

### Community 262 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Control-channel additions (an additive change to #3), Design, Order and dependencies, Proposing, approving, stopping, Risks, Spec: Show the CFactory board in the call, The constraint that shapes it (+2 more)

### Community 263 - "avatars.test.js"
Cohesion: 0.20
Nodes (8): assert, crypto, dir, fs, ids, manifest, path, test

### Community 264 - "github-read.js"
Cohesion: 0.28
Nodes (7): createGithubRead(), commit(), newest(), request(), repoUrl(), { TextDecoder }, 2. The connection: Jira Cloud's REST API, directly

### Community 265 - "k8s-policy.test.js"
Cohesion: 0.28
Nodes (8): addressBits(), assert, assertPolicySchema(), { buildPolicy }, cidrContains(), input, ranges, test

### Community 266 - "Steps"
Cohesion: 0.43
Nodes (8): Steps, Steps, loadReview(), openPage(), run(), wireCall(), composeStandalone(), projectPage()

### Community 267 - "Intent: see why Meet refuses the call bot, and recover from it"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: see why Meet refuses the call bot, and recover from it, Open questions, Problem, Proposed outcome

### Community 268 - "Steps"
Cohesion: 0.57
Nodes (7): Steps, handleAction(), loadActions(), loadPanels(), renderAction(), renderActions(), storeOf()

### Community 269 - "cfactory.js"
Cohesion: 0.33
Nodes (4): boundedFetch(), { Client }, STATE, { StreamableHTTPClientTransport }

### Community 270 - "actions.js"
Cohesion: 0.33
Nodes (5): { closeEvidence }, { deriveEffects, describe }, FINAL, { randomUUID }, { validate, hashPayload, canonical }

### Community 271 - "wireProjectCall"
Cohesion: 0.83
Nodes (4): wireProjectCall(), open(), refresh(), send()

## Knowledge Gaps
- **41 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+36 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2075 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Websock` connect `Websock` to `rfb.js`, `.rQwait`, `browser.js`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _41 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `makeRedactor` to `Steps`, `running`, `createCallManager`, `Websock`, `agents.test.js`, `Steps`, `error`, `server.js`, `tts.test.js`, `Spec: one live test call with 5-10 team members talking to Factory`, `createInvestigationManager`, `createActionManager`, `core/test/actions.test.js`, `C5. Tools and wrapper (`web/agent-tools.js`)`, `review.js`, `createShareManager`, `el`, `shell-browser.test.js`, `Plan: an MCP server for agents, slice A: read RFactory with a read key`, `Steps`, `refuseKeyEnv`, `listProjects`, `gateway.js`, `scope.js`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `rfb.js` be split into smaller, more focused modules?**
  _Cohesion score 0.052600818234950324 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `Steps` to `shell-browser.test.js`, `C5. Tools and wrapper (`web/agent-tools.js`)`, `createActionManager`, `createCallManager`, `web/test/notes.test.js`, `createLifecycle`, `review.js`, `error`, `wireProjectCall`, `hearing.test.js`, `Plan: project-aware calls, slice B (writes for every project)`, `Profiles`, `el`, `Websock`, `Steps`, `gateway.js`, `proxy.js`, `server.js`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `test/call.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07226890756302522 - nodes in this community are weakly interconnected._