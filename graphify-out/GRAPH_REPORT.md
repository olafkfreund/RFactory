# Graph Report - RFactory  (2026-11-26)

## Corpus Check
- 246 files · ~352,704 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: (none) 7, .nix 6, .css 4)

## Summary
- 2708 nodes · 4742 edges · 169 communities (152 shown, 17 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 692 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dd225167`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verify lib.sh
- checkFacts
- redact.js
- k14 results: agent workspace desktops on k3d with KubeVirt
- public app.js
- createCallManager
- claude-cli.js
- gateway.js
- agent.test.js
- core/package.json
- run.js
- test desktop-ui.test.js
- guard.test.js
- shares.test.js
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
- Steps
- vnc.test.js
- rfactory-standup.js
- How the bot hears
- web server.js
- lookups.test.js
- Design
- test claude-cli.test.js
- avatar-renderer.test.js
- tts.test.js
- client.test.js
- profiles.test.js
- encode
- stt-bridge.test.js
- main
- cfactory-write.test.js
- k8s-policy.js
- verify verify.test.js
- desktop-routes.js
- speak
- makeRedactor
- Standalone mode S1: end-to-end results (#2 step 10)
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
- Plan: Agent workspace, a disposable desktop per call (#3)
- reaper reaper.test.js
- review.js
- loadScope
- ref_node_assert
- test cfactory.test.js
- agent.test.js
- facts.js
- origin
- bot bot/package.json
- Design
- avatars.test.js
- runner k8s-lifecycle.test.js
- web live-view.test.js
- main
- web/package.json
- ref_node_fs
- Design
- spike spike/package.json
- profile.test.js
- test run.test.js
- createShareManager
- web/call.js
- core/package.json
- createClaudeBrain
- bot run()
- desktop.test.js
- scope.js
- test/board.test.js
- desktop desktop/package.json
- Design
- actions-record.test.js
- Spec: an approved, read-only Claude investigation from the call
- lookup-endpoint.js
- cfactory-write.js
- items.test.js
- Plan: A face for the bot that talks when it speaks
- k3d k14-env.sh
- verify handover.sh
- Intent: project-aware calls
- protocol.test.js
- Spec: the bot hears the call itself (its own speech-to-text)
- verify lifecycle.sh
- Design
- ollama-standup.js
- Design
- k3d gate.sh
- gateway.js
- stt-languages.test.js
- Plan: Show the CFactory board in the call
- shell-browser.test.js
- ref_node_http
- listProjects
- boundary.test.js
- createActionManager
- createGateway
- verify e2e.sh
- Intent: redact credentials that wrap across log lines
- k3d k11.sh
- k3d mk-tls.sh
- verify liveview.sh
- fake-github-mcp.js
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
- Desktop VMs on the k3d factory cluster
- Design
- Socket
- teams-tap-spike.js
- Phase 0 results: can a guest bot join Google Meet, speak and read captions?
- Intent: run a Claude terminal from the call, and show it
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
- loadScope
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
2. `makeRedactor()` - 40 edges
3. `createInvestigationManager()` - 37 edges
4. `checkFacts()` - 33 edges
5. `createCallManager()` - 32 edges
6. `run()` - 27 edges
7. `toModel()` - 26 edges
8. `createApp()` - 25 edges
9. `Steps` - 24 edges
10. `Profiles` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Steps` --references--> `event()`  [INFERRED]
  plan/2026-11-21-16-own-speech-to-text.md → bot/test/stt-bridge.test.js
- `Verification` --references--> `heard()`  [INFERRED]
  spec/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `Decisions carried over from the approved spec` --references--> `toModel()`  [INFERRED]
  plan/2026-11-17-2-standalone-mode.md → core/src/redact.js
- `The action allowlist (the only things that can ever run)` --references--> `toModel()`  [INFERRED]
  spec/2026-11-17-10-phase-3-actions-and-share.md → core/src/redact.js
- `Brains` --references--> `toModel()`  [INFERRED]
  spec/2026-11-17-2-standalone-mode.md → core/src/redact.js

## Import Cycles
- None detected.

## Communities (169 total, 17 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "checkFacts"
Cohesion: 0.08
Nodes (26): checkFacts(), Alternatives rejected, Risks, Spec: Phase 1a, a text standup in the web UI, Verification, Alternatives rejected, Design, Hearing: wake phrase and end of a question (+18 more)

### Community 2 - "redact.js"
Cohesion: 0.18
Nodes (14): base64(), JOINED_RULES, jwtSpans(), KEY_VALUE_AT, keyValueAt(), keyValueMatch(), keyValueSpans(), occurrences() (+6 more)

### Community 3 - "k14 results: agent workspace desktops on k3d with KubeVirt"
Cohesion: 0.12
Nodes (14): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+6 more)

