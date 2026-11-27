# Graph Report - RFactory-t52  (2026-11-27)

## Corpus Check
- 332 files · ~519,689 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 10, .nix 6, .css 4)

## Summary
- 3794 nodes · 6820 edges · 262 communities (221 shown, 41 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 963 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a0f9d143`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verify lib.sh
- Design
- rfb.js
- test/call.test.js
- app.js
- Steps
- claude-cli.js
- createLifecycle
- control.js
- kubevirt.test.js
- How the bot hears
- test desktop-ui.test.js
- guard.test.js
- RFB
- runner runner.test.js
- refresh.js
- e2e-inventory.js
- github.test.js
- runner runner.js
- run.js
- test server.test.js
- brain.test.js
- test avatar-state.test.js
- Profiles
- ._updateConnectionState
- standup.test.js
- Steps
- rfactory-standup.js
- state
- web server.js
- lookups.test.js
- share.test.js
- claude-cli.test.js
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
- app.test.js
- vm-call.test.js
- createInvestigationManager
- index.js
- createProxy
- runner protocol.js
- createActionManager
- kubevirt.test.js
- proxy.js
- lifecycle.js
- share-desktop.test.js
- test/board.test.js
- Design
- reaper reaper.test.js
- Spec: call the bot "Factory"
- Steps
- ref_node_assert
- test cfactory.test.js
- agent/call.test.js
- proxy.test.js
- loadScope
- bot bot/package.json
- guard.js
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
- Steps
- web/call.js
- core/package.json
- createCallManager
- bot run()
- Design
- gateway.test.js
- test/board.test.js
- desktop desktop/package.json
- running
- ref_node_fs
- Spec: an approved, read-only Claude investigation from the call
- shares.test.js
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
- Decisions carried over from the approved spec and intent
- scope.js
- des.js
- shell-browser.test.js
- createGuard
- repo
- boundary.test.js
- deflator.js
- Intent: call the bot "Factory"
- RSAAESAuthenticationState
- Intent: see why Meet refuses the call bot, and recover from it
- ref_node_crypto
- verify e2e.sh
- H264Decoder
- k3d k11.sh
- k3d mk-tls.sh
- .text
- verify liveview.sh
- standup.test.js
- k8s-policy.js
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
- Plan: run RFactory in the factory cluster
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
- Design
- cfactory-write.js
- Intent: run RFactory in the factory cluster like the other Factory services
- desktop.test.js
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
- Deviations from the spec (approved with this plan)
- Intent: redact credentials that wrap across log lines
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
- Plan: enforce an egress limit for the RFactory pod
- events.js
- Plan: Show the CFactory board in the call
- LegacyCrypto
- theme.js
- RSACipher
- CLAUDE.md
- .claude/CLAUDE.md
- Intent: finish the "Factory" rename and stop false wakes at a caption block start
- check-image-stt.sh
- SHELL_INVENTORY.md
- Steps
- bootstrap-secrets.sh
- createHearing
- assert-signature-location.sh
- Design
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
- Intent: the bot hears in audio mode, and joins Meet on the first try
- Buf16
- Buf32
- Buf8
- deflateInfo
- inflateInfo
- k8s-policy.test.js
- join
- check-egress.sh
- github-web.test.js
- ._handleMouse
- Spec: the call Chrome runs with its sandbox on, so Meet admits the bot
- Plan: the bot hears the call itself (its own speech-to-text)
- loadScope
- Plan: project-aware calls, slice B (writes for every project)
- request
- gateway.js
- desktop-routes.test.js
- scoped
- Deviations from the spec revision (Codex re-check and plan review, for approval with this plan)
- stt-languages.test.js
- net.js
- probe.js
- proposed
- Deviations from the spec (for approval with this plan)
- Spec: Phase 3, act on the Factories from the call
- installAvatar
- profiles.js
- wireProjectCall
- keysymdef.js

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `createLifecycle()` - 45 edges
3. `makeRedactor()` - 43 edges
4. `createInvestigationManager()` - 37 edges
5. `checkFacts()` - 34 edges
6. `createCallManager()` - 33 edges
7. `Display` - 32 edges
8. `Websock` - 32 edges
9. `run()` - 29 edges
10. `loadScope()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `Findings this design rests on (checked 2026-11-19)` --references--> `code()`  [INFERRED]
  spec/2026-11-19-18-claude-terminals.md → core/bin/e2e-inventory.js
- `3. Tests` --references--> `createHearing()`  [INFERRED]
  spec/2026-11-26-62-bot-name-factory.md → core/src/call/hearing.js
- `Constraints` --references--> `heard()`  [INFERRED]
  intent/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `Proposed outcome` --references--> `heard()`  [INFERRED]
  intent/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `Verification` --references--> `heard()`  [INFERRED]
  spec/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js

## Import Cycles
- None detected.

## Communities (262 total, 41 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Design, Hearing: wake phrase and end of a question, Packaging, Risks, Spec: Phase 1b, a voice standup in Google Meet, Speech (TTS), Understanding and answering (+3 more)

### Community 2 - "rfb.js"
Cohesion: 0.06
Nodes (18): CopyRectDecoder, JPEGDecoder, RawDecoder, RREDecoder, ZlibDecoder, Deflator, encodings, _buildExtendedClipboardFlags() (+10 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.08
Nodes (19): assert, { createCallManager }, { createInvestigationManager }, { EventEmitter }, fakeClock(), finishSpeech(), flush(), fs (+11 more)

### Community 4 - "app.js"
Cohesion: 0.11
Nodes (35): ago(), clear(), clock(), day(), el(), fill(), githubMode, handleCall() (+27 more)

### Community 5 - "Steps"
Cohesion: 0.21
Nodes (24): Deviations (Codex review of the approved plan, 2026-11-17), Steps, createCallManager(), addressed(), answer(), armQuiet(), audio(), captionSeen() (+16 more)

### Community 6 - "claude-cli.js"
Cohesion: 0.13
Nodes (14): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, LOOKUP_ERRORS, LOOKUP_SYSTEM_PROMPT (+6 more)

### Community 7 - "createLifecycle"
Cohesion: 0.11
Nodes (34): createLifecycle(), accept(), allowAccept(), attachAgent(), boot(), callAttach(), cancel(), cancelNow() (+26 more)

### Community 8 - "control.js"
Cohesion: 0.27
Nodes (10): capText(), createControl(), applyHosts(), closePage(), page(), start(), fs, originOf() (+2 more)

### Community 9 - "kubevirt.test.js"
Cohesion: 0.09
Nodes (15): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+7 more)

### Community 10 - "How the bot hears"
Cohesion: 0.12
Nodes (14): Captions vs own transcription, How the bot hears, Language, `listen` values and the per-platform `auto` rule, Privacy, Rollback, When own transcription is not configured, Deployment (+6 more)

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "guard.test.js"
Cohesion: 0.13
Nodes (14): assert, { buildPolicy }, cniResult(), entry, { execFileSync }, fake(), fs, https (+6 more)

### Community 13 - "RFB"
Cohesion: 0.06
Nodes (4): clientEncodings(), keyEvent(), RFB, setDesktopSize()

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 15 - "refresh.js"
Cohesion: 0.17
Nodes (13): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+5 more)

