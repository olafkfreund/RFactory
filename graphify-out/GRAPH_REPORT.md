# Graph Report - RFactory-t26  (2026-11-28)

## Corpus Check
- 367 files · ~614,861 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: (none) 10, .nix 6, .css 4)

## Summary
- 4303 nodes · 7831 edges · 277 communities (239 shown, 38 thin omitted)
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 1248 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `11a18fb1`
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
- Plan: `rfactory` CLI, slice A: sign in, read, join and leave
- rfactory.test.js
- How the bot hears
- test desktop-ui.test.js
- guard.test.js
- RFB
- runner runner.test.js
- agent-tools.js
- e2e-inventory.test.js
- Intent: the bot hears the call itself (its own speech-to-text)
- runner runner.js
- effects.js
- test server.test.js
- cli.test.js
- test avatar-state.test.js
- Profiles
- cli.test.js
- agents.test.js
- core/test/notes.test.js
- rfactory-standup.js
- error
- server.js
- lookups.test.js
- share.test.js
- claude-cli.test.js
- ref_node_assert
- tts.test.js
- client.js
- rfactory-auth.js
- captions
- stt-bridge.test.js
- deflate.js
- cfactory-write.test.js
- kyverno-scope.test.js
- verify verify.test.js
- compare
- listen
- redact.js
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
- logging.js
- proxy.js
- createNotesManager
- share-desktop.test.js
- a
- agent-endpoint.js
- reaper reaper.test.js
- agent-endpoint.test.js
- ref_node_path
- rfactory-client.js
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
- gateway.test.js
- rfactory.js
- desktop desktop/package.json
- kubevirt.test.js
- ref_node_fs
- Spec: an approved, read-only Claude investigation from the call
- Design
- avatar-renderer.test.js
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
- makeRedactor
- Steps
- des.js
- Design
- @rfactory/core
- github-web.test.js
- boundary.test.js
- Design
- Intent: call the bot "Factory"
- RSAAESAuthenticationState
- inflator.js
- standup
- verify e2e.sh
- H264Decoder
- k3d k11.sh
- k3d mk-tls.sh
- test/board.test.js
- verify liveview.sh
- jira.test.js
- k8s-policy.js
- loadScope
- GestureHandler
- Design
- web/package.json
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
- el
- afterJoin
- md5.js
- TightDecoder
- readiness.sh
- failure
- observer.js
- desktop-routes.js
- eyes
- Keyboard
- Spec: one live test call with 5-10 team members talking to Factory
- Socket
- teams-tap-spike.js
- Plan: finish the "Factory" rename and stop false wakes at a caption block start
- Intent: clean up the `e2e-*` test repositories (GitHub and CFactory)
- Plan: Phase 0, the Linux call test
- Intent: run a Claude terminal from the call, and show it
- Steps
- @modelcontextprotocol/sdk
- Intent: run RFactory in the factory cluster like the other Factory services
- desktop.test.js
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
- Plan: an MCP server for agents, slice A: read RFactory with a read key
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
- Intent: a command-line tool for RFactory, slice A: sign in, read, join and leave
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
- Steps
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
- source-guard.test.js
- join
- check-egress.sh
- Design
- Intent: one live test call with 5-10 team members talking to Factory
- Spec: the call Chrome runs with its sandbox on, so Meet admits the bot
- callevents.js
- Spec: a read-only standup from one Jira project, on the page (first slice of #59)
- Intent: the first question after the bot joins is heard in Meet captions mode
- facts.js
- gateway.js
- Design
- shell-browser.test.js
- Deviations from the spec (for approval with this plan)
- scope.js
- Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence
- Plan: `e2e-*` cleanup, first slice: the read-only inventory script
- refuseKeyEnv
- avatars.test.js
- Standalone mode S1: end-to-end results (#2 step 10)
- createClaudeBrain
- start
- ollama-standup.js
- Design
- Intent: redact credentials that wrap across log lines
- Design
- composeWrites
- events.js
- pod.test.js
- cfactory-write.js
- Steps
- stun.test.js
- main
- Intent: see why Meet refuses the call bot, and recover from it
- renderNotes
- .off
- redact.test.js
- Plan: Review and standup from the board (#28, slice 1)
- ref_node_crypto
- wireProjectCall

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `makeRedactor()` - 48 edges
3. `createLifecycle()` - 45 edges
4. `Steps` - 39 edges
5. `createInvestigationManager()` - 37 edges
6. `Steps` - 37 edges
7. `createApp()` - 36 edges
8. `loadScope()` - 35 edges
9. `createCallManager()` - 35 edges
10. `checkFacts()` - 34 edges

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

## Communities (277 total, 38 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "app.test.js"
Cohesion: 0.11
Nodes (13): renderFooter(), ALPHA, assert, base, BETA, Node, notesShim(), page (+5 more)

### Community 2 - "rfb.js"
Cohesion: 0.05
Nodes (21): CopyRectDecoder, JPEGDecoder, RawDecoder, RREDecoder, ZlibDecoder, Deflator, encodings, _buildExtendedClipboardFlags() (+13 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.07
Nodes (19): assert, { createCallManager }, { createInvestigationManager }, { EventEmitter }, fakeClock(), finishSpeech(), flush(), fs (+11 more)

### Community 4 - "web/test/notes.test.js"
Cohesion: 0.12
Nodes (16): @rfactory/core, { checkNote, sentence, headline, toMarkdown, notesHash }, { randomUUID }, same(), assert, { createNotesManager }, KEYS, { loadRoles } (+8 more)

### Community 5 - "createCallManager"
Cohesion: 0.28
Nodes (20): Deviations (Codex review of the approved plan, 2026-11-17), Steps, createCallManager(), addressed(), answer(), drain(), emitLimits(), lookupAnswer() (+12 more)

### Community 6 - "claude-cli.js"
Cohesion: 0.11
Nodes (18): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, LOOKUP_ERRORS, LOOKUP_SYSTEM_PROMPT (+10 more)

### Community 7 - "createLifecycle"
Cohesion: 0.11
Nodes (34): createLifecycle(), accept(), allowAccept(), attachAgent(), boot(), callAttach(), cancel(), cancelNow() (+26 more)

### Community 8 - "Plan: `rfactory` CLI, slice A: sign in, read, join and leave"
Cohesion: 0.12
Nodes (20): idle(), Deviations, Open questions, Plan: `rfactory` CLI, slice A: sign in, read, join and leave, Rollback, Steps, Tests, Deviations (+12 more)

### Community 9 - "rfactory.test.js"
Cohesion: 0.11
Nodes (23): app(), assert, BIN, cli(), run(), signedIn(), start(), { createApp } (+15 more)

### Community 10 - "How the bot hears"
Cohesion: 0.11
Nodes (16): a. The invitation, b. The timeline, c. The script, d. The score sheet, e. The results comment template, Multi-participant live test, The 10 questions, Agents (MCP) (+8 more)

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "guard.test.js"
Cohesion: 0.06
Nodes (52): binding(), cidrFamily(), command(), createApi(), get(), createGuard(), apply(), counters() (+44 more)

### Community 13 - "RFB"
Cohesion: 0.06
Nodes (3): clientEncodings(), RFB, xvpOp()

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 15 - "agent-tools.js"
Cohesion: 0.07
Nodes (28): action, atom(), { CARD_KEY }, createAgentTools(), invoke(), descriptions, freshness, investigation (+20 more)

### Community 16 - "e2e-inventory.test.js"
Cohesion: 0.12
Nodes (22): assert, { build, hashOf, compare, compareAfter, main }, clone(), endpointsOf(), { EventEmitter }, fixture(), fs, ghFake() (+14 more)

### Community 17 - "Intent: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text), Open questions, Problem, Proposed outcome

### Community 18 - "runner runner.js"
Cohesion: 0.11
Nodes (23): clearInterval(), createK8s(), { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade() (+15 more)

### Community 19 - "effects.js"
Cohesion: 0.32
Nodes (7): deriveEffects(), describe(), SERVICE, STAGE, stageFor(), stateOf(), WRITES

### Community 20 - "test server.test.js"
Cohesion: 0.06
Nodes (29): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, GH_KEYS, ghItems, { handleCall } (+21 more)

### Community 21 - "cli.test.js"
Cohesion: 0.11
Nodes (19): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+11 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.11
Nodes (13): installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState(), meshAt() (+5 more)

### Community 23 - "Profiles"
Cohesion: 0.17
Nodes (5): fs, LABEL, name(), Profiles, { randomUUID, hkdfSync }

### Community 24 - "cli.test.js"
Cohesion: 0.09
Nodes (15): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+7 more)

### Community 25 - "agents.test.js"
Cohesion: 0.09
Nodes (19): agents, assert, cards, { Client }, compose(), { createApp, composeAgents, composeWrites, refuseKeyEnv }, fs, { loadRoles } (+11 more)

### Community 26 - "core/test/notes.test.js"
Cohesion: 0.13
Nodes (20): hashPayload(), checkNote(), closeEvidence(), { FAILED }, { hashPayload }, KINDS, notesHash(), { reviewCard, ACTIVE } (+12 more)

### Community 27 - "rfactory-standup.js"
Cohesion: 0.13
Nodes (22): ageOf(), approveClaude(), causes(), { checkFacts }, { connect }, { createBrain }, { createCfactorySource }, { createClaudeBrain, ARGV: CLAUDE_ARGV } (+14 more)

### Community 28 - "error"
Cohesion: 0.12
Nodes (29): releaseAttempt(), code(), number(), bash(), Approved decisions (copied from the spec, so this plan stands alone), Decisions (approved intent and spec), Deviations, Plan: see why Meet refuses the call bot, and recover from it (+21 more)

### Community 29 - "server.js"
Cohesion: 0.09
Nodes (35): C2. Shared reads (`web/reads.js`), 5. The web app and the page (`web/server.js`, `web/public/app.js`), { buildStandup, speakStandupHeadline }, createReads(), bind(), listProjects(), describe(), { mapCard } (+27 more)

### Community 30 - "lookups.test.js"
Cohesion: 0.08
Nodes (24): createLookups(), FACTORY, GITHUB, { mapCard }, specs, { STATES }, validate(), { validPath, validNumber } (+16 more)

### Community 31 - "share.test.js"
Cohesion: 0.08
Nodes (30): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+22 more)

### Community 32 - "claude-cli.test.js"
Cohesion: 0.13
Nodes (16): claudeHash(), assert, { claudeHash, checkClaudeHome }, { createClaudeBrain }, { EventEmitter }, fs, lookup, lookupBrain() (+8 more)

### Community 33 - "ref_node_assert"
Cohesion: 0.08
Nodes (21): toSpeech(), toWhisperLanguage(), WHISPER_LANGUAGES, assert, fs, path, root, test (+13 more)

### Community 34 - "tts.test.js"
Cohesion: 0.13
Nodes (14): assert, { createTts }, { EventEmitter }, fs, os, { PassThrough }, path, test (+6 more)

### Community 35 - "client.js"
Cohesion: 0.25
Nodes (5): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS

### Community 36 - "rfactory-auth.js"
Cohesion: 0.20
Nodes (10): { constants }, { failure, relogin, targetUrl, sanitize }, fs, { homedir }, { isAbsolute, join }, logout(), { randomUUID }, saveSession() (+2 more)

### Community 37 - "captions"
Cohesion: 0.14
Nodes (15): captions(), A. The bot reports caption readiness (`bot/run.js`), Alternatives rejected, B. The manager holds the greeting (`web/call.js`), C. The call log places a miss (`web/call.js`), D. The page (`web/public/app.js`), Decisions (2026-11-27), Deferred (+7 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.08
Nodes (11): installSttBridge(), assert, event(), fs, { installSttBridge }, path, RTCRtpReceiver, RTCRtpSender (+3 more)

### Community 39 - "deflate.js"
Cohesion: 0.07
Nodes (41): deflate(), deflate_fast(), deflate_huff(), deflate_rle(), deflate_slow(), deflate_stored(), deflateEnd(), deflateInit() (+33 more)

### Community 40 - "cfactory-write.test.js"
Cohesion: 0.10
Nodes (19): createCfactoryWriter(), getClient(), invoke(), assert, bareBlocked, bareStarted, before, card (+11 more)

### Community 41 - "kyverno-scope.test.js"
Cohesion: 0.14
Nodes (16): assert, dir, { firstHost }, fs, path, policies, probeCidrs(), test (+8 more)

### Community 42 - "verify verify.test.js"
Cohesion: 0.10
Nodes (19): assert, beats(), CHECKS, fs, http, INPUT, { join }, LIB (+11 more)

### Community 43 - "compare"
Cohesion: 0.36
Nodes (8): canon(), compare(), compareAfter(), facts(), hashOf(), checked(), gone(), 2. `core/bin/e2e-inventory.js`: the pure part (codex)

### Community 44 - "listen"
Cohesion: 0.07
Nodes (30): listen(), Captions vs own transcription, Environment and scope reference, How the bot hears, Language, `listen` values and the per-platform `auto` rule, Per-call worker environment variables (set internally), Privacy (+22 more)

### Community 45 - "redact.js"
Cohesion: 0.18
Nodes (14): base64(), JOINED_RULES, jwtSpans(), KEY_VALUE_AT, keyValueAt(), keyValueMatch(), keyValueSpans(), occurrences() (+6 more)

### Community 46 - "inflate.js"
Cohesion: 0.08
Nodes (26): adler32(), crc32(), makeTable(), read_buf(), inflate_fast(), fixedtables(), inflate(), inflateInit() (+18 more)

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
Cohesion: 0.14
Nodes (10): botName(), path, run(), assert, { EventEmitter }, fs, os, path (+2 more)

### Community 52 - "app.js"
Cohesion: 0.11
Nodes (34): decide(), decided(), decideInvestigation(), decideShare(), handleAction(), handleInvestigation(), handleShare(), INVESTIGATION_LIVE (+26 more)

### Community 53 - "ref_node_stream"
Cohesion: 0.08
Nodes (21): assert, { createHandler, createUpgrade }, { createRunnerClient }, { execFileSync }, fs, https, os, { PassThrough, Duplex } (+13 more)

### Community 54 - "createInvestigationManager"
Cohesion: 0.07
Nodes (64): count(), COUNT_CLAIM, createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog(), endCall() (+56 more)

### Community 55 - "index.js"
Cohesion: 0.07
Nodes (37): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+29 more)

### Community 56 - "createProxy"
Cohesion: 0.24
Nodes (18): checkedAddresses(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect(), handleForward() (+10 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.24
Nodes (16): board(), boolean(), columns, count(), exact(), identity, log(), login() (+8 more)

### Community 58 - "createActionManager"
Cohesion: 0.20
Nodes (20): Steps, { closeEvidence }, createActionManager(), approve(), emit(), endCall(), expire(), finish() (+12 more)

### Community 59 - "logging.js"
Cohesion: 0.10
Nodes (4): HextileDecoder, DataChannel, rawChannelProps, ReadyStates

### Community 60 - "proxy.js"
Cohesion: 0.17
Nodes (14): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, inRange() (+6 more)

### Community 61 - "createNotesManager"
Cohesion: 0.28
Nodes (17): createNotesManager(), approve(), discard(), download(), edit(), emit(), endCall(), find() (+9 more)

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

### Community 67 - "ref_node_path"
Cohesion: 0.15
Nodes (10): fs, path, assert, { createRecord }, fs, { makeRedactor }, os, path (+2 more)

### Community 68 - "rfactory-client.js"
Cohesion: 0.13
Nodes (13): action, events, fields(), investigation, item, project, readEvent(), refusalReasons (+5 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.10
Nodes (12): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, invReplies(), invWith(), listTools(), { makeRedactor } (+4 more)

### Community 70 - "agent/call.test.js"
Cohesion: 0.11
Nodes (18): createCallWorker(), { createShare, callLaunchArgs }, fs, { PassThrough }, assert, { createCallWorker, withProxy, MEET_GUEST, TEAMS_CAPTIONS }, { EventEmitter }, fixture() (+10 more)

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
Cohesion: 0.13
Nodes (18): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+10 more)

### Community 75 - "trees.js"
Cohesion: 0.16
Nodes (28): bi_flush(), bi_reverse(), bi_windup(), build_bl_tree(), build_tree(), compress_block(), copy_block(), d_code() (+20 more)

### Community 76 - "runner k8s-lifecycle.test.js"
Cohesion: 0.10
Nodes (16): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+8 more)

### Community 77 - "web live-view.test.js"
Cohesion: 0.15
Nodes (11): assert, client(), clientSession, { createApp }, fbUpdate, includes(), { loadRoles }, net (+3 more)

### Community 78 - "checkFacts"
Cohesion: 0.05
Nodes (42): checkFacts(), Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 1b, a voice standup in Google Meet, Rollback, Steps, Tests, Alternatives rejected (+34 more)

### Community 80 - "standup.test.js"
Cohesion: 0.23
Nodes (9): buildStandup(), { FAILED, mapCard }, speakStandupHeadline(), assert, build(), { buildStandup, speakStandupHeadline }, freshness(), { makeRedactor } (+1 more)

### Community 81 - "Design"
Cohesion: 0.06
Nodes (32): gateway(), Affected users and systems, Constraints, Decisions (2026-11-27), Intent: Enforce an egress limit for the RFactory pod, Open questions, Problem, Proposed outcome (+24 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "k14 results: agent workspace desktops on k3d with KubeVirt"
Cohesion: 0.12
Nodes (14): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+6 more)

### Community 84 - "test run.test.js"
Cohesion: 0.11
Nodes (11): assert, { EventEmitter }, fs, joined(), { PassThrough }, path, { run }, setup() (+3 more)

### Community 85 - "createShareManager"
Cohesion: 0.31
Nodes (19): createShareManager(), approve(), cleanup(), close(), emit(), endCall(), expire(), frameFor() (+11 more)

### Community 86 - "web/call.js"
Cohesion: 0.08
Nodes (23): NOTE, NOTES, SELF_NAMES, Web server environment variables, BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts, checkFactsDetailed }, { createHearing, SELF_NAMES } (+15 more)

### Community 87 - "core/package.json"
Cohesion: 0.14
Nodes (13): bin, rfactory, dependencies, @modelcontextprotocol/sdk, openai, engines, node, license (+5 more)

### Community 88 - "._handleMouse"
Cohesion: 0.15
Nodes (5): extendedPointerEvent(), keyEvent(), pointerEvent(), QEMUExtendedKeyEvent(), clientToElement()

### Community 89 - "bot run()"
Cohesion: 0.19
Nodes (22): pageLeft(), run(), abandon(), discardOpen(), failureReport(), guestHelper(), idleAvatar(), leftConfirmed() (+14 more)

### Community 90 - "Design"
Cohesion: 0.09
Nodes (20): speechLevel(), Decisions carried over (approved intent and spec), Deviations after merge, Plan: A face for the bot that talks when it speaks, Rollback, Tests, AI disclosure, Alternatives rejected (+12 more)

### Community 91 - "gateway.test.js"
Cohesion: 0.13
Nodes (9): assert, base, { createGateway }, fs, { loadScope }, { makeRedactor }, os, path (+1 more)

### Community 92 - "rfactory.js"
Cohesion: 0.19
Nodes (15): argumentsFor(), { DEFAULT_URL, createClient, failure, sanitize, targetUrl }, hideToken(), human(), { login, logout, readSession }, main(), MULTILINE, { parseArgs } (+7 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "kubevirt.test.js"
Cohesion: 0.14
Nodes (11): assert, { createAgent }, { createCallWorker }, { createControl }, { dial }, { encode, createDecoder }, net, { parseCmdline } (+3 more)

### Community 95 - "ref_node_fs"
Cohesion: 0.08
Nodes (19): assert, { createProfile }, KEY, { test }, fs, assert, { createK8s }, fs (+11 more)

### Community 96 - "Spec: an approved, read-only Claude investigation from the call"
Cohesion: 0.18
Nodes (10): 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), 3. RFactory: hearing, approval, the shared log, the spoken result, Alternatives rejected, Design, Findings this design rests on (checked 2026-11-19), Order and dependencies, Risks (+2 more)

### Community 97 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Design, Images: built, signed and promoted by CI, like CFactory, One pod, as today, Order and cutover, Owner decisions (proposed defaults), Pod security, Reach: tunnel, DNS, Keycloak (+4 more)

### Community 98 - "avatar-renderer.test.js"
Cohesion: 0.18
Nodes (6): assert, { buildRendererSource }, { chromium }, fs, path, test

### Community 99 - "Plan: a read-only standup from one Jira project, on the page (first slice of #59)"
Cohesion: 0.22
Nodes (8): Decisions (2026-11-27), Deviations from the spec (approved with this plan), Final review deviations from this plan, Open questions, Plan: a read-only standup from one Jira project, on the page (first slice of #59), Rollback, Tests, refuseJiraEnv()

### Community 100 - ".rQwait"
Cohesion: 0.13
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

### Community 111 - "makeRedactor"
Cohesion: 0.29
Nodes (12): makeRedactor(), logSafeWindow(), redactString(), toModel(), pemSpans(), Decisions carried over (approved intent and spec), Deviations, Plan: redact credentials that wrap across log lines (+4 more)

### Community 112 - "Steps"
Cohesion: 0.07
Nodes (43): revalidate(), mapCard(), commit(), base(), source(), action(), Waves, Steps (+35 more)

### Community 113 - "des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 114 - "Design"
Cohesion: 0.13
Nodes (14): 11. Not in this slice, 1. The switch, 2. Hearing a note, 3. Shaping a note, 4. The notes of a call, 6. Approving and downloading, 8. The spoken headline, 9. The record (+6 more)

### Community 115 - "@rfactory/core"
Cohesion: 0.13
Nodes (16): The action record, Switches and record, approve(), assert, binding, callOf(), { createShareManager }, { loadRoles } (+8 more)

### Community 116 - "github-web.test.js"
Cohesion: 0.05
Nodes (39): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFile } (+31 more)

### Community 117 - "boundary.test.js"
Cohesion: 0.10
Nodes (14): card(), assert, callTool(), { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs (+6 more)

### Community 118 - "Design"
Cohesion: 0.20
Nodes (9): 1. CFactory: projects on the server (CFactory PR A, then PR B), 2. RFactory: the allowlist and its secrets (`core/src/scope.js`), 5. RFactory: each proposal keeps its target (`web/actions.js`, `web/shares.js`, `web/investigations.js`), 6. Rollout order, Alternatives rejected, Design, Risks, Spec: project-aware calls (+1 more)

### Community 119 - "Intent: call the bot "Factory""
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-26: "approved", with the recommendations), Intent: call the bot "Factory", Open questions, Problem, Proposed outcome

### Community 121 - "inflator.js"
Cohesion: 0.21
Nodes (4): Inflate, inflateReset(), inflateResetKeep(), ZStream()

### Community 122 - "standup"
Cohesion: 0.09
Nodes (26): tools(), ask(), required(), raw(), Problem, Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains) (+18 more)

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
Cohesion: 0.08
Nodes (31): COLUMNS, projectBoard(), { repositoryOf }, STAGES, boundedFetch(), { Client }, createCfactorySource(), call() (+23 more)

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 129 - "jira.test.js"
Cohesion: 0.12
Nodes (18): mapJira(), endpoint(), boundedJson(), { boundedJson }, createJiraSource(), snapshot(), { mapJira }, assert (+10 more)

### Community 130 - "k8s-policy.js"
Cohesion: 0.05
Nodes (45): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+37 more)

### Community 131 - "loadScope"
Cohesion: 0.09
Nodes (22): setCameraRenderer(), loadScope(), ctx(), Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 3, act on the Factories from the call, Rollback, Tests (+14 more)

### Community 133 - "Design"
Cohesion: 0.13
Nodes (14): 10. Intent constraints carried into slice 1, 1. Data comes from four CFactory read tools, all on the existing read key, 2. Scope: one rule, used everywhere, 3. Failure and freshness, 4. `core/src/standup.js` (new, pure): `buildStandup(cards, freshness)`, 5. The spoken headline is built by the server: `speakStandupHeadline(standup)`, 6. Review (`core/src/review.js`, new, pure), 8. `core/src/sources/cfactory.js` (+6 more)

### Community 134 - "web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 135 - "browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

### Community 136 - "run.js"
Cohesion: 0.17
Nodes (10): { buildRendererSource }, { CALL_EVENTS }, crypto, fs, { installSttBridge }, { makeRedactor }, os, path (+2 more)

### Community 137 - "loadRoles"
Cohesion: 0.15
Nodes (11): loadRoles(), has(), rolesOf(), Decisions carried over from the approved spec, Decisions for this plan, Deviations, Plan: v1 roles in code (admin, approver, member), slice "roles" of #2, Rollback (+3 more)

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

### Community 155 - "Spec: call the bot "Factory""
Cohesion: 0.20
Nodes (9): 1. The name, everywhere a person sees or hears it, 2. The wake rule (`core/src/call/hearing.js`), 3. Tests, Alternatives rejected, Amendment (owner, 2026-11-26): share requests in natural words (#63), Design, Risks, Spec: call the bot "Factory" (+1 more)

### Community 156 - "check-egress.test.sh"
Cohesion: 0.27
Nodes (9): calls(), FAKE_ARGS, FAKE_CALLS, FAKE_OUT, FAKE_PROGRAM, fixture(), PATH, run() (+1 more)

### Community 157 - "el"
Cohesion: 0.27
Nodes (13): ago(), clear(), clock(), el(), handleCall(), loadReviewCard(), render(), renderLimits() (+5 more)

### Community 158 - "afterJoin"
Cohesion: 0.17
Nodes (11): buildRendererSource(), afterJoin(), startAvatar(), waitRetry(), Approval (2026-11-27), Decisions (the approved intent and spec), Plan: the first question after the bot joins is heard in Meet captions mode, Rollback (+3 more)

### Community 159 - "md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 161 - "readiness.sh"
Cohesion: 0.35
Nodes (10): alive(), extra_cleanup(), mode_checks(), settle(), readiness.sh script, stop_call(), stop_helpers(), wait_event() (+2 more)

### Community 162 - "failure"
Cohesion: 0.41
Nodes (11): oidc(), readSession(), createClient(), checkExpiry(), heard(), listProjects(), projectId(), request() (+3 more)

### Community 163 - "observer.js"
Cohesion: 0.09
Nodes (21): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 8. Problems we hit (+13 more)

### Community 164 - "desktop-routes.js"
Cohesion: 0.10
Nodes (28): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+20 more)

### Community 165 - "eyes"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 167 - "Spec: one live test call with 5-10 team members talking to Factory"
Cohesion: 0.17
Nodes (11): 2. The runbook page (slice 1, docs), 3. How the results are scored without a code change, 4. The day (slice 2, no code), 5. Deferred, Alternatives rejected, Approval (2026-11-27), Design, Open questions (+3 more)

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
Cohesion: 0.25
Nodes (6): Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions?, Run 2 (Chrome) against the pass criteria, Runs, Verdict: **pass**

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "Steps"
Cohesion: 0.17
Nodes (11): headline(), Steps, Approval (2026-11-27), Contracts between the steps, Decisions (the approved intent and spec), Deviations, Plan: standup notes, slice 1: dictated notes, review on the page, a Markdown download, Rollback (+3 more)

### Community 175 - "@modelcontextprotocol/sdk"
Cohesion: 0.33
Nodes (4): { ListToolsRequestSchema, CallToolRequestSchema }, { Server }, { StdioServerTransport }, @modelcontextprotocol/sdk

### Community 176 - "Intent: run RFactory in the factory cluster like the other Factory services"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decided, Intent: run RFactory in the factory cluster like the other Factory services, Open questions, Problem, Proposed outcome

### Community 177 - "desktop.test.js"
Cohesion: 0.10
Nodes (26): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), stopShare() (+18 more)