### Community 4 - "public app.js"
Cohesion: 0.06
Nodes (67): ago(), clear(), clock(), day(), decide(), decideInvestigation(), decideShare(), el() (+59 more)

### Community 5 - "createCallManager"
Cohesion: 0.23
Nodes (24): Steps, createCallManager(), addressed(), answer(), armQuiet(), audio(), drain(), emitLimits() (+16 more)

### Community 6 - "claude-cli.js"
Cohesion: 0.11
Nodes (17): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, LOOKUP_ERRORS, LOOKUP_SYSTEM_PROMPT (+9 more)

### Community 7 - "gateway.js"
Cohesion: 0.14
Nodes (25): createLifecycle(), accept(), allowAccept(), attachAgent(), boot(), callAttach(), cancel(), cancelNow() (+17 more)

### Community 8 - "agent.test.js"
Cohesion: 0.12
Nodes (18): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+10 more)

### Community 9 - "core/package.json"
Cohesion: 0.13
Nodes (20): Claude Code CLI brain (`core/src/brains/claude-cli.js`), approve(), assert, { createInvestigationManager }, { createRecord }, fs, { loadRoles }, { makeRedactor } (+12 more)

### Community 10 - "run.js"
Cohesion: 0.17
Nodes (9): { buildRendererSource }, crypto, fs, { installSttBridge }, { makeRedactor }, os, path, { SpeechGate } (+1 more)

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "guard.test.js"
Cohesion: 0.06
Nodes (52): binding(), cidrFamily(), command(), createApi(), get(), createGuard(), apply(), counters() (+44 more)

### Community 13 - "shares.test.js"
Cohesion: 0.16
Nodes (12): Switches and record, approve(), assert, { createShareManager }, { loadRoles }, { makeRedactor }, proposed(), ready() (+4 more)

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 15 - "k8s-policy.js"
Cohesion: 0.05
Nodes (46): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+38 more)

### Community 16 - "join"
Cohesion: 0.12
Nodes (19): releaseAttempt(), join(), Deviations from the spec (for approval with this plan), Decisions (approved intent and spec), Deviations, Plan: see why Meet refuses the call bot, and recover from it, Rollback, Steps (+11 more)

### Community 17 - "github.test.js"
Cohesion: 0.09
Nodes (24): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFileSync } (+16 more)

### Community 18 - "runner runner.js"
Cohesion: 0.09
Nodes (26): clearInterval(), { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade(), crypto (+18 more)

### Community 19 - "cli.test.js"
Cohesion: 0.09
Nodes (15): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+7 more)

### Community 20 - "test server.test.js"
Cohesion: 0.09
Nodes (20): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, { handleCall }, items, { loadRoles } (+12 more)

### Community 21 - "test brain.test.js"
Cohesion: 0.11
Nodes (18): { createHash }, destinationHash(), fs, path, createBrain(), turn(), { destinationHash }, OpenAI (+10 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.11
Nodes (13): installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState(), meshAt() (+5 more)

### Community 24 - "gateway.test.js"
Cohesion: 0.12
Nodes (11): assert, base, { createGateway }, fs, gateway(), { loadScope }, { makeRedactor }, os (+3 more)

### Community 25 - "Steps"
Cohesion: 0.09
Nodes (26): mapCard(), buildStandup(), { FAILED, mapCard }, speakStandupHeadline(), assert, build(), { buildStandup, speakStandupHeadline }, freshness() (+18 more)

### Community 26 - "vnc.test.js"
Cohesion: 0.12
Nodes (19): bridgeViewOnly(), createFilter(), assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session (+11 more)

### Community 27 - "rfactory-standup.js"
Cohesion: 0.10
Nodes (28): ageOf(), approveClaude(), causes(), { checkFacts }, { connect }, { createBrain }, { createCfactorySource }, { createClaudeBrain, ARGV: CLAUDE_ARGV } (+20 more)

### Community 28 - "How the bot hears"
Cohesion: 0.12
Nodes (15): Environment and scope reference, How the bot hears, Language, `listen` values and the per-platform `auto` rule, Per-call worker environment variables (set internally), Privacy, Rollback, Scope fields (`RFACTORY_SCOPE_FILE`) (+7 more)

### Community 29 - "web server.js"
Cohesion: 0.12
Nodes (23): { buildStandup, speakStandupHeadline }, createApp(), bind(), decide(), resolveSlug(), DESKTOP_STATIC, EMPTY_LISTS, fs (+15 more)

### Community 30 - "lookups.test.js"
Cohesion: 0.05
Nodes (38): cap(), collect(), walk(), createLookups(), FACTORY, GITHUB, { mapCard }, specs (+30 more)

### Community 31 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Answers to the intent's open questions, Design, Driving apps, Feasibility gate (first plan step), Lifecycle and disposal, Live view, Network (+4 more)

### Community 32 - "test claude-cli.test.js"
Cohesion: 0.13
Nodes (16): claudeHash(), assert, { claudeHash, checkClaudeHome }, { createClaudeBrain }, { EventEmitter }, fs, lookup, lookupBrain() (+8 more)

### Community 33 - "avatar-renderer.test.js"
Cohesion: 0.18
Nodes (6): assert, { buildRendererSource }, { chromium }, fs, path, test

### Community 34 - "tts.test.js"
Cohesion: 0.12
Nodes (15): Deviations, Gates, Plan: an approved, read-only Claude investigation from the call (RFactory side), Rollback, Tests, after(), assert, { createTts } (+7 more)

### Community 35 - "client.test.js"
Cohesion: 0.10
Nodes (16): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+8 more)

