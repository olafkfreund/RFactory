# Graph Report - RFactory-t80  (2026-11-28)

## Corpus Check
- 384 files · ~646,939 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 10, .nix 6, .css 4)

## Summary
- 4509 nodes · 8243 edges · 295 communities (256 shown, 39 thin omitted)
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 1372 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5a94c865`
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
- ok
- Plan: run RFactory in the factory cluster
- test desktop-ui.test.js
- guard.js
- RFB
- runner runner.test.js
- agent-tools.js
- e2e-inventory.test.js
- makeRedactor
- runner runner.js
- effects.js
- test server.test.js
- brain.test.js
- test avatar-state.test.js
- Profiles
- github-web.test.js
- cli.test.js
- core/test/notes.test.js
- rfactory-standup.js
- error
- server.js
- lookups.js
- share.test.js
- claude-cli.test.js
- ref_node_assert
- tts.test.js
- shell-browser.test.js
- validLink
- captions
- stt-bridge.test.js
- deflate.js
- cfactory-write.test.js
- kyverno-scope.test.js
- verify verify.test.js
- rfactory.test.js
- Plan: project-aware calls, slice A (project-aware reads)
- Websock
- inflate.js
- verify net.sh
- verify profiles.sh
- lookup-endpoint.test.js
- e2e-inventory.js
- spike hello-call.test.js
- app.js
- agents.test.js
- createInvestigationManager
- index.js
- handleConnect
- runner protocol.js
- running
- ref_node_path
- Spec: Phase 1b, a voice standup in Google Meet
- Design
- share-desktop.test.js
- web/package.json
- agent-endpoint.js
- reaper reaper.test.js
- agent-endpoint.test.js
- Plan: standup notes, slice 1: dictated notes, review on the page, a Markdown download
- avatars.test.js
- test cfactory.test.js
- agent/call.test.js
- logging.js
- profiles.test.js
- bot bot/package.json
- review.js
- trees.js
- runner k8s-lifecycle.test.js
- investigations.test.js
- checkFacts
- Display
- Steps
- Design
- spike spike/package.json
- shares.test.js
- test run.test.js
- createShareManager
- web/call.js
- core/package.json
- rfactory.js
- bot run()
- Design
- gateway.test.js
- rfactory-client.js
- desktop desktop/package.json
- Standalone mode S1: end-to-end results (#2 step 10)
- ref_node_fs
- Spec: an approved, read-only Claude investigation from the call
- Design
- el
- Plan: a read-only standup from one Jira project, on the page (first slice of #59)
- Websock
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
- createRecord
- des.js
- Design
- join
- github.test.js
- boundary.test.js
- Intent: a command-line tool for RFactory, slice A: sign in, read, join and leave
- Intent: call the bot "Factory"
- RSAAESAuthenticationState
- deflator.js
- k14 results: agent workspace desktops on k3d with KubeVirt
- verify e2e.sh
- H264Decoder
- k3d k11.sh
- k3d mk-tls.sh
- test/board.test.js
- verify liveview.sh
- jira.test.js
- k8s-policy.js
- Spec: one live test call with 5-10 team members talking to Factory
- GestureHandler
- Plan: finish the "Factory" rename and stop false wakes at a caption block start
- loadPanels
- browser.js
- renderer.js
- checkFactsDetailed
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
- ollama-standup.js
- avatar-renderer.test.js
- md5.js
- TightDecoder
- readiness.sh
- loadScope
- readme.test.js
- desktop-routes.test.js
- eyes
- scoped
- a
- Plan: an approved, read-only Claude investigation from the call (RFactory side)
- teams-tap-spike.js
- Design
- Intent: clean up the `e2e-*` test repositories (GitHub and CFactory)
- Plan: Phase 0, the Linux call test
- Intent: run a Claude terminal from the call, and show it
- wireProjectCall
- @modelcontextprotocol/sdk
- Intent: run RFactory in the factory cluster like the other Factory services
- desktop.test.js
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
- guard.test.js
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
- createHearing
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
- kubevirt.test.js
- rfactory-auth.js
- check-egress.sh
- .expired
- Intent: one live test call with 5-10 team members talking to Factory
- Spec: the call Chrome runs with its sandbox on, so Meet admits the bot
- proxy.test.js
- refresh.js
- Design
- failure
- createGuard
- Design
- proxy.js
- Intent: a user guide and a feature list for RFactory
- scope.js
- Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence
- compare
- Intent: in-call agents, the model with live tools, provider chosen per call
- Keyboard
- standup.test.js
- Plan: `e2e-*` cleanup, first slice: the read-only inventory script
- cfactory.js
- createCfactorySource
- C5. Tools and wrapper (`web/agent-tools.js`)
- gateway.js
- Design
- Intent: Phase 2, slice A: the bot joins a Zoom meeting as a guest
- Design
- RFactory
- client.test.js
- installSttBridge
- renderNotes
- Steps
- k8s-policy.test.js
- observer.js
- stt.test.js
- createProxy
- Spec: Elevated calls, slice 1 — portal-verified pairing, schedule, and grant
- Desktop VMs on the k3d factory cluster
- createGithubRead
- ref_node_crypto
- Socket
- Multi-participant live test
- Intent: the bot hears the call itself (its own speech-to-text)
- net.js
- Intent: the first question after the bot joins is heard in Meet captions mode
- callevents.js
- Steps
- Design
- events.js
- Intent: redact credentials that wrap across log lines
- Intent: elevated calls, slice 1: pair a call in the portal and hold a grant for it
- Steps
- cap
- Plan: Elevated calls, slice 1 — portal-verified pairing, schedule, and grant
- loadShares

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `makeRedactor()` - 51 edges
3. `createLifecycle()` - 45 edges
4. `createCallManager()` - 40 edges
5. `Steps` - 39 edges
6. `createInvestigationManager()` - 38 edges
7. `createApp()` - 38 edges
8. `Steps` - 37 edges
9. `checkFacts()` - 36 edges
10. `loadScope()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `Alternatives rejected` --references--> `afterJoin()`  [INFERRED]
  spec/2026-11-27-56-first-question-captions.md → bot/run.js
