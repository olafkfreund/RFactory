# Graph Report - RFactory-jira59  (2026-11-28)

## Corpus Check
- 383 files · ~645,234 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 10, .nix 6, .css 4)

## Summary
- 4504 nodes · 8213 edges · 308 communities (270 shown, 38 thin omitted)
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 1336 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cb868b83`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verify lib.sh
- app.test.js
- rfb.js
- test/call.test.js
- web/test/notes.test.js
- createCallManager
- claude-cli.js
- createLifecycle
- createGrantManager
- logging.js
- join
- test desktop-ui.test.js
- guard.test.js
- RFB
- runner runner.test.js
- agent-tools.js
- e2e-inventory.test.js
- redact.js
- runner runner.js
- investigations.test.js
- test server.test.js
- brain.test.js
- test avatar-state.test.js
- Profiles
- ._handleMouse
- agents.test.js
- core/test/notes.test.js
- rfactory-standup.js
- .text
- createApp
- lookups.js
- share.test.js
- claude-cli.test.js
- ref_node_assert
- tts.test.js
- Design
- validLink
- captions
- stt-bridge.test.js
- deflate.js
- cfactory-write.test.js
- kyverno-scope.test.js
- verify verify.test.js
- rfactory.test.js
- Spec: the bot hears the call itself (its own speech-to-text)
- ref_node_path
- inflate.js
- verify net.sh
- verify profiles.sh
- lookup-endpoint.test.js
- e2e-inventory.js
- spike hello-call.test.js
- app.js
- cli.test.js
- createInvestigationManager
- index.js
- handleConnect
- runner protocol.js
- server.js
- schedule.test.js
- proxy.js
- Deviations from the spec (for approval with this plan)
- share-desktop.test.js
- web/package.json
- agent-endpoint.js
- reaper reaper.test.js
- agent-endpoint.test.js
- jira.js
- lookups.test.js
- test cfactory.test.js
- agent/call.test.js
- proxy.test.js
- profiles.test.js
- bot bot/package.json
- review.js
- trees.js
- runner k8s-lifecycle.test.js
- live-view.test.js
- checkFacts
- Display
- standup.test.js
- Design
- spike spike/package.json
- guard.js
- test run.test.js
- Steps
- web/call.js
- core/package.json
- rfactory.js
- bot run()
- Design
- gateway.test.js
- rfactory-client.js
- desktop desktop/package.json
- kubevirt.test.js
- ref_node_fs
- Spec: an approved, read-only Claude investigation from the call
- Design
- investigations.js
- Plan: a read-only standup from one Jira project, on the page (first slice of #59)
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
- Design
- des.js
- Design
- shares.test.js
- github.test.js
- boundary.test.js
- Keyboard
- Intent: call the bot "Factory"
- RSAAESAuthenticationState
- deflator.js
- k14 results: agent workspace desktops on k3d with KubeVirt
- verify e2e.sh
- H264Decoder
- k3d k11.sh
- k3d mk-tls.sh
- cfactory.js
- verify liveview.sh
- jira.test.js
- Design
- mapCard
- GestureHandler
- lifecycle.js
- k8s-policy.js
- browser.js
- run.js
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
- Spec: call the bot "Factory"
- check-egress.test.sh
- facts.js
- avatar-renderer.test.js
- md5.js
- TightDecoder
- readiness.sh
- Spec: one live test call with 5-10 team members talking to Factory
- readme.test.js
- desktop-routes.test.js
- eyes
- scoped
- .off
- Socket
- teams-tap-spike.js
- Design
- Intent: clean up the `e2e-*` test repositories (GitHub and CFactory)
- Phase 0 results: can a guest bot join Google Meet, speak and read captions?
- Intent: run a Claude terminal from the call, and show it
- createGuard
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
- origin
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
- Steps
- rfactory-auth.js
- check-egress.sh
- Design
- Intent: one live test call with 5-10 team members talking to Factory
- Spec: the call Chrome runs with its sandbox on, so Meet admits the bot
- callevents.js
- avatars.test.js
- control.js
- createClient
- shell-browser.test.js
- Design
- Plan: Agent workspace, a disposable desktop per call (#3)
- Intent: a user guide and a feature list for RFactory
- loadScope
- Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence
- compare
- refuseKeyEnv
- createClaudeBrain
- running
- Plan: `e2e-*` cleanup, first slice: the read-only inventory script
- pod.test.js
- Intent: a command-line tool for RFactory, slice A: sign in, read, join and leave
- Design
- items.js
- ollama-standup.js
- Intent: Phase 2, slice A: the bot joins a Zoom meeting as a guest
- H264Parser
- Desktop VMs on the k3d factory cluster
- client.test.js
- Plan: Phase 3, act on the Factories from the call
- el
- Steps
- Intent: see why Meet refuses the call bot, and recover from it
- observer.js
- Steps
- Plan: one live test call with 5-10 team members talking to Factory
- Steps
- Deviations from the spec revision (Codex re-check and plan review, for approval with this plan)
- github-read.js
- createProxy
- Design
- client.js
- Intent: the bot hears the call itself (its own speech-to-text)
- Steps
- Plan: the call Chrome runs with its sandbox on, so Meet admits the bot
- Intent: redact credentials that wrap across log lines
- Steps
- Decisions (carried from the approved intent and spec)
- events.js
- Spec: a read-only standup from one Jira project, on the page (first slice of #59)
- start
- Intent: elevated calls, slice 1: pair a call in the portal and hold a grant for it
- error
- cap
- H264Context
- gateway.js
- Plan: Show the CFactory board in the call
- Plan: an approved, read-only Claude investigation from the call (RFactory side)
- Plan: standup notes, slice 1: dictated notes, review on the page, a Markdown download
- Spec: Read Jira issues in a project call
- How the bot hears
- Steps
- a
- Plan: Add project-bound Jira reads to calls
- renderInvestigation
- Spec: A face for the bot that talks when it speaks
- .sendKey
- grants.test.js
- Spec: Agent workspace, a disposable desktop per call
- Spec: project-aware calls

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `makeRedactor()` - 51 edges
3. `createLifecycle()` - 45 edges
4. `createCallManager()` - 40 edges
5. `Steps` - 39 edges
6. `createApp()` - 38 edges
7. `loadScope()` - 37 edges
8. `createInvestigationManager()` - 37 edges
9. `Steps` - 37 edges
10. `checkFacts()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Alternatives rejected` --references--> `afterJoin()`  [INFERRED]
  spec/2026-11-27-56-first-question-captions.md → bot/run.js
- `Findings this design rests on (checked 2026-11-19)` --references--> `code()`  [INFERRED]
  spec/2026-11-19-18-claude-terminals.md → core/bin/e2e-inventory.js
- `Decisions carried over (approved intent and spec)` --references--> `hashPayload()`  [INFERRED]
  plan/2026-11-19-18-claude-terminals.md → core/src/actions/allowlist.js
- `3. Tests` --references--> `createHearing()`  [INFERRED]
  spec/2026-11-26-62-bot-name-factory.md → core/src/call/hearing.js
- `2. Hearing a note` --references--> `createHearing()`  [INFERRED]
  spec/2026-11-27-58-standup-notes.md → core/src/call/hearing.js

## Import Cycles
- None detected.

## Communities (308 total, 38 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "app.test.js"
Cohesion: 0.09
Nodes (15): renderFooter(), ALPHA, assert, base, BETA, card(), Node, notesShim() (+7 more)

### Community 2 - "rfb.js"
Cohesion: 0.06
Nodes (17): CopyRectDecoder, HextileDecoder, JPEGDecoder, RawDecoder, RREDecoder, ZlibDecoder, Deflator, encodings (+9 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.07
Nodes (24): hashLink(), assert, { createCallManager }, { createGrantManager }, { createInvestigationManager }, { EventEmitter }, fakeClock(), finishSpeech() (+16 more)

### Community 4 - "web/test/notes.test.js"
Cohesion: 0.09
Nodes (34): Contracts between the steps, { checkNote, sentence, headline, toMarkdown, notesHash }, createNotesManager(), approve(), closeIntake(), discard(), download(), edit() (+26 more)

### Community 5 - "createCallManager"
Cohesion: 0.21
Nodes (24): Captions vs own transcription, Deviations (Codex review of the approved plan, 2026-11-17), Steps, Steps, createCallManager(), addressed(), answer(), drain() (+16 more)

### Community 6 - "claude-cli.js"
Cohesion: 0.12
Nodes (15): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, LOOKUP_ERRORS, LOOKUP_SYSTEM_PROMPT (+7 more)

### Community 7 - "createLifecycle"
Cohesion: 0.10
Nodes (36): 8. Problems we hit, createLifecycle(), accept(), allowAccept(), attachAgent(), boot(), callAttach(), cancel() (+28 more)

### Community 8 - "createGrantManager"
Cohesion: 0.23
Nodes (20): allows(), binding(), createGrantManager(), check(), clearCode(), clearGrant(), emit(), endCall() (+12 more)

### Community 9 - "logging.js"
Cohesion: 0.13
Nodes (3): DataChannel, rawChannelProps, ReadyStates

### Community 10 - "join"
Cohesion: 0.08
Nodes (25): join(), Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 1b, a voice standup in Google Meet, Rollback, Tests, Decisions, Deviations (+17 more)

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "guard.test.js"
Cohesion: 0.13
Nodes (14): assert, { buildPolicy }, cniResult(), entry, { execFileSync }, fake(), fs, https (+6 more)

### Community 13 - "RFB"
Cohesion: 0.07
Nodes (5): clientEncodings(), enableContinuousUpdates(), RFB, setDesktopSize(), xvpOp()

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 15 - "agent-tools.js"
Cohesion: 0.07
Nodes (28): action, atom(), { CARD_KEY }, createAgentTools(), invoke(), descriptions, freshness, investigation (+20 more)

### Community 16 - "e2e-inventory.test.js"
Cohesion: 0.12
Nodes (22): assert, { build, hashOf, compare, compareAfter, main }, clone(), endpointsOf(), { EventEmitter }, fixture(), fs, ghFake() (+14 more)

### Community 17 - "redact.js"
Cohesion: 0.11
Nodes (32): base64(), JOINED_RULES, jwtSpans(), KEY_VALUE_AT, keyValueAt(), keyValueMatch(), keyValueSpans(), makeRedactor() (+24 more)

### Community 18 - "runner runner.js"
Cohesion: 0.08
Nodes (28): clearInterval(), createK8s(), { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade() (+20 more)

### Community 19 - "investigations.test.js"
Cohesion: 0.12
Nodes (19): approve(), assert, binding, { createInvestigationManager }, { createRecord }, fs, { loadRoles }, { makeRedactor } (+11 more)

### Community 20 - "test server.test.js"
Cohesion: 0.06
Nodes (29): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, GH_KEYS, ghItems, { handleCall } (+21 more)

### Community 21 - "brain.test.js"
Cohesion: 0.11
Nodes (19): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+11 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.10
Nodes (15): buildRendererSource(), installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState() (+7 more)

### Community 23 - "Profiles"
Cohesion: 0.17
Nodes (5): fs, LABEL, name(), Profiles, { randomUUID, hkdfSync }

### Community 24 - "._handleMouse"
Cohesion: 0.25
Nodes (3): extendedPointerEvent(), pointerEvent(), clientToElement()

### Community 25 - "agents.test.js"
Cohesion: 0.09
Nodes (20): composeAgents(), agents, assert, cards, { Client }, compose(), { createApp, composeAgents, composeWrites, refuseKeyEnv }, fs (+12 more)

### Community 26 - "core/test/notes.test.js"
Cohesion: 0.13
Nodes (20): hashPayload(), checkNote(), closeEvidence(), { FAILED }, { hashPayload }, KINDS, notesHash(), { reviewCard, ACTIVE } (+12 more)

### Community 27 - "rfactory-standup.js"
Cohesion: 0.12
Nodes (25): ageOf(), approveClaude(), causes(), { checkFacts }, { connect }, { createBrain }, { createCfactorySource }, { createClaudeBrain, ARGV: CLAUDE_ARGV } (+17 more)

### Community 28 - ".text"
Cohesion: 0.18
Nodes (17): idle(), action(), Deviations, Open questions, Plan: `rfactory` CLI, slice A: sign in, read, join and leave, Rollback, Steps, Tests (+9 more)

### Community 29 - "createApp"
Cohesion: 0.21
Nodes (13): C2. Shared reads (`web/reads.js`), { buildStandup, speakStandupHeadline }, createReads(), bind(), listProjects(), describe(), { mapCard }, refusal() (+5 more)

### Community 30 - "lookups.js"
Cohesion: 0.17
Nodes (8): { mapCard }, specs, { STATES }, validate(), { validPath, validNumber }, { TextDecoder }, validNumber(), validPath()

### Community 31 - "share.test.js"
Cohesion: 0.08
Nodes (30): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+22 more)

### Community 32 - "claude-cli.test.js"
Cohesion: 0.10
Nodes (21): checkClaudeHome(), hasOverride(), claudeHash(), assert, { claudeHash, checkClaudeHome }, { createClaudeBrain }, { EventEmitter }, fs (+13 more)

### Community 33 - "ref_node_assert"
Cohesion: 0.10
Nodes (17): toSpeech(), assert, fs, path, root, test, assert, { loadRoles } (+9 more)

### Community 34 - "tts.test.js"
Cohesion: 0.13
Nodes (14): assert, { createTts }, { EventEmitter }, fs, os, { PassThrough }, path, test (+6 more)

### Community 35 - "Design"
Cohesion: 0.17
Nodes (11): 1. Call session identity and lifecycle (`web/call.js`), 2. Meeting schedule registry (`web/schedule.js`, `web/server.js`), 4. Grant manager (`web/grants.js`), 5. HTTP routes, CSRF check, and UI (`web/server.js`, `web/public/app.js`, `web/public/index.html`, `web/Containerfile`), Alternatives rejected, Decisions (2026-11-28), Design, Open questions (+3 more)

### Community 36 - "validLink"
Cohesion: 0.11
Nodes (17): Approved decisions carried from the spec, Decisions (2026-11-28), Deviations, Open questions, Plan: RFactory README and feature list (slice 1), Rollback, Steps, Tests (+9 more)

### Community 37 - "captions"
Cohesion: 0.10
Nodes (22): captions(), When the bot starts to hear (Meet captions), Approval (2026-11-27), Decisions (the approved intent and spec), Deviations, Plan: the first question after the bot joins is heard in Meet captions mode, Rollback, Steps (+14 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.08
Nodes (12): installSttBridge(), assert, event(), fs, { installSttBridge }, path, RTCRtpReceiver, RTCRtpSender (+4 more)

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
Cohesion: 0.10
Nodes (20): assert, bash(), beats(), CHECKS, fs, http, INPUT, { join } (+12 more)

### Community 43 - "rfactory.test.js"
Cohesion: 0.11
Nodes (23): app(), assert, BIN, cli(), run(), signedIn(), start(), { createApp } (+15 more)

### Community 44 - "Spec: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.17
Nodes (12): listen(), 1. The service: `rfactory-stt`, 2. In the bot (`bot/run.js`, both deployments): cut speech, send segments, 3. In the call manager (`web/call.js`): transcribe and hear, 4. The listen setting, 5. Packaging and deploy, Design, Measured on p620 (2026-11-21) (+4 more)

### Community 45 - "ref_node_path"
Cohesion: 0.15
Nodes (10): fs, path, assert, { createRecord }, fs, { makeRedactor }, os, path (+2 more)

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

### Community 50 - "e2e-inventory.js"
Cohesion: 0.17
Nodes (22): build(), codes(), { createCfactorySource }, { createHash }, fail(), FIXED, fs, keyOf() (+14 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.13
Nodes (13): Steps, Pieces, botName(), path, run(), assert, { EventEmitter }, fs (+5 more)

### Community 52 - "app.js"
Cohesion: 0.11
Nodes (29): ago(), clear(), clock(), el(), fill(), grantRefresh, INVESTIGATION_LIVE, investigationStores (+21 more)

### Community 53 - "cli.test.js"
Cohesion: 0.08
Nodes (16): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+8 more)

### Community 54 - "createInvestigationManager"
Cohesion: 0.20
Nodes (32): createInvestigationManager(), approve(), clearLiveTimers(), closeLog(), endCall(), expire(), findRun(), finish() (+24 more)

### Community 55 - "index.js"
Cohesion: 0.09
Nodes (26): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+18 more)

### Community 56 - "handleConnect"
Cohesion: 0.22
Nodes (16): checkedAddresses(), addresses(), answerDns(), handleConnect(), handleForward(), serve(), drain(), inRange() (+8 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.24
Nodes (16): board(), boolean(), columns, count(), exact(), identity, log(), login() (+8 more)

### Community 58 - "server.js"
Cohesion: 0.09
Nodes (32): Deviations from the spec (approved with this plan), Final review deviations from this plan, 5. The web app and the page (`web/server.js`, `web/public/app.js`), createApp(), standaloneStandup(), standup(), { createReads, refusal, describe, CARD_KEY }, { createVmSpawn, platformOf } (+24 more)

### Community 59 - "schedule.test.js"
Cohesion: 0.14
Nodes (18): { createHash, randomUUID }, createScheduleRegistry(), add(), list(), match(), remove(), save(), fs (+10 more)

### Community 60 - "proxy.js"
Cohesion: 0.19
Nodes (11): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, ipv6Bytes() (+3 more)

### Community 61 - "Deviations from the spec (for approval with this plan)"
Cohesion: 0.18
Nodes (14): label(), hosts(), Decisions carried over from the approved spec, Deviations from the spec (for approval with this plan), Answers to the intent's open questions, Design, Driving apps, Feasibility gate (first plan step) (+6 more)

### Community 62 - "share-desktop.test.js"
Cohesion: 0.24
Nodes (7): createShareDesktop(), schedule(), stopPolling(), assert, { createShareDesktop }, setup(), test

### Community 63 - "web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 64 - "agent-endpoint.js"
Cohesion: 0.19
Nodes (14): BAD, createAgentEndpoint(), find(), handle(), valid(), { createHash, timingSafeEqual }, digest(), errorResult() (+6 more)

### Community 65 - "reaper reaper.test.js"
Cohesion: 0.17
Nodes (13): createReaper(), leaseStale(), tick(), fs, main(), assert, { createReaper }, fake() (+5 more)

### Community 66 - "agent-endpoint.test.js"
Cohesion: 0.15
Nodes (12): agents, assert, { Client }, { createAgentEndpoint }, fake, http, names, request() (+4 more)

### Community 67 - "jira.js"
Cohesion: 0.18
Nodes (17): mapJira(), boundedJson(), { boundedJson }, createJiraRead(), projectIssue(), createJiraSource(), snapshot(), currentIssues() (+9 more)

### Community 68 - "lookups.test.js"
Cohesion: 0.12
Nodes (12): createLookups(), FACTORY, GITHUB, JIRA, assert, card, { createCfactorySource }, { createGithubRead, validPath, repoUrl } (+4 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.11
Nodes (10): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, invReplies(), invWith(), { makeRedactor }, reply() (+2 more)

### Community 70 - "agent/call.test.js"
Cohesion: 0.15
Nodes (13): createCallWorker(), { createShare, callLaunchArgs }, fs, { PassThrough }, assert, { createCallWorker, withProxy, MEET_GUEST, TEAMS_CAPTIONS }, { EventEmitter }, fixture() (+5 more)

### Community 71 - "proxy.test.js"
Cohesion: 0.13
Nodes (11): assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard, os (+3 more)

### Community 72 - "profiles.test.js"
Cohesion: 0.15
Nodes (12): admin, assert, fakeK8s(), fixture(), fs, { hkdfSync }, MASTER, os (+4 more)

### Community 73 - "bot bot/package.json"
Cohesion: 0.14
Nodes (13): dependencies, playwright-core, @vibeconferencing/calls, engines, node, playwright-core, @vibeconferencing/calls, license (+5 more)

### Community 74 - "review.js"
Cohesion: 0.14
Nodes (19): headline(), discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun() (+11 more)

### Community 75 - "trees.js"
Cohesion: 0.16
Nodes (28): bi_flush(), bi_reverse(), bi_windup(), build_bl_tree(), build_tree(), compress_block(), copy_block(), d_code() (+20 more)

### Community 76 - "runner k8s-lifecycle.test.js"
Cohesion: 0.19
Nodes (9): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+1 more)

### Community 77 - "live-view.test.js"
Cohesion: 0.17
Nodes (10): assert, clientSession, { createApp }, fbUpdate, includes(), { loadRoles }, net, start() (+2 more)

### Community 78 - "checkFacts"
Cohesion: 0.10
Nodes (23): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass** (+15 more)

### Community 80 - "standup.test.js"
Cohesion: 0.21
Nodes (9): buildStandup(), { FAILED, mapCard }, speakStandupHeadline(), assert, build(), { buildStandup, speakStandupHeadline }, freshness(), { makeRedactor } (+1 more)

### Community 81 - "Design"
Cohesion: 0.06
Nodes (32): gateway(), Affected users and systems, Constraints, Decisions (2026-11-27), Intent: Enforce an egress limit for the RFactory pod, Open questions, Problem, Proposed outcome (+24 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "guard.js"
Cohesion: 0.20
Nodes (13): binding(), cidrFamily(), command(), apply(), { execFile }, execFileAsync, fs, https (+5 more)

### Community 84 - "test run.test.js"
Cohesion: 0.09
Nodes (14): assert, audioJoined(), { EventEmitter }, fs, joined(), { PassThrough }, path, { run } (+6 more)

### Community 85 - "Steps"
Cohesion: 0.27
Nodes (20): Steps, createShareManager(), approve(), cleanup(), close(), emit(), endCall(), expire() (+12 more)

### Community 86 - "web/call.js"
Cohesion: 0.08
Nodes (27): NOTE, NOTES, SELF_NAMES, BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts, checkFactsDetailed }, emitLimits(), lookupAnswer() (+19 more)

### Community 87 - "core/package.json"
Cohesion: 0.14
Nodes (13): bin, rfactory, dependencies, @modelcontextprotocol/sdk, openai, engines, node, license (+5 more)

### Community 88 - "rfactory.js"
Cohesion: 0.21
Nodes (12): argumentsFor(), { DEFAULT_URL, createClient, failure, sanitize, targetUrl }, hideToken(), human(), { login, logout, readSession }, main(), MULTILINE, { parseArgs } (+4 more)

### Community 89 - "bot run()"
Cohesion: 0.17
Nodes (24): run(), abandon(), afterJoin(), discardOpen(), guestHelper(), idleAvatar(), newGate(), onAudio() (+16 more)

### Community 90 - "Design"
Cohesion: 0.18
Nodes (11): speechLevel(), Decisions carried over (approved intent and spec), AI disclosure, Cost, Design, Licence (owner decision 2: the whole repository is AGPL-3.0), Packaging, Portraits and notices (+3 more)

### Community 91 - "gateway.test.js"
Cohesion: 0.13
Nodes (9): assert, base, { createGateway }, fs, { loadScope }, { makeRedactor }, os, path (+1 more)

### Community 92 - "rfactory-client.js"
Cohesion: 0.13
Nodes (13): action, events, fields(), investigation, item, project, readEvent(), refusalReasons (+5 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "kubevirt.test.js"
Cohesion: 0.13
Nodes (13): octets(), parseCmdline(), assert, { createAgent }, { createCallWorker }, { createControl }, { dial }, { encode, createDecoder } (+5 more)

### Community 95 - "ref_node_fs"
Cohesion: 0.08
Nodes (19): assert, { createProfile }, KEY, { test }, fs, assert, { createK8s }, fs (+11 more)

### Community 96 - "Spec: an approved, read-only Claude investigation from the call"
Cohesion: 0.18
Nodes (10): 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), 3. RFactory: hearing, approval, the shared log, the spoken result, Alternatives rejected, Design, Findings this design rests on (checked 2026-11-19), Order and dependencies, Risks (+2 more)

### Community 97 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Design, Images: built, signed and promoted by CI, like CFactory, One pod, as today, Order and cutover, Owner decisions (proposed defaults), Pod security, Reach: tunnel, DNS, Keycloak (+4 more)

### Community 98 - "investigations.js"
Cohesion: 0.15
Nodes (13): count(), COUNT_CLAIM, announce(), publish(), summarize(), { hashPayload, revalidate, investigationApprovalText, INVESTIGATION_LIMITS }, namedRepository(), QUANTITY (+5 more)

### Community 99 - "Plan: a read-only standup from one Jira project, on the page (first slice of #59)"
Cohesion: 0.33
Nodes (5): Decisions (2026-11-27), Open questions, Plan: a read-only standup from one Jira project, on the page (first slice of #59), Rollback, Tests

### Community 100 - ".rQwait"
Cohesion: 0.12
Nodes (3): fbUpdateRequest(), pixelFormat(), Websock

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
Cohesion: 0.17
Nodes (11): Alternatives rejected, Bounded run time, Decisions on the intent's open questions (proposed), Design, Find first, replace once (`core/src/redact.js` `logSafeWindow`), PEM flag across polls (`web/shares.js:49-51`), PEM marker scanner, Risks (+3 more)

### Community 108 - "vnc.test.js"
Cohesion: 0.12
Nodes (19): bridgeViewOnly(), createFilter(), assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session (+11 more)

### Community 109 - "web/test/actions.test.js"
Cohesion: 0.09
Nodes (32): Steps, { closeEvidence }, createActionManager(), approve(), emit(), endCall(), expire(), finish() (+24 more)

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "Plan: an MCP server for agents, slice A: read RFactory with a read key"
Cohesion: 0.14
Nodes (13): Approval (2026-11-27), C1. Scope (`core/src/scope.js`), C3. Project ids on entries, C4. The listener (`core/src/agent-endpoint.js`), Contracts (fixed; steps refer to them), Deviations, Open questions, Plan: an MCP server for agents, slice A: read RFactory with a read key (+5 more)

### Community 112 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Control-channel additions (an additive change to #3), Design, Order and dependencies, Proposing, approving, stopping, Risks, Spec: Show the CFactory board in the call, The constraint that shapes it (+3 more)

### Community 113 - "des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 114 - "Design"
Cohesion: 0.13
Nodes (14): 11. Not in this slice, 1. The switch, 2. Hearing a note, 4. The notes of a call, 6. Approving and downloading, 7. Card proposals from a note, 8. The spoken headline, 9. The record (+6 more)

### Community 115 - "shares.test.js"
Cohesion: 0.12
Nodes (16): @rfactory/core, { hashPayload }, { randomUUID }, approve(), assert, binding, callOf(), { createShareManager } (+8 more)

### Community 116 - "github.test.js"
Cohesion: 0.05
Nodes (39): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFile } (+31 more)

### Community 117 - "boundary.test.js"
Cohesion: 0.11
Nodes (12): assert, { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs, { loadRoles }, { makeRedactor } (+4 more)

### Community 119 - "Intent: call the bot "Factory""
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-26: "approved", with the recommendations), Intent: call the bot "Factory", Open questions, Problem, Proposed outcome

### Community 120 - "RSAAESAuthenticationState"
Cohesion: 0.10
Nodes (5): RA2Cipher, RSAAESAuthenticationState, EventTargetMixin, decodeUTF8(), encodeUTF8()

### Community 121 - "deflator.js"
Cohesion: 0.38
Nodes (4): deflateInit(), Z_DEFAULT_COMPRESSION, Z_FULL_FLUSH, ZStream()

### Community 122 - "k14 results: agent workspace desktops on k3d with KubeVirt"
Cohesion: 0.18
Nodes (9): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+1 more)

### Community 123 - "verify e2e.sh"
Cohesion: 0.53
Nodes (4): real_ids(), e2e.sh script, teams_call(), WEB_MAX

### Community 125 - "k3d k11.sh"
Cohesion: 0.50
Nodes (4): env_of(), RFACTORY_DESKTOP, RFACTORY_RUNNER_URL, k11.sh script

### Community 126 - "k3d mk-tls.sh"
Cohesion: 0.70
Nodes (4): FILES, key(), leaf(), mk-tls.sh script

### Community 127 - "cfactory.js"
Cohesion: 0.09
Nodes (26): COLUMNS, projectBoard(), { repositoryOf }, STAGES, boundedFetch(), { Client }, inScope(), repositoryOf() (+18 more)

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 129 - "jira.test.js"
Cohesion: 0.18
Nodes (9): assert, base64, { createJiraSource, createJiraRead }, fixture(), issue(), rows(), scope, start() (+1 more)

### Community 130 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Design, Hearing: wake phrase and end of a question, Packaging, Risks, Spec: Phase 1b, a voice standup in Google Meet, Speech (TTS), The bot process (`bot/run.js`) (+4 more)

### Community 131 - "mapCard"
Cohesion: 0.15
Nodes (13): mapCard(), 10. Intent constraints carried into slice 1, 1. Data comes from four CFactory read tools, all on the existing read key, 3. Failure and freshness, 4. `core/src/standup.js` (new, pure): `buildStandup(cards, freshness)`, 6. Review (`core/src/review.js`, new, pure), 8. `core/src/sources/cfactory.js`, 9. CFactory issues to file when this spec is approved (slice 2 dependencies) (+5 more)

### Community 133 - "lifecycle.js"
Cohesion: 0.17
Nodes (9): nonce(), { buildPolicy }, { createDecoder, tag, encode, LANGUAGE }, crypto, net, { nonce: newNonce }, { StringDecoder }, Deviations (+1 more)

### Community 134 - "k8s-policy.js"
Cohesion: 0.05
Nodes (45): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+37 more)

### Community 135 - "browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

### Community 136 - "run.js"
Cohesion: 0.14
Nodes (10): { buildRendererSource }, { CALL_EVENTS }, crypto, fs, { installSttBridge }, { makeRedactor }, os, path (+2 more)

### Community 137 - "loadRoles"
Cohesion: 0.15
Nodes (13): loadRoles(), has(), rolesOf(), commit(), Decisions carried over from the approved spec, Decisions for this plan, Deviations, Plan: v1 roles in code (admin, approver, member), slice "roles" of #2 (+5 more)

### Community 139 - "u8ArrayToBigInt"
Cohesion: 0.24
Nodes (5): bigIntToU8Array(), modPow(), u8ArrayToBigInt(), DHCipher, DHPublicKey

### Community 140 - "Cursor"
Cohesion: 0.13
Nodes (9): setCameraRenderer(), ctx(), Steps, Decisions (approved intent and spec, with the owner's amendments of 2026-11-26), Plan: in-call agents, slice 1: live read-only lookups, Rollback, Shared contracts (steps 2 to 6 all follow these), Tests (+1 more)

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

### Community 155 - "Spec: call the bot "Factory""
Cohesion: 0.20
Nodes (9): 1. The name, everywhere a person sees or hears it, 2. The wake rule (`core/src/call/hearing.js`), 3. Tests, Alternatives rejected, Amendment (owner, 2026-11-26): share requests in natural words (#63), Design, Risks, Spec: call the bot "Factory" (+1 more)

### Community 156 - "check-egress.test.sh"
Cohesion: 0.27
Nodes (9): calls(), FAKE_ARGS, FAKE_CALLS, FAKE_OUT, FAKE_PROGRAM, fixture(), PATH, run() (+1 more)

### Community 157 - "facts.js"
Cohesion: 0.20
Nodes (9): checkFactsDetailed(), CLAIM, COUNT, { summarise }, WORDS, assert, { checkFacts, checkFactsDetailed }, snapshot (+1 more)

### Community 158 - "avatar-renderer.test.js"
Cohesion: 0.18
Nodes (6): assert, { buildRendererSource }, { chromium }, fs, path, test

### Community 159 - "md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 161 - "readiness.sh"
Cohesion: 0.35
Nodes (10): alive(), extra_cleanup(), mode_checks(), settle(), readiness.sh script, stop_call(), stop_helpers(), wait_event() (+2 more)

### Community 162 - "Spec: one live test call with 5-10 team members talking to Factory"
Cohesion: 0.17
Nodes (11): 2. The runbook page (slice 1, docs), 3. How the results are scored without a code change, 4. The day (slice 2, no code), 5. Deferred, Alternatives rejected, Approval (2026-11-27), Design, Open questions (+3 more)

### Community 163 - "readme.test.js"
Cohesion: 0.25
Nodes (7): assert, fs, missingPaths(), path, readme, root, test

### Community 164 - "desktop-routes.test.js"
Cohesion: 0.10
Nodes (28): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+20 more)

### Community 165 - "eyes"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 166 - "scoped"
Cohesion: 0.23
Nodes (16): decide(), decided(), decideInvestigation(), decideShare(), handleShare(), loadShares(), localTime(), renderShare() (+8 more)

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 170 - "Design"
Cohesion: 0.11
Nodes (17): Decisions (the approved intent and spec), Deviations, Plan: finish the "Factory" rename and stop false wakes at a caption block start, Rollback, Steps, Tests, 1. The wake rule (`core/src/call/hearing.js:3`), 2. A rejected mention still ends the request before it (`hearing.js:50-71`) (+9 more)

### Community 171 - "Intent: clean up the `e2e-*` test repositories (GitHub and CFactory)"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: clean up the `e2e-*` test repositories (GitHub and CFactory), Open questions, Problem, Proposed outcome

### Community 172 - "Phase 0 results: can a guest bot join Google Meet, speak and read captions?"
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "createGuard"
Cohesion: 0.35
Nodes (12): createApi(), get(), createGuard(), counters(), heartbeat(), reconcile(), reconcileOnce(), server() (+4 more)

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
Cohesion: 0.46
Nodes (7): agent_fixture(), FAKE_LOG, fixture(), PATH, refused(), run(), bootstrap-secrets.test.sh script

### Community 188 - "core/test/actions.test.js"
Cohesion: 0.07
Nodes (40): ACTIONS, bounded(), canonical(), CREATE_STATUSES, { createHash }, criteria(), FIELDS, INVESTIGATION_FIELDS (+32 more)

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

### Community 195 - "origin"
Cohesion: 0.31
Nodes (10): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), stopShare() (+2 more)

### Community 196 - "source-guard.test.js"
Cohesion: 0.20
Nodes (9): assert, fs, git(), guard, os, path, repo(), { spawnSync } (+1 more)

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
Cohesion: 0.08
Nodes (25): createHearing(), heard(), assert, { createHearing }, fakeClock(), headlineRequests, noteRequests, setup() (+17 more)

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

### Community 237 - "Steps"
Cohesion: 0.28
Nodes (13): revalidate(), Waves, Steps, Steps, Steps, createRecord(), append(), files() (+5 more)

### Community 238 - "rfactory-auth.js"
Cohesion: 0.17
Nodes (14): { constants }, { failure, relogin, targetUrl, sanitize }, fs, { homedir }, { isAbsolute, join }, login(), endpoint(), logout() (+6 more)

### Community 240 - "Design"
Cohesion: 0.09
Nodes (21): Decisions (2026-11-28), Deviations, Open questions, Plan: Elevated calls, slice 1 — portal-verified pairing, schedule, and grant, Rollback, Tests, Alternatives rejected, Design (+13 more)

### Community 241 - "Intent: one live test call with 5-10 team members talking to Factory"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: one live test call with 5-10 team members talking to Factory, Open questions, Problem, Proposed outcome

### Community 242 - "Spec: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Design, Risks, Spec: the call Chrome runs with its sandbox on, so Meet admits the bot, Verification

### Community 243 - "callevents.js"
Cohesion: 0.29
Nodes (5): filter(), GREETING, HEARING, LOG_CLASSES, STATES

### Community 244 - "avatars.test.js"
Cohesion: 0.20
Nodes (8): assert, crypto, dir, fs, ids, manifest, path, test

### Community 245 - "control.js"
Cohesion: 0.27
Nodes (10): capText(), createControl(), applyHosts(), closePage(), page(), start(), fs, originOf() (+2 more)

### Community 246 - "createClient"
Cohesion: 0.41
Nodes (11): oidc(), readSession(), createClient(), checkExpiry(), heard(), listProjects(), projectId(), request() (+3 more)

### Community 247 - "shell-browser.test.js"
Cohesion: 0.18
Nodes (7): assert, { chromium }, { createApp }, { loadRoles }, { makeRedactor }, { spawnSync }, test

### Community 248 - "Design"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Source adapters (+1 more)

### Community 249 - "Plan: Agent workspace, a disposable desktop per call (#3)"
Cohesion: 0.22
Nodes (8): exec(), Facts checked in the real repos, Open questions for the owner, Plan: Agent workspace, a disposable desktop per call (#3), Prerequisites (named revisions), Rollback, Steps, Tests

### Community 250 - "Intent: a user guide and a feature list for RFactory"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: a user guide and a feature list for RFactory, Open questions, Problem, Proposed outcome

### Community 251 - "loadScope"
Cohesion: 0.06
Nodes (36): source, commit, path, repo, DESTINATIONS, fs, LISTEN, loadScope() (+28 more)

### Community 252 - "Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence, Open questions, Problem, Proposed outcome

### Community 253 - "compare"
Cohesion: 0.83
Nodes (4): canon(), compare(), facts(), hashOf()

### Community 254 - "refuseKeyEnv"
Cohesion: 0.11
Nodes (19): Affected users and systems, Amendments (owner, 2026-11-26), Constraints, Decisions (owner, 2026-11-26: "approve with your recommendations"), Intent: in-call agents, the model with live tools, provider chosen per call, Open questions, Problem, Proposed outcome (+11 more)

### Community 255 - "createClaudeBrain"
Cohesion: 0.49
Nodes (10): createClaudeBrain(), answerTurn(), checkDestination(), lookupTurn(), note(), propose(), run(), stop() (+2 more)

### Community 256 - "running"
Cohesion: 0.09
Nodes (25): base(), source(), Deviations, Live check results (step 12), Decisions (approved intent and spec, as delivered in slice A), Delivery in two slices (a plan decision; the approved spec is unchanged), Plan: project-aware calls, slice A (project-aware reads), Rollback (in reverse order) (+17 more)

### Community 257 - "Plan: `e2e-*` cleanup, first slice: the read-only inventory script"
Cohesion: 0.12
Nodes (18): compareAfter(), checked(), gone(), number(), 2. `core/bin/e2e-inventory.js`: the pure part (codex), 3. `core/bin/e2e-inventory.js`: readers and the command line (coder), 4. Full tests, review, commit (lead), 5. One live read-only run, and the list on issue #60 (lead) (+10 more)

### Community 258 - "pod.test.js"
Cohesion: 0.22
Nodes (7): assert, fs, os, path, realPod, { spawnSync }, test

### Community 259 - "Intent: a command-line tool for RFactory, slice A: sign in, read, join and leave"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: a command-line tool for RFactory, slice A: sign in, read, join and leave, Open questions, Problem, Proposed outcome

### Community 260 - "Design"
Cohesion: 0.14
Nodes (13): 1. Keys and the scope file (decisions 1, 8), 3. Shared reads (the one control API), 5. What an agent sees: the wrapper, 6. Project ids on proposals and record lines, 7. Limits and the page (constraint "agents must not get in the page's way"), 9. Deployment, Alternatives rejected, Decisions (2026-11-27) (+5 more)

### Community 261 - "items.js"
Cohesion: 0.13
Nodes (13): FAIL, failing(), labelNames(), logins(), mapGithub(), STATES, assert, jiraScope (+5 more)

### Community 262 - "ollama-standup.js"
Cohesion: 0.29
Nodes (6): { checkFacts }, count(), fs, main(), path, { setup }

### Community 263 - "Intent: Phase 2, slice A: the bot joins a Zoom meeting as a guest"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: Phase 2, slice A: the bot joins a Zoom meeting as a guest, Open questions, Problem, Proposed outcome

### Community 265 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.04
Nodes (39): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 9. Rollback (+31 more)

### Community 266 - "client.test.js"
Cohesion: 0.09
Nodes (15): assert, { createHandler, createUpgrade }, { createRunnerClient }, { execFileSync }, fs, https, os, { PassThrough, Duplex } (+7 more)

### Community 267 - "Plan: Phase 3, act on the Factories from the call"
Cohesion: 0.33
Nodes (5): Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Tests

### Community 268 - "el"
Cohesion: 0.43
Nodes (8): 4. The tools, day(), handleNotes(), loadNotes(), notesStoreOf(), postNote(), renderNote(), renderNotes()

### Community 269 - "Steps"
Cohesion: 0.13
Nodes (23): pageLeft(), failureReport(), leftConfirmed(), watchLeft(), resolveListen(), Decisions (2026-11-28), Deviations, Open questions (+15 more)

### Community 270 - "Intent: see why Meet refuses the call bot, and recover from it"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: see why Meet refuses the call bot, and recover from it, Open questions, Problem, Proposed outcome

### Community 271 - "observer.js"
Cohesion: 0.24
Nodes (8): [chrome, dir], close(), controller, endWatch, fs, path, stop(), stopped

### Community 272 - "Steps"
Cohesion: 0.40
Nodes (4): Deviations after merge, Plan: A face for the bot that talks when it speaks, Rollback, Tests

### Community 273 - "Plan: one live test call with 5-10 team members talking to Factory"
Cohesion: 0.29
Nodes (6): Decisions (2026-11-27), Deviations, Open questions, Plan: one live test call with 5-10 team members talking to Factory, Rollback, Tests

### Community 274 - "Steps"
Cohesion: 0.33
Nodes (5): Approved decisions (copied from the spec, so this plan stands alone), Plan: Review and standup from the board (#28, slice 1), Roles, Rollback, Tests

### Community 275 - "Deviations from the spec revision (Codex re-check and plan review, for approval with this plan)"
Cohesion: 0.29
Nodes (7): findVeth(), wait(), Decisions carried over from the approved spec revision, Deviations from the spec revision (Codex re-check and plan review, for approval with this plan), Plan: desktops as KubeVirt VMs in the k3d cluster (#3, revision), Rollback, Tests

### Community 276 - "github-read.js"
Cohesion: 0.50
Nodes (5): createGithubRead(), newest(), request(), repoUrl(), 2. The connection: Jira Cloud's REST API, directly

### Community 277 - "createProxy"
Cohesion: 0.39
Nodes (7): createApi(), get(), createProxy(), entryFor(), snapshot(), watch(), limiter()

### Community 278 - "Design"
Cohesion: 0.25
Nodes (8): CFactory source (`core/src/sources/cfactory.js`), Data, Decisions on the intent's open questions (recommended), Design, Sign-in, Web server (`web/`), Where it runs, Where it sits

### Community 279 - "client.js"
Cohesion: 0.17
Nodes (10): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, connect(), handshake(), main() (+2 more)

### Community 280 - "Intent: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text), Open questions, Problem, Proposed outcome

### Community 281 - "Steps"
Cohesion: 0.43
Nodes (8): Steps, Steps, loadReview(), openPage(), run(), wireCall(), composeStandalone(), projectPage()

### Community 282 - "Plan: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.29
Nodes (6): Accepted risk, Decisions carried over (approved intent and spec), Deviations, Plan: the call Chrome runs with its sandbox on, so Meet admits the bot, Rollback, Tests

### Community 283 - "Intent: redact credentials that wrap across log lines"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: redact credentials that wrap across log lines, Open questions, Problem, Proposed outcome

### Community 284 - "Steps"
Cohesion: 0.11
Nodes (18): tools(), listTools(), required(), raw(), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains), Recorded GitHub inventory (pinned 1.14.0, captured 2026-11-17) (+10 more)

### Community 285 - "Decisions (carried from the approved intent and spec)"
Cohesion: 0.29
Nodes (6): Decisions (carried from the approved intent and spec), Deviations found during implementation, Deviations from the spec (made while planning, for approval with this plan), Plan: the bot hears the call itself (its own speech-to-text), Rollback, Tests

### Community 286 - "events.js"
Cohesion: 0.48
Nodes (5): _capturedElemChanged(), _captureObserver, _captureProxy(), releaseCapture(), setCapture()

### Community 287 - "Spec: a read-only standup from one Jira project, on the page (first slice of #59)"
Cohesion: 0.29
Nodes (6): Alternatives rejected, Approval (2026-11-27), Open questions, Risks, Spec: a read-only standup from one Jira project, on the page (first slice of #59), Verification

### Community 288 - "start"
Cohesion: 0.48
Nodes (7): armQuiet(), audio(), incoming(), killGroup(), settle(), start(), stop()

### Community 289 - "Intent: elevated calls, slice 1: pair a call in the portal and hold a grant for it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: elevated calls, slice 1: pair a call in the portal and hold a grant for it, Open questions, Problem, Proposed outcome

### Community 290 - "error"
Cohesion: 0.15
Nodes (21): releaseAttempt(), code(), Decisions (approved intent and spec), Deviations, Plan: see why Meet refuses the call bot, and recover from it, Rollback, Steps, Tests (+13 more)

### Community 291 - "cap"
Cohesion: 0.67
Nodes (3): cap(), collect(), walk()

### Community 293 - "gateway.js"
Cohesion: 0.33
Nodes (5): DESKTOP, { mapGithub, summarise, STATES }, NAMES, { origin }, SCHEMAS

### Community 294 - "Plan: Show the CFactory board in the call"
Cohesion: 0.33
Nodes (5): Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Tests

### Community 295 - "Plan: an approved, read-only Claude investigation from the call (RFactory side)"
Cohesion: 0.33
Nodes (5): Decisions carried over (approved intent and spec), Gates, Plan: an approved, read-only Claude investigation from the call (RFactory side), Rollback, Tests

### Community 296 - "Plan: standup notes, slice 1: dictated notes, review on the page, a Markdown download"
Cohesion: 0.33
Nodes (5): Approval (2026-11-27), Deviations, Plan: standup notes, slice 1: dictated notes, review on the page, a Markdown download, Rollback, Tests

### Community 297 - "Spec: Read Jira issues in a project call"
Cohesion: 0.33
Nodes (5): Alternatives considered, Design, Risks, Spec: Read Jira issues in a project call, Verification

### Community 298 - "How the bot hears"
Cohesion: 0.12
Nodes (15): hello(), Environment and scope reference, How the bot hears, Language, `listen` values and the per-platform `auto` rule, Per-call worker environment variables (set internally), Privacy, Rollback (+7 more)

### Community 299 - "Steps"
Cohesion: 0.28
Nodes (13): Steps, handleAction(), handleCall(), loadActions(), loadPanels(), renderAction(), renderActions(), renderLimits() (+5 more)

### Community 301 - "Plan: Add project-bound Jira reads to calls"
Cohesion: 0.40
Nodes (4): Plan: Add project-bound Jira reads to calls, Rollback, Steps, Tests

### Community 302 - "renderInvestigation"
Cohesion: 0.60
Nodes (5): handleInvestigation(), investigationStateText(), investigationStoreOf(), loadInvestigations(), renderInvestigation()

### Community 303 - "Spec: A face for the bot that talks when it speaks"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Evidence this spec rests on, Risks, Spec: A face for the bot that talks when it speaks, Verification

### Community 305 - "grants.test.js"
Cohesion: 0.33
Nodes (5): assert, { createGrantManager, allows }, crypto, fixture(), test

### Community 306 - "Spec: Agent workspace, a disposable desktop per call"
Cohesion: 0.40
Nodes (4): Alternatives rejected, Risks, Spec: Agent workspace, a disposable desktop per call, Verification

### Community 307 - "Spec: project-aware calls"
Cohesion: 0.40
Nodes (4): Alternatives rejected, Risks, Spec: project-aware calls, Verification

## Knowledge Gaps
- **41 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+36 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2241 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Websock` connect `.rQwait` to `logging.js`, `rfb.js`, `RFB`, `.off`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _41 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `Steps` to `web/test/notes.test.js`, `createCallManager`, `lifecycle.js`, `el`, `core/test/notes.test.js`, `Steps`, `.text`, `error`, `.off`, `Plan: standup notes, slice 1: dictated notes, review on the page, a Markdown download`, `app.js`, `handleConnect`, `server.js`, `review.js`, `hearing.test.js`, `Steps`, `web/test/actions.test.js`, `Design`, `createClient`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Should `app.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09195402298850575 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `Steps` to `running`, `lifecycle.js`, `el`, `redact.js`, `agents.test.js`, `core/test/notes.test.js`, `rfactory-standup.js`, `Steps`, `.text`, `createApp`, `start`, `error`, `.off`, `createInvestigationManager`, `server.js`, `review.js`, `Steps`, `web/test/actions.test.js`, `Plan: an MCP server for agents, slice A: read RFactory with a read key`, `createClient`, `loadScope`, `refuseKeyEnv`, `cfactory.js`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Should `rfb.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05649350649350649 - nodes in this community are weakly interconnected._