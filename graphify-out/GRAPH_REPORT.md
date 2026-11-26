# Graph Report - RFactory  (2026-11-26)

## Corpus Check
- 243 files · ~335,433 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: (none) 6, .nix 6, .css 4)

## Summary
- 2640 nodes · 4595 edges · 178 communities (162 shown, 16 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 662 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6fbb1f66`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verify lib.sh
- checkFacts
- redact.js
- test/call.test.js
- public app.js
- createCallManager
- claude-cli.js
- gateway.js
- control.js
- core/package.json
- run.js
- test desktop-ui.test.js
- guard.test.js
- facts.js
- runner runner.test.js
- k8s-policy.js
- join
- github.test.js
- runner runner.js
- cli.test.js
- test server.test.js
- test brain.test.js
- test avatar-state.test.js
- Profiles
- gateway.test.js
- mapCard
- vnc.test.js
- rfactory-standup.js
- How the bot hears
- web server.js
- lookups.test.js
- github-read.js
- test claude-cli.test.js
- avatar-renderer.test.js
- tts.test.js
- client.test.js
- profiles.test.js
- lookups.js
- stt-bridge.test.js
- main
- cfactory-write.test.js
- k8s-policy.js
- verify verify.test.js
- desktop-routes.js
- speak
- makeRedactor
- test/call.test.js
- verify net.sh
- verify profiles.sh
- lookup-endpoint.test.js
- Deviations
- spike hello-call.test.js
- viewer/board.test.js
- vm-call.test.js
- proxy.test.js
- agent.test.js
- proxy.test.js
- runner protocol.js
- web/test/actions.test.js
- Plan: Agent workspace, a disposable desktop per call (#3)
- encode
- lifecycle.js
- share-desktop.test.js
- Design
- Deviations from the spec (for approval with this plan)
- reaper reaper.test.js
- review.js
- loadScope
- ref_node_assert
- test cfactory.test.js
- agent.test.js
- facts.js
- Intent: in-call agents, the model with live tools, provider chosen per call
- bot bot/package.json
- Design
- avatars.test.js
- runner k8s-lifecycle.test.js
- web live-view.test.js
- Design
- web/package.json
- ref_node_fs
- Design
- spike spike/package.json
- ref_node_child_process
- test run.test.js
- run.test.js
- web/call.js
- core/package.json
- share.test.js
- bot run()
- state
- scope.js
- test test/board.test.js
- desktop desktop/package.json
- Spec: Show the CFactory board in the call
- actions-record.test.js
- Spec: an approved, read-only Claude investigation from the call
- lookup-endpoint.js
- cfactory-write.js
- Plan: v1 roles in code (admin, approver, member), slice "roles" of #2
- Call manager (web/call.js)
- k3d k14-env.sh
- verify handover.sh
- Intent: the bot hears the call itself (its own speech-to-text)
- protocol.test.js
- Spec: the bot hears the call itself (its own speech-to-text)
- verify lifecycle.sh
- Design
- ollama-standup.js
- Design
- k3d gate.sh
- gateway.js
- desktop-routes.test.js
- RFactory
- shell-browser.test.js
- ref_node_http
- Spec: Phase 3, act on the Factories from the call
- boundary.test.js
- createActionManager
- Intent: redact credentials that wrap across log lines
- Spec: Show the CFactory board in the call
- Steps
- ref_node_child_process
- verify e2e.sh
- Intent: redact credentials that wrap across log lines
- k3d k11.sh
- k3d mk-tls.sh
- Intent: see why Meet refuses the call bot, and recover from it
- verify liveview.sh
- connect
- fake-github-mcp.js
- profiles.js
- cap
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
- stt.test.js
- standup.test.js
- Desktop VMs on the k3d factory cluster
- desktop.test.js
- Socket
- teams-tap-spike.js
- Phase 0 results: can a guest bot join Google Meet, speak and read captions?
- Intent: run a Claude terminal from the call, and show it
- Plan: Phase 3, act on the Factories from the call
- Intent: run RFactory in the factory cluster like the other Factory services
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
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
- createRecord
- theme.js
- CLAUDE.md
- .claude/CLAUDE.md
- check-image-stt.sh
- SHELL_INVENTORY.md
- source-guard.test.js
- bootstrap-secrets.sh
- hearing.test.js
- assert-signature-location.sh

## God Nodes (most connected - your core abstractions)
1. `createLifecycle()` - 45 edges
2. `makeRedactor()` - 39 edges
3. `createInvestigationManager()` - 37 edges
4. `checkFacts()` - 33 edges
5. `createCallManager()` - 30 edges
6. `run()` - 27 edges
7. `toModel()` - 26 edges
8. `Profiles` - 23 edges
9. `Steps` - 23 edges
10. `loadScope()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `Claude login: the shared `factory-cli-creds`, like CFactory` --references--> `checkClaudeHome()`  [INFERRED]
  spec/2026-11-24-33-rfactory-in-cluster.md → core/src/brains/destination.js
- `Constraints` --references--> `heard()`  [INFERRED]
  intent/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `Proposed outcome` --references--> `heard()`  [INFERRED]
  intent/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `Verification` --references--> `heard()`  [INFERRED]
  spec/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `Decisions carried over from the approved spec` --references--> `checkFacts()`  [INFERRED]
  plan/2026-11-17-5-phase-1a-text-standup.md → core/src/facts.js

## Import Cycles
- None detected.

## Communities (178 total, 16 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "checkFacts"
Cohesion: 0.10
Nodes (23): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass** (+15 more)

### Community 2 - "redact.js"
Cohesion: 0.24
Nodes (14): base64(), JOINED_RULES, jwtSpans(), KEY_VALUE_AT, keyValueAt(), keyValueMatch(), keyValueSpans(), logSafeWindow() (+6 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.09
Nodes (19): assert, { createCallManager }, { createInvestigationManager }, { EventEmitter }, fakeActions(), a, fakeClock(), finishSpeech() (+11 more)

### Community 4 - "public app.js"
Cohesion: 0.06
Nodes (56): ago(), clear(), clock(), day(), decide(), decideInvestigation(), decideShare(), el() (+48 more)

### Community 5 - "createCallManager"
Cohesion: 0.26
Nodes (22): Steps, createCallManager(), addressed(), answer(), armQuiet(), audio(), drain(), emitLimits() (+14 more)

### Community 6 - "claude-cli.js"
Cohesion: 0.12
Nodes (16): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, LOOKUP_ERRORS, LOOKUP_SYSTEM_PROMPT (+8 more)

### Community 7 - "gateway.js"
Cohesion: 0.11
Nodes (36): createLifecycle(), accept(), allowAccept(), attachAgent(), boot(), callAttach(), cancel(), cancelNow() (+28 more)

### Community 8 - "control.js"
Cohesion: 0.27
Nodes (10): capText(), createControl(), applyHosts(), closePage(), page(), start(), fs, originOf() (+2 more)

### Community 9 - "core/package.json"
Cohesion: 0.13
Nodes (19): Claude Code CLI brain (`core/src/brains/claude-cli.js`), approve(), assert, { createInvestigationManager }, { createRecord }, fs, { loadRoles }, { makeRedactor } (+11 more)

### Community 10 - "run.js"
Cohesion: 0.18
Nodes (9): { buildRendererSource }, crypto, fs, { installSttBridge }, { makeRedactor }, os, path, { SpeechGate } (+1 more)

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "guard.test.js"
Cohesion: 0.05
Nodes (54): binding(), cidrFamily(), command(), createApi(), get(), createGuard(), apply(), counters() (+46 more)

### Community 13 - "facts.js"
Cohesion: 0.16
Nodes (12): tableOf(), checkFactsDetailed(), CLAIM, COUNT, { summarise }, WORDS, summarise(), assert (+4 more)

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 15 - "k8s-policy.js"
Cohesion: 0.05
Nodes (45): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+37 more)

### Community 16 - "join"
Cohesion: 0.16
Nodes (14): releaseAttempt(), withProxy(), join(), Decisions (approved intent and spec), Deviations, Plan: see why Meet refuses the call bot, and recover from it, Rollback, Steps (+6 more)

### Community 17 - "github.test.js"
Cohesion: 0.13
Nodes (13): fetchScope(), assert, conn(), { connect, RECORDED }, dir, fakeBin(), fs, issue() (+5 more)

### Community 18 - "runner runner.js"
Cohesion: 0.09
Nodes (27): clearInterval(), createK8s(), { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade() (+19 more)

### Community 19 - "cli.test.js"
Cohesion: 0.09
Nodes (15): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+7 more)

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
Cohesion: 0.21
Nodes (3): name(), Profiles, Decisions carried over from the approved spec and intent

### Community 24 - "gateway.test.js"
Cohesion: 0.14
Nodes (9): assert, base, { createGateway }, fs, { loadScope }, { makeRedactor }, os, path (+1 more)

### Community 25 - "mapCard"
Cohesion: 0.14
Nodes (14): mapCard(), 10. Intent constraints carried into slice 1, 1. Data comes from four CFactory read tools, all on the existing read key, 2. Scope: one rule, used everywhere, 3. Failure and freshness, 4. `core/src/standup.js` (new, pure): `buildStandup(cards, freshness)`, 6. Review (`core/src/review.js`, new, pure), 8. `core/src/sources/cfactory.js` (+6 more)

### Community 26 - "vnc.test.js"
Cohesion: 0.12
Nodes (19): bridgeViewOnly(), createFilter(), assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session (+11 more)

### Community 27 - "rfactory-standup.js"
Cohesion: 0.14
Nodes (21): ageOf(), approveClaude(), causes(), { checkFacts }, { connect }, { createBrain }, { createCfactorySource }, { createClaudeBrain, ARGV: CLAUDE_ARGV } (+13 more)

### Community 28 - "How the bot hears"
Cohesion: 0.20
Nodes (10): Captions vs own transcription, Environment and scope reference, How the bot hears, Language, `listen` values and the per-platform `auto` rule, Per-call worker environment variables (set internally), Privacy, Rollback (+2 more)

### Community 29 - "web server.js"
Cohesion: 0.13
Nodes (23): @rfactory/core, { buildStandup, speakStandupHeadline }, composeLookups(), composeWrites(), createApp(), DESKTOP_STATIC, fs, HEADERS (+15 more)

### Community 30 - "lookups.test.js"
Cohesion: 0.17
Nodes (9): createLookups(), assert, card, { createCfactorySource }, { createGithubRead, validPath, repoUrl }, { createLookups, FACTORY, GITHUB, validate }, lookup(), { makeRedactor } (+1 more)

### Community 31 - "github-read.js"
Cohesion: 0.23
Nodes (10): validate(), boundedJson(), createGithubRead(), commit(), newest(), request(), repoUrl(), { TextDecoder } (+2 more)

### Community 32 - "test claude-cli.test.js"
Cohesion: 0.13
Nodes (25): createClaudeBrain(), answerTurn(), checkDestination(), lookupTurn(), propose(), run(), stop(), summarize() (+17 more)

### Community 33 - "avatar-renderer.test.js"
Cohesion: 0.18
Nodes (6): assert, { buildRendererSource }, { chromium }, fs, path, test

### Community 34 - "tts.test.js"
Cohesion: 0.12
Nodes (17): Deviations, after(), assert, { createTts }, { EventEmitter }, fs, os, { PassThrough } (+9 more)

### Community 35 - "client.test.js"
Cohesion: 0.10
Nodes (16): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+8 more)