- `Steps` --references--> `event()`  [INFERRED]
  plan/2026-11-21-16-own-speech-to-text.md → bot/test/stt-bridge.test.js
- `Findings this design rests on (checked 2026-11-19)` --references--> `code()`  [INFERRED]
  spec/2026-11-19-18-claude-terminals.md → core/bin/e2e-inventory.js
- `Decisions carried over (approved intent and spec)` --references--> `hashPayload()`  [INFERRED]
  plan/2026-11-19-18-claude-terminals.md → core/src/actions/allowlist.js
- `3. Tests` --references--> `createHearing()`  [INFERRED]
  spec/2026-11-26-62-bot-name-factory.md → core/src/call/hearing.js

## Import Cycles
- None detected.

## Communities (295 total, 39 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "app.test.js"
Cohesion: 0.09
Nodes (15): renderFooter(), ALPHA, assert, base, BETA, card(), Node, notesShim() (+7 more)

### Community 2 - "rfb.js"
Cohesion: 0.05
Nodes (20): CopyRectDecoder, JPEGDecoder, RawDecoder, RREDecoder, ZlibDecoder, Deflator, encodings, _buildExtendedClipboardFlags() (+12 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.07
Nodes (23): hashLink(), assert, { createCallManager }, { createGrantManager }, { createInvestigationManager }, { EventEmitter }, fakeClock(), finishSpeech() (+15 more)

### Community 4 - "web/test/notes.test.js"
Cohesion: 0.10
Nodes (32): { checkNote, sentence, headline, toMarkdown, notesHash }, createNotesManager(), approve(), discard(), download(), edit(), emit(), endCall() (+24 more)

### Community 5 - "createCallManager"
Cohesion: 0.16
Nodes (33): Steps, Steps, createCallManager(), addressed(), answer(), armQuiet(), audio(), captionSeen() (+25 more)

### Community 6 - "claude-cli.js"
Cohesion: 0.12
Nodes (16): ACTION_SYSTEM_PROMPT, ARGV, CAPTIONS_ACTION_GUIDANCE, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, LOOKUP_ERRORS (+8 more)

### Community 7 - "createLifecycle"
Cohesion: 0.11
Nodes (36): nonce(), createLifecycle(), accept(), allowAccept(), attachAgent(), boot(), callAttach(), cancel() (+28 more)

### Community 8 - "createGrantManager"
Cohesion: 0.16
Nodes (25): allows(), binding(), createGrantManager(), check(), clearCode(), clearGrant(), emit(), endCall() (+17 more)

### Community 9 - "ok"
Cohesion: 0.13
Nodes (17): ok(), hello(), Waking the bot, Affected users and systems, Constraints, Decisions (2026-11-28), Intent: Captions mode robustness for repository names, card keys, wake words, and Meet dialogs, Open questions (+9 more)

### Community 10 - "Plan: run RFactory in the factory cluster"
Cohesion: 0.18
Nodes (11): Branches and worktrees, Corrections to the approved spec, Deviations, Landing record (2026-11-24), Lead steps, in order, Plan: run RFactory in the factory cluster, Rollback, Steps (+3 more)

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "guard.js"
Cohesion: 0.19
Nodes (14): binding(), cidrFamily(), command(), apply(), { execFile }, execFileAsync, findVeth(), fs (+6 more)

### Community 13 - "RFB"
Cohesion: 0.06
Nodes (8): clientEncodings(), extendedPointerEvent(), keyEvent(), pointerEvent(), RFB, setDesktopSize(), xvpOp(), clientToElement()

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 15 - "agent-tools.js"
Cohesion: 0.07
Nodes (28): action, atom(), { CARD_KEY }, createAgentTools(), invoke(), descriptions, freshness, investigation (+20 more)

### Community 16 - "e2e-inventory.test.js"
Cohesion: 0.11
Nodes (23): assert, { build, hashOf, compare, compareAfter, main }, clone(), endpointsOf(), { EventEmitter }, fixture(), fs, ghFake() (+15 more)

### Community 17 - "makeRedactor"
Cohesion: 0.10
Nodes (32): base64(), JOINED_RULES, jwtSpans(), KEY_VALUE_AT, keyValueAt(), keyValueMatch(), keyValueSpans(), makeRedactor() (+24 more)

### Community 18 - "runner runner.js"
Cohesion: 0.08
Nodes (28): clearInterval(), createK8s(), { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade() (+20 more)

### Community 19 - "effects.js"
Cohesion: 0.32
Nodes (7): deriveEffects(), describe(), SERVICE, STAGE, stageFor(), stateOf(), WRITES

### Community 20 - "test server.test.js"
Cohesion: 0.06
Nodes (29): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, GH_KEYS, ghItems, { handleCall } (+21 more)

### Community 21 - "brain.test.js"
Cohesion: 0.12
Nodes (18): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+10 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.18
Nodes (5): approvedM01, assert, { createState, meshAt, source }, test, vm

### Community 24 - "github-web.test.js"
Cohesion: 0.13
Nodes (13): assert, { connect }, { createGithubSource }, dir, fs, gone(), os, path (+5 more)

### Community 25 - "cli.test.js"
Cohesion: 0.08
Nodes (16): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+8 more)

### Community 26 - "core/test/notes.test.js"
Cohesion: 0.13
Nodes (20): hashPayload(), checkNote(), closeEvidence(), { FAILED }, { hashPayload }, KINDS, notesHash(), { reviewCard, ACTIVE } (+12 more)

### Community 27 - "rfactory-standup.js"
Cohesion: 0.12
Nodes (25): ageOf(), approveClaude(), causes(), { checkFacts }, { connect }, { createBrain }, { createCfactorySource }, { createClaudeBrain, ARGV: CLAUDE_ARGV } (+17 more)

### Community 28 - "error"
Cohesion: 0.09
Nodes (35): idle(), code(), action(), bash(), Deviations, Open questions, Plan: `rfactory` CLI, slice A: sign in, read, join and leave, Rollback (+27 more)

### Community 29 - "server.js"
Cohesion: 0.07
Nodes (52): Steps, Steps, @rfactory/core, 5. The web app and the page (`web/server.js`, `web/public/app.js`), append(), assert, clientSession, { createApp } (+44 more)

### Community 30 - "lookups.js"
Cohesion: 0.10
Nodes (19): createLookups(), FACTORY, GITHUB, { mapCard }, specs, { STATES }, validate(), { validPath, validNumber } (+11 more)

### Community 31 - "share.test.js"
Cohesion: 0.08
Nodes (30): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+22 more)

