# Graph Report - 28-impl  (2026-11-23)

## Corpus Check
- 260 files · ~344,323 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: (none) 9, .nix 6, .css 3)

## Summary
- 2872 nodes · 5210 edges · 193 communities (157 shown, 36 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 637 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e429811e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verify lib.sh
- runner k8s-policy.js
- Display
- test/call.test.js
- public app.js
- guard guard.test.js
- zlib deflate.js
- runner createLifecycle()
- agent index.js
- core rfb.js
- core RFB
- test desktop-ui.test.js
- k14 results: agent workspace desktops on k3d with KubeVirt
- zlib inflate.js
- runner runner.test.js
- core .rQwait()
- zlib trees.js
- test github.test.js
- runner runner.js
- web createActionManager()
- test server.test.js
- test brain.test.js
- test avatar-state.test.js
- test core/test/actions.test.js
- runner vnc.test.js
- crypto des.js
- Websock
- rfactory-standup.js
- test cli.test.js
- web server.js
- input GestureHandler
- util browser.js
- test claude-cli.test.js
- src gateway.js
- tts.test.js
- runner client.test.js
- core RSAAESAuthenticationState
- actions-record.test.js
- live-view.js
- H264Decoder
- test cfactory-write.test.js
- runner kyverno-scope.test.js
- verify verify.test.js
- web desktop-routes.js
- decoders TightDecoder
- proxy createProxy()
- Design
- verify net.sh
- verify profiles.sh
- vm-call.test.js
- Profiles
- spike hello-call.test.js
- crypto crypto.js
- input util.js
- core Websock
- proxy proxy.js
- proxy proxy.test.js
- runner protocol.js
- util logging.js
- crypto u8ArrayToBigInt()
- HextileDecoder
- util Cursor
- avatars points
- effects.js
- Plan: A face for the bot that talks when it speaks
- reaper reaper.test.js
- review.js
- Steps
- ref_node_assert
- test cfactory.test.js
- cfactory-write.js
- ref_node_fs
- core ._handleMouse()
- bot bot/package.json
- test gateway.test.js
- tts.js
- runner k8s-lifecycle.test.js
- web live-view.test.js
- crypto md5.js
- inflator.js
- test avatar-renderer.test.js
- fake-github-mcp.js
- spike spike/package.json
- input Keyboard
- test run.test.js
- core core/package.json
- cancel
- ref_node_os
- share.test.js
- bot run()
- avatars eyes
- bot run.js
- test test/board.test.js
- desktop desktop/package.json
- runner protocol.test.js
- web web/package.json
- test desktop-routes.test.js
- test source-guard.test.js
- desktop createSessions()
- toModel
- k3d k14-env.sh
- verify handover.sh
- test hearing.test.js
- proxy Socket
- verify lifecycle.sh
- decoders ZRLEDecoder
- avatars portraits
- k3d gate.sh
- runner lifecycle.js
- crypto LegacyCrypto
- crypto RSACipher
- ref_node_http
- verify main()
- boundary.test.js
- util events.js
- avatars mesh
- avatars move
- Steps
- createCallManager
- verify e2e.sh
- kubevirt.test.js
- k3d k11.sh
- k3d mk-tls.sh
- Plan: Show the CFactory board in the call
- verify liveview.sh
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
- avatars anchors
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
- utils Buf16
- utils Buf32
- utils Buf8
- zlib deflateInfo
- zlib inflateInfo
- Steps
- web/call.js
- mapCard
- createActionManager
- standup.test.js
- Plan: Phase 0, the Linux call test
- Design
- Desktop VMs on the k3d factory cluster
- Design
- Spec: Phase 1b, a voice standup in Google Meet
- Design
- control.js
- Design
- share-desktop.test.js
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
- makeTable
- Standalone mode S1: end-to-end results (#2 step 10)
- ready
- Intent: Show the Factories in the call
- Intent: Meeting agent Phase 1b, a voice standup in Google Meet
- Intent: Review and control the Factories from the standup and the bot
- fill_window
- core/test/actions.test.js
- Intent: Meeting agent web app for the Factories
- Intent: Standalone mode, without the Factories
- Intent: Agent workspace, a disposable desktop per call
- Intent: Meeting agent Phase 1a, a text standup in the web UI
- Third-party notices
- speak
- Approved decisions (copied from the spec, so this plan stands alone)
- RFactory
- JPEGDecoder
- Avatar portraits
- CLAUDE.md
- .claude/CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `createLifecycle()` - 45 edges
3. `makeRedactor()` - 32 edges
4. `Display` - 32 edges
5. `Websock` - 32 edges
6. `checkFacts()` - 28 edges
7. `portraits` - 23 edges
8. `Profiles` - 23 edges
9. `GestureHandler` - 23 edges
10. `createCallManager()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `Verification` --references--> `stopShare()`  [INFERRED]
  spec/2026-11-17-3-agent-workspace.md → core/src/desktop/session.js
- `Decisions carried over from the approved spec` --references--> `toModel()`  [INFERRED]
  plan/2026-11-17-2-standalone-mode.md → core/src/redact.js
- `Brains` --references--> `toModel()`  [INFERRED]
  spec/2026-11-17-2-standalone-mode.md → core/src/redact.js
- `Keys and switches` --references--> `loadScope()`  [INFERRED]
  spec/2026-11-17-10-phase-3-actions-and-share.md → core/src/scope.js
- `2. Scope: one rule, used everywhere` --references--> `repositoryOf()`  [INFERRED]
  spec/2026-11-23-28-factory-review-control.md → core/src/sources/cfactory.js

## Import Cycles
- None detected.

## Communities (193 total, 36 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "runner k8s-policy.js"
Cohesion: 0.06
Nodes (42): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+34 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.15
Nodes (12): assert, { createCallManager }, { EventEmitter }, fakeActions(), a, fakeClock(), finishSpeech(), flush() (+4 more)

### Community 4 - "public app.js"
Cohesion: 0.07
Nodes (44): ago(), clear(), clock(), day(), decide(), decideShare(), el(), fill() (+36 more)

### Community 5 - "guard guard.test.js"
Cohesion: 0.06
Nodes (51): binding(), cidrFamily(), command(), createApi(), get(), createGuard(), apply(), counters() (+43 more)

### Community 6 - "zlib deflate.js"
Cohesion: 0.08
Nodes (33): deflate(), deflateEnd(), deflateInit(), deflateInit2(), deflateReset(), deflateResetKeep(), deflateSetDictionary(), DeflateState() (+25 more)

### Community 7 - "runner createLifecycle()"
Cohesion: 0.10
Nodes (36): createLifecycle(), accept(), action(), allowAccept(), attachAgent(), boot(), callAttach(), cancelNow() (+28 more)

### Community 8 - "agent index.js"
Cohesion: 0.11
Nodes (23): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+15 more)

### Community 9 - "core rfb.js"
Cohesion: 0.07
Nodes (17): CopyRectDecoder, RawDecoder, RREDecoder, ZlibDecoder, Deflator, encodings, _buildExtendedClipboardFlags(), clientCutText() (+9 more)

### Community 10 - "core RFB"
Cohesion: 0.06
Nodes (4): clientEncodings(), keyEvent(), RFB, xvpOp()

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "k14 results: agent workspace desktops on k3d with KubeVirt"
Cohesion: 0.12
Nodes (14): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+6 more)

### Community 13 - "zlib inflate.js"
Cohesion: 0.08
Nodes (24): adler32(), inflate_fast(), fixedtables(), inflate(), inflateInit2(), inflateReset(), inflateReset2(), inflateResetKeep() (+16 more)

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 16 - "zlib trees.js"
Cohesion: 0.16
Nodes (28): bi_flush(), bi_reverse(), bi_windup(), build_bl_tree(), build_tree(), compress_block(), copy_block(), d_code() (+20 more)

### Community 17 - "test github.test.js"
Cohesion: 0.10
Nodes (22): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFileSync } (+14 more)

### Community 18 - "runner runner.js"
Cohesion: 0.10
Nodes (25): { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade(), crypto, dgram (+17 more)

### Community 19 - "web createActionManager()"
Cohesion: 0.13
Nodes (11): { deriveEffects, describe }, FINAL, { randomUUID }, { validate, hashPayload, canonical }, approve(), assert, { createActionManager }, { loadRoles } (+3 more)

### Community 20 - "test server.test.js"
Cohesion: 0.10
Nodes (17): assert, boardData, { createApp, makeLogin }, fakeBrain, fs, { handleCall }, items, { loadRoles } (+9 more)

### Community 21 - "test brain.test.js"
Cohesion: 0.11
Nodes (19): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+11 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.11
Nodes (13): installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState(), meshAt() (+5 more)

### Community 23 - "test core/test/actions.test.js"
Cohesion: 0.23
Nodes (12): ACTIONS, bounded(), canonical(), CREATE_STATUSES, { createHash }, criteria(), FIELDS, hashPayload() (+4 more)

### Community 24 - "runner vnc.test.js"
Cohesion: 0.17
Nodes (11): assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session, setEnc, setPixel (+3 more)

### Community 25 - "crypto des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 27 - "rfactory-standup.js"
Cohesion: 0.06
Nodes (43): { checkFacts }, count(), fs, main(), path, { setup }, ageOf(), causes() (+35 more)

### Community 28 - "test cli.test.js"
Cohesion: 0.09
Nodes (15): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+7 more)

### Community 29 - "web server.js"
Cohesion: 0.11
Nodes (25): nonce(), Deviations, @rfactory/core, { buildStandup, speakStandupHeadline }, composeWrites(), createApp(), DESKTOP_STATIC, fs (+17 more)

### Community 31 - "util browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

### Community 32 - "test claude-cli.test.js"
Cohesion: 0.08
Nodes (32): approveClaude(), runClaude(), ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, createClaudeBrain(), propose() (+24 more)

### Community 33 - "src gateway.js"
Cohesion: 0.07
Nodes (28): createGateway(), call(), numberFrom(), snapshot(), DESKTOP, { mapGithub, summarise, STATES }, NAMES, { origin } (+20 more)

### Community 34 - "tts.test.js"
Cohesion: 0.17
Nodes (11): Recorded GitHub inventory (pinned 1.14.0, captured 2026-11-17), after(), assert, { createTts }, { EventEmitter }, fs, os, { PassThrough } (+3 more)

### Community 35 - "runner client.test.js"
Cohesion: 0.10
Nodes (16): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+8 more)

### Community 36 - "core RSAAESAuthenticationState"
Cohesion: 0.13
Nodes (3): RA2Cipher, RSAAESAuthenticationState, EventTargetMixin

### Community 37 - "actions-record.test.js"
Cohesion: 0.15
Nodes (16): Waves, Steps, createRecord(), files(), lastEntries(), prune(), unfinished(), unfinishedShares() (+8 more)

### Community 38 - "live-view.js"
Cohesion: 0.27
Nodes (8): bridgeViewOnly(), createFilter(), RFC-6455, attachLiveView(), { bridgeViewOnly }, crypto, wsFrame(), wsReader()

### Community 39 - "H264Decoder"
Cohesion: 0.16
Nodes (3): H264Context, H264Decoder, H264Parser

### Community 40 - "test cfactory-write.test.js"
Cohesion: 0.06
Nodes (36): makeRedactor(), PATTERNS, DESTINATIONS, fs, loadScope(), { makeRedactor }, path, createCfactoryWriter() (+28 more)

### Community 41 - "runner kyverno-scope.test.js"
Cohesion: 0.14
Nodes (16): assert, dir, { firstHost }, fs, path, policies, probeCidrs(), test (+8 more)

### Community 42 - "verify verify.test.js"
Cohesion: 0.12
Nodes (15): assert, beats(), CHECKS, fs, http, INPUT, { join }, LIB (+7 more)

### Community 43 - "web desktop-routes.js"
Cohesion: 0.17
Nodes (19): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+11 more)

### Community 45 - "proxy createProxy()"
Cohesion: 0.24
Nodes (18): checkedAddresses(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect(), handleForward() (+10 more)

### Community 46 - "Design"
Cohesion: 0.22
Nodes (8): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Spec: Standalone mode, with a choice of source and brain

### Community 47 - "verify net.sh"
Cohesion: 0.16
Nodes (17): BP, connect(), deadline_left(), hello(), mk_target(), mkp(), NIP, node_ip() (+9 more)

### Community 48 - "verify profiles.sh"
Cohesion: 0.23
Nodes (18): app_restore(), app_sync(), argo_app(), attach(), ciphertext(), cm_field(), errmatch(), extra_cleanup() (+10 more)

### Community 49 - "vm-call.test.js"
Cohesion: 0.16
Nodes (10): assert, { createVmSpawn }, { Duplex }, { test }, createVmSpawn(), { EventEmitter }, firstLine(), { PassThrough } (+2 more)

### Community 50 - "Profiles"
Cohesion: 0.05
Nodes (47): fs, LABEL, name(), Profiles, { randomUUID, hkdfSync }, admin, assert, fakeK8s() (+39 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.14
Nodes (12): Steps, botName(), path, run(), assert, { EventEmitter }, fs, JoinError (+4 more)

### Community 53 - "input util.js"
Cohesion: 0.15
Nodes (5): DOMKeyTable, codepoints, getKey(), getKeycode(), getKeysym()

### Community 55 - "proxy proxy.js"
Cohesion: 0.17
Nodes (14): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, inRange() (+6 more)

### Community 56 - "proxy proxy.test.js"
Cohesion: 0.11
Nodes (12): createApi(), assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard (+4 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.20
Nodes (13): board(), columns, count(), exact(), identity, login(), optional(), safe() (+5 more)

### Community 58 - "util logging.js"
Cohesion: 0.09
Nodes (5): toSigned32bit(), toUnsigned32bit(), DataChannel, rawChannelProps, ReadyStates

### Community 59 - "crypto u8ArrayToBigInt()"
Cohesion: 0.24
Nodes (5): bigIntToU8Array(), modPow(), u8ArrayToBigInt(), DHCipher, DHPublicKey

### Community 62 - "avatars points"
Cohesion: 0.12
Nodes (16): points, C, JL, JR, LB, LL, LM, LR (+8 more)

### Community 63 - "effects.js"
Cohesion: 0.32
Nodes (7): deriveEffects(), describe(), SERVICE, STAGE, stageFor(), stateOf(), WRITES

### Community 64 - "Plan: A face for the bot that talks when it speaks"
Cohesion: 0.25
Nodes (7): speechLevel(), Decisions carried over (approved intent and spec), Deviations after merge, Plan: A face for the bot that talks when it speaks, Rollback, Tests, Timing and "never frozen"

### Community 65 - "reaper reaper.test.js"
Cohesion: 0.09
Nodes (23): loadRoles(), has(), rolesOf(), createReaper(), leaseStale(), tick(), fs, main() (+15 more)

### Community 66 - "review.js"
Cohesion: 0.15
Nodes (17): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+9 more)

### Community 67 - "Steps"
Cohesion: 0.16
Nodes (18): tools(), ask(), raw(), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains), Rollback, Steps (+10 more)

### Community 68 - "ref_node_assert"
Cohesion: 0.05
Nodes (38): assert, crypto, dir, fs, ids, manifest, path, test (+30 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.13
Nodes (7): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, reply(), repos, test

### Community 70 - "cfactory-write.js"
Cohesion: 0.25
Nodes (7): { Client }, { deriveEffects }, fs, { makeRedactor }, STAGES, { StreamableHTTPClientTransport }, TOOLS

### Community 71 - "ref_node_fs"
Cohesion: 0.17
Nodes (9): createK8s(), assert, { createK8s }, fs, http, { inClusterConfig }, os, path (+1 more)

### Community 72 - "core ._handleMouse()"
Cohesion: 0.25
Nodes (3): extendedPointerEvent(), pointerEvent(), clientToElement()

### Community 73 - "bot bot/package.json"
Cohesion: 0.14
Nodes (13): dependencies, playwright-core, @vibeconferencing/calls, engines, node, playwright-core, @vibeconferencing/calls, license (+5 more)

### Community 74 - "test gateway.test.js"
Cohesion: 0.11
Nodes (13): assert, base, { createGateway }, fetchScope(), fs, gateway(), { loadScope }, { makeRedactor } (+5 more)

### Community 75 - "tts.js"
Cohesion: 0.38
Nodes (6): createTts(), say(), fs, path, run(), wavHeader()

### Community 76 - "runner k8s-lifecycle.test.js"
Cohesion: 0.19
Nodes (9): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+1 more)

### Community 77 - "web live-view.test.js"
Cohesion: 0.15
Nodes (11): assert, client(), clientSession, { createApp }, fbUpdate, includes(), { loadRoles }, net (+3 more)

### Community 78 - "crypto md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 80 - "test avatar-renderer.test.js"
Cohesion: 0.18
Nodes (6): assert, { buildRendererSource }, { chromium }, fs, path, test

### Community 81 - "fake-github-mcp.js"
Cohesion: 0.33
Nodes (4): { ListToolsRequestSchema, CallToolRequestSchema }, { Server }, { StdioServerTransport }, @modelcontextprotocol/sdk

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 84 - "test run.test.js"
Cohesion: 0.19
Nodes (9): assert, { EventEmitter }, joined(), { PassThrough }, { run }, setup(), stopsOnce(), test (+1 more)

### Community 85 - "core core/package.json"
Cohesion: 0.17
Nodes (11): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+3 more)

### Community 86 - "cancel"
Cohesion: 0.18
Nodes (16): label(), stopShare(), exec(), cancel(), hosts(), Decisions carried over from the approved spec, Deviations from the spec (for approval with this plan), Facts checked in the real repos (+8 more)

### Community 87 - "ref_node_os"
Cohesion: 0.21
Nodes (7): createProfile(), readHead(), assert, { createProfile }, KEY, setup(), { test }

### Community 88 - "share.test.js"
Cohesion: 0.06
Nodes (40): createCallWorker(), { createShare, callLaunchArgs }, { PassThrough }, assert, { createCallWorker, withProxy }, { EventEmitter }, fixture(), { test } (+32 more)

### Community 89 - "bot run()"
Cohesion: 0.33
Nodes (12): buildRendererSource(), run(), afterJoin(), idleAvatar(), leftConfirmed(), onLine(), play(), start() (+4 more)

### Community 90 - "avatars eyes"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 91 - "bot run.js"
Cohesion: 0.18
Nodes (7): { buildRendererSource }, crypto, fs, { makeRedactor }, os, path, TERMINAL

### Community 92 - "test test/board.test.js"
Cohesion: 0.13
Nodes (15): COLUMNS, projectBoard(), { repositoryOf }, STAGES, assert, callTool(), card(), { createCfactorySource } (+7 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "runner protocol.test.js"
Cohesion: 0.20
Nodes (7): assert, fs, { MAX, encode, createDecoder, tag }, net, os, path, { test }

### Community 95 - "web web/package.json"
Cohesion: 0.18
Nodes (10): dependencies, @rfactory/core, engines, node, license, name, private, scripts (+2 more)

### Community 96 - "test desktop-routes.test.js"
Cohesion: 0.18
Nodes (9): assert, { createApp }, { createDesktop }, grant, { loadRoles }, { makeRedactor }, open, roles (+1 more)

### Community 97 - "test source-guard.test.js"
Cohesion: 0.18
Nodes (10): Source adapters, assert, fs, git(), guard, os, path, repo() (+2 more)

### Community 99 - "desktop createSessions()"
Cohesion: 0.29
Nodes (10): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), origin() (+2 more)

### Community 100 - "toModel"
Cohesion: 0.14
Nodes (16): redactString(), toModel(), Data, Decisions on the intent's open questions (recommended), Design, Sign-in, Web server (`web/`), Where it runs (+8 more)

### Community 101 - "k3d k14-env.sh"
Cohesion: 0.44
Nodes (9): app_sync(), argo(), desktops(), env_of(), kc(), kubectl(), runner_restart(), k14-env.sh script (+1 more)

### Community 102 - "verify handover.sh"
Cohesion: 0.42
Nodes (8): fixture_reached(), hits(), open_page(), page_loaded(), session_of(), handover.sh script, trap_page(), wait_attached()

### Community 103 - "test hearing.test.js"
Cohesion: 0.36
Nodes (6): createHearing(), assert, { createHearing }, fakeClock(), setup(), test

### Community 106 - "verify lifecycle.sh"
Cohesion: 0.42
Nodes (7): case_hold(), egress_cut(), fresh(), hold(), settled(), lifecycle.sh script, watch_end()

### Community 109 - "avatars portraits"
Cohesion: 0.25
Nodes (8): anchors, file, sha256, file, sha256, portraits, f01, f09

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "runner lifecycle.js"
Cohesion: 0.25
Nodes (6): { buildPolicy }, { createDecoder, tag, encode }, crypto, net, { nonce: newNonce }, { StringDecoder }

### Community 115 - "ref_node_http"
Cohesion: 0.29
Nodes (3): http, [portA, portB], state

### Community 116 - "verify main()"
Cohesion: 0.43
Nodes (5): connect(), handshake(), main(), [mode, url], out()

### Community 117 - "boundary.test.js"
Cohesion: 0.11
Nodes (12): assert, { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs, { loadRoles }, { makeRedactor } (+4 more)

### Community 118 - "util events.js"
Cohesion: 0.48
Nodes (5): _capturedElemChanged(), _captureObserver, _captureProxy(), releaseCapture(), setCapture()

### Community 119 - "avatars mesh"
Cohesion: 0.33
Nodes (6): mesh, anchors, file, sha256, triangles, f17

### Community 120 - "avatars move"
Cohesion: 0.33
Nodes (6): move, C, JL, JR, LB, LM

### Community 121 - "Steps"
Cohesion: 0.21
Nodes (14): { Client }, createCfactorySource(), call(), comments(), connect(), freshness(), scopedCards(), within() (+6 more)

### Community 122 - "createCallManager"
Cohesion: 0.34
Nodes (15): createCallManager(), addressed(), answer(), drain(), incoming(), killGroup(), queueSpeech(), requestAction() (+7 more)

### Community 123 - "verify e2e.sh"
Cohesion: 0.53
Nodes (4): real_ids(), e2e.sh script, teams_call(), WEB_MAX

### Community 124 - "kubevirt.test.js"
Cohesion: 0.13
Nodes (13): octets(), parseCmdline(), assert, { createAgent }, { createCallWorker }, { createControl }, { dial }, { encode, createDecoder } (+5 more)

### Community 125 - "k3d k11.sh"
Cohesion: 0.50
Nodes (4): env_of(), RFACTORY_DESKTOP, RFACTORY_RUNNER_URL, k11.sh script

### Community 126 - "k3d mk-tls.sh"
Cohesion: 0.70
Nodes (4): FILES, key(), leaf(), mk-tls.sh script

### Community 127 - "Plan: Show the CFactory board in the call"
Cohesion: 0.33
Nodes (5): Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Tests

### Community 128 - "verify liveview.sh"
Cohesion: 0.70
Nodes (4): extra_cleanup(), pod_up(), liveview.sh script, shot()

### Community 129 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f02

### Community 130 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f03

### Community 131 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f05

### Community 132 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f06

### Community 133 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f07

### Community 134 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f08

### Community 135 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f10

### Community 136 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f11

### Community 137 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f12

### Community 138 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f14

### Community 139 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f15

### Community 140 - "avatars anchors"
Cohesion: 0.50
Nodes (4): anchors, file, sha256, f16

### Community 141 - "deploy pod.sh"
Cohesion: 1.00
Nodes (3): down(), pod.sh script, up()

### Community 142 - "verify share.sh"
Cohesion: 0.83
Nodes (3): ready(), share.sh script, web_stop()

### Community 160 - "Steps"
Cohesion: 0.22
Nodes (8): idle(), setCameraRenderer(), Steps, Alternatives rejected, Evidence this spec rests on, Risks, Spec: A face for the bot that talks when it speaks, Verification

### Community 161 - "web/call.js"
Cohesion: 0.14
Nodes (12): source, commit, path, repo, BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts }, { createHearing } (+4 more)

### Community 162 - "mapCard"
Cohesion: 0.15
Nodes (13): mapCard(), 10. Intent constraints carried into slice 1, 1. Data comes from four CFactory read tools, all on the existing read key, 2. Scope: one rule, used everywhere, 3. Failure and freshness, 4. `core/src/standup.js` (new, pure): `buildStandup(cards, freshness)`, 6. Review (`core/src/review.js`, new, pure), 8. `core/src/sources/cfactory.js` (+5 more)

### Community 163 - "createActionManager"
Cohesion: 0.36
Nodes (14): Steps, createActionManager(), approve(), emit(), endCall(), expire(), finish(), list() (+6 more)

### Community 165 - "standup.test.js"
Cohesion: 0.21
Nodes (9): buildStandup(), { FAILED, mapCard }, speakStandupHeadline(), assert, build(), { buildStandup, speakStandupHeadline }, freshness(), { makeRedactor } (+1 more)

### Community 166 - "Plan: Phase 0, the Linux call test"
Cohesion: 0.15
Nodes (11): Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Tests, Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions? (+3 more)

### Community 167 - "Design"
Cohesion: 0.22
Nodes (9): AI disclosure, Cost, Design, Licence (owner decision 2: the whole repository is AGPL-3.0), Packaging, Portraits and notices, The face, Turning the camera on (+1 more)

### Community 168 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.20
Nodes (9): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 9. Rollback (+1 more)

### Community 170 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Answers to the intent's open questions, Design, Feasibility gate (first plan step), Lifecycle and disposal, Live view, Network, Persistent profiles (+4 more)

### Community 171 - "Spec: Phase 1b, a voice standup in Google Meet"
Cohesion: 0.40
Nodes (4): Alternatives rejected, Risks, Spec: Phase 1b, a voice standup in Google Meet, Verification

### Community 172 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Design, Exposure, Facts this rests on (checked on p620, 2026-11-18), Lifecycle, Live view, Profiles, Risks (+4 more)

### Community 173 - "control.js"
Cohesion: 0.27
Nodes (10): capText(), createControl(), applyHosts(), closePage(), page(), start(), fs, originOf() (+2 more)

### Community 174 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Design, Order and dependencies, Proposing, approving, stopping, Risks, Spec: Show the CFactory board in the call, The constraint that shapes it, The viewer page (in the desktop image) (+2 more)

### Community 175 - "share-desktop.test.js"
Cohesion: 0.24
Nodes (7): createShareDesktop(), schedule(), stopPolling(), assert, { createShareDesktop }, setup(), test

### Community 178 - "Spec: Phase 0, the Linux call test"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Context for later phases (not decided here), Decisions on the intent's Phase 0 questions, Design, Goal, Pass / fail, Risks, Spec: Phase 0, the Linux call test (+1 more)

### Community 179 - "Intent: A face for the bot that talks when it speaks"
Cohesion: 0.22
Nodes (8): Affected users and systems, Constraints, Decisions (owner, 2026-11-17), Intent: A face for the bot that talks when it speaks, Open questions, Problem, Proposed outcome (first slice), Source of the portraits

### Community 180 - "makeTable"
Cohesion: 0.67
Nodes (3): crc32(), makeTable(), read_buf()

### Community 181 - "Standalone mode S1: end-to-end results (#2 step 10)"
Cohesion: 0.20
Nodes (8): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass**

### Community 183 - "ready"
Cohesion: 0.11
Nodes (16): Affected users and systems, Constraints, Decisions at approval (owner, 2026-11-17), Intent: Meeting agent Phase 3, act on the Factories from the call, Not in this slice, Open questions, Problem, Proposed outcome (+8 more)

### Community 184 - "Intent: Show the Factories in the call"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-17), Intent: Show the Factories in the call, Open questions, Problem, Proposed outcome

### Community 185 - "Intent: Meeting agent Phase 1b, a voice standup in Google Meet"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions at approval (owner, 2026-11-17), Intent: Meeting agent Phase 1b, a voice standup in Google Meet, Open questions, Problem, Proposed outcome

### Community 186 - "Intent: Review and control the Factories from the standup and the bot"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-23: "approved"), Intent: Review and control the Factories from the standup and the bot, Open questions, Problem, Proposed outcome

### Community 187 - "fill_window"
Cohesion: 0.43
Nodes (8): deflate_fast(), deflate_huff(), deflate_rle(), deflate_slow(), deflate_stored(), fill_window(), flush_block_only(), longest_match()

### Community 188 - "core/test/actions.test.js"
Cohesion: 0.16
Nodes (13): assert, card, context, { deriveEffects, describe }, { makeRedactor }, ok(), proposal(), refused() (+5 more)

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

### Community 195 - "speak"
Cohesion: 0.26
Nodes (11): heard(), join(), Decisions carried over from the approved spec and intent, Deviations from the spec (approved with this plan), Plan: Phase 1b, a voice standup in Google Meet, Rollback, Steps, Tests (+3 more)

### Community 196 - "Approved decisions (copied from the spec, so this plan stands alone)"
Cohesion: 0.33
Nodes (5): Approved decisions (copied from the spec, so this plan stands alone), Plan: Review and standup from the board (#28, slice 1), Roles, Rollback, Tests

### Community 197 - "RFactory"
Cohesion: 0.40
Nodes (4): Licence, RFactory, Roles, Standup and review

### Community 200 - "Avatar portraits"
Cohesion: 0.50
Nodes (3): Avatar portraits, Changes, Provenance

## Knowledge Gaps
- **32 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+27 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1373 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Websock` connect `Websock` to `core rfb.js`, `core RFB`, `core .rQwait()`, `core Websock`, `util logging.js`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `createLifecycle()` (e.g. with `lifecycle.js` and `action()`) actually correct?**
  _`createLifecycle()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _32 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `Steps` to `src gateway.js`, `toModel`, `Profiles`, `core Websock`, `rfactory-standup.js`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Should `runner k8s-policy.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0603921568627451 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `Steps` to `Plan: A face for the bot that talks when it speaks`, `desktop createSessions()`, `test cfactory-write.test.js`, `cancel`, `bot run()`, `util Cursor`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._