### Community 36 - "profiles.test.js"
Cohesion: 0.15
Nodes (12): admin, assert, fakeK8s(), fixture(), fs, { hkdfSync }, MASTER, os (+4 more)

### Community 37 - "lookups.js"
Cohesion: 0.18
Nodes (6): FACTORY, GITHUB, { mapCard }, specs, { STATES }, { validPath, validNumber }

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.08
Nodes (14): installSttBridge(), bind(), assert, event(), fs, { installSttBridge }, path, setup() (+6 more)

### Community 39 - "main"
Cohesion: 0.43
Nodes (5): connect(), handshake(), main(), [mode, url], out()

### Community 40 - "cfactory-write.test.js"
Cohesion: 0.10
Nodes (19): createCfactoryWriter(), getClient(), invoke(), assert, bareBlocked, bareStarted, before, card (+11 more)

### Community 41 - "k8s-policy.js"
Cohesion: 0.14
Nodes (16): assert, dir, { firstHost }, fs, path, policies, probeCidrs(), test (+8 more)

### Community 42 - "verify verify.test.js"
Cohesion: 0.12
Nodes (15): assert, beats(), CHECKS, fs, http, INPUT, { join }, LIB (+7 more)

### Community 43 - "desktop-routes.js"
Cohesion: 0.18
Nodes (18): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+10 more)