### Community 32 - "claude-cli.test.js"
Cohesion: 0.13
Nodes (26): createClaudeBrain(), answerTurn(), checkDestination(), lookupTurn(), note(), propose(), run(), stop() (+18 more)

### Community 33 - "ref_node_assert"
Cohesion: 0.07
Nodes (25): toSpeech(), assert, checked(), { checkFacts, checkFactsDetailed }, snapshot, test, assert, fs (+17 more)

### Community 34 - "tts.test.js"
Cohesion: 0.12
Nodes (15): assert, { createTts }, { EventEmitter }, fs, os, { PassThrough }, path, test (+7 more)

### Community 35 - "shell-browser.test.js"
Cohesion: 0.13
Nodes (12): connect(), handshake(), main(), [mode, url], out(), assert, { chromium }, { createApp } (+4 more)

### Community 36 - "validLink"
Cohesion: 0.11
Nodes (17): Approved decisions carried from the spec, Decisions (2026-11-28), Deviations, Open questions, Plan: RFactory README and feature list (slice 1), Rollback, Steps, Tests (+9 more)

### Community 37 - "captions"
Cohesion: 0.10
Nodes (21): captions(), Approval (2026-11-27), Decisions (the approved intent and spec), Deviations, Plan: the first question after the bot joins is heard in Meet captions mode, Rollback, Steps, Tests (+13 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.08
Nodes (9): assert, event(), fs, { installSttBridge }, path, RTCRtpReceiver, RTCRtpSender, test (+1 more)

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
Nodes (19): assert, beats(), CHECKS, fs, http, INPUT, { join }, LIB (+11 more)

### Community 43 - "rfactory.test.js"
Cohesion: 0.10
Nodes (22): assert, BIN, cli(), run(), signedIn(), start(), { createApp }, { execFile, spawn } (+14 more)

### Community 44 - "Plan: project-aware calls, slice A (project-aware reads)"
Cohesion: 0.17
Nodes (11): 1. The service: `rfactory-stt`, 2. In the bot (`bot/run.js`, both deployments): cut speech, send segments, 3. In the call manager (`web/call.js`): transcribe and hear, 4. The listen setting, 5. Packaging and deploy, Design, Measured on p620 (2026-11-21), Owner decisions taken with this spec (2026-11-21) (+3 more)

### Community 45 - "Websock"
Cohesion: 0.12
Nodes (3): Verification, encodeUTF8(), Websock

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
Cohesion: 0.08
Nodes (20): { buildRendererSource }, { CALL_EVENTS }, crypto, fs, { installSttBridge }, { makeRedactor }, os, path (+12 more)

### Community 52 - "app.js"
Cohesion: 0.11
Nodes (25): decide(), decided(), decideInvestigation(), decideShare(), grantRefresh, handleInvestigation(), INVESTIGATION_LIVE, investigationStateText() (+17 more)

### Community 53 - "agents.test.js"
Cohesion: 0.09
Nodes (20): composeAgents(), agents, assert, cards, { Client }, compose(), { createApp, composeAgents, composeWrites, refuseKeyEnv }, fs (+12 more)

### Community 54 - "createInvestigationManager"
Cohesion: 0.12
Nodes (44): count(), COUNT_CLAIM, createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog(), endCall() (+36 more)

### Community 55 - "index.js"
Cohesion: 0.07
Nodes (34): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+26 more)