### Community 16 - "e2e-inventory.js"
Cohesion: 0.05
Nodes (64): build(), canon(), compare(), compareAfter(), { createCfactorySource }, { createHash }, facts(), fail() (+56 more)

### Community 17 - "github.test.js"
Cohesion: 0.09
Nodes (25): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFile } (+17 more)

### Community 18 - "runner runner.js"
Cohesion: 0.06
Nodes (37): clearInterval(), createK8s(), fs, assert, { createK8s }, fs, http, { inClusterConfig } (+29 more)

### Community 19 - "run.js"
Cohesion: 0.08
Nodes (6): HextileDecoder, toSigned32bit(), toUnsigned32bit(), DataChannel, rawChannelProps, ReadyStates

### Community 20 - "test server.test.js"
Cohesion: 0.07
Nodes (24): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, GH_KEYS, ghItems, { handleCall } (+16 more)

### Community 21 - "brain.test.js"
Cohesion: 0.11
Nodes (20): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+12 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.12
Nodes (9): { source }, stateFactory(), createState(), meshAt(), approvedM01, assert, { createState, meshAt, source }, test (+1 more)

### Community 25 - "standup.test.js"
Cohesion: 0.15
Nodes (17): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+9 more)

### Community 26 - "Steps"
Cohesion: 0.22
Nodes (8): setCameraRenderer(), ctx(), Steps, Decisions (approved intent and spec, with the owner's amendments of 2026-11-26), Plan: in-call agents, slice 1: live read-only lookups, Rollback, Shared contracts (steps 2 to 6 all follow these), Tests

### Community 27 - "rfactory-standup.js"
Cohesion: 0.09
Nodes (31): { checkFacts }, count(), fs, main(), path, { setup }, ageOf(), approveClaude() (+23 more)

### Community 28 - "state"
Cohesion: 0.12
Nodes (22): releaseAttempt(), code(), codes(), render(), Decisions (approved intent and spec), Deviations, Plan: see why Meet refuses the call bot, and recover from it, Rollback (+14 more)

### Community 29 - "web server.js"
Cohesion: 0.10
Nodes (31): 3. RFactory: one CFactory client, views per repository set (`core/src/sources/cfactory.js`), { buildStandup, speakStandupHeadline }, composeLookups(), composeStandalone(), createApp(), decide(), githubStandup(), resolveSlug() (+23 more)

### Community 30 - "lookups.test.js"
Cohesion: 0.07
Nodes (29): cap(), collect(), walk(), createLookups(), FACTORY, GITHUB, { mapCard }, specs (+21 more)

### Community 31 - "share.test.js"
Cohesion: 0.08
Nodes (30): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+22 more)