### Community 44 - "speak"
Cohesion: 0.22
Nodes (12): heard(), Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 1b, a voice standup in Google Meet, Rollback, Steps, Tests, Decisions (carried from the approved intent and spec) (+4 more)

### Community 45 - "makeRedactor"
Cohesion: 0.17
Nodes (15): makeRedactor(), redactString(), toModel(), pemSpans(), redactLegacyPem(), assert, { makeRedactor }, test (+7 more)

### Community 46 - "test/call.test.js"
Cohesion: 0.14
Nodes (11): assert, { createAgent }, { createCallWorker }, { createControl }, { dial }, { encode, createDecoder }, net, { parseCmdline } (+3 more)

### Community 47 - "verify net.sh"
Cohesion: 0.16
Nodes (17): BP, connect(), deadline_left(), hello(), mk_target(), mkp(), NIP, node_ip() (+9 more)

### Community 48 - "verify profiles.sh"
Cohesion: 0.23
Nodes (18): app_restore(), app_sync(), argo_app(), attach(), ciphertext(), cm_field(), errmatch(), extra_cleanup() (+10 more)

### Community 49 - "lookup-endpoint.test.js"
Cohesion: 0.17
Nodes (8): assert, { Client }, { createLookupEndpoint }, { DESKTOP }, http, { StreamableHTTPClientTransport }, test, tools