### Community 56 - "handleConnect"
Cohesion: 0.22
Nodes (16): checkedAddresses(), addresses(), answerDns(), handleConnect(), handleForward(), serve(), drain(), inRange() (+8 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.24
Nodes (16): board(), boolean(), columns, count(), hosts(), identity, log(), login() (+8 more)

### Community 58 - "running"
Cohesion: 0.09
Nodes (22): revalidate(), base(), source(), Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Tests (+14 more)

### Community 59 - "ref_node_path"
Cohesion: 0.14
Nodes (18): { createHash, randomUUID }, createScheduleRegistry(), add(), list(), match(), remove(), save(), fs (+10 more)

### Community 60 - "Spec: Phase 1b, a voice standup in Google Meet"
Cohesion: 0.40
Nodes (4): Alternatives rejected, Risks, Spec: Phase 1b, a voice standup in Google Meet, Verification

### Community 61 - "Design"
Cohesion: 0.08
Nodes (26): label(), stopShare(), exec(), control(), Decisions carried over from the approved spec, Facts checked in the real repos, Open questions for the owner, Plan: Agent workspace, a disposable desktop per call (#3) (+18 more)

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

### Community 67 - "Plan: standup notes, slice 1: dictated notes, review on the page, a Markdown download"
Cohesion: 0.22
Nodes (8): Approval (2026-11-27), Choices made in this plan (for approval with it), Contracts between the steps, Deviations, Plan: standup notes, slice 1: dictated notes, review on the page, a Markdown download, Rollback, Tests, closeIntake()

### Community 68 - "avatars.test.js"
Cohesion: 0.20
Nodes (8): assert, crypto, dir, fs, ids, manifest, path, test

### Community 69 - "test cfactory.test.js"
Cohesion: 0.11
Nodes (10): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, invReplies(), invWith(), { makeRedactor }, reply() (+2 more)

### Community 70 - "agent/call.test.js"
Cohesion: 0.11
Nodes (18): createCallWorker(), { createShare, callLaunchArgs }, fs, { PassThrough }, assert, { createCallWorker, withProxy, MEET_GUEST, TEAMS_CAPTIONS }, { EventEmitter }, fixture() (+10 more)

### Community 71 - "logging.js"
Cohesion: 0.10
Nodes (4): HextileDecoder, DataChannel, rawChannelProps, ReadyStates

### Community 72 - "profiles.test.js"
Cohesion: 0.15
Nodes (12): admin, assert, fakeK8s(), fixture(), fs, { hkdfSync }, MASTER, os (+4 more)

### Community 73 - "bot bot/package.json"
Cohesion: 0.14
Nodes (13): dependencies, playwright-core, @vibeconferencing/calls, engines, node, playwright-core, @vibeconferencing/calls, license (+5 more)

### Community 74 - "review.js"
Cohesion: 0.16
Nodes (16): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+8 more)

### Community 75 - "trees.js"
Cohesion: 0.16
Nodes (28): bi_flush(), bi_reverse(), bi_windup(), build_bl_tree(), build_tree(), compress_block(), copy_block(), d_code() (+20 more)

### Community 76 - "runner k8s-lifecycle.test.js"
Cohesion: 0.10
Nodes (16): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+8 more)

### Community 77 - "investigations.test.js"
Cohesion: 0.12
Nodes (19): approve(), assert, binding, { createInvestigationManager }, { createRecord }, fs, { loadRoles }, { makeRedactor } (+11 more)

### Community 78 - "checkFacts"
Cohesion: 0.06
Nodes (41): checkFacts(), toModel(), Deviations from the spec (for approval with this plan), Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 1b, a voice standup in Google Meet, Rollback, Steps (+33 more)

### Community 80 - "Steps"
Cohesion: 0.07
Nodes (38): headline(), projectBoard(), inScope(), mapCard(), repositoryOf(), buildStandup(), ctx(), Approved decisions (copied from the spec, so this plan stands alone) (+30 more)

### Community 81 - "Design"
Cohesion: 0.06
Nodes (32): gateway(), Affected users and systems, Constraints, Decisions (2026-11-27), Intent: Enforce an egress limit for the RFactory pod, Open questions, Problem, Proposed outcome (+24 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "shares.test.js"
Cohesion: 0.14
Nodes (15): Switches and record, approve(), assert, binding, callOf(), { createShareManager }, { loadRoles }, { makeRedactor } (+7 more)

### Community 84 - "test run.test.js"
Cohesion: 0.09
Nodes (15): assert, audioJoined(), { EventEmitter }, filter(), fs, joined(), { PassThrough }, path (+7 more)

### Community 85 - "createShareManager"
Cohesion: 0.31
Nodes (19): createShareManager(), approve(), cleanup(), close(), emit(), endCall(), expire(), frameFor() (+11 more)

### Community 86 - "web/call.js"
Cohesion: 0.08
Nodes (23): BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts, checkFactsDetailed }, { createHearing, SELF_NAMES }, { createShareDesktop }, { createStt }, { FACTORY, GITHUB }, fs (+15 more)

### Community 87 - "core/package.json"
Cohesion: 0.14
Nodes (13): bin, rfactory, dependencies, @modelcontextprotocol/sdk, openai, engines, node, license (+5 more)

### Community 88 - "rfactory.js"
Cohesion: 0.19
Nodes (15): argumentsFor(), { DEFAULT_URL, createClient, failure, sanitize, targetUrl }, hideToken(), human(), { login, logout, readSession }, main(), MULTILINE, { parseArgs } (+7 more)

### Community 89 - "bot run()"
Cohesion: 0.20
Nodes (22): run(), abandon(), afterJoin(), discardOpen(), idleAvatar(), newGate(), onAudio(), onLine() (+14 more)

### Community 90 - "Design"
Cohesion: 0.14
Nodes (13): AI disclosure, Alternatives rejected, Cost, Design, Evidence this spec rests on, Licence (owner decision 2: the whole repository is AGPL-3.0), Packaging, Portraits and notices (+5 more)