### Community 32 - "claude-cli.test.js"
Cohesion: 0.13
Nodes (25): createClaudeBrain(), answerTurn(), checkDestination(), lookupTurn(), propose(), run(), stop(), summarize() (+17 more)

### Community 33 - "ref_node_path"
Cohesion: 0.18
Nodes (6): assert, { buildRendererSource }, { chromium }, fs, path, test

### Community 34 - "tts.test.js"
Cohesion: 0.12
Nodes (15): Deviations, Gates, Plan: an approved, read-only Claude investigation from the call (RFactory side), Rollback, Tests, after(), assert, { createTts } (+7 more)

### Community 35 - "client.test.js"
Cohesion: 0.10
Nodes (16): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+8 more)

### Community 36 - "profiles.test.js"
Cohesion: 0.15
Nodes (12): admin, assert, fakeK8s(), fixture(), fs, { hkdfSync }, MASTER, os (+4 more)

### Community 37 - "repo"
Cohesion: 0.09
Nodes (28): afterJoin(), captions(), heard(), When the bot starts to hear (Meet captions), Decisions (carried from the approved intent and spec), Deviations found during implementation, Deviations from the spec (made while planning, for approval with this plan), Approval (2026-11-27) (+20 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.08
Nodes (13): installSttBridge(), assert, event(), fs, { installSttBridge }, path, RTCRtpReceiver, RTCRtpSender (+5 more)

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

### Community 43 - "Keyboard"
Cohesion: 0.16
Nodes (12): 1. `core/src/sources/cfactory.js`: one tenant-wide read (coder), 4. Full tests, review, commit (lead), 5. One live read-only run, and the list on issue #60 (lead), Decisions (2026-11-27), Decisions (approved intent and spec), Open questions, Plan: `e2e-*` cleanup, first slice: the read-only inventory script, Rollback (+4 more)

### Community 44 - "speak"
Cohesion: 0.14
Nodes (13): base(), 1. The service: `rfactory-stt`, 2. In the bot (`bot/run.js`, both deployments): cut speech, send segments, 3. In the call manager (`web/call.js`): transcribe and hear, 4. The listen setting, 5. Packaging and deploy, Alternatives rejected, Design (+5 more)

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
Cohesion: 0.06
Nodes (21): createLookupEndpoint(), http, { ListToolsRequestSchema, CallToolRequestSchema }, { randomBytes, timingSafeEqual }, { Server }, { StreamableHTTPServerTransport }, { ListToolsRequestSchema, CallToolRequestSchema }, { Server } (+13 more)

### Community 50 - "Plan: project-aware calls, slice A (project-aware reads)"
Cohesion: 0.21
Nodes (13): idle(), source(), Decisions (approved intent and spec, as delivered in slice A), Delivery in two slices (a plan decision; the approved spec is unchanged), Deviations, Plan: project-aware calls, slice A (project-aware reads), Rollback (in reverse order), Steps (+5 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.11
Nodes (13): Steps, Pieces, botName(), path, run(), assert, { EventEmitter }, fs (+5 more)

### Community 52 - "app.test.js"
Cohesion: 0.11
Nodes (13): renderFooter(), ALPHA, assert, base, BETA, Node, projectPage(), page (+5 more)

### Community 53 - "vm-call.test.js"
Cohesion: 0.17
Nodes (10): assert, { createVmSpawn }, { Duplex }, { test }, createVmSpawn(), { EventEmitter }, firstLine(), { PassThrough } (+2 more)

### Community 54 - "createInvestigationManager"
Cohesion: 0.22
Nodes (28): createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog(), endCall(), expire(), findRun() (+20 more)

### Community 55 - "index.js"
Cohesion: 0.10
Nodes (25): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+17 more)

### Community 56 - "createProxy"
Cohesion: 0.23
Nodes (18): checkedAddresses(), createApi(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect() (+10 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.24
Nodes (16): board(), boolean(), columns, count(), exact(), identity, log(), login() (+8 more)

### Community 58 - "createActionManager"
Cohesion: 0.12
Nodes (13): @rfactory/core, { deriveEffects, describe }, FINAL, { randomUUID }, { validate, hashPayload, canonical }, approve(), assert, binding (+5 more)

### Community 59 - "kubevirt.test.js"
Cohesion: 0.14
Nodes (11): assert, { createAgent }, { createCallWorker }, { createControl }, { dial }, { encode, createDecoder }, net, { parseCmdline } (+3 more)

### Community 60 - "proxy.js"
Cohesion: 0.16
Nodes (15): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, inRange() (+7 more)

### Community 61 - "lifecycle.js"
Cohesion: 0.17
Nodes (9): nonce(), { buildPolicy }, { createDecoder, tag, encode, LANGUAGE }, crypto, net, { nonce: newNonce }, { StringDecoder }, Deviations (+1 more)

### Community 62 - "share-desktop.test.js"
Cohesion: 0.24
Nodes (7): createShareDesktop(), schedule(), stopPolling(), assert, { createShareDesktop }, setup(), test

### Community 64 - "Design"
Cohesion: 0.17
Nodes (11): Alternatives rejected, Answers to the intent's open questions, Design, Feasibility gate (first plan step), Lifecycle and disposal, Live view, Network, Persistent profiles (+3 more)

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
Cohesion: 0.07
Nodes (24): assert, crypto, dir, fs, ids, manifest, path, test (+16 more)

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
Cohesion: 0.09
Nodes (20): source, commit, path, repo, DESTINATIONS, fs, LISTEN, { makeRedactor } (+12 more)

### Community 73 - "bot bot/package.json"
Cohesion: 0.14
Nodes (13): dependencies, playwright-core, @vibeconferencing/calls, engines, node, playwright-core, @vibeconferencing/calls, license (+5 more)

### Community 74 - "guard.js"
Cohesion: 0.22
Nodes (12): binding(), cidrFamily(), command(), apply(), { execFile }, execFileAsync, fs, https (+4 more)

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
Cohesion: 0.17
Nodes (11): Alternatives rejected, Data, Decisions on the intent's open questions (recommended), Design, Risks, Sign-in, Spec: Phase 1a, a text standup in the web UI, Verification (+3 more)

### Community 80 - "ref_node_fs"
Cohesion: 0.13
Nodes (13): buildRendererSource(), { buildRendererSource }, { CALL_EVENTS }, crypto, fs, { installSttBridge }, { makeRedactor }, os (+5 more)

### Community 81 - "Design"
Cohesion: 0.06
Nodes (32): gateway(), Affected users and systems, Constraints, Decisions (2026-11-27), Intent: Enforce an egress limit for the RFactory pod, Open questions, Problem, Proposed outcome (+24 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "profile.test.js"
Cohesion: 0.18
Nodes (9): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+1 more)

### Community 84 - "test run.test.js"
Cohesion: 0.11
Nodes (12): assert, audioJoined(), { EventEmitter }, fs, joined(), { PassThrough }, path, { run } (+4 more)

### Community 85 - "Steps"
Cohesion: 0.27
Nodes (20): Steps, createShareManager(), approve(), cleanup(), close(), emit(), endCall(), expire() (+12 more)

### Community 86 - "web/call.js"
Cohesion: 0.10
Nodes (22): SELF_NAMES, BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts, checkFactsDetailed }, emitLimits(), lookupAnswer(), { createHearing, SELF_NAMES }, { createShareDesktop } (+14 more)

### Community 87 - "core/package.json"
Cohesion: 0.17
Nodes (11): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+3 more)

### Community 88 - "createCallManager"
Cohesion: 0.13
Nodes (17): checkFacts(), assert, checked(), { checkFacts, checkFactsDetailed }, snapshot, test, 1. A turn context, not a model-chosen scope, 2. The lookup tools (`core/src/lookups.js`, new) (+9 more)

### Community 89 - "bot run()"
Cohesion: 0.20
Nodes (21): pageLeft(), run(), abandon(), discardOpen(), failureReport(), guestHelper(), idleAvatar(), leftConfirmed() (+13 more)

### Community 90 - "Design"
Cohesion: 0.09
Nodes (20): speechLevel(), Decisions carried over (approved intent and spec), Deviations after merge, Plan: A face for the bot that talks when it speaks, Rollback, Tests, AI disclosure, Alternatives rejected (+12 more)

### Community 91 - "gateway.test.js"
Cohesion: 0.14
Nodes (9): assert, base, { createGateway }, fs, { loadScope }, { makeRedactor }, os, path (+1 more)

### Community 92 - "test/board.test.js"
Cohesion: 0.13
Nodes (16): COLUMNS, projectBoard(), { repositoryOf }, STAGES, assert, callTool(), card(), { createCfactorySource } (+8 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "running"
Cohesion: 0.11
Nodes (20): Claude Code CLI brain (`core/src/brains/claude-cli.js`), approve(), assert, binding, { createInvestigationManager }, { createRecord }, fs, { loadRoles } (+12 more)

### Community 95 - "ref_node_fs"
Cohesion: 0.07
Nodes (22): Environment and scope reference, Per-call worker environment variables (set internally), Scope fields (`RFACTORY_SCOPE_FILE`), Web server environment variables, fs, path, createStt(), fs (+14 more)

### Community 96 - "Spec: an approved, read-only Claude investigation from the call"
Cohesion: 0.18
Nodes (10): 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), 3. RFactory: hearing, approval, the shared log, the spoken result, Alternatives rejected, Design, Findings this design rests on (checked 2026-11-19), Order and dependencies, Risks (+2 more)

### Community 97 - "shares.test.js"
Cohesion: 0.16
Nodes (12): approve(), assert, binding, callOf(), { createShareManager }, { loadRoles }, { makeRedactor }, projectView() (+4 more)

### Community 98 - "avatars.test.js"
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

### Community 105 - "source-guard.test.js"
Cohesion: 0.15
Nodes (12): 2. The two gates, 3. The removal procedure (the owner runs it), Alternatives rejected, Approval (2026-11-27), Decisions carried from the approved intent, Design, First slice and what is deferred, Open questions (+4 more)

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
Cohesion: 0.18
Nodes (11): Design, Effects are derived, not trusted, Execution: re-check, claim, record, dispatch once, Keys and switches, Pending actions and approval, Reading CFactory's results, Recognising an action request, The action allowlist (the only things that can ever run) (+3 more)

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "Decisions carried over from the approved spec and intent"
Cohesion: 0.17
Nodes (10): toSpeech(), assert, test, { toSpeech }, Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 1b, a voice standup in Google Meet, Rollback (+2 more)

### Community 112 - "scope.js"
Cohesion: 0.17
Nodes (17): action(), Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Steps, Tests, Waves (+9 more)

### Community 113 - "des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 115 - "createGuard"
Cohesion: 0.35
Nodes (12): createApi(), get(), createGuard(), counters(), heartbeat(), reconcile(), reconcileOnce(), server() (+4 more)

### Community 116 - "repo"
Cohesion: 0.13
Nodes (13): assert, fs, os, path, realPod, { spawnSync }, test, createTts() (+5 more)

### Community 117 - "boundary.test.js"
Cohesion: 0.10
Nodes (14): card(), assert, callTool(), { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs (+6 more)

### Community 118 - "deflator.js"
Cohesion: 0.38
Nodes (13): createActionManager(), approve(), emit(), endCall(), expire(), finish(), list(), live() (+5 more)

### Community 119 - "Intent: call the bot "Factory""
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-26: "approved", with the recommendations), Intent: call the bot "Factory", Open questions, Problem, Proposed outcome

### Community 120 - "RSAAESAuthenticationState"
Cohesion: 0.12
Nodes (4): RA2Cipher, RSAAESAuthenticationState, EventTargetMixin, encodeUTF8()

### Community 121 - "Intent: see why Meet refuses the call bot, and recover from it"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: see why Meet refuses the call bot, and recover from it, Open questions, Problem, Proposed outcome

### Community 122 - "ref_node_crypto"
Cohesion: 0.17
Nodes (10): count(), COUNT_CLAIM, { hashPayload, revalidate, investigationApprovalText, INVESTIGATION_LIMITS }, QUANTITY, { randomUUID }, readTests(), TERMINAL, TEST_WORD (+2 more)

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
Cohesion: 0.22
Nodes (8): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Spec: Standalone mode, with a choice of source and brain

### Community 130 - "k8s-policy.js"
Cohesion: 0.27
Nodes (10): BASE_PROTECTED, block(), buildPolicy(), contains(), ipNumber(), net, portRules(), ranges (+2 more)

### Community 131 - ".expired"
Cohesion: 0.67
Nodes (3): crc32(), makeTable(), read_buf()

### Community 133 - "ref_node_crypto"
Cohesion: 0.18
Nodes (17): boundedFetch(), { Client }, createCfactorySource(), call(), connect(), view(), comments(), freshness() (+9 more)

### Community 134 - "Keyboard"
Cohesion: 0.25
Nodes (8): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass**

### Community 135 - "browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

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
Cohesion: 0.19
Nodes (4): DOMKeyTable, getKey(), getKeycode(), getKeysym()

### Community 155 - "stt-languages.test.js"
Cohesion: 0.21
Nodes (7): createProfile(), readHead(), assert, { createProfile }, KEY, setup(), { test }

### Community 156 - ".sendKey"
Cohesion: 0.27
Nodes (9): calls(), FAKE_ARGS, FAKE_CALLS, FAKE_OUT, FAKE_PROGRAM, fixture(), PATH, run() (+1 more)

### Community 157 - "mapCard"
Cohesion: 0.10
Nodes (19): mapCard(), Approved decisions (copied from the spec, so this plan stands alone), Plan: Review and standup from the board (#28, slice 1), Roles, Rollback, Tests, 10. Intent constraints carried into slice 1, 1. Data comes from four CFactory read tools, all on the existing read key (+11 more)

### Community 158 - "web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 159 - "md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 161 - "Plan: run RFactory in the factory cluster"
Cohesion: 0.18
Nodes (10): Branches and worktrees, Corrections to the approved spec, Deviations, Lead steps, in order, Plan: run RFactory in the factory cluster, Rollback, Steps, Tests (+2 more)

### Community 162 - "Design"
Cohesion: 0.18
Nodes (10): Source adapters, assert, fs, git(), guard, os, path, repo() (+2 more)

### Community 163 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.20
Nodes (9): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 9. Rollback (+1 more)

### Community 164 - "desktop-routes.test.js"
Cohesion: 0.18
Nodes (18): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+10 more)

### Community 165 - "eyes"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 166 - "createControl"
Cohesion: 0.19
Nodes (10): buildStandup(), { FAILED, mapCard }, speakStandupHeadline(), assert, build(), { buildStandup, speakStandupHeadline }, freshness(), { makeRedactor } (+2 more)

### Community 167 - "Plan: Show the CFactory board in the call"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text), Open questions, Problem, Proposed outcome

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 170 - "Design"
Cohesion: 0.11
Nodes (17): Decisions (the approved intent and spec), Deviations, Plan: finish the "Factory" rename and stop false wakes at a caption block start, Rollback, Steps, Tests, 1. The wake rule (`core/src/call/hearing.js:3`), 2. A rejected mention still ends the request before it (`hearing.js:50-71`) (+9 more)

### Community 171 - ".sendKey"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: clean up the `e2e-*` test repositories (GitHub and CFactory), Open questions, Problem, Proposed outcome

### Community 172 - "Plan: Phase 0, the Linux call test"
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Control-channel additions (an additive change to #3), Design, Order and dependencies, Proposing, approving, stopping, Risks, Spec: Show the CFactory board in the call, The constraint that shapes it (+2 more)

### Community 175 - "cfactory-write.js"
Cohesion: 0.15
Nodes (14): deriveEffects(), describe(), SERVICE, STAGE, stageFor(), stateOf(), WRITES, { Client } (+6 more)

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

### Community 180 - "Deviations from the spec (approved with this plan)"
Cohesion: 0.20
Nodes (8): required(), raw(), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains), Recorded GitHub inventory (pinned 1.14.0, captured 2026-11-17), Rollback, Tests

### Community 181 - "Intent: redact credentials that wrap across log lines"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: redact credentials that wrap across log lines, Open questions, Problem, Proposed outcome

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
Cohesion: 0.10
Nodes (31): ACTIONS, bounded(), canonical(), CREATE_STATUSES, { createHash }, criteria(), FIELDS, hashPayload() (+23 more)

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

### Community 195 - "Plan: enforce an egress limit for the RFactory pod"
Cohesion: 0.29
Nodes (6): Approval (2026-11-27), Decisions (the approved intent and spec), Deviations, Plan: enforce an egress limit for the RFactory pod, Rollback, Tests

### Community 196 - "events.js"
Cohesion: 0.48
Nodes (5): _capturedElemChanged(), _captureObserver, _captureProxy(), releaseCapture(), setCapture()

### Community 197 - "Plan: Show the CFactory board in the call"
Cohesion: 0.33
Nodes (5): Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Tests

### Community 199 - "theme.js"
Cohesion: 0.67
Nodes (3): applyTheme(), dark, observer

### Community 203 - "Intent: finish the "Factory" rename and stop false wakes at a caption block start"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: finish the "Factory" rename and stop false wakes at a caption block start, Open questions, Problem, Proposed outcome

### Community 206 - "Steps"
Cohesion: 0.36
Nodes (10): Steps, handleAction(), loadActions(), loadPanels(), loadReview(), openPage(), renderActions(), run() (+2 more)

### Community 207 - "bootstrap-secrets.sh"
Cohesion: 0.83
Nodes (3): env_of(), bootstrap-secrets.sh script, write_secret()

### Community 208 - "createHearing"
Cohesion: 0.18
Nodes (12): createHearing(), assert, { createHearing }, fakeClock(), setup(), test, Decisions (the approved intent and spec, including the spec's amendment), Deviations (+4 more)

### Community 210 - "Design"
Cohesion: 0.20
Nodes (9): 1. CFactory: projects on the server (CFactory PR A, then PR B), 2. RFactory: the allowlist and its secrets (`core/src/scope.js`), 5. RFactory: each proposal keeps its target (`web/actions.js`, `web/shares.js`, `web/investigations.js`), 6. Rollout order, Alternatives rejected, Design, Risks, Spec: project-aware calls (+1 more)

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

### Community 228 - "Intent: the bot hears in audio mode, and joins Meet on the first try"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: the bot hears in audio mode, and joins Meet on the first try, Open questions, Problem, Proposed outcome

### Community 237 - "k8s-policy.test.js"
Cohesion: 0.28
Nodes (8): addressBits(), assert, assertPolicySchema(), { buildPolicy }, cidrContains(), input, ranges, test

### Community 238 - "join"
Cohesion: 0.15
Nodes (15): join(), Candidate causes, and what the code says, How a caption becomes a question today, Problem, Decisions, Deviations, Plan: the bot hears in audio mode, and joins Meet on the first try (#67, #68), Rollback (+7 more)

### Community 240 - "github-web.test.js"
Cohesion: 0.13
Nodes (13): assert, { connect }, { createGithubSource }, dir, fs, gone(), os, path (+5 more)

### Community 241 - "._handleMouse"
Cohesion: 0.25
Nodes (3): extendedPointerEvent(), pointerEvent(), clientToElement()

### Community 242 - "Spec: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Design, Risks, Spec: the call Chrome runs with its sandbox on, so Meet admits the bot, Verification

### Community 243 - "Plan: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.50
Nodes (3): Plan: the bot hears the call itself (its own speech-to-text), Rollback, Tests

### Community 244 - "loadScope"
Cohesion: 0.18
Nodes (12): loadScope(), listTools(), Steps, Decisions (2026-11-27), Decisions carried over from the approved spec, Decisions for this plan, Open questions, Out of scope (+4 more)

### Community 245 - "Plan: project-aware calls, slice B (writes for every project)"
Cohesion: 0.22
Nodes (8): Approval (2026-11-27), Decisions (approved intent and spec, as they apply to slice B), Deviations, Open questions, Plan: project-aware calls, slice B (writes for every project), Rollback, State on 2026-11-27 (checked read-only), Tests

### Community 246 - "request"
Cohesion: 0.25
Nodes (9): list(), publicEntry(), request(), row(), sentences(), show(), write(), namedRepository() (+1 more)

### Community 247 - "gateway.js"
Cohesion: 0.08
Nodes (26): checkFactsDetailed(), CLAIM, COUNT, { summarise }, WORDS, DESKTOP, { mapGithub, summarise, STATES }, NAMES (+18 more)

### Community 248 - "desktop-routes.test.js"
Cohesion: 0.17
Nodes (10): assert, { createApp }, { createDesktop }, grant, { loadRoles }, { makeRedactor }, open, roles (+2 more)

### Community 249 - "scoped"
Cohesion: 0.36
Nodes (9): decide(), decided(), decideInvestigation(), decideShare(), handleShare(), loadShares(), renderShare(), scoped() (+1 more)

### Community 250 - "Deviations from the spec revision (Codex re-check and plan review, for approval with this plan)"
Cohesion: 0.25
Nodes (8): 8. Problems we hit, findVeth(), control(), Decisions carried over from the approved spec revision, Deviations from the spec revision (Codex re-check and plan review, for approval with this plan), Plan: desktops as KubeVirt VMs in the k3d cluster (#3, revision), Rollback, Tests

### Community 251 - "stt-languages.test.js"
Cohesion: 0.38
Nodes (5): toWhisperLanguage(), WHISPER_LANGUAGES, assert, test, { WHISPER_LANGUAGES, toWhisperLanguage }

### Community 252 - "net.js"
Cohesion: 0.57
Nodes (6): cidr(), contains(), ipValue(), net, preview(), validatePreview()

### Community 254 - "probe.js"
Cohesion: 0.29
Nodes (4): { buildPolicy }, manifests(), net, ranges

### Community 255 - "proposed"
Cohesion: 0.40
Nodes (5): Landing record (2026-11-24), Live check results (step 12), Switches and record, proposed(), ready()

### Community 256 - "Deviations from the spec (for approval with this plan)"
Cohesion: 0.17
Nodes (15): label(), stopShare(), hosts(), Decisions carried over from the approved spec, Deviations from the spec (for approval with this plan), Facts checked in the real repos, Open questions for the owner, Plan: Agent workspace, a disposable desktop per call (#3) (+7 more)

### Community 257 - "Spec: Phase 3, act on the Factories from the call"
Cohesion: 0.40
Nodes (4): Alternatives rejected, Risks, Spec: Phase 3, act on the Factories from the call, Verification

### Community 258 - "installAvatar"
Cohesion: 0.83
Nodes (4): installAvatar(), draw(), portrait(), triangle()

### Community 259 - "profiles.js"
Cohesion: 0.50
Nodes (3): fs, LABEL, { randomUUID, hkdfSync }

### Community 260 - "wireProjectCall"
Cohesion: 0.83
Nodes (4): wireProjectCall(), open(), refresh(), send()

## Knowledge Gaps
- **40 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1858 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Display` connect `Display` to `rfb.js`, `run.js`, `Steps`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `createLifecycle()` (e.g. with `lifecycle.js` and `action()`) actually correct?**
  _`createLifecycle()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `Steps` to `app.js`, `ref_node_crypto`, `guard.js`, `proxy.js`, `cfactory-write.js`, `test/board.test.js`, `e2e-inventory.js`, `Plan: project-aware calls, slice A (project-aware reads)`, `lifecycle.js`, `Plan: project-aware calls, slice B (writes for every project)`, `web/call.js`, `gateway.js`, `createCallManager`, `createInvestigationManager`, `Steps`, `core/test/actions.test.js`, `web server.js`, `lookups.test.js`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `rfb.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06290471785383904 - nodes in this community are weakly interconnected._
- **Why does `Websock` connect `._updateConnectionState` to `rfb.js`, `run.js`, `Plan: A face for the bot that talks when it speaks`, `._updateConnectionState`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._