### Community 50 - "Deviations"
Cohesion: 0.22
Nodes (8): setCameraRenderer(), ctx(), Decisions (approved intent and spec, with the owner's amendments of 2026-11-26), Deviations, Plan: in-call agents, slice 1: live read-only lookups, Rollback, Shared contracts (steps 2 to 6 all follow these), Tests

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.11
Nodes (13): Steps, Pieces, botName(), path, run(), assert, { EventEmitter }, fs (+5 more)

### Community 52 - "viewer/board.test.js"
Cohesion: 0.13
Nodes (14): nonce(), { randomBytes }, { viewerRoute, URL_BOARD, ORIGIN }, assert, board(), browser, column(), open() (+6 more)

### Community 53 - "vm-call.test.js"
Cohesion: 0.16
Nodes (10): assert, { createVmSpawn }, { Duplex }, { test }, createVmSpawn(), { EventEmitter }, firstLine(), { PassThrough } (+2 more)

### Community 54 - "proxy.test.js"
Cohesion: 0.12
Nodes (44): count(), COUNT_CLAIM, createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog(), endCall() (+36 more)

### Community 55 - "agent.test.js"
Cohesion: 0.09
Nodes (27): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+19 more)

### Community 56 - "proxy.test.js"
Cohesion: 0.23
Nodes (18): checkedAddresses(), createApi(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect() (+10 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.23
Nodes (17): board(), boolean(), columns, count(), exact(), hosts(), identity, log() (+9 more)

### Community 58 - "web/test/actions.test.js"
Cohesion: 0.13
Nodes (11): { deriveEffects, describe }, FINAL, { randomUUID }, { validate, hashPayload, canonical }, approve(), assert, { createActionManager }, { loadRoles } (+3 more)

### Community 59 - "Plan: Agent workspace, a disposable desktop per call (#3)"
Cohesion: 0.47
Nodes (9): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+1 more)

### Community 60 - "encode"
Cohesion: 0.16
Nodes (15): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, inRange() (+7 more)

### Community 61 - "lifecycle.js"
Cohesion: 0.22
Nodes (6): { buildPolicy }, { createDecoder, tag, encode, LANGUAGE }, crypto, net, { nonce: newNonce }, { StringDecoder }

### Community 62 - "share-desktop.test.js"
Cohesion: 0.24
Nodes (7): createShareDesktop(), schedule(), stopPolling(), assert, { createShareDesktop }, setup(), test

### Community 63 - "Design"
Cohesion: 0.25
Nodes (8): CFactory source (`core/src/sources/cfactory.js`), Data, Decisions on the intent's open questions (recommended), Design, Sign-in, Web server (`web/`), Where it runs, Where it sits

### Community 64 - "Deviations from the spec (for approval with this plan)"
Cohesion: 0.08
Nodes (27): label(), stopShare(), exec(), action(), Decisions carried over from the approved spec, Deviations from the spec (for approval with this plan), Facts checked in the real repos, Open questions for the owner (+19 more)

### Community 65 - "reaper reaper.test.js"
Cohesion: 0.17
Nodes (13): createReaper(), leaseStale(), tick(), fs, main(), assert, { createReaper }, fake() (+5 more)

### Community 66 - "review.js"
Cohesion: 0.15
Nodes (17): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+9 more)