### Community 91 - "gateway.test.js"
Cohesion: 0.13
Nodes (9): assert, base, { createGateway }, fs, { loadScope }, { makeRedactor }, os, path (+1 more)

### Community 92 - "rfactory-client.js"
Cohesion: 0.13
Nodes (13): action, events, fields(), investigation, item, project, readEvent(), refusalReasons (+5 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "Standalone mode S1: end-to-end results (#2 step 10)"
Cohesion: 0.25
Nodes (8): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass**

### Community 95 - "ref_node_fs"
Cohesion: 0.05
Nodes (33): fs, os, path, assert, { createProfile }, KEY, { test }, fs (+25 more)

### Community 96 - "Spec: an approved, read-only Claude investigation from the call"
Cohesion: 0.18
Nodes (10): 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), 3. RFactory: hearing, approval, the shared log, the spoken result, Alternatives rejected, Design, Findings this design rests on (checked 2026-11-19), Order and dependencies, Risks (+2 more)

### Community 97 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Design, Images: built, signed and promoted by CI, like CFactory, One pod, as today, Order and cutover, Owner decisions (proposed defaults), Pod security, Reach: tunnel, DNS, Keycloak (+4 more)

### Community 98 - "el"
Cohesion: 0.27
Nodes (12): ago(), clear(), el(), fill(), loadReviewCard(), render(), renderReview(), renderReviewCard() (+4 more)

### Community 99 - "Plan: a read-only standup from one Jira project, on the page (first slice of #59)"
Cohesion: 0.33
Nodes (5): Decisions (2026-11-27), Open questions, Plan: a read-only standup from one Jira project, on the page (first slice of #59), Rollback, Tests

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
Cohesion: 0.07
Nodes (29): bridgeViewOnly(), createFilter(), assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session (+21 more)

### Community 109 - "web/test/actions.test.js"
Cohesion: 0.09
Nodes (31): { closeEvidence }, createActionManager(), approve(), emit(), endCall(), expire(), finish(), list() (+23 more)

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "Plan: an MCP server for agents, slice A: read RFactory with a read key"
Cohesion: 0.13
Nodes (14): Approval (2026-11-27), C1. Scope (`core/src/scope.js`), C2. Shared reads (`web/reads.js`), C3. Project ids on entries, C4. The listener (`core/src/agent-endpoint.js`), Contracts (fixed; steps refer to them), Deviations, Open questions (+6 more)

### Community 112 - "createRecord"
Cohesion: 0.20
Nodes (15): Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Steps, Tests, Waves, Steps (+7 more)

### Community 113 - "des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 114 - "Design"
Cohesion: 0.13
Nodes (14): 11. Not in this slice, 1. The switch, 2. Hearing a note, 4. The notes of a call, 6. Approving and downloading, 7. Card proposals from a note, 8. The spoken headline, 9. The record (+6 more)

### Community 115 - "join"
Cohesion: 0.08
Nodes (29): releaseAttempt(), join(), Affected users and systems, Constraints, Intent: see why Meet refuses the call bot, and recover from it, Open questions, Problem, Proposed outcome (+21 more)

### Community 116 - "github.test.js"
Cohesion: 0.09
Nodes (23): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFile } (+15 more)

### Community 117 - "boundary.test.js"
Cohesion: 0.11
Nodes (12): assert, { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs, { loadRoles }, { makeRedactor } (+4 more)

### Community 118 - "Intent: a command-line tool for RFactory, slice A: sign in, read, join and leave"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: a command-line tool for RFactory, slice A: sign in, read, join and leave, Open questions, Proposed outcome

### Community 119 - "Intent: call the bot "Factory""
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-26: "approved", with the recommendations), Intent: call the bot "Factory", Open questions, Problem, Proposed outcome

### Community 121 - "deflator.js"
Cohesion: 0.38
Nodes (4): deflateInit(), Z_DEFAULT_COMPRESSION, Z_FULL_FLUSH, ZStream()

### Community 122 - "k14 results: agent workspace desktops on k3d with KubeVirt"
Cohesion: 0.13
Nodes (13): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+5 more)

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
Cohesion: 0.17
Nodes (12): assert, callTool(), card(), { createCfactorySource }, { encode }, { makeRedactor }, { projectBoard }, redactor (+4 more)

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 129 - "jira.test.js"
Cohesion: 0.12
Nodes (18): mapJira(), endpoint(), boundedJson(), { boundedJson }, createJiraSource(), snapshot(), { mapJira }, assert (+10 more)

### Community 130 - "k8s-policy.js"
Cohesion: 0.15
Nodes (15): BASE_PROTECTED, block(), buildPolicy(), contains(), ipNumber(), net, portRules(), ranges (+7 more)

### Community 131 - "Spec: one live test call with 5-10 team members talking to Factory"
Cohesion: 0.17
Nodes (11): 2. The runbook page (slice 1, docs), 3. How the results are scored without a code change, 4. The day (slice 2, no code), 5. Deferred, Alternatives rejected, Approval (2026-11-27), Design, Open questions (+3 more)

### Community 133 - "Plan: finish the "Factory" rename and stop false wakes at a caption block start"
Cohesion: 0.33
Nodes (5): Decisions (the approved intent and spec), Deviations, Plan: finish the "Factory" rename and stop false wakes at a caption block start, Rollback, Tests

### Community 134 - "loadPanels"
Cohesion: 0.70
Nodes (5): handleAction(), loadActions(), loadPanels(), renderActions(), storeOf()

### Community 135 - "browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

### Community 136 - "renderer.js"
Cohesion: 0.21
Nodes (9): buildRendererSource(), installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState() (+1 more)