### Community 178 - "Spec: Phase 0, the Linux call test"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Context for later phases (not decided here), Decisions on the intent's Phase 0 questions, Design, Goal, Pass / fail, Risks, Spec: Phase 0, the Linux call test (+1 more)

### Community 179 - "Intent: A face for the bot that talks when it speaks"
Cohesion: 0.22
Nodes (8): Affected users and systems, Constraints, Decisions (owner, 2026-11-17), Intent: A face for the bot that talks when it speaks, Open questions, Problem, Proposed outcome (first slice), Source of the portraits

### Community 180 - "Plan: an MCP server for agents, slice A: read RFactory with a read key"
Cohesion: 0.17
Nodes (11): Approval (2026-11-27), C1. Scope (`core/src/scope.js`), C3. Project ids on entries, C4. The listener (`core/src/agent-endpoint.js`), Contracts (fixed; steps refer to them), Deviations, Open questions, Plan: an MCP server for agents, slice A: read RFactory with a read key (+3 more)

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
Cohesion: 0.14
Nodes (13): ok(), hello(), Waking the bot, Plan decisions (new here; the owner approves them with this plan), Approval (2026-11-27), Decisions (the approved intent and spec), Deviations, Plan: enforce an egress limit for the RFactory pod (+5 more)

### Community 196 - "Intent: a command-line tool for RFactory, slice A: sign in, read, join and leave"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Decisions (2026-11-27), Intent: a command-line tool for RFactory, slice A: sign in, read, join and leave, Open questions, Proposed outcome

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
Cohesion: 0.14
Nodes (15): createHearing(), assert, { createHearing }, fakeClock(), headlineRequests, noteRequests, setup(), test (+7 more)

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