### Community 36 - "profiles.test.js"
Cohesion: 0.10
Nodes (17): fs, LABEL, { randomUUID, hkdfSync }, admin, assert, fakeK8s(), fixture(), fs (+9 more)

### Community 37 - "encode"
Cohesion: 0.21
Nodes (12): nonce(), login(), shareStart(), shareStop(), sharing(), toGuest(), viewClose(), viewData() (+4 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.09
Nodes (9): installSttBridge(), assert, event(), fs, { installSttBridge }, path, setup(), test (+1 more)

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
Cohesion: 0.10
Nodes (28): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+20 more)

### Community 44 - "speak"
Cohesion: 0.09
Nodes (26): heard(), number(), Captions vs own transcription, Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text), Open questions (+18 more)

### Community 45 - "makeRedactor"
Cohesion: 0.20
Nodes (16): makeRedactor(), logSafeWindow(), redactString(), toModel(), pemSpans(), assert, { makeRedactor }, test (+8 more)

### Community 46 - "Standalone mode S1: end-to-end results (#2 step 10)"
Cohesion: 0.20
Nodes (8): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass**

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
Cohesion: 0.06
Nodes (36): idle(), setCameraRenderer(), inScope(), ctx(), source(), Deviations (Codex review of the approved plan, 2026-11-17), Steps, Approved decisions (copied from the spec, so this plan stands alone) (+28 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.12
Nodes (13): Steps, Pieces, botName(), path, run(), assert, { EventEmitter }, fs (+5 more)

### Community 52 - "viewer/board.test.js"
Cohesion: 0.09
Nodes (22): callLaunchArgs(), { randomBytes }, assert, browser, { createShare, titleFor, callLaunchArgs, installCaptureGuard }, http, pick(), { test } (+14 more)

### Community 53 - "vm-call.test.js"
Cohesion: 0.17
Nodes (10): assert, { createVmSpawn }, { Duplex }, { test }, createVmSpawn(), { EventEmitter }, firstLine(), { PassThrough } (+2 more)

### Community 54 - "proxy.test.js"
Cohesion: 0.05
Nodes (65): count(), COUNT_CLAIM, createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog(), endCall() (+57 more)

### Community 55 - "agent.test.js"
Cohesion: 0.08
Nodes (27): octets(), parseCmdline(), startHeartbeat(), createAgent(), run(), { createCallWorker }, { createControl }, { createProfile } (+19 more)

### Community 56 - "proxy.test.js"
Cohesion: 0.23
Nodes (18): checkedAddresses(), createApi(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect() (+10 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.23
Nodes (17): board(), boolean(), columns, count(), exact(), hosts(), identity, log() (+9 more)

### Community 58 - "web/test/actions.test.js"
Cohesion: 0.13
Nodes (12): @rfactory/core, { deriveEffects, describe }, FINAL, { randomUUID }, { validate, hashPayload, canonical }, approve(), assert, { createActionManager } (+4 more)

### Community 59 - "Plan: Agent workspace, a disposable desktop per call (#3)"
Cohesion: 0.47
Nodes (9): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+1 more)

### Community 60 - "encode"
Cohesion: 0.16
Nodes (15): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, inRange() (+7 more)

### Community 61 - "lifecycle.js"
Cohesion: 0.20
Nodes (7): { buildPolicy }, { createDecoder, tag, encode, LANGUAGE }, crypto, net, { nonce: newNonce }, { StringDecoder }, createDecoder()

### Community 62 - "share-desktop.test.js"
Cohesion: 0.24
Nodes (7): createShareDesktop(), schedule(), stopPolling(), assert, { createShareDesktop }, setup(), test

### Community 63 - "Design"
Cohesion: 0.29
Nodes (7): Data, Decisions on the intent's open questions (recommended), Design, Sign-in, Web server (`web/`), Where it runs, Where it sits

### Community 64 - "Plan: Agent workspace, a disposable desktop per call (#3)"
Cohesion: 0.16
Nodes (13): label(), stopShare(), exec(), Decisions carried over from the approved spec, Facts checked in the real repos, Open questions for the owner, Plan: Agent workspace, a disposable desktop per call (#3), Prerequisites (named revisions) (+5 more)

### Community 65 - "reaper reaper.test.js"
Cohesion: 0.17
Nodes (13): createReaper(), leaseStale(), tick(), fs, main(), assert, { createReaper }, fake() (+5 more)

### Community 66 - "review.js"
Cohesion: 0.16
Nodes (16): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+8 more)

### Community 67 - "loadScope"
Cohesion: 0.13
Nodes (18): tools(), ask(), listTools(), raw(), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains), Recorded GitHub inventory (pinned 1.14.0, captured 2026-11-17) (+10 more)

### Community 68 - "ref_node_assert"
Cohesion: 0.08
Nodes (21): toSpeech(), assert, checked(), { checkFacts, checkFactsDetailed }, snapshot, test, assert, fs (+13 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.12
Nodes (8): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, { makeRedactor }, reply(), repos, test

### Community 70 - "agent.test.js"
Cohesion: 0.10
Nodes (16): createCallWorker(), { createShare, callLaunchArgs }, { PassThrough }, assert, { createCallWorker, withProxy, MEET_GUEST, TEAMS_CAPTIONS }, { EventEmitter }, fixture(), { test } (+8 more)

### Community 71 - "facts.js"
Cohesion: 0.12
Nodes (11): assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard, os (+3 more)

### Community 72 - "origin"
Cohesion: 0.33
Nodes (9): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), origin() (+1 more)

### Community 73 - "bot bot/package.json"
Cohesion: 0.14
Nodes (13): dependencies, playwright-core, @vibeconferencing/calls, engines, node, playwright-core, @vibeconferencing/calls, license (+5 more)

### Community 74 - "Design"
Cohesion: 0.14
Nodes (13): Alternatives rejected, Design, Images: built, signed and promoted by CI, like CFactory, One pod, as today, Order and cutover, Owner decisions (proposed defaults), Pod security, Reach: tunnel, DNS, Keycloak (+5 more)

### Community 75 - "avatars.test.js"
Cohesion: 0.20
Nodes (8): assert, crypto, dir, fs, ids, manifest, path, test

### Community 76 - "runner k8s-lifecycle.test.js"
Cohesion: 0.19
Nodes (9): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+1 more)