### Community 137 - "checkFactsDetailed"
Cohesion: 0.17
Nodes (15): guestHelper(), poll(), checkFactsDetailed(), exact(), Steps, Deviations, Open questions, Plan: Captions mode robustness for repository names, card keys, wake words, and Meet dialogs (+7 more)

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
Cohesion: 0.15
Nodes (5): DOMKeyTable, codepoints, getKey(), getKeycode(), getKeysym()

### Community 155 - "Spec: call the bot "Factory""
Cohesion: 0.20
Nodes (9): 1. The name, everywhere a person sees or hears it, 2. The wake rule (`core/src/call/hearing.js`), 3. Tests, Alternatives rejected, Amendment (owner, 2026-11-26): share requests in natural words (#63), Design, Risks, Spec: call the bot "Factory" (+1 more)

### Community 156 - "check-egress.test.sh"
Cohesion: 0.27
Nodes (9): calls(), FAKE_ARGS, FAKE_CALLS, FAKE_OUT, FAKE_PROGRAM, fixture(), PATH, run() (+1 more)

### Community 157 - "ollama-standup.js"
Cohesion: 0.16
Nodes (11): { checkFacts }, count(), fs, main(), path, { setup }, setup(), CLAIM (+3 more)

### Community 158 - "avatar-renderer.test.js"
Cohesion: 0.08
Nodes (18): source, commit, path, repo, assert, { buildRendererSource }, { chromium }, fs (+10 more)

### Community 159 - "md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 161 - "readiness.sh"
Cohesion: 0.35
Nodes (10): alive(), extra_cleanup(), mode_checks(), settle(), readiness.sh script, stop_call(), stop_helpers(), wait_event() (+2 more)

### Community 162 - "loadScope"
Cohesion: 0.06
Nodes (44): loadScope(), listen(), Captions vs own transcription, Environment and scope reference, How the bot hears, Language, `listen` values and the per-platform `auto` rule, Per-call worker environment variables (set internally) (+36 more)

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
Cohesion: 0.40
Nodes (10): loadReview(), localTime(), run(), scoped(), wireElevation(), changeGrant(), changeSchedule(), loadSchedule() (+2 more)

### Community 168 - "Plan: an approved, read-only Claude investigation from the call (RFactory side)"
Cohesion: 0.33
Nodes (5): Decisions carried over (approved intent and spec), Gates, Plan: an approved, read-only Claude investigation from the call (RFactory side), Rollback, Tests

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 170 - "Design"
Cohesion: 0.20
Nodes (9): 2. A rejected mention still ends the request before it (`hearing.js:50-71`), 3. What people are told, 4. The shared views (`desktop/guest/agent/viewer/board.js:30`, `:35`), 5. Tests, Alternatives rejected, Design, Risks, Spec: finish the "Factory" rename and stop false wakes at a caption block start (+1 more)

### Community 171 - "Intent: clean up the `e2e-*` test repositories (GitHub and CFactory)"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: clean up the `e2e-*` test repositories (GitHub and CFactory), Open questions, Problem, Proposed outcome

### Community 172 - "Plan: Phase 0, the Linux call test"
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "wireProjectCall"
Cohesion: 0.83
Nodes (4): wireProjectCall(), open(), refresh(), send()

### Community 175 - "@modelcontextprotocol/sdk"
Cohesion: 0.33
Nodes (4): { ListToolsRequestSchema, CallToolRequestSchema }, { Server }, { StdioServerTransport }, @modelcontextprotocol/sdk

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

### Community 180 - "guard.test.js"
Cohesion: 0.13
Nodes (14): assert, { buildPolicy }, cniResult(), entry, { execFileSync }, fake(), fs, https (+6 more)

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

### Community 188 - "allowlist.js"
Cohesion: 0.12
Nodes (24): ACTIONS, bounded(), canonical(), CREATE_STATUSES, { createHash }, criteria(), FIELDS, INVESTIGATION_FIELDS (+16 more)

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
Cohesion: 0.25
Nodes (7): Approval (2026-11-27), Decisions (the approved intent and spec), Deviations, Plan: enforce an egress limit for the RFactory pod, Rollback, Steps, Tests

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

### Community 208 - "createHearing"
Cohesion: 0.09
Nodes (22): CAPTION_WAKE, createHearing(), heard(), NOTE, NOTES, SELF_NAMES, WAKE, assert (+14 more)

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

### Community 237 - "kubevirt.test.js"
Cohesion: 0.14
Nodes (11): assert, { createAgent }, { createCallWorker }, { createControl }, { dial }, { encode, createDecoder }, net, { parseCmdline } (+3 more)

### Community 238 - "rfactory-auth.js"
Cohesion: 0.19
Nodes (11): { constants }, { failure, relogin, targetUrl, sanitize }, fs, { homedir }, { isAbsolute, join }, logout(), { randomUUID }, readSession() (+3 more)

### Community 240 - ".expired"
Cohesion: 0.12
Nodes (15): Alternatives rejected, Design, Effects are derived, not trusted, Execution: re-check, claim, record, dispatch once, Keys and switches, Pending actions and approval, Reading CFactory's results, Recognising an action request (+7 more)

### Community 241 - "Intent: one live test call with 5-10 team members talking to Factory"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: one live test call with 5-10 team members talking to Factory, Open questions, Problem, Proposed outcome

### Community 242 - "Spec: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Design, Risks, Spec: the call Chrome runs with its sandbox on, so Meet admits the bot, Verification

### Community 243 - "proxy.test.js"
Cohesion: 0.13
Nodes (11): assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard, os (+3 more)

### Community 244 - "refresh.js"
Cohesion: 0.17
Nodes (13): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+5 more)