### Community 67 - "loadScope"
Cohesion: 0.10
Nodes (23): tools(), loadScope(), ask(), listTools(), required(), raw(), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan) (+15 more)

### Community 68 - "ref_node_assert"
Cohesion: 0.10
Nodes (16): toSpeech(), assert, fs, path, root, test, assert, { loadRoles } (+8 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.13
Nodes (7): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, reply(), repos, test

### Community 70 - "agent.test.js"
Cohesion: 0.15
Nodes (8): createCallWorker(), { createShare, callLaunchArgs }, { PassThrough }, assert, { createCallWorker, withProxy, MEET_GUEST, TEAMS_CAPTIONS }, { EventEmitter }, fixture(), { test }

### Community 71 - "facts.js"
Cohesion: 0.12
Nodes (11): assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard, os (+3 more)

### Community 72 - "Intent: in-call agents, the model with live tools, provider chosen per call"
Cohesion: 0.18
Nodes (10): Affected users and systems, Amendments (owner, 2026-11-26), Constraints, Decisions (owner, 2026-11-26: "approve with your recommendations"), Intent: in-call agents, the model with live tools, provider chosen per call, Open questions, Problem, Proposed outcome (+2 more)

### Community 73 - "bot bot/package.json"
Cohesion: 0.14
Nodes (13): dependencies, playwright-core, @vibeconferencing/calls, engines, node, playwright-core, @vibeconferencing/calls, license (+5 more)

### Community 74 - "Design"
Cohesion: 0.13
Nodes (14): Alternatives rejected, Claude login: the shared `factory-cli-creds`, like CFactory, Design, Images: built, signed and promoted by CI, like CFactory, One pod, as today, Order and cutover, Owner decisions (proposed defaults), Pod security (+6 more)

### Community 75 - "avatars.test.js"
Cohesion: 0.20
Nodes (8): assert, crypto, dir, fs, ids, manifest, path, test

### Community 76 - "runner k8s-lifecycle.test.js"
Cohesion: 0.19
Nodes (9): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+1 more)

### Community 77 - "web live-view.test.js"
Cohesion: 0.15
Nodes (11): assert, client(), clientSession, { createApp }, fbUpdate, includes(), { loadRoles }, net (+3 more)

### Community 78 - "Design"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Spec: Standalone mode, with a choice of source and brain (+1 more)

### Community 79 - "web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 80 - "ref_node_fs"
Cohesion: 0.18
Nodes (9): fs, assert, { createK8s }, fs, http, { inClusterConfig }, os, path (+1 more)

### Community 81 - "Design"
Cohesion: 0.13
Nodes (14): gateway(), Alternatives rejected, Design, Exposure, Facts this rests on (checked on p620, 2026-11-18), Lifecycle, Live view, Network (replaces the approved "Network" section) (+6 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "ref_node_child_process"
Cohesion: 0.12
Nodes (11): assert, { createProfile }, KEY, { test }, assert, fs, os, path (+3 more)

### Community 84 - "test run.test.js"
Cohesion: 0.11
Nodes (12): assert, audioJoined(), { EventEmitter }, fs, joined(), { PassThrough }, path, { run } (+4 more)

### Community 85 - "run.test.js"
Cohesion: 0.07
Nodes (46): Branches and worktrees, Corrections to the approved spec, Decisions (from the approved spec; owner defaults accepted 2026-11-24), Deviations, Landing record (2026-11-24), Lead steps, in order, Live check results (step 12), Plan: run RFactory in the factory cluster (+38 more)

### Community 86 - "web/call.js"
Cohesion: 0.09
Nodes (23): toWhisperLanguage(), WHISPER_LANGUAGES, assert, test, { WHISPER_LANGUAGES, toWhisperLanguage }, BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts, checkFactsDetailed } (+15 more)