### Community 77 - "web live-view.test.js"
Cohesion: 0.15
Nodes (11): assert, client(), clientSession, { createApp }, fbUpdate, includes(), { loadRoles }, net (+3 more)

### Community 78 - "main"
Cohesion: 0.27
Nodes (9): main(), makeLogin(), recordBrain(), createTts(), say(), fs, path, run() (+1 more)

### Community 79 - "web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 80 - "ref_node_fs"
Cohesion: 0.15
Nodes (10): createK8s(), fs, assert, { createK8s }, fs, http, { inClusterConfig }, os (+2 more)

### Community 81 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Design, Exposure, Facts this rests on (checked on p620, 2026-11-18), Lifecycle, Live view, Profiles, Risks (+3 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "profile.test.js"
Cohesion: 0.24
Nodes (7): createProfile(), readHead(), assert, { createProfile }, KEY, setup(), { test }

### Community 84 - "test run.test.js"
Cohesion: 0.11
Nodes (12): assert, audioJoined(), { EventEmitter }, fs, joined(), { PassThrough }, path, { run } (+4 more)

### Community 85 - "createShareManager"
Cohesion: 0.31
Nodes (19): createShareManager(), approve(), cleanup(), close(), emit(), endCall(), expire(), frameFor() (+11 more)

### Community 86 - "web/call.js"
Cohesion: 0.09
Nodes (21): Web server environment variables, BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts, checkFactsDetailed }, { createHearing }, { createShareDesktop }, { createStt }, { FACTORY, GITHUB } (+13 more)