### Community 245 - "Design"
Cohesion: 0.14
Nodes (13): 3. The Jira adapter (new `core/src/sources/jira.js`), 6. What does not change, 7. Who sees what, 8. #2's spec, Alternatives rejected, Approval (2026-11-27), Decisions carried over from the approved intent, Deferred (+5 more)

### Community 246 - "failure"
Cohesion: 0.45
Nodes (10): oidc(), createClient(), checkExpiry(), heard(), listProjects(), projectId(), request(), failure() (+2 more)

### Community 247 - "createGuard"
Cohesion: 0.35
Nodes (12): createApi(), get(), createGuard(), counters(), heartbeat(), reconcile(), reconcileOnce(), server() (+4 more)

### Community 248 - "Design"
Cohesion: 0.22
Nodes (8): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Spec: Standalone mode, with a choice of source and brain

### Community 249 - "proxy.js"
Cohesion: 0.19
Nodes (11): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, ipv6Bytes() (+3 more)

### Community 250 - "Intent: a user guide and a feature list for RFactory"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: a user guide and a feature list for RFactory, Open questions, Problem, Proposed outcome

### Community 251 - "scope.js"
Cohesion: 0.15
Nodes (13): DESTINATIONS, fs, LISTEN, { makeRedactor }, name(), path, { STATES }, { toWhisperLanguage } (+5 more)

### Community 252 - "Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence, Open questions, Problem, Proposed outcome

### Community 253 - "compare"
Cohesion: 0.27
Nodes (12): canon(), compare(), compareAfter(), facts(), hashOf(), number(), 2. `core/bin/e2e-inventory.js`: the pure part (codex), 3. `core/bin/e2e-inventory.js`: readers and the command line (coder) (+4 more)

### Community 254 - "Intent: in-call agents, the model with live tools, provider chosen per call"
Cohesion: 0.22
Nodes (8): Affected users and systems, Amendments (owner, 2026-11-26), Constraints, Decisions (owner, 2026-11-26: "approve with your recommendations"), Intent: in-call agents, the model with live tools, provider chosen per call, Open questions, Problem, Proposed outcome

### Community 256 - "standup.test.js"
Cohesion: 0.20
Nodes (8): { FAILED, mapCard }, speakStandupHeadline(), assert, build(), { buildStandup, speakStandupHeadline }, freshness(), { makeRedactor }, test

### Community 257 - "Plan: `e2e-*` cleanup, first slice: the read-only inventory script"
Cohesion: 0.25
Nodes (7): Decisions (2026-11-27), Decisions (approved intent and spec), Open questions, Plan: `e2e-*` cleanup, first slice: the read-only inventory script, Rollback, Rules for implementers, Tests

### Community 258 - "cfactory.js"
Cohesion: 0.20
Nodes (7): COLUMNS, { repositoryOf }, STAGES, boundedFetch(), { Client }, STATE, { StreamableHTTPClientTransport }

### Community 259 - "createCfactorySource"
Cohesion: 0.36
Nodes (10): createCfactorySource(), call(), connect(), view(), comments(), freshness(), scopedCards(), withClient() (+2 more)

### Community 260 - "C5. Tools and wrapper (`web/agent-tools.js`)"
Cohesion: 0.07
Nodes (33): loadRoles(), has(), rolesOf(), commit(), app(), Decisions carried over from the approved spec, Decisions for this plan, Deviations (+25 more)

### Community 261 - "gateway.js"
Cohesion: 0.09
Nodes (21): DESKTOP, { mapGithub, summarise, STATES }, NAMES, { origin }, SCHEMAS, FAIL, failing(), labelNames() (+13 more)

### Community 262 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Control-channel additions (an additive change to #3), Design, Order and dependencies, Proposing, approving, stopping, Risks, Spec: Show the CFactory board in the call, The constraint that shapes it (+2 more)

### Community 263 - "Intent: Phase 2, slice A: the bot joins a Zoom meeting as a guest"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: Phase 2, slice A: the bot joins a Zoom meeting as a guest, Open questions, Problem, Proposed outcome

### Community 264 - "Design"
Cohesion: 0.20
Nodes (9): 1. CFactory: projects on the server (CFactory PR A, then PR B), 2. RFactory: the allowlist and its secrets (`core/src/scope.js`), 5. RFactory: each proposal keeps its target (`web/actions.js`, `web/shares.js`, `web/investigations.js`), 6. Rollout order, Alternatives rejected, Design, Risks, Spec: project-aware calls (+1 more)

### Community 265 - "RFactory"
Cohesion: 0.18
Nodes (11): Agents (MCP), Deployment, Feature list, How the bot hears, Jira, Licence, RFactory, Roles (+3 more)

### Community 266 - "client.test.js"
Cohesion: 0.10
Nodes (16): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+8 more)

### Community 267 - "installSttBridge"
Cohesion: 0.22
Nodes (7): installSttBridge(), setup(), Alternatives rejected, Design, Risks, Spec: the bot hears in audio mode, and joins Meet on the first try, Verification

### Community 268 - "renderNotes"
Cohesion: 0.46
Nodes (8): handleCall(), handleNotes(), loadNotes(), notesStoreOf(), postNote(), renderLimits(), renderNote(), renderNotes()