### Community 87 - "core/package.json"
Cohesion: 0.17
Nodes (11): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+3 more)

### Community 88 - "share.test.js"
Cohesion: 0.18
Nodes (9): callLaunchArgs(), assert, browser, { createShare, titleFor, callLaunchArgs, installCaptureGuard }, http, pick(), { test }, { URL_BOARD } (+1 more)

### Community 89 - "bot run()"
Cohesion: 0.18
Nodes (24): buildRendererSource(), pageLeft(), run(), abandon(), afterJoin(), discardOpen(), failureReport(), idleAvatar() (+16 more)

### Community 90 - "state"
Cohesion: 0.25
Nodes (8): number(), 1. The bot reports a failed join (`bot/run.js` `start()`), 3. The desktop worker closes what it launched on setup failure (`desktop/guest/agent/call.js:83-90`), 4. The server logs it (`web/call.js` `incoming()`), Design, The intent's open questions, 2. The lookup tools (`core/src/lookups.js`, new), state()

### Community 91 - "scope.js"
Cohesion: 0.12
Nodes (15): DESTINATIONS, fs, LISTEN, { makeRedactor }, path, resolveListen(), { toWhisperLanguage }, assert (+7 more)

### Community 92 - "test test/board.test.js"
Cohesion: 0.13
Nodes (16): COLUMNS, projectBoard(), { repositoryOf }, STAGES, assert, callTool(), card(), { createCfactorySource } (+8 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "Spec: Show the CFactory board in the call"
Cohesion: 0.15
Nodes (13): Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Tests, Design, Order and dependencies, Proposing, approving, stopping (+5 more)

### Community 95 - "actions-record.test.js"
Cohesion: 0.15
Nodes (10): fs, path, assert, { createRecord }, fs, { makeRedactor }, os, path (+2 more)

### Community 96 - "Spec: an approved, read-only Claude investigation from the call"
Cohesion: 0.18
Nodes (10): 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), 3. RFactory: hearing, approval, the shared log, the spoken result, Alternatives rejected, Design, Findings this design rests on (checked 2026-11-19), Order and dependencies, Risks (+2 more)

### Community 97 - "lookup-endpoint.js"
Cohesion: 0.22
Nodes (6): createLookupEndpoint(), http, { ListToolsRequestSchema, CallToolRequestSchema }, { randomBytes, timingSafeEqual }, { Server }, { StreamableHTTPServerTransport }

### Community 98 - "cfactory-write.js"
Cohesion: 0.25
Nodes (7): { Client }, { deriveEffects }, fs, { makeRedactor }, STAGES, { StreamableHTTPClientTransport }, TOOLS

### Community 99 - "Plan: v1 roles in code (admin, approver, member), slice "roles" of #2"
Cohesion: 0.19
Nodes (10): loadRoles(), has(), rolesOf(), Decisions carried over from the approved spec, Decisions for this plan, Deviations, Plan: v1 roles in code (admin, approver, member), slice "roles" of #2, Rollback (+2 more)

### Community 100 - "Call manager (web/call.js)"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Design, Hearing: wake phrase and end of a question, Packaging, Risks, Spec: Phase 1b, a voice standup in Google Meet, Speech (TTS), The bot process (`bot/run.js`) (+3 more)

### Community 101 - "k3d k14-env.sh"
Cohesion: 0.44
Nodes (9): app_sync(), argo(), desktops(), env_of(), kc(), kubectl(), runner_restart(), k14-env.sh script (+1 more)

### Community 102 - "verify handover.sh"
Cohesion: 0.42
Nodes (8): fixture_reached(), hits(), open_page(), page_loaded(), session_of(), handover.sh script, trap_page(), wait_attached()

### Community 103 - "Intent: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text), Open questions, Problem, Proposed outcome

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

