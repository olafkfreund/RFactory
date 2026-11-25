# Graph Report - RFactory  (2026-11-25)

## Corpus Check
- 232 files · ~303,762 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: (none) 6, .nix 6, .css 4)

## Summary
- 2479 nodes · 4309 edges · 166 communities (150 shown, 16 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 601 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2cafac69`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verify lib.sh
- k8s-policy.js
- makeRedactor
- avatar-state.test.js
- public app.js
- guard.js
- guard.test.js
- gateway.js
- control.js
- core/package.json
- run.js
- test desktop-ui.test.js
- k14 results: agent workspace desktops on k3d with KubeVirt
- Plan: run RFactory in the factory cluster
- runner runner.test.js
- Design
- Plan: Agent workspace, a disposable desktop per call (#3)
- github.test.js
- runner runner.js
- cli.test.js
- test server.test.js
- test brain.test.js
- test avatar-state.test.js
- Profiles
- vnc.test.js
- mapCard
- running
- rfactory-standup.js
- ref_node_http
- web server.js
- Steps
- Plan: A face for the bot that talks when it speaks
- test claude-cli.test.js
- gateway.test.js
- tts.test.js
- client.test.js
- Design
- createCallManager
- stt-bridge.test.js
- main
- cfactory-write.test.js
- kyverno-scope.test.js
- verify verify.test.js
- desktop-routes.js
- claude-cli.js
- web/call.js
- test/call.test.js
- verify net.sh
- verify profiles.sh
- createGuard
- encode
- spike hello-call.test.js
- viewer/board.test.js
- Design
- proxy.test.js
- @rfactory/core
- control.js
- runner protocol.js
- web/test/actions.test.js
- createShare
- desktop.test.js
- lifecycle.js
- Intent: the bot hears the call itself (its own speech-to-text)
- Design
- Intent: redact credentials that wrap across log lines
- reaper reaper.test.js
- review.js
- toModel
- ref_node_assert
- test cfactory.test.js
- agent.test.js
- proxy.test.js
- refused
- bot bot/package.json
- Design
- avatar-renderer.test.js
- runner k8s-lifecycle.test.js
- web live-view.test.js
- Plan: Phase 3, act on the Factories from the call
- ref_node_fs
- Design
- spike spike/package.json
- test run.test.js
- run.test.js
- share.test.js
- bot run()
- scope.js
- test test/board.test.js
- desktop desktop/package.json
- ref_node_fs
- web web/package.json
- Spec: an approved, read-only Claude investigation from the call
- desktop-routes.test.js
- createClaudeBrain
- Call manager (web/call.js)
- k3d k14-env.sh
- verify handover.sh
- Deviations from the spec (for approval with this plan)
- protocol.test.js
- Spec: the bot hears the call itself (its own speech-to-text)
- verify lifecycle.sh
- k3d gate.sh
- desktop.test.js
- shell-browser.test.js
- avatars.test.js
- Socket
- boundary.test.js
- createActionManager
- Steps
- verify e2e.sh
- index.js
- k3d k11.sh
- k3d mk-tls.sh
- cfactory-write.js
- verify liveview.sh
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
- createStt
- standup.test.js
- Desktop VMs on the k3d factory cluster
- Steps
- Design
- Socket
- teams-tap-spike.js
- Design
- Phase 0 results: can a guest bot join Google Meet, speak and read captions?
- Intent: run a Claude terminal from the call, and show it
- Design
- share-desktop.test.js
- Intent: run RFactory in the factory cluster like the other Factory services
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
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
- checkFacts
- stt-languages.test.js
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
- createCfactorySource

## God Nodes (most connected - your core abstractions)
1. `createLifecycle()` - 45 edges
2. `createInvestigationManager()` - 37 edges
3. `makeRedactor()` - 36 edges
4. `checkFacts()` - 28 edges
5. `toModel()` - 26 edges
6. `createCallManager()` - 26 edges
7. `run()` - 23 edges
8. `Profiles` - 23 edges
9. `createShareManager()` - 22 edges
10. `loadScope()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Claude login: the shared `factory-cli-creds`, like CFactory` --references--> `checkClaudeHome()`  [INFERRED]
  spec/2026-11-24-33-rfactory-in-cluster.md → core/src/brains/destination.js
- `Constraints` --references--> `heard()`  [INFERRED]
  intent/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `Proposed outcome` --references--> `heard()`  [INFERRED]
  intent/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `Verification` --references--> `heard()`  [INFERRED]
  spec/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `Source offer to every remote user (AGPL §13)` --references--> `origin()`  [INFERRED]
  spec/2026-11-17-13-talking-avatar.md → core/src/desktop/session.js

## Import Cycles
- None detected.

## Communities (166 total, 16 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "k8s-policy.js"
Cohesion: 0.06
Nodes (41): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+33 more)

### Community 2 - "makeRedactor"
Cohesion: 0.15
Nodes (21): jwtSpans(), keyValueSpans(), makeRedactor(), logSafeWindow(), redactString(), toModel(), PATTERNS, pemSpans() (+13 more)

### Community 3 - "avatar-state.test.js"
Cohesion: 0.06
Nodes (26): assert, { createCallManager }, { createInvestigationManager }, { EventEmitter }, fakeActions(), a, fakeClock(), finishSpeech() (+18 more)

### Community 4 - "public app.js"
Cohesion: 0.07
Nodes (51): ago(), clear(), clock(), day(), decide(), decideInvestigation(), decideShare(), el() (+43 more)

### Community 5 - "guard.js"
Cohesion: 0.19
Nodes (13): binding(), cidrFamily(), command(), apply(), { execFile }, execFileAsync, findVeth(), fs (+5 more)

### Community 6 - "guard.test.js"
Cohesion: 0.13
Nodes (14): assert, { buildPolicy }, cniResult(), entry, { execFileSync }, fake(), fs, https (+6 more)

### Community 7 - "gateway.js"
Cohesion: 0.14
Nodes (25): createLifecycle(), accept(), allowAccept(), attachAgent(), boot(), cancelNow(), check(), cleanup() (+17 more)

### Community 8 - "control.js"
Cohesion: 0.27
Nodes (10): capText(), createControl(), applyHosts(), closePage(), page(), start(), fs, originOf() (+2 more)

### Community 9 - "core/package.json"
Cohesion: 0.11
Nodes (15): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+7 more)

### Community 10 - "run.js"
Cohesion: 0.18
Nodes (9): { buildRendererSource }, crypto, fs, { installSttBridge }, { makeRedactor }, os, path, { SpeechGate } (+1 more)

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "k14 results: agent workspace desktops on k3d with KubeVirt"
Cohesion: 0.12
Nodes (14): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+6 more)

### Community 13 - "Plan: run RFactory in the factory cluster"
Cohesion: 0.17
Nodes (11): Branches and worktrees, Corrections to the approved spec, Decisions (from the approved spec; owner defaults accepted 2026-11-24), Deviations, Lead steps, in order, Plan: run RFactory in the factory cluster, Rollback, Steps (+3 more)

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 15 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Bounded run time, Decisions on the intent's open questions (proposed), Design, PEM flag across polls (`web/shares.js:49-51`), PEM marker scanner, Risks, Spec: redact credentials that wrap across log lines (+2 more)

### Community 16 - "Plan: Agent workspace, a disposable desktop per call (#3)"
Cohesion: 0.19
Nodes (13): label(), stopShare(), exec(), hosts(), Decisions carried over from the approved spec, Facts checked in the real repos, Open questions for the owner, Plan: Agent workspace, a disposable desktop per call (#3) (+5 more)

### Community 17 - "github.test.js"
Cohesion: 0.10
Nodes (22): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFileSync } (+14 more)

### Community 18 - "runner runner.js"
Cohesion: 0.09
Nodes (26): clearInterval(), { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade(), crypto (+18 more)

### Community 19 - "cli.test.js"
Cohesion: 0.09
Nodes (15): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+7 more)

### Community 20 - "test server.test.js"
Cohesion: 0.10
Nodes (17): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, { handleCall }, items, { loadRoles } (+9 more)

### Community 21 - "test brain.test.js"
Cohesion: 0.11
Nodes (20): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+12 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.11
Nodes (13): installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState(), meshAt() (+5 more)

### Community 23 - "Profiles"
Cohesion: 0.06
Nodes (30): fs, LABEL, name(), Profiles, { randomUUID, hkdfSync }, admin, assert, fakeK8s() (+22 more)

### Community 24 - "vnc.test.js"
Cohesion: 0.12
Nodes (19): bridgeViewOnly(), createFilter(), assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session (+11 more)

### Community 25 - "mapCard"
Cohesion: 0.15
Nodes (13): mapCard(), 10. Intent constraints carried into slice 1, 1. Data comes from four CFactory read tools, all on the existing read key, 2. Scope: one rule, used everywhere, 3. Failure and freshness, 4. `core/src/standup.js` (new, pure): `buildStandup(cards, freshness)`, 6. Review (`core/src/review.js`, new, pure), 8. `core/src/sources/cfactory.js` (+5 more)

### Community 26 - "running"
Cohesion: 0.15
Nodes (13): Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Tests, Landing record (2026-11-24), Live check results (step 12), The action record (+5 more)

### Community 27 - "rfactory-standup.js"
Cohesion: 0.08
Nodes (33): { checkFacts }, count(), fs, main(), path, { setup }, ageOf(), approveClaude() (+25 more)

### Community 28 - "ref_node_http"
Cohesion: 0.29
Nodes (3): http, [portA, portB], state

### Community 29 - "web server.js"
Cohesion: 0.13
Nodes (20): { buildStandup, speakStandupHeadline }, createApp(), DESKTOP_STATIC, fs, HEADERS, http, keepAlive(), main() (+12 more)

### Community 30 - "Steps"
Cohesion: 0.22
Nodes (8): idle(), setCameraRenderer(), Steps, Alternatives rejected, Evidence this spec rests on, Risks, Spec: A face for the bot that talks when it speaks, Verification

### Community 31 - "Plan: A face for the bot that talks when it speaks"
Cohesion: 0.25
Nodes (7): speechLevel(), Decisions carried over (approved intent and spec), Deviations after merge, Plan: A face for the bot that talks when it speaks, Rollback, Tests, Timing and "never frozen"

### Community 32 - "test claude-cli.test.js"
Cohesion: 0.13
Nodes (22): createClaudeBrain(), checkDestination(), propose(), run(), summarize(), turn(), checkClaudeHome(), hasOverride() (+14 more)

### Community 33 - "gateway.test.js"
Cohesion: 0.11
Nodes (13): assert, base, { createGateway }, fetchScope(), fs, gateway(), { loadScope }, { makeRedactor } (+5 more)

### Community 34 - "tts.test.js"
Cohesion: 0.13
Nodes (14): assert, { createTts }, { EventEmitter }, fs, os, { PassThrough }, path, test (+6 more)

### Community 35 - "client.test.js"
Cohesion: 0.10
Nodes (16): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+8 more)

### Community 36 - "Design"
Cohesion: 0.14
Nodes (13): Alternatives rejected, Design, Effects are derived, not trusted, Keys and switches, Pending actions and approval, Reading CFactory's results, Recognising an action request, Risks (+5 more)

### Community 37 - "createCallManager"
Cohesion: 0.25
Nodes (20): resolveListen(), createCallManager(), addressed(), answer(), armQuiet(), audio(), drain(), incoming() (+12 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.10
Nodes (8): installSttBridge(), assert, fs, { installSttBridge }, path, setup(), test, vm

### Community 39 - "main"
Cohesion: 0.43
Nodes (5): connect(), handshake(), main(), [mode, url], out()

### Community 40 - "cfactory-write.test.js"
Cohesion: 0.10
Nodes (19): createCfactoryWriter(), getClient(), invoke(), assert, bareBlocked, bareStarted, before, card (+11 more)

### Community 41 - "kyverno-scope.test.js"
Cohesion: 0.14
Nodes (16): assert, dir, { firstHost }, fs, path, policies, probeCidrs(), test (+8 more)

### Community 42 - "verify verify.test.js"
Cohesion: 0.12
Nodes (15): assert, beats(), CHECKS, fs, http, INPUT, { join }, LIB (+7 more)

### Community 43 - "desktop-routes.js"
Cohesion: 0.17
Nodes (19): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+11 more)

### Community 44 - "claude-cli.js"
Cohesion: 0.15
Nodes (12): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, os, path (+4 more)

### Community 45 - "web/call.js"
Cohesion: 0.15
Nodes (12): BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts }, { createHearing }, { createShareDesktop }, { createStt }, fs, { resolveListen } (+4 more)

### Community 46 - "test/call.test.js"
Cohesion: 0.14
Nodes (11): assert, { createAgent }, { createCallWorker }, { createControl }, { dial }, { encode, createDecoder }, net, { parseCmdline } (+3 more)

### Community 47 - "verify net.sh"
Cohesion: 0.16
Nodes (17): BP, connect(), deadline_left(), hello(), mk_target(), mkp(), NIP, node_ip() (+9 more)

### Community 48 - "verify profiles.sh"
Cohesion: 0.23
Nodes (18): app_restore(), app_sync(), argo_app(), attach(), ciphertext(), cm_field(), errmatch(), extra_cleanup() (+10 more)

### Community 49 - "createGuard"
Cohesion: 0.35
Nodes (12): createApi(), get(), createGuard(), counters(), heartbeat(), reconcile(), reconcileOnce(), server() (+4 more)

### Community 50 - "encode"
Cohesion: 0.19
Nodes (13): nonce(), callAttach(), login(), shareStart(), shareStop(), sharing(), toGuest(), viewClose() (+5 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.11
Nodes (13): Steps, Pieces, botName(), path, run(), assert, { EventEmitter }, fs (+5 more)

### Community 52 - "viewer/board.test.js"
Cohesion: 0.19
Nodes (11): assert, board(), browser, column(), open(), { test }, { viewerRoute, URL_BOARD }, fs (+3 more)

### Community 53 - "Design"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Spec: Standalone mode, with a choice of source and brain (+1 more)

### Community 54 - "proxy.test.js"
Cohesion: 0.07
Nodes (63): Claude Code CLI brain (`core/src/brains/claude-cli.js`), count(), COUNT_CLAIM, createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog() (+55 more)

### Community 55 - "@rfactory/core"
Cohesion: 0.33
Nodes (5): @rfactory/core, { deriveEffects, describe }, FINAL, { randomUUID }, { validate, hashPayload, canonical }

### Community 56 - "control.js"
Cohesion: 0.22
Nodes (18): createApi(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect(), handleForward() (+10 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.22
Nodes (15): board(), boolean(), columns, count(), exact(), identity, log(), login() (+7 more)

### Community 58 - "web/test/actions.test.js"
Cohesion: 0.20
Nodes (7): approve(), assert, { createActionManager }, { loadRoles }, { makeRedactor }, setup(), test

### Community 59 - "createShare"
Cohesion: 0.47
Nodes (9): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+1 more)

### Community 60 - "desktop.test.js"
Cohesion: 0.18
Nodes (15): addressBits(), BASE_PROTECTED, checkedAddresses(), crypto, dgram, dnsReply(), fs, http (+7 more)

### Community 61 - "lifecycle.js"
Cohesion: 0.22
Nodes (6): { buildPolicy }, { createDecoder, tag, encode, LANGUAGE }, crypto, net, { nonce: newNonce }, { StringDecoder }

### Community 62 - "Intent: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text), Open questions, Problem, Proposed outcome

### Community 63 - "Design"
Cohesion: 0.25
Nodes (8): CFactory source (`core/src/sources/cfactory.js`), Data, Decisions on the intent's open questions (recommended), Design, Sign-in, Web server (`web/`), Where it runs, Where it sits

### Community 64 - "Intent: redact credentials that wrap across log lines"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: redact credentials that wrap across log lines, Open questions, Problem, Proposed outcome

### Community 65 - "reaper reaper.test.js"
Cohesion: 0.17
Nodes (13): createReaper(), leaseStale(), tick(), fs, main(), assert, { createReaper }, fake() (+5 more)

### Community 66 - "review.js"
Cohesion: 0.15
Nodes (17): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+9 more)

### Community 67 - "toModel"
Cohesion: 0.10
Nodes (20): tools(), listTools(), required(), raw(), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains), Recorded GitHub inventory (pinned 1.14.0, captured 2026-11-17) (+12 more)

### Community 68 - "ref_node_assert"
Cohesion: 0.10
Nodes (16): assert, fs, path, root, test, assert, test, { toSpeech } (+8 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.12
Nodes (7): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, reply(), repos, test

### Community 70 - "agent.test.js"
Cohesion: 0.17
Nodes (9): createCallWorker(), { createShare, callLaunchArgs }, { PassThrough }, assert, { createCallWorker, withProxy, TEAMS_CAPTIONS }, { EventEmitter }, fixture(), { test } (+1 more)

### Community 71 - "proxy.test.js"
Cohesion: 0.12
Nodes (11): assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard, os (+3 more)

### Community 72 - "refused"
Cohesion: 0.33
Nodes (6): refused(), Deviations, Execution: re-check, claim, record, dispatch once, 9. CFactory issues to file when this spec is approved (slice 2 dependencies), after(), voiceFixture()

### Community 73 - "bot bot/package.json"
Cohesion: 0.14
Nodes (13): dependencies, playwright-core, @vibeconferencing/calls, engines, node, playwright-core, @vibeconferencing/calls, license (+5 more)

### Community 74 - "Design"
Cohesion: 0.13
Nodes (14): Alternatives rejected, Claude login: the shared `factory-cli-creds`, like CFactory, Design, Images: built, signed and promoted by CI, like CFactory, One pod, as today, Order and cutover, Owner decisions (proposed defaults), Pod security (+6 more)

### Community 75 - "avatar-renderer.test.js"
Cohesion: 0.18
Nodes (6): assert, { buildRendererSource }, { chromium }, fs, path, test

### Community 76 - "runner k8s-lifecycle.test.js"
Cohesion: 0.19
Nodes (9): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+1 more)

### Community 77 - "web live-view.test.js"
Cohesion: 0.15
Nodes (11): assert, client(), clientSession, { createApp }, fbUpdate, includes(), { loadRoles }, net (+3 more)

### Community 78 - "Plan: Phase 3, act on the Factories from the call"
Cohesion: 0.33
Nodes (5): Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Tests

### Community 80 - "ref_node_fs"
Cohesion: 0.06
Nodes (28): assert, { createProfile }, KEY, { test }, fs, path, fs, assert (+20 more)

### Community 81 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Design, Exposure, Facts this rests on (checked on p620, 2026-11-18), Lifecycle, Live view, Profiles, Risks (+3 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 84 - "test run.test.js"
Cohesion: 0.15
Nodes (12): assert, audioJoined(), { EventEmitter }, fs, joined(), { PassThrough }, path, { run } (+4 more)

### Community 85 - "run.test.js"
Cohesion: 0.13
Nodes (30): createShareManager(), approve(), cleanup(), close(), emit(), endCall(), expire(), frameFor() (+22 more)

### Community 88 - "share.test.js"
Cohesion: 0.14
Nodes (11): callLaunchArgs(), { randomBytes }, assert, browser, { createShare, titleFor, callLaunchArgs, installCaptureGuard }, http, pick(), { test } (+3 more)

### Community 89 - "bot run()"
Cohesion: 0.19
Nodes (22): buildRendererSource(), pageLeft(), run(), afterJoin(), discardOpen(), idleAvatar(), leftConfirmed(), newGate() (+14 more)

### Community 91 - "scope.js"
Cohesion: 0.13
Nodes (15): DESTINATIONS, fs, LISTEN, loadScope(), { makeRedactor }, path, { toWhisperLanguage }, assert (+7 more)

### Community 92 - "test test/board.test.js"
Cohesion: 0.13
Nodes (15): COLUMNS, projectBoard(), { repositoryOf }, STAGES, assert, callTool(), card(), { createCfactorySource } (+7 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "ref_node_fs"
Cohesion: 0.15
Nodes (10): createK8s(), fs, assert, { createK8s }, fs, http, { inClusterConfig }, os (+2 more)

### Community 95 - "web web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 96 - "Spec: an approved, read-only Claude investigation from the call"
Cohesion: 0.18
Nodes (10): 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), 3. RFactory: hearing, approval, the shared log, the spoken result, Alternatives rejected, Design, Findings this design rests on (checked 2026-11-19), Order and dependencies, Risks (+2 more)

### Community 98 - "desktop-routes.test.js"
Cohesion: 0.18
Nodes (9): assert, { createApp }, { createDesktop }, grant, { loadRoles }, { makeRedactor }, open, roles (+1 more)

### Community 99 - "createClaudeBrain"
Cohesion: 0.15
Nodes (13): loadRoles(), has(), rolesOf(), assert, { loadRoles }, test, Decisions carried over from the approved spec, Decisions for this plan (+5 more)

### Community 100 - "Call manager (web/call.js)"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Design, Hearing: wake phrase and end of a question, Packaging, Risks, Spec: Phase 1b, a voice standup in Google Meet, Speech (TTS), Verification (+2 more)

### Community 101 - "k3d k14-env.sh"
Cohesion: 0.44
Nodes (9): app_sync(), argo(), desktops(), env_of(), kc(), kubectl(), runner_restart(), k14-env.sh script (+1 more)

### Community 102 - "verify handover.sh"
Cohesion: 0.42
Nodes (8): fixture_reached(), hits(), open_page(), page_loaded(), session_of(), handover.sh script, trap_page(), wait_attached()

### Community 103 - "Deviations from the spec (for approval with this plan)"
Cohesion: 0.12
Nodes (24): event(), heard(), toSpeech(), cancel(), join(), Deviations (Codex review of the approved plan, 2026-11-17), Deviations from the spec (for approval with this plan), Decisions carried over from the approved spec and intent (+16 more)

### Community 104 - "protocol.test.js"
Cohesion: 0.18
Nodes (7): assert, fs, { MAX, encode, createDecoder, tag }, net, os, path, { test }

### Community 105 - "Spec: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.17
Nodes (11): 1. The service: `rfactory-stt`, 3. In the call manager (`web/call.js`): transcribe and hear, 4. The listen setting, 5. Packaging and deploy, Alternatives rejected, Design, Measured on p620 (2026-11-21), Owner decisions taken with this spec (2026-11-21) (+3 more)

### Community 106 - "verify lifecycle.sh"
Cohesion: 0.42
Nodes (7): case_hold(), egress_cut(), fresh(), hold(), settled(), lifecycle.sh script, watch_end()

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "desktop.test.js"
Cohesion: 0.07
Nodes (36): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), origin() (+28 more)

### Community 114 - "shell-browser.test.js"
Cohesion: 0.20
Nodes (6): assert, { chromium }, { createApp }, { loadRoles }, { spawnSync }, test

### Community 115 - "avatars.test.js"
Cohesion: 0.20
Nodes (8): assert, crypto, dir, fs, ids, manifest, path, test

### Community 116 - "Socket"
Cohesion: 0.22
Nodes (9): assert, card, context, { deriveEffects, describe }, { makeRedactor }, ok(), proposal(), test (+1 more)

### Community 117 - "boundary.test.js"
Cohesion: 0.11
Nodes (12): assert, { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs, { loadRoles }, { makeRedactor } (+4 more)

### Community 118 - "createActionManager"
Cohesion: 0.38
Nodes (13): createActionManager(), approve(), emit(), endCall(), expire(), finish(), list(), live() (+5 more)

### Community 121 - "Steps"
Cohesion: 0.27
Nodes (8): { Client }, scopedCards(), inScope(), repositoryOf(), STATE, { StreamableHTTPClientTransport }, Steps, renderItem()

### Community 123 - "verify e2e.sh"
Cohesion: 0.53
Nodes (4): real_ids(), e2e.sh script, teams_call(), WEB_MAX

### Community 124 - "index.js"
Cohesion: 0.09
Nodes (27): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+19 more)

### Community 125 - "k3d k11.sh"
Cohesion: 0.50
Nodes (4): env_of(), RFACTORY_DESKTOP, RFACTORY_RUNNER_URL, k11.sh script

### Community 126 - "k3d mk-tls.sh"
Cohesion: 0.70
Nodes (4): FILES, key(), leaf(), mk-tls.sh script

### Community 127 - "cfactory-write.js"
Cohesion: 0.15
Nodes (14): deriveEffects(), describe(), SERVICE, STAGE, stageFor(), stateOf(), WRITES, { Client } (+6 more)

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 141 - "deploy pod.sh"
Cohesion: 1.00
Nodes (3): down(), pod.sh script, up()

### Community 142 - "verify share.sh"
Cohesion: 0.83
Nodes (3): ready(), share.sh script, web_stop()

### Community 161 - "createStt"
Cohesion: 0.33
Nodes (5): Environment and scope reference, Per-call worker environment variables (set internally), Scope fields (`RFACTORY_SCOPE_FILE`), Web server environment variables, createStt()

### Community 162 - "standup.test.js"
Cohesion: 0.19
Nodes (10): buildStandup(), { FAILED, mapCard }, speakStandupHeadline(), assert, build(), { buildStandup, speakStandupHeadline }, freshness(), { makeRedactor } (+2 more)

### Community 163 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.15
Nodes (12): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 8. Problems we hit (+4 more)

### Community 164 - "Steps"
Cohesion: 0.22
Nodes (8): hashPayload(), revalidate(), Decisions carried over (approved intent and spec), Gates, Plan: an approved, read-only Claude investigation from the call (RFactory side), Rollback, Steps, Tests

### Community 167 - "Design"
Cohesion: 0.22
Nodes (9): AI disclosure, Cost, Design, Licence (owner decision 2: the whole repository is AGPL-3.0), Packaging, Portraits and notices, Source offer to every remote user (AGPL §13), The face (+1 more)

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 170 - "Design"
Cohesion: 0.14
Nodes (13): Alternatives rejected, Answers to the intent's open questions, Design, Driving apps, Feasibility gate (first plan step), Lifecycle and disposal, Live view, Network (+5 more)

### Community 172 - "Phase 0 results: can a guest bot join Google Meet, speak and read captions?"
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "Design"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Design, Order and dependencies, Proposing, approving, stopping, Risks, Spec: Show the CFactory board in the call, The constraint that shapes it, The viewer page (in the desktop image) (+1 more)

### Community 175 - "share-desktop.test.js"
Cohesion: 0.24
Nodes (7): createShareDesktop(), schedule(), stopPolling(), assert, { createShareDesktop }, setup(), test

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

### Community 194 - "checkFacts"
Cohesion: 0.12
Nodes (18): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass** (+10 more)

### Community 195 - "stt-languages.test.js"
Cohesion: 0.38
Nodes (5): toWhisperLanguage(), WHISPER_LANGUAGES, assert, test, { WHISPER_LANGUAGES, toWhisperLanguage }

### Community 198 - "createRecord"
Cohesion: 0.27
Nodes (12): action(), Steps, Waves, Steps, Shape, createRecord(), files(), lastEntries() (+4 more)

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

### Community 211 - "createCfactorySource"
Cohesion: 0.20
Nodes (13): createCfactorySource(), call(), comments(), connect(), freshness(), withClient(), within(), src() (+5 more)

## Knowledge Gaps
- **30 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1316 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `makeRedactor()` connect `makeRedactor` to `test claude-cli.test.js`, `gateway.test.js`, `standup.test.js`, `toModel`, `Steps`, `avatar-state.test.js`, `rfactory-standup.js`, `cfactory-write.test.js`, `run.js`, `desktop.test.js`, `Socket`, `test brain.test.js`, `bot run()`, `scope.js`, `test test/board.test.js`, `cfactory-write.js`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `createLifecycle()` (e.g. with `lifecycle.js` and `action()`) actually correct?**
  _`createLifecycle()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `toModel()` connect `makeRedactor` to `test claude-cli.test.js`, `toModel`, `Design`, `Call manager (web/call.js)`, `createRecord`, `Deviations from the spec (for approval with this plan)`, `Plan: Phase 3, act on the Factories from the call`, `Design`, `Design`, `Design`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `k8s-policy.js` be split into smaller, more focused modules?**
  _Cohesion score 0.061224489795918366 - nodes in this community are weakly interconnected._
- **Why does `createLifecycle()` connect `gateway.js` to `Desktop VMs on the k3d factory cluster`, `createRecord`, `Deviations from the spec (for approval with this plan)`, `runner k8s-lifecycle.test.js`, `runner runner.test.js`, `encode`, `runner runner.js`, `lifecycle.js`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._