### Community 269 - "Steps"
Cohesion: 0.13
Nodes (22): pageLeft(), failureReport(), leftConfirmed(), watchLeft(), resolveListen(), Decisions (2026-11-28), Deviations, Open questions (+14 more)

### Community 270 - "k8s-policy.test.js"
Cohesion: 0.28
Nodes (8): addressBits(), assert, assertPolicySchema(), { buildPolicy }, cidrContains(), input, ranges, test

### Community 271 - "observer.js"
Cohesion: 0.20
Nodes (10): [chrome, dir], close(), controller, endWatch, fs, path, stop(), stopped (+2 more)

### Community 272 - "stt.test.js"
Cohesion: 0.22
Nodes (6): assert, { createStt }, fs, os, path, test

### Community 273 - "createProxy"
Cohesion: 0.39
Nodes (7): createApi(), get(), createProxy(), entryFor(), snapshot(), watch(), limiter()

### Community 274 - "Spec: Elevated calls, slice 1 — portal-verified pairing, schedule, and grant"
Cohesion: 0.29
Nodes (6): Alternatives rejected, Decisions (2026-11-28), Open questions, Risks, Spec: Elevated calls, slice 1 — portal-verified pairing, schedule, and grant, Verification

### Community 275 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.20
Nodes (10): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 8. Problems we hit (+2 more)

### Community 276 - "createGithubRead"
Cohesion: 0.50
Nodes (5): createGithubRead(), newest(), request(), repoUrl(), 2. The connection: Jira Cloud's REST API, directly

### Community 277 - "ref_node_crypto"
Cohesion: 0.25
Nodes (5): fs, LABEL, { randomUUID, hkdfSync }, { hashPayload }, { randomUUID }

### Community 279 - "Multi-participant live test"
Cohesion: 0.25
Nodes (7): a. The invitation, b. The timeline, c. The script, d. The score sheet, e. The results comment template, Multi-participant live test, The 10 questions

### Community 280 - "Intent: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text), Open questions, Problem, Proposed outcome

### Community 281 - "net.js"
Cohesion: 0.57
Nodes (6): cidr(), contains(), ipValue(), net, preview(), validatePreview()

### Community 282 - "Intent: the first question after the bot joins is heard in Meet captions mode"
Cohesion: 0.22
Nodes (8): Affected users and systems, Candidate causes, and what the code says, Constraints, Decisions (2026-11-27), Intent: the first question after the bot joins is heard in Meet captions mode, Open questions, Problem, Proposed outcome

### Community 283 - "callevents.js"
Cohesion: 0.29
Nodes (5): filter(), GREETING, HEARING, LOG_CLASSES, STATES

### Community 284 - "Steps"
Cohesion: 0.08
Nodes (27): tools(), ask(), listTools(), raw(), Problem, Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains) (+19 more)

### Community 285 - "Design"
Cohesion: 0.33
Nodes (6): 1. Call session identity and lifecycle (`web/call.js`), 2. Meeting schedule registry (`web/schedule.js`, `web/server.js`), 3. Pairing code and bot display (`bot/run.js`, `bot/avatar/renderer.js`), 4. Grant manager (`web/grants.js`), 5. HTTP routes, CSRF check, and UI (`web/server.js`, `web/public/app.js`, `web/public/index.html`, `web/Containerfile`), Design

### Community 286 - "events.js"
Cohesion: 0.48
Nodes (5): _capturedElemChanged(), _captureObserver, _captureProxy(), releaseCapture(), setCapture()

### Community 288 - "Intent: redact credentials that wrap across log lines"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: redact credentials that wrap across log lines, Open questions, Problem, Proposed outcome

### Community 289 - "Intent: elevated calls, slice 1: pair a call in the portal and hold a grant for it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: elevated calls, slice 1: pair a call in the portal and hold a grant for it, Open questions, Problem, Proposed outcome

### Community 290 - "Steps"
Cohesion: 0.18
Nodes (10): setCameraRenderer(), speechLevel(), Decisions carried over (approved intent and spec), Deviations after merge, Deviations (Codex review of the approved plan, 2026-11-17), Plan: A face for the bot that talks when it speaks, Rollback, Steps (+2 more)

### Community 291 - "cap"
Cohesion: 0.67
Nodes (3): cap(), collect(), walk()

### Community 292 - "Plan: Elevated calls, slice 1 — portal-verified pairing, schedule, and grant"
Cohesion: 0.29
Nodes (6): Decisions (2026-11-28), Deviations, Open questions, Plan: Elevated calls, slice 1 — portal-verified pairing, schedule, and grant, Rollback, Tests

### Community 294 - "loadShares"
Cohesion: 0.83
Nodes (4): handleShare(), loadShares(), renderShare(), shareStoreOf()

## Knowledge Gaps
- **41 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+36 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2245 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Websock` connect `Websock` to `rfb.js`, `Websock`, `.off`, `logging.js`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _41 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `createCallManager` to `Plan: standup notes, slice 1: dictated notes, review on the page, a Markdown download`, `web/test/notes.test.js`, `.off`, `loadPanels`, `review.js`, `renderNotes`, `web/test/actions.test.js`, `wireProjectCall`, `createHearing`, `.expired`, `app.js`, `Steps`, `failure`, `createInvestigationManager`, `handleConnect`, `core/test/notes.test.js`, `error`, `server.js`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Should `app.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09195402298850575 - nodes in this community are weakly interconnected._
- **Why does `Display` connect `Display` to `rfb.js`, `createInvestigationManager`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `rfb.js` be split into smaller, more focused modules?**
  _Cohesion score 0.04972677595628415 - nodes in this community are weakly interconnected._