### Community 108 - "ollama-standup.js"
Cohesion: 0.29
Nodes (6): { checkFacts }, count(), fs, main(), path, { setup }

### Community 109 - "Design"
Cohesion: 0.20
Nodes (10): Design, Effects are derived, not trusted, Execution: re-check, claim, record, dispatch once, Keys and switches, Pending actions and approval, Reading CFactory's results, Recognising an action request, The action allowlist (the only things that can ever run) (+2 more)

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "gateway.js"
Cohesion: 0.10
Nodes (21): createGateway(), call(), numberFrom(), snapshot(), DESKTOP, { mapGithub, summarise, STATES }, NAMES, { origin } (+13 more)

### Community 112 - "desktop-routes.test.js"
Cohesion: 0.18
Nodes (9): assert, { createApp }, { createDesktop }, grant, { loadRoles }, { makeRedactor }, open, roles (+1 more)

### Community 113 - "RFactory"
Cohesion: 0.25
Nodes (6): Deployment, How the bot hears, Licence, RFactory, Roles, Standup and review

### Community 114 - "shell-browser.test.js"
Cohesion: 0.20
Nodes (6): assert, { chromium }, { createApp }, { loadRoles }, { spawnSync }, test

### Community 115 - "ref_node_http"
Cohesion: 0.29
Nodes (3): http, [portA, portB], state

### Community 116 - "Spec: Phase 3, act on the Factories from the call"
Cohesion: 0.40
Nodes (4): Alternatives rejected, Risks, Spec: Phase 3, act on the Factories from the call, Verification

