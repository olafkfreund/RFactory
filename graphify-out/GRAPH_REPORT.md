# Graph Report - RFactory-t58  (2026-11-27)

## Corpus Check
- 316 files · ~491,522 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 10, .nix 6, .css 4)

## Summary
- 3629 nodes · 6593 edges · 236 communities (199 shown, 37 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 917 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c7693ecf`
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
- core/test/notes.test.js
- web/test/notes.test.js
- test desktop-ui.test.js
- guard.test.js
- RFB
- runner runner.test.js
- k8s-policy.js
- join
- github.test.js
- runner runner.js
- proxy.js
- test server.test.js
- test brain.test.js
- test avatar-state.test.js
- Profiles
- .rQwait
- Steps
- Plan: in-call agents, slice 1: live read-only lookups
- rfactory-standup.js
- How the bot hears
- web server.js
- lookups.test.js
- viewer/board.test.js
- claude-cli.test.js
- proxy.test.js
- tts.test.js
- client.test.js
- profiles.test.js
- redact.js
- stt-bridge.test.js
- deflate.js
- cfactory-write.test.js
- kyverno-scope.test.js
- verify verify.test.js
- desktop-routes.test.js
- speak
- makeRedactor
- inflate.js
- verify net.sh
- verify profiles.sh
- lookup-endpoint.test.js
- running
- spike hello-call.test.js
- share.test.js
- vm-call.test.js
- createInvestigationManager
- kubevirt.test.js
- createProxy
- runner protocol.js
- facts.js
- createShare
- ref_node_test
- core/test/actions.test.js
- share-desktop.test.js
- checkFacts
- github-read.js
- reaper reaper.test.js
- Spec: call the bot "Factory"
- Steps
- avatars.test.js
- test cfactory.test.js
- agent/call.test.js
- gateway.test.js
- ref_node_assert
- bot bot/package.json
- Design
- trees.js
- runner k8s-lifecycle.test.js
- web live-view.test.js
- logging.js
- Display
- desktop-routes.test.js
- Design
- spike spike/package.json
- profile.test.js
- test run.test.js
- createShareManager
- web/call.js
- core/package.json
- run.js
- bot run()
- desktop.test.js
- scope.js
- cfactory.js
- desktop desktop/package.json
- Design
- ref_node_fs
- Spec: an approved, read-only Claude investigation from the call
- lookup-endpoint.js
- lookups.js
- Intent: in-call agents, the model with live tools, provider chosen per call
- main
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
- scope.js
- des.js
- @rfactory/core
- ref_node_http
- cfactory-write.js
- boundary.test.js
- web/test/actions.test.js
- Intent: call the bot "Factory"
- RSAAESAuthenticationState
- Intent: see why Meet refuses the call bot, and recover from it
- Websock
- verify e2e.sh
- H264Context
- k3d k11.sh
- k3d mk-tls.sh
- a
- verify liveview.sh
- RFactory
- @modelcontextprotocol/sdk
- Intent: the bot hears the call itself (its own speech-to-text)
- GestureHandler
- fill_window
- Keyboard
- browser.js
- inflator.js
- roles.test.js
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
- events.js
- Socket
- Design
- web/package.json
- md5.js
- TightDecoder
- loadScope
- Intent: redact credentials that wrap across log lines
- Desktop VMs on the k3d factory cluster
- Plan: v1 roles in code (admin, approver, member), slice "roles" of #2
- eyes
- Design
- Design
- events.js
- teams-tap-spike.js
- Design
- shares.test.js
- Plan: Phase 0, the Linux call test
- Intent: run a Claude terminal from the call, and show it
- Design
- Spec: standup notes, slice 1: dictated notes, review on the page, a Markdown download
- Intent: run RFactory in the factory cluster like the other Factory services
- Spec: see why Meet refuses the call bot, and recover from it
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
- k14 results: agent workspace desktops on k3d with KubeVirt
- loadScope
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
- effects.js
- makeTable
- Intent: standup notes: record what is agreed, turn it into cards, publish the notes
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
- hearing.test.js
- assert-signature-location.sh
- Plan: finish the "Factory" rename and stop false wakes at a caption block start
- mesh
- move
- state
- cap
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
- Buf16
- Buf32
- Buf8
- deflateInfo
- inflateInfo

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `createLifecycle()` - 45 edges
3. `makeRedactor()` - 41 edges
4. `createInvestigationManager()` - 37 edges
5. `Steps` - 37 edges
6. `checkFacts()` - 33 edges
7. `createCallManager()` - 33 edges
8. `Display` - 32 edges
9. `Websock` - 32 edges
10. `run()` - 27 edges

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

## Communities (236 total, 37 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Design, Hearing: wake phrase and end of a question, Packaging, Risks, Spec: Phase 1b, a voice standup in Google Meet, Speech (TTS), Verification (+2 more)

### Community 2 - "rfb.js"
Cohesion: 0.06
Nodes (18): CopyRectDecoder, JPEGDecoder, RawDecoder, RREDecoder, ZlibDecoder, Deflator, encodings, _buildExtendedClipboardFlags() (+10 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.08
Nodes (19): assert, { createCallManager }, { createInvestigationManager }, { EventEmitter }, fakeClock(), finishSpeech(), flush(), fs (+11 more)

### Community 4 - "public app.js"
Cohesion: 0.05
Nodes (77): Deviations from the spec (for approval with this plan), ago(), clear(), clock(), day(), decide(), decideInvestigation(), decideShare() (+69 more)

### Community 5 - "createCallManager"
Cohesion: 0.19
Nodes (27): resolveListen(), number(), Steps, Steps, 2. The lookup tools (`core/src/lookups.js`, new), createCallManager(), addressed(), answer() (+19 more)

### Community 6 - "claude-cli.js"
Cohesion: 0.12
Nodes (15): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, LOOKUP_ERRORS, LOOKUP_SYSTEM_PROMPT (+7 more)

### Community 7 - "createLifecycle"
Cohesion: 0.11
Nodes (35): createLifecycle(), accept(), allowAccept(), attachAgent(), boot(), callAttach(), cancel(), cancelNow() (+27 more)

### Community 8 - "index.js"
Cohesion: 0.08
Nodes (33): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+25 more)

### Community 9 - "core/test/notes.test.js"
Cohesion: 0.13
Nodes (20): hashPayload(), checkNote(), closeEvidence(), { FAILED }, { hashPayload }, KINDS, notesHash(), { reviewCard, ACTIVE } (+12 more)

### Community 10 - "web/test/notes.test.js"
Cohesion: 0.11
Nodes (31): 5. Routes and the page, createNotesManager(), approve(), discard(), download(), edit(), emit(), endCall() (+23 more)

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "guard.test.js"
Cohesion: 0.06
Nodes (52): binding(), cidrFamily(), command(), createApi(), get(), createGuard(), apply(), counters() (+44 more)

### Community 13 - "RFB"
Cohesion: 0.06
Nodes (6): clientEncodings(), enableContinuousUpdates(), keyEvent(), RFB, setDesktopSize(), xvpOp()

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 15 - "k8s-policy.js"
Cohesion: 0.05
Nodes (45): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+37 more)

### Community 16 - "join"
Cohesion: 0.24
Nodes (10): releaseAttempt(), join(), Problem, Decisions (approved intent and spec), Deviations, Plan: see why Meet refuses the call bot, and recover from it, Rollback, Steps (+2 more)

### Community 17 - "github.test.js"
Cohesion: 0.10
Nodes (22): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFileSync } (+14 more)

### Community 18 - "runner runner.js"
Cohesion: 0.06
Nodes (36): clearInterval(), createK8s(), fs, assert, { createK8s }, fs, http, { inClusterConfig } (+28 more)

### Community 19 - "proxy.js"
Cohesion: 0.16
Nodes (15): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, inRange() (+7 more)

### Community 20 - "test server.test.js"
Cohesion: 0.08
Nodes (20): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, { handleCall }, items, { loadRoles } (+12 more)

### Community 21 - "test brain.test.js"
Cohesion: 0.05
Nodes (33): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+25 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.11
Nodes (13): installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState(), meshAt() (+5 more)

### Community 24 - ".rQwait"
Cohesion: 0.12
Nodes (3): fbUpdateRequest(), decodeUTF8(), Websock

### Community 25 - "Steps"
Cohesion: 0.09
Nodes (30): headline(), discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun() (+22 more)

### Community 26 - "Plan: in-call agents, slice 1: live read-only lookups"
Cohesion: 0.25
Nodes (7): setCameraRenderer(), ctx(), Decisions (approved intent and spec, with the owner's amendments of 2026-11-26), Plan: in-call agents, slice 1: live read-only lookups, Rollback, Shared contracts (steps 2 to 6 all follow these), Tests

### Community 27 - "rfactory-standup.js"
Cohesion: 0.10
Nodes (27): { checkFacts }, count(), fs, main(), path, { setup }, ageOf(), approveClaude() (+19 more)

### Community 28 - "How the bot hears"
Cohesion: 0.22
Nodes (9): Environment and scope reference, How the bot hears, Language, `listen` values and the per-platform `auto` rule, Per-call worker environment variables (set internally), Privacy, Rollback, Scope fields (`RFACTORY_SCOPE_FILE`) (+1 more)

### Community 29 - "web server.js"
Cohesion: 0.12
Nodes (22): { buildStandup, speakStandupHeadline }, createApp(), bind(), decide(), resolveSlug(), DESKTOP_STATIC, EMPTY_LISTS, fs (+14 more)

### Community 30 - "lookups.test.js"
Cohesion: 0.17
Nodes (9): createLookups(), assert, card, { createCfactorySource }, { createGithubRead, validPath, repoUrl }, { createLookups, FACTORY, GITHUB, validate }, lookup(), { makeRedactor } (+1 more)

### Community 31 - "viewer/board.test.js"
Cohesion: 0.18
Nodes (11): assert, board(), browser, column(), open(), { test }, { viewerRoute, URL_BOARD }, fs (+3 more)

### Community 32 - "claude-cli.test.js"
Cohesion: 0.13
Nodes (26): createClaudeBrain(), answerTurn(), checkDestination(), lookupTurn(), note(), propose(), run(), stop() (+18 more)

### Community 33 - "proxy.test.js"
Cohesion: 0.13
Nodes (11): assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard, os (+3 more)

### Community 34 - "tts.test.js"
Cohesion: 0.12
Nodes (15): Deviations, Gates, Plan: an approved, read-only Claude investigation from the call (RFactory side), Rollback, Tests, after(), assert, { createTts } (+7 more)

### Community 35 - "client.test.js"
Cohesion: 0.08
Nodes (21): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+13 more)

### Community 36 - "profiles.test.js"
Cohesion: 0.10
Nodes (17): fs, LABEL, { randomUUID, hkdfSync }, admin, assert, fakeK8s(), fixture(), fs (+9 more)

### Community 37 - "redact.js"
Cohesion: 0.24
Nodes (14): base64(), JOINED_RULES, jwtSpans(), KEY_VALUE_AT, keyValueAt(), keyValueMatch(), keyValueSpans(), logSafeWindow() (+6 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.08
Nodes (13): installSttBridge(), assert, event(), fs, { installSttBridge }, path, setup(), test (+5 more)

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

### Community 43 - "desktop-routes.test.js"
Cohesion: 0.18
Nodes (18): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+10 more)

### Community 44 - "speak"
Cohesion: 0.22
Nodes (13): heard(), Captions vs own transcription, Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 1b, a voice standup in Google Meet, Rollback, Steps, Tests (+5 more)

### Community 45 - "makeRedactor"
Cohesion: 0.17
Nodes (15): makeRedactor(), redactString(), toModel(), pemSpans(), redactLegacyPem(), assert, { makeRedactor }, test (+7 more)

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

### Community 50 - "running"
Cohesion: 0.08
Nodes (28): source(), Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Tests, Decisions (approved intent and spec, as delivered in slice A), Delivery in two slices (a plan decision; the approved spec is unchanged) (+20 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.11
Nodes (13): Steps, Pieces, botName(), path, run(), assert, { EventEmitter }, fs (+5 more)

### Community 52 - "share.test.js"
Cohesion: 0.14
Nodes (12): callLaunchArgs(), nonce(), { randomBytes }, assert, browser, { createShare, titleFor, callLaunchArgs, installCaptureGuard }, http, pick() (+4 more)

### Community 53 - "vm-call.test.js"
Cohesion: 0.17
Nodes (10): assert, { createVmSpawn }, { Duplex }, { test }, createVmSpawn(), { EventEmitter }, firstLine(), { PassThrough } (+2 more)

### Community 54 - "createInvestigationManager"
Cohesion: 0.07
Nodes (63): Claude Code CLI brain (`core/src/brains/claude-cli.js`), count(), COUNT_CLAIM, createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog() (+55 more)

### Community 55 - "kubevirt.test.js"
Cohesion: 0.14
Nodes (11): assert, { createAgent }, { createCallWorker }, { createControl }, { dial }, { encode, createDecoder }, net, { parseCmdline } (+3 more)

### Community 56 - "createProxy"
Cohesion: 0.23
Nodes (18): checkedAddresses(), createApi(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect() (+10 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.24
Nodes (16): board(), boolean(), columns, count(), exact(), identity, log(), login() (+8 more)

### Community 58 - "facts.js"
Cohesion: 0.16
Nodes (12): tableOf(), checkFactsDetailed(), CLAIM, COUNT, { summarise }, WORDS, summarise(), assert (+4 more)

### Community 59 - "createShare"
Cohesion: 0.47
Nodes (9): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+1 more)

### Community 60 - "ref_node_test"
Cohesion: 0.15
Nodes (12): Decisions carried over (approved intent and spec), Source adapters, 2. RFactory: the allowlist and its secrets (`core/src/scope.js`), assert, fs, git(), guard, os (+4 more)

### Community 61 - "core/test/actions.test.js"
Cohesion: 0.16
Nodes (13): INVESTIGATION_LIMITS, assert, card, context, { deriveEffects, describe }, { makeRedactor }, ok(), proposal() (+5 more)

### Community 62 - "share-desktop.test.js"
Cohesion: 0.24
Nodes (7): createShareDesktop(), schedule(), stopPolling(), assert, { createShareDesktop }, setup(), test

### Community 63 - "checkFacts"
Cohesion: 0.07
Nodes (30): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass** (+22 more)

### Community 64 - "github-read.js"
Cohesion: 0.23
Nodes (10): validate(), boundedJson(), createGithubRead(), commit(), newest(), request(), repoUrl(), { TextDecoder } (+2 more)

### Community 65 - "reaper reaper.test.js"
Cohesion: 0.17
Nodes (13): createReaper(), leaseStale(), tick(), fs, main(), assert, { createReaper }, fake() (+5 more)

### Community 66 - "Spec: call the bot "Factory""
Cohesion: 0.20
Nodes (9): 1. The name, everywhere a person sees or hears it, 2. The wake rule (`core/src/call/hearing.js`), 3. Tests, Alternatives rejected, Amendment (owner, 2026-11-26): share requests in natural words (#63), Design, Risks, Spec: call the bot "Factory" (+1 more)

### Community 67 - "Steps"
Cohesion: 0.09
Nodes (26): checkClaudeHome(), hasOverride(), tools(), ask(), listTools(), required(), raw(), Decisions carried over from the approved spec (+18 more)

### Community 68 - "avatars.test.js"
Cohesion: 0.20
Nodes (8): assert, crypto, dir, fs, ids, manifest, path, test

### Community 69 - "test cfactory.test.js"
Cohesion: 0.12
Nodes (9): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, { makeRedactor }, reply(), repos, src() (+1 more)

### Community 70 - "agent/call.test.js"
Cohesion: 0.16
Nodes (10): createCallWorker(), { createShare, callLaunchArgs }, { PassThrough }, assert, { createCallWorker, withProxy, MEET_GUEST, TEAMS_CAPTIONS }, { EventEmitter }, fixture(), { test } (+2 more)

### Community 71 - "gateway.test.js"
Cohesion: 0.12
Nodes (11): assert, base, { createGateway }, fetchScope(), fs, { loadScope }, { makeRedactor }, os (+3 more)

### Community 72 - "ref_node_assert"
Cohesion: 0.08
Nodes (20): toSpeech(), assert, fs, path, root, test, assert, test (+12 more)

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
Cohesion: 0.10
Nodes (16): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+8 more)

### Community 77 - "web live-view.test.js"
Cohesion: 0.17
Nodes (10): assert, clientSession, { createApp }, fbUpdate, includes(), { loadRoles }, net, start() (+2 more)

### Community 78 - "logging.js"
Cohesion: 0.10
Nodes (4): HextileDecoder, DataChannel, rawChannelProps, ReadyStates

### Community 80 - "desktop-routes.test.js"
Cohesion: 0.17
Nodes (10): assert, { createApp }, { createDesktop }, grant, { loadRoles }, { makeRedactor }, open, roles (+2 more)

### Community 81 - "Design"
Cohesion: 0.13
Nodes (14): gateway(), Alternatives rejected, Design, Exposure, Facts this rests on (checked on p620, 2026-11-18), Lifecycle, Live view, Network (replaces the approved "Network" section) (+6 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "profile.test.js"
Cohesion: 0.21
Nodes (7): createProfile(), readHead(), assert, { createProfile }, KEY, setup(), { test }

### Community 84 - "test run.test.js"
Cohesion: 0.11
Nodes (12): assert, audioJoined(), { EventEmitter }, fs, joined(), { PassThrough }, path, { run } (+4 more)

### Community 85 - "createShareManager"
Cohesion: 0.31
Nodes (19): createShareManager(), approve(), cleanup(), close(), emit(), endCall(), expire(), frameFor() (+11 more)

### Community 86 - "web/call.js"
Cohesion: 0.09
Nodes (24): NOTE, NOTES, SELF_NAMES, BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts, checkFactsDetailed }, emitLimits(), lookupAnswer() (+16 more)

### Community 87 - "core/package.json"
Cohesion: 0.15
Nodes (12): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+4 more)

### Community 88 - "run.js"
Cohesion: 0.18
Nodes (9): { buildRendererSource }, crypto, fs, { installSttBridge }, { makeRedactor }, os, path, { SpeechGate } (+1 more)

### Community 89 - "bot run()"
Cohesion: 0.18
Nodes (24): buildRendererSource(), pageLeft(), run(), abandon(), afterJoin(), discardOpen(), failureReport(), idleAvatar() (+16 more)

### Community 90 - "desktop.test.js"
Cohesion: 0.13
Nodes (21): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), origin() (+13 more)

### Community 91 - "scope.js"
Cohesion: 0.08
Nodes (18): source, commit, path, repo, assert, { buildRendererSource }, { chromium }, fs (+10 more)

### Community 92 - "cfactory.js"
Cohesion: 0.08
Nodes (34): COLUMNS, projectBoard(), { repositoryOf }, STAGES, boundedFetch(), { Client }, createCfactorySource(), call() (+26 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Control-channel additions (an additive change to #3), Design, Order and dependencies, Proposing, approving, stopping, Risks, Spec: Show the CFactory board in the call, The constraint that shapes it (+3 more)

### Community 95 - "ref_node_fs"
Cohesion: 0.08
Nodes (19): Web server environment variables, fs, path, createStt(), fs, assert, { createRecord }, fs (+11 more)

### Community 96 - "Spec: an approved, read-only Claude investigation from the call"
Cohesion: 0.18
Nodes (10): 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), 3. RFactory: hearing, approval, the shared log, the spoken result, Alternatives rejected, Design, Findings this design rests on (checked 2026-11-19), Order and dependencies, Risks (+2 more)

### Community 97 - "lookup-endpoint.js"
Cohesion: 0.22
Nodes (6): createLookupEndpoint(), http, { ListToolsRequestSchema, CallToolRequestSchema }, { randomBytes, timingSafeEqual }, { Server }, { StreamableHTTPServerTransport }

### Community 98 - "lookups.js"
Cohesion: 0.18
Nodes (6): FACTORY, GITHUB, { mapCard }, specs, { STATES }, { validPath, validNumber }

### Community 99 - "Intent: in-call agents, the model with live tools, provider chosen per call"
Cohesion: 0.18
Nodes (10): Affected users and systems, Amendments (owner, 2026-11-26), Constraints, Decisions (owner, 2026-11-26: "approve with your recommendations"), Intent: in-call agents, the model with live tools, provider chosen per call, Open questions, Problem, Proposed outcome (+2 more)

### Community 100 - "main"
Cohesion: 0.31
Nodes (8): main(), makeLogin(), createTts(), say(), fs, path, run(), wavHeader()

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
Nodes (6): Alternatives rejected, Measured on p620 (2026-11-21), Owner decisions taken with this spec (2026-11-21), Risks, Spec: the bot hears the call itself (its own speech-to-text), Verification

### Community 106 - "verify lifecycle.sh"
Cohesion: 0.42
Nodes (7): case_hold(), egress_cut(), fresh(), hold(), settled(), lifecycle.sh script, watch_end()

### Community 107 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Bounded run time, Decisions on the intent's open questions (proposed), Design, Find first, replace once (`core/src/redact.js` `logSafeWindow`), PEM flag across polls (`web/shares.js:49-51`), PEM marker scanner, Risks (+3 more)

### Community 108 - "vnc.test.js"
Cohesion: 0.12
Nodes (19): bridgeViewOnly(), createFilter(), assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session (+11 more)

### Community 109 - "Design"
Cohesion: 0.12
Nodes (15): Alternatives rejected, Design, Effects are derived, not trusted, Execution: re-check, claim, record, dispatch once, Keys and switches, Pending actions and approval, Reading CFactory's results, Recognising an action request (+7 more)

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "gateway.js"
Cohesion: 0.12
Nodes (16): DESKTOP, { mapGithub, summarise, STATES }, NAMES, { origin }, SCHEMAS, FAIL, failing(), labelNames() (+8 more)

### Community 112 - "scope.js"
Cohesion: 0.18
Nodes (11): DESTINATIONS, fs, LISTEN, { makeRedactor }, path, { toWhisperLanguage }, toWhisperLanguage(), WHISPER_LANGUAGES (+3 more)

### Community 113 - "des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 114 - "@rfactory/core"
Cohesion: 0.13
Nodes (10): @rfactory/core, { checkNote, sentence, headline, toMarkdown, notesHash }, { randomUUID }, same(), assert, { chromium }, { createApp }, { loadRoles } (+2 more)

### Community 115 - "ref_node_http"
Cohesion: 0.29
Nodes (3): http, [portA, portB], state

### Community 116 - "cfactory-write.js"
Cohesion: 0.25
Nodes (7): { Client }, { deriveEffects }, fs, { makeRedactor }, STAGES, { StreamableHTTPClientTransport }, TOOLS

### Community 117 - "boundary.test.js"
Cohesion: 0.10
Nodes (14): card(), assert, callTool(), { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs (+6 more)

### Community 118 - "web/test/actions.test.js"
Cohesion: 0.08
Nodes (36): Facts checked in the real repos, Open questions for the owner, Plan: Agent workspace, a disposable desktop per call (#3), Prerequisites (named revisions), Rollback, Tests, { closeEvidence }, createActionManager() (+28 more)

### Community 119 - "Intent: call the bot "Factory""
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-26: "approved", with the recommendations), Intent: call the bot "Factory", Open questions, Problem, Proposed outcome

### Community 120 - "RSAAESAuthenticationState"
Cohesion: 0.12
Nodes (4): RA2Cipher, RSAAESAuthenticationState, EventTargetMixin, encodeUTF8()

### Community 121 - "Intent: see why Meet refuses the call bot, and recover from it"
Cohesion: 0.33
Nodes (5): Affected users and systems, Constraints, Intent: see why Meet refuses the call bot, and recover from it, Open questions, Proposed outcome

### Community 123 - "verify e2e.sh"
Cohesion: 0.53
Nodes (4): real_ids(), e2e.sh script, teams_call(), WEB_MAX

### Community 124 - "H264Context"
Cohesion: 0.16
Nodes (3): H264Context, H264Decoder, H264Parser

### Community 125 - "k3d k11.sh"
Cohesion: 0.50
Nodes (4): env_of(), RFACTORY_DESKTOP, RFACTORY_RUNNER_URL, k11.sh script

### Community 126 - "k3d mk-tls.sh"
Cohesion: 0.70
Nodes (4): FILES, key(), leaf(), mk-tls.sh script

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 129 - "RFactory"
Cohesion: 0.25
Nodes (6): Deployment, How the bot hears, Licence, RFactory, Roles, Standup and review

### Community 130 - "@modelcontextprotocol/sdk"
Cohesion: 0.33
Nodes (4): { ListToolsRequestSchema, CallToolRequestSchema }, { Server }, { StdioServerTransport }, @modelcontextprotocol/sdk

### Community 131 - "Intent: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text), Open questions, Problem, Proposed outcome

### Community 133 - "fill_window"
Cohesion: 0.43
Nodes (8): deflate_fast(), deflate_huff(), deflate_rle(), deflate_slow(), deflate_stored(), fill_window(), flush_block_only(), longest_match()

### Community 135 - "browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

### Community 137 - "roles.test.js"
Cohesion: 0.27
Nodes (7): loadRoles(), has(), rolesOf(), assert, { loadRoles }, test, Steps

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

### Community 155 - "events.js"
Cohesion: 0.25
Nodes (3): extendedPointerEvent(), pointerEvent(), clientToElement()

### Community 157 - "Design"
Cohesion: 0.14
Nodes (13): 10. Intent constraints carried into slice 1, 1. Data comes from four CFactory read tools, all on the existing read key, 3. Failure and freshness, 4. `core/src/standup.js` (new, pure): `buildStandup(cards, freshness)`, 5. The spoken headline is built by the server: `speakStandupHeadline(standup)`, 6. Review (`core/src/review.js`, new, pure), 8. `core/src/sources/cfactory.js`, 9. CFactory issues to file when this spec is approved (slice 2 dependencies) (+5 more)

### Community 158 - "web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 159 - "md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 161 - "loadScope"
Cohesion: 0.11
Nodes (26): idle(), loadScope(), action(), Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Steps (+18 more)

### Community 162 - "Intent: redact credentials that wrap across log lines"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: redact credentials that wrap across log lines, Open questions, Problem, Proposed outcome

### Community 163 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.15
Nodes (12): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 8. Problems we hit (+4 more)

### Community 164 - "Plan: v1 roles in code (admin, approver, member), slice "roles" of #2"
Cohesion: 0.29
Nodes (6): Decisions carried over from the approved spec, Decisions for this plan, Deviations, Plan: v1 roles in code (admin, approver, member), slice "roles" of #2, Rollback, Tests

### Community 165 - "eyes"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 166 - "Design"
Cohesion: 0.12
Nodes (17): page(), Approval (2026-11-27), Contracts between the steps, Decisions (the approved intent and spec), Deviations, Plan: standup notes, slice 1: dictated notes, review on the page, a Markdown download, Rollback, Tests (+9 more)

### Community 167 - "Design"
Cohesion: 0.12
Nodes (20): label(), stopShare(), exec(), hosts(), Decisions carried over from the approved spec, Steps, Alternatives rejected, Answers to the intent's open questions (+12 more)

### Community 168 - "events.js"
Cohesion: 0.48
Nodes (5): _capturedElemChanged(), _captureObserver, _captureProxy(), releaseCapture(), setCapture()

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 170 - "Design"
Cohesion: 0.18
Nodes (10): 1. The wake rule (`core/src/call/hearing.js:3`), 2. A rejected mention still ends the request before it (`hearing.js:50-71`), 3. What people are told, 4. The shared views (`desktop/guest/agent/viewer/board.js:30`, `:35`), 5. Tests, Alternatives rejected, Design, Risks (+2 more)

### Community 171 - "shares.test.js"
Cohesion: 0.16
Nodes (12): Switches and record, approve(), assert, { createShareManager }, { loadRoles }, { makeRedactor }, proposed(), ready() (+4 more)

### Community 172 - "Plan: Phase 0, the Linux call test"
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "Design"
Cohesion: 0.33
Nodes (6): 1. The service: `rfactory-stt`, 2. In the bot (`bot/run.js`, both deployments): cut speech, send segments, 3. In the call manager (`web/call.js`): transcribe and hear, 4. The listen setting, 5. Packaging and deploy, Design

### Community 175 - "Spec: standup notes, slice 1: dictated notes, review on the page, a Markdown download"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Decisions (2026-11-27), Open questions, Risks, Spec: standup notes, slice 1: dictated notes, review on the page, a Markdown download

### Community 176 - "Intent: run RFactory in the factory cluster like the other Factory services"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decided, Intent: run RFactory in the factory cluster like the other Factory services, Open questions, Problem, Proposed outcome

### Community 177 - "Spec: see why Meet refuses the call bot, and recover from it"
Cohesion: 0.50
Nodes (3): Alternatives rejected, Spec: see why Meet refuses the call bot, and recover from it, Verification

### Community 178 - "Spec: Phase 0, the Linux call test"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Context for later phases (not decided here), Decisions on the intent's Phase 0 questions, Design, Goal, Pass / fail, Risks, Spec: Phase 0, the Linux call test (+1 more)

### Community 179 - "Intent: A face for the bot that talks when it speaks"
Cohesion: 0.22
Nodes (8): Affected users and systems, Constraints, Decisions (owner, 2026-11-17), Intent: A face for the bot that talks when it speaks, Open questions, Problem, Proposed outcome (first slice), Source of the portraits

### Community 180 - "k14 results: agent workspace desktops on k3d with KubeVirt"
Cohesion: 0.12
Nodes (14): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+6 more)

### Community 181 - "loadScope"
Cohesion: 0.11
Nodes (17): speechLevel(), Decisions carried over (approved intent and spec), Deviations after merge, Deviations (Codex review of the approved plan, 2026-11-17), Plan: A face for the bot that talks when it speaks, Rollback, Tests, AI disclosure (+9 more)

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
Cohesion: 0.20
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

### Community 195 - "effects.js"
Cohesion: 0.32
Nodes (7): deriveEffects(), describe(), SERVICE, STAGE, stageFor(), stateOf(), WRITES

### Community 196 - "makeTable"
Cohesion: 0.67
Nodes (3): crc32(), makeTable(), read_buf()

### Community 197 - "Intent: standup notes: record what is agreed, turn it into cards, publish the notes"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: standup notes: record what is agreed, turn it into cards, publish the notes, Open questions, Problem, Proposed outcome

### Community 199 - "theme.js"
Cohesion: 0.67
Nodes (3): applyTheme(), dark, observer

### Community 203 - "Intent: finish the "Factory" rename and stop false wakes at a caption block start"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: finish the "Factory" rename and stop false wakes at a caption block start, Open questions, Problem, Proposed outcome

### Community 206 - "Design"
Cohesion: 0.22
Nodes (8): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Spec: Standalone mode, with a choice of source and brain

### Community 207 - "bootstrap-secrets.sh"
Cohesion: 0.83
Nodes (3): env_of(), bootstrap-secrets.sh script, write_secret()

### Community 208 - "hearing.test.js"
Cohesion: 0.13
Nodes (16): createHearing(), assert, { createHearing }, fakeClock(), headlineRequests, noteRequests, setup(), test (+8 more)

### Community 210 - "Plan: finish the "Factory" rename and stop false wakes at a caption block start"
Cohesion: 0.29
Nodes (6): Decisions (the approved intent and spec), Deviations, Plan: finish the "Factory" rename and stop false wakes at a caption block start, Rollback, Steps, Tests

### Community 211 - "mesh"
Cohesion: 0.33
Nodes (6): mesh, anchors, file, sha256, triangles, f17

### Community 212 - "move"
Cohesion: 0.33
Nodes (6): move, C, JL, JR, LB, LM

### Community 213 - "state"
Cohesion: 0.18
Nodes (11): Approved decisions (copied from the spec, so this plan stands alone), Plan: Review and standup from the board (#28, slice 1), Roles, Rollback, Tests, 1. The bot reports a failed join (`bot/run.js` `start()`), 3. The desktop worker closes what it launched on setup failure (`desktop/guest/agent/call.js:83-90`), 4. The server logs it (`web/call.js` `incoming()`) (+3 more)

### Community 214 - "cap"
Cohesion: 0.67
Nodes (3): cap(), collect(), walk()

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

## Knowledge Gaps
- **35 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+30 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1759 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Steps` connect `createCallManager` to `loadScope`, `Steps`, `public app.js`, `Design`, `core/test/notes.test.js`, `web/test/notes.test.js`, `Design`, `hearing.test.js`, `proxy.js`, `state`, `web/test/actions.test.js`, `createInvestigationManager`, `Steps`, `Websock`, `web server.js`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `createLifecycle()` (e.g. with `lifecycle.js` and `action()`) actually correct?**
  _`createLifecycle()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _35 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Websock` connect `.rQwait` to `rfb.js`, `RFB`, `logging.js`, `Websock`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Should `rfb.js` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Why does `Display` connect `Display` to `rfb.js`, `createInvestigationManager`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._