### Community 214 - "Steps"
Cohesion: 0.12
Nodes (18): cap(), collect(), walk(), inScope(), Deviations, Approval (2026-11-27), Decisions (approved intent and spec, as they apply to slice B), Deviations (+10 more)

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

### Community 237 - "source-guard.test.js"
Cohesion: 0.18
Nodes (10): Source adapters, assert, fs, git(), guard, os, path, repo() (+2 more)

### Community 238 - "join"
Cohesion: 0.11
Nodes (20): join(), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Steps, Tests, Decisions (+12 more)

### Community 240 - "Design"
Cohesion: 0.13
Nodes (14): Alternatives rejected, Design, Effects are derived, not trusted, Execution: re-check, claim, record, dispatch once, Keys and switches, Pending actions and approval, Reading CFactory's results, Recognising an action request (+6 more)

### Community 241 - "Intent: one live test call with 5-10 team members talking to Factory"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: one live test call with 5-10 team members talking to Factory, Open questions, Problem, Proposed outcome

### Community 242 - "Spec: the call Chrome runs with its sandbox on, so Meet admits the bot"
Cohesion: 0.33
Nodes (5): Alternatives rejected, Design, Risks, Spec: the call Chrome runs with its sandbox on, so Meet admits the bot, Verification

### Community 243 - "callevents.js"
Cohesion: 0.29
Nodes (5): filter(), GREETING, HEARING, LOG_CLASSES, STATES