### Community 117 - "boundary.test.js"
Cohesion: 0.11
Nodes (12): assert, { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs, { loadRoles }, { makeRedactor } (+4 more)

### Community 118 - "createActionManager"
Cohesion: 0.36
Nodes (14): Steps, createActionManager(), approve(), emit(), endCall(), expire(), finish(), list() (+6 more)

### Community 119 - "Intent: redact credentials that wrap across log lines"
Cohesion: 0.33
Nodes (5): Approved decisions (copied from the spec, so this plan stands alone), Plan: Review and standup from the board (#28, slice 1), Roles, Rollback, Tests

### Community 120 - "Spec: Show the CFactory board in the call"
Cohesion: 0.40
Nodes (4): Alternatives rejected, Risks, Spec: Show the CFactory board in the call, Verification

### Community 121 - "Steps"
Cohesion: 0.19
Nodes (16): boundedFetch(), { Client }, createCfactorySource(), call(), comments(), connect(), freshness(), scopedCards() (+8 more)

### Community 122 - "ref_node_child_process"
Cohesion: 0.29
Nodes (5): { Client }, { execFileSync }, READ_TOOLS, RECORDED, { StdioClientTransport }

### Community 123 - "verify e2e.sh"
Cohesion: 0.53
Nodes (4): real_ids(), e2e.sh script, teams_call(), WEB_MAX

### Community 124 - "Intent: redact credentials that wrap across log lines"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: redact credentials that wrap across log lines, Open questions, Problem, Proposed outcome

### Community 125 - "k3d k11.sh"
Cohesion: 0.50
Nodes (4): env_of(), RFACTORY_DESKTOP, RFACTORY_RUNNER_URL, k11.sh script

### Community 126 - "k3d mk-tls.sh"
Cohesion: 0.70
Nodes (4): FILES, key(), leaf(), mk-tls.sh script

### Community 127 - "Intent: see why Meet refuses the call bot, and recover from it"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: see why Meet refuses the call bot, and recover from it, Open questions, Problem, Proposed outcome

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 129 - "connect"
Cohesion: 0.60
Nodes (6): connect(), call(), fetchScope(), getItem(), itemActivity(), paged()

### Community 130 - "fake-github-mcp.js"
Cohesion: 0.33
Nodes (4): { ListToolsRequestSchema, CallToolRequestSchema }, { Server }, { StdioServerTransport }, @modelcontextprotocol/sdk

### Community 131 - "profiles.js"
Cohesion: 0.50
Nodes (3): fs, LABEL, { randomUUID, hkdfSync }

### Community 132 - "cap"
Cohesion: 0.67
Nodes (3): cap(), collect(), walk()

### Community 141 - "deploy pod.sh"
Cohesion: 1.00
Nodes (3): down(), pod.sh script, up()

### Community 142 - "verify share.sh"
Cohesion: 0.83
Nodes (3): ready(), share.sh script, web_stop()

### Community 161 - "stt.test.js"
Cohesion: 0.15
Nodes (9): Web server environment variables, createStt(), fs, assert, { createStt }, fs, os, path (+1 more)

### Community 162 - "standup.test.js"
Cohesion: 0.19
Nodes (10): buildStandup(), { FAILED, mapCard }, speakStandupHeadline(), assert, build(), { buildStandup, speakStandupHeadline }, freshness(), { makeRedactor } (+2 more)

### Community 163 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.17
Nodes (11): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 8. Problems we hit (+3 more)

### Community 167 - "desktop.test.js"
Cohesion: 0.06
Nodes (41): idle(), speechLevel(), ACTIONS, createSessions(), approveShare(), check(), get(), grant() (+33 more)

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 172 - "Phase 0 results: can a guest bot join Google Meet, speak and read captions?"
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "Plan: Phase 3, act on the Factories from the call"
Cohesion: 0.40
Nodes (4): Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Tests

### Community 176 - "Intent: run RFactory in the factory cluster like the other Factory services"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decided, Intent: run RFactory in the factory cluster like the other Factory services, Open questions, Problem, Proposed outcome

### Community 178 - "Spec: Phase 0, the Linux call test"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Context for later phases (not decided here), Decisions on the intent's Phase 0 questions, Design, Goal, Pass / fail, Risks, Spec: Phase 0, the Linux call test (+1 more)

### Community 179 - "Intent: A face for the bot that talks when it speaks"
Cohesion: 0.22
Nodes (8): Affected users and systems, Constraints, Decisions (owner, 2026-11-17), Intent: A face for the bot that talks when it speaks, Open questions, Problem, Proposed outcome (first slice), Source of the portraits

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
Cohesion: 0.07
Nodes (40): ACTIONS, bounded(), canonical(), CREATE_STATUSES, { createHash }, criteria(), FIELDS, hashPayload() (+32 more)

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

### Community 198 - "createRecord"
Cohesion: 0.36
Nodes (9): Waves, Steps, createRecord(), files(), lastEntries(), prune(), unfinished(), unfinishedInvestigations() (+1 more)

### Community 199 - "theme.js"
Cohesion: 0.67
Nodes (3): applyTheme(), dark, observer

### Community 206 - "source-guard.test.js"
Cohesion: 0.18
Nodes (10): Source adapters, assert, fs, git(), guard, os, path, repo() (+2 more)

### Community 207 - "bootstrap-secrets.sh"
Cohesion: 0.83
Nodes (3): env_of(), bootstrap-secrets.sh script, write_secret()

### Community 208 - "hearing.test.js"
Cohesion: 0.36
Nodes (6): createHearing(), assert, { createHearing }, fakeClock(), setup(), test

## Knowledge Gaps
- **30 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1392 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createLifecycle()` connect `gateway.js` to `Deviations from the spec (for approval with this plan)`, `Desktop VMs on the k3d factory cluster`, `runner k8s-lifecycle.test.js`, `runner runner.test.js`, `runner runner.js`, `lifecycle.js`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `createLifecycle()` (e.g. with `lifecycle.js` and `action()`) actually correct?**
  _`createLifecycle()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `createCallManager()` connect `createCallManager` to `test/call.test.js`, `desktop.test.js`, `speak`, `boundary.test.js`, `web/call.js`, `Steps`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `checkFacts` be split into smaller, more focused modules?**
  _Cohesion score 0.09666666666666666 - nodes in this community are weakly interconnected._
- **Why does `checkFacts()` connect `checkFacts` to `test claude-cli.test.js`, `standup.test.js`, `loadScope`, `Call manager (web/call.js)`, `createCallManager`, `claude-cli.js`, `review.js`, `core/package.json`, `ollama-standup.js`, `facts.js`, `speak`, `Intent: redact credentials that wrap across log lines`, `mapCard`, `rfactory-standup.js`, `Design`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._