### Community 87 - "core/package.json"
Cohesion: 0.17
Nodes (11): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+3 more)

### Community 88 - "createClaudeBrain"
Cohesion: 0.53
Nodes (9): createClaudeBrain(), answerTurn(), checkDestination(), lookupTurn(), propose(), run(), stop(), summarize() (+1 more)

### Community 89 - "bot run()"
Cohesion: 0.18
Nodes (24): buildRendererSource(), pageLeft(), run(), abandon(), afterJoin(), discardOpen(), failureReport(), idleAvatar() (+16 more)

### Community 90 - "desktop.test.js"
Cohesion: 0.22
Nodes (7): assert, { createGateway }, { createSessions }, { makeRedactor }, running, scope, test

### Community 91 - "scope.js"
Cohesion: 0.12
Nodes (15): DESTINATIONS, fs, LISTEN, { makeRedactor }, path, resolveListen(), { toWhisperLanguage }, assert (+7 more)

### Community 92 - "test/board.test.js"
Cohesion: 0.08
Nodes (31): COLUMNS, projectBoard(), { repositoryOf }, STAGES, boundedFetch(), { Client }, createCfactorySource(), call() (+23 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Control-channel additions (an additive change to #3), Design, Order and dependencies, Proposing, approving, stopping, Risks, Spec: Show the CFactory board in the call, The constraint that shapes it (+3 more)

### Community 95 - "actions-record.test.js"
Cohesion: 0.09
Nodes (17): fs, path, assert, { createRecord }, fs, { makeRedactor }, os, path (+9 more)

### Community 96 - "Spec: an approved, read-only Claude investigation from the call"
Cohesion: 0.18
Nodes (10): 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), 3. RFactory: hearing, approval, the shared log, the spoken result, Alternatives rejected, Design, Findings this design rests on (checked 2026-11-19), Order and dependencies, Risks (+2 more)

### Community 97 - "lookup-endpoint.js"
Cohesion: 0.22
Nodes (6): createLookupEndpoint(), http, { ListToolsRequestSchema, CallToolRequestSchema }, { randomBytes, timingSafeEqual }, { Server }, { StreamableHTTPServerTransport }

### Community 98 - "cfactory-write.js"
Cohesion: 0.15
Nodes (14): deriveEffects(), describe(), SERVICE, STAGE, stageFor(), stateOf(), WRITES, { Client } (+6 more)

### Community 99 - "items.test.js"
Cohesion: 0.22
Nodes (5): assert, { mapGithub, summarise }, mapping, run(), test

### Community 100 - "Plan: A face for the bot that talks when it speaks"
Cohesion: 0.25
Nodes (7): speechLevel(), Decisions carried over (approved intent and spec), Deviations after merge, Plan: A face for the bot that talks when it speaks, Rollback, Tests, Timing and "never frozen"

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
Cohesion: 0.18
Nodes (10): Alternatives rejected, Bounded run time, Decisions on the intent's open questions (proposed), Design, PEM flag across polls (`web/shares.js:49-51`), PEM marker scanner, Risks, Spec: redact credentials that wrap across log lines (+2 more)

### Community 108 - "ollama-standup.js"
Cohesion: 0.28
Nodes (7): { checkFacts }, count(), fs, main(), path, { setup }, setup()

### Community 109 - "Design"
Cohesion: 0.12
Nodes (15): Alternatives rejected, Design, Effects are derived, not trusted, Execution: re-check, claim, record, dispatch once, Keys and switches, Pending actions and approval, Reading CFactory's results, Recognising an action request (+7 more)

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "gateway.js"
Cohesion: 0.22
Nodes (11): DESKTOP, { mapGithub, summarise, STATES }, NAMES, { origin }, SCHEMAS, FAIL, failing(), labelNames() (+3 more)

### Community 112 - "stt-languages.test.js"
Cohesion: 0.38
Nodes (5): toWhisperLanguage(), WHISPER_LANGUAGES, assert, test, { WHISPER_LANGUAGES, toWhisperLanguage }

### Community 113 - "Plan: Show the CFactory board in the call"
Cohesion: 0.33
Nodes (5): Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Tests

### Community 114 - "shell-browser.test.js"
Cohesion: 0.20
Nodes (6): assert, { chromium }, { createApp }, { loadRoles }, { spawnSync }, test

### Community 115 - "ref_node_http"
Cohesion: 0.29
Nodes (3): http, [portA, portB], state

### Community 116 - "listProjects"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Risks, Spec: project-aware calls, Verification, listProjects()

### Community 117 - "boundary.test.js"
Cohesion: 0.10
Nodes (14): card(), assert, callTool(), { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs (+6 more)

### Community 118 - "createActionManager"
Cohesion: 0.38
Nodes (13): createActionManager(), approve(), emit(), endCall(), expire(), finish(), list(), live() (+5 more)

### Community 119 - "createGateway"
Cohesion: 0.60
Nodes (5): createGateway(), call(), numberFrom(), snapshot(), setup()

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

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 130 - "fake-github-mcp.js"
Cohesion: 0.33
Nodes (4): { ListToolsRequestSchema, CallToolRequestSchema }, { Server }, { StdioServerTransport }, @modelcontextprotocol/sdk

### Community 141 - "deploy pod.sh"
Cohesion: 1.00
Nodes (3): down(), pod.sh script, up()

### Community 142 - "verify share.sh"
Cohesion: 0.83
Nodes (3): ready(), share.sh script, web_stop()

### Community 161 - "stt.test.js"
Cohesion: 0.22
Nodes (6): assert, { createStt }, fs, os, path, test

### Community 163 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.15
Nodes (12): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 8. Problems we hit (+4 more)

### Community 167 - "Design"
Cohesion: 0.14
Nodes (13): AI disclosure, Alternatives rejected, Cost, Design, Evidence this spec rests on, Licence (owner decision 2: the whole repository is AGPL-3.0), Packaging, Portraits and notices (+5 more)

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 172 - "Phase 0 results: can a guest bot join Google Meet, speak and read captions?"
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

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

### Community 198 - "loadScope"
Cohesion: 0.16
Nodes (19): loadScope(), action(), Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Steps, Tests (+11 more)

### Community 199 - "theme.js"
Cohesion: 0.67
Nodes (3): applyTheme(), dark, observer

### Community 206 - "source-guard.test.js"
Cohesion: 0.06
Nodes (30): Affected users and systems, Amendments (owner, 2026-11-26), Constraints, Decisions (owner, 2026-11-26: "approve with your recommendations"), Intent: in-call agents, the model with live tools, provider chosen per call, Open questions, Problem, Proposed outcome (+22 more)

### Community 207 - "bootstrap-secrets.sh"
Cohesion: 0.83
Nodes (3): env_of(), bootstrap-secrets.sh script, write_secret()

### Community 208 - "hearing.test.js"
Cohesion: 0.36
Nodes (6): createHearing(), assert, { createHearing }, fakeClock(), setup(), test

## Knowledge Gaps
- **30 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1424 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `join()` connect `join` to `client.test.js`, `agent.test.js`, `Spec: the bot hears the call itself (its own speech-to-text)`, `verify verify.test.js`, `Phase 0 results: can a guest bot join Google Meet, speak and read captions?`, `speak`, `spike hello-call.test.js`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `createLifecycle()` (e.g. with `lifecycle.js` and `action()`) actually correct?**
  _`createLifecycle()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `makeRedactor()` connect `makeRedactor` to `redact.js`, `run.js`, `test brain.test.js`, `gateway.test.js`, `Steps`, `rfactory-standup.js`, `lookups.test.js`, `test claude-cli.test.js`, `cfactory-write.test.js`, `proxy.test.js`, `core/test/actions.test.js`, `loadScope`, `test cfactory.test.js`, `loadScope`, `bot run()`, `desktop.test.js`, `scope.js`, `test/board.test.js`, `cfactory-write.js`, `ollama-standup.js`, `createGateway`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `checkFacts` be split into smaller, more focused modules?**
  _Cohesion score 0.0812807881773399 - nodes in this community are weakly interconnected._
- **Why does `checkFacts()` connect `checkFacts` to `loadScope`, `ref_node_assert`, `createCallManager`, `claude-cli.js`, `core/package.json`, `ollama-standup.js`, `speak`, `Standalone mode S1: end-to-end results (#2 step 10)`, `Deviations`, `createClaudeBrain`, `Steps`, `rfactory-standup.js`, `Design`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._