### Community 244 - "Spec: a read-only standup from one Jira project, on the page (first slice of #59)"
Cohesion: 0.29
Nodes (6): Alternatives rejected, Approval (2026-11-27), Open questions, Risks, Spec: a read-only standup from one Jira project, on the page (first slice of #59), Verification

### Community 245 - "Intent: the first question after the bot joins is heard in Meet captions mode"
Cohesion: 0.18
Nodes (10): heard(), Affected users and systems, Candidate causes, and what the code says, Constraints, Decisions (2026-11-27), How a caption becomes a question today, Intent: the first question after the bot joins is heard in Meet captions mode, Open questions (+2 more)

### Community 246 - "facts.js"
Cohesion: 0.20
Nodes (9): checkFactsDetailed(), CLAIM, COUNT, { summarise }, WORDS, assert, { checkFacts, checkFactsDetailed }, snapshot (+1 more)

### Community 247 - "gateway.js"
Cohesion: 0.11
Nodes (17): DESKTOP, { mapGithub, summarise, STATES }, NAMES, { origin }, SCHEMAS, FAIL, failing(), labelNames() (+9 more)

### Community 248 - "Design"
Cohesion: 0.22
Nodes (8): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Spec: Standalone mode, with a choice of source and brain

### Community 249 - "shell-browser.test.js"
Cohesion: 0.18
Nodes (7): assert, { chromium }, { createApp }, { loadRoles }, { makeRedactor }, { spawnSync }, test

### Community 250 - "Deviations from the spec (for approval with this plan)"
Cohesion: 0.10
Nodes (23): label(), exec(), hosts(), Decisions carried over from the approved spec, Deviations from the spec (for approval with this plan), Facts checked in the real repos, Open questions for the owner, Plan: Agent workspace, a disposable desktop per call (#3) (+15 more)

### Community 251 - "scope.js"
Cohesion: 0.09
Nodes (20): source, commit, path, repo, DESTINATIONS, fs, LISTEN, { makeRedactor } (+12 more)

### Community 252 - "Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence"
Cohesion: 0.25
Nodes (7): Affected users and systems, Approval (2026-11-27), Constraints, Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence, Open questions, Problem, Proposed outcome

### Community 253 - "Plan: `e2e-*` cleanup, first slice: the read-only inventory script"
Cohesion: 0.15
Nodes (12): 1. `core/src/sources/cfactory.js`: one tenant-wide read (coder), 4. Full tests, review, commit (lead), 5. One live read-only run, and the list on issue #60 (lead), Decisions (2026-11-27), Decisions (approved intent and spec), Deviations, Open questions, Plan: `e2e-*` cleanup, first slice: the read-only inventory script (+4 more)

### Community 254 - "refuseKeyEnv"
Cohesion: 0.10
Nodes (20): Affected users and systems, Amendments (owner, 2026-11-26), Constraints, Decisions (owner, 2026-11-26: "approve with your recommendations"), Intent: in-call agents, the model with live tools, provider chosen per call, Open questions, Problem, Proposed outcome (+12 more)

### Community 255 - "avatars.test.js"
Cohesion: 0.20
Nodes (8): assert, crypto, dir, fs, ids, manifest, path, test

### Community 256 - "Standalone mode S1: end-to-end results (#2 step 10)"
Cohesion: 0.20
Nodes (8): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass**

### Community 257 - "createClaudeBrain"
Cohesion: 0.49
Nodes (10): createClaudeBrain(), answerTurn(), checkDestination(), lookupTurn(), note(), propose(), run(), stop() (+2 more)

### Community 258 - "start"
Cohesion: 0.29
Nodes (10): resolveListen(), Deviations, armQuiet(), audio(), captionSeen(), incoming(), killGroup(), settle() (+2 more)

### Community 259 - "ollama-standup.js"
Cohesion: 0.28
Nodes (7): { checkFacts }, count(), fs, main(), path, { setup }, setup()

### Community 260 - "Design"
Cohesion: 0.15
Nodes (12): 1. Keys and the scope file (decisions 1, 8), 3. Shared reads (the one control API), 5. What an agent sees: the wrapper, 6. Project ids on proposals and record lines, 7. Limits and the page (constraint "agents must not get in the page's way"), 9. Deployment, Alternatives rejected, Decisions (2026-11-27) (+4 more)

### Community 261 - "Intent: redact credentials that wrap across log lines"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: redact credentials that wrap across log lines, Open questions, Problem, Proposed outcome

### Community 262 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Control-channel additions (an additive change to #3), Design, Order and dependencies, Proposing, approving, stopping, Risks, Spec: Show the CFactory board in the call, The constraint that shapes it (+2 more)

### Community 263 - "composeWrites"
Cohesion: 0.22
Nodes (8): nonce(), Decisions carried over (approved intent and spec), Deviations, Gates, Plan: Show the CFactory board in the call, Rollback, Tests, composeWrites()

### Community 264 - "events.js"
Cohesion: 0.48
Nodes (5): _capturedElemChanged(), _captureObserver, _captureProxy(), releaseCapture(), setCapture()

### Community 265 - "pod.test.js"
Cohesion: 0.22
Nodes (7): assert, fs, os, path, realPod, { spawnSync }, test

### Community 266 - "cfactory-write.js"
Cohesion: 0.25
Nodes (7): { Client }, { deriveEffects }, fs, { makeRedactor }, STAGES, { StreamableHTTPClientTransport }, TOOLS

### Community 267 - "Steps"
Cohesion: 0.43
Nodes (8): Steps, Steps, loadReview(), openPage(), run(), wireCall(), composeStandalone(), projectPage()

### Community 268 - "stun.test.js"
Cohesion: 0.29
Nodes (4): assert, dgram, { stunProbe }, test

### Community 269 - "main"
Cohesion: 0.43
Nodes (5): connect(), handshake(), main(), [mode, url], out()

### Community 270 - "Intent: see why Meet refuses the call bot, and recover from it"
Cohesion: 0.29
Nodes (6): Affected users and systems, Constraints, Intent: see why Meet refuses the call bot, and recover from it, Open questions, Problem, Proposed outcome

### Community 271 - "renderNotes"
Cohesion: 0.67
Nodes (6): handleNotes(), loadNotes(), notesStoreOf(), postNote(), renderNote(), renderNotes()

### Community 273 - "redact.test.js"
Cohesion: 0.40
Nodes (4): assert, { makeRedactor }, test, { toModel, logSafe }

### Community 274 - "Plan: Review and standup from the board (#28, slice 1)"
Cohesion: 0.40
Nodes (4): Plan: Review and standup from the board (#28, slice 1), Roles, Rollback, Tests

### Community 276 - "wireProjectCall"
Cohesion: 0.83
Nodes (4): wireProjectCall(), open(), refresh(), send()

## Knowledge Gaps
- **41 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+36 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2139 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Websock` connect `.rQwait` to `.off`, `rfb.js`, `logging.js`, `RFB`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _41 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `Steps` to `start`, `loadScope`, `composeWrites`, `Plan: `rfactory` CLI, slice A: sign in, read, join and leave`, `.off`, `core/test/notes.test.js`, `rfactory-standup.js`, `error`, `server.js`, `failure`, `Plan: an MCP server for agents, slice A: read RFactory with a read key`, `createInvestigationManager`, `createActionManager`, `review.js`, `createShareManager`, `Steps`, `makeRedactor`, `standup`, `refuseKeyEnv`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `app.test.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10541310541310542 - nodes in this community are weakly interconnected._
- **Why does `Display` connect `Display` to `rfb.js`, `createInvestigationManager`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `rfb.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0519774011299435 - nodes in this community are weakly interconnected._