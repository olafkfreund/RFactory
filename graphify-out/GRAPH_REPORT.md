# Graph Report - 18-int  (2026-11-25)

## Corpus Check
- 286 files · ~397,364 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 20 file(s) not represented in the graph (top: (none) 9, .nix 6, .css 4)

## Summary
- 3190 nodes · 5783 edges · 213 communities (175 shown, 38 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 720 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1d935f3e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- verify lib.sh
- k8s-policy.js
- Display
- test/call.test.js
- public app.js
- guard.test.js
- zlib deflate.js
- createLifecycle
- control.js
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
- cli.test.js
- test server.test.js
- test brain.test.js
- test avatar-state.test.js
- Profiles
- vnc.test.js
- crypto des.js
- Websock
- rfactory-standup.js
- ref_node_http
- web server.js
- input GestureHandler
- util browser.js
- test claude-cli.test.js
- gateway.test.js
- tts.test.js
- runner client.test.js
- core RSAAESAuthenticationState
- createCallManager
- stt-bridge.test.js
- H264Decoder
- cfactory-write.test.js
- kyverno-scope.test.js
- verify verify.test.js
- desktop-routes.js
- decoders TightDecoder
- web/call.js
- kubevirt.test.js
- verify net.sh
- verify profiles.sh
- Websock
- investigations.test.js
- spike hello-call.test.js
- crypto crypto.js
- util.js
- createInvestigationManager
- @rfactory/core
- createProxy
- runner protocol.js
- logging.js
- crypto u8ArrayToBigInt()
- proxy.js
- util Cursor
- avatars points
- viewer/board.test.js
- vm-call.test.js
- reaper reaper.test.js
- review.js
- makeRedactor
- ref_node_assert
- test cfactory.test.js
- agent/call.test.js
- proxy.test.js
- core ._handleMouse()
- bot bot/package.json
- Design
- avatar-renderer.test.js
- runner k8s-lifecycle.test.js
- web live-view.test.js
- crypto md5.js
- inflator.js
- actions-record.test.js
- Design
- spike spike/package.json
- lifecycle.js
- test run.test.js
- createShareManager
- cancel
- encode
- share.test.js
- bot run()
- avatars eyes
- ref_node_path
- test test/board.test.js
- desktop desktop/package.json
- k8s.test.js
- web web/package.json
- action
- ref_node_os
- desktop-routes.test.js
- roles.test.js
- Design
- k3d k14-env.sh
- verify handover.sh
- heard
- protocol.test.js
- Spec: the bot hears the call itself (its own speech-to-text)
- verify lifecycle.sh
- decoders ZRLEDecoder
- desktop.test.js
- avatars portraits
- k3d gate.sh
- desktop.test.js
- crypto LegacyCrypto
- crypto RSACipher
- shell-browser.test.js
- avatars.test.js
- core/test/actions.test.js
- boundary.test.js
- createActionManager
- avatars mesh
- avatars move
- Steps
- pod.test.js
- verify e2e.sh
- index.js
- k3d k11.sh
- k3d mk-tls.sh
- cfactory-write.js
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
- Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains)
- RFactory
- mapCard
- Desktop VMs on the k3d factory cluster
- Plan: an approved, read-only Claude investigation from the call (RFactory side)
- standup.test.js
- join
- Design
- Socket
- teams-tap-spike.js
- Design
- effects.js
- Phase 0 results: can a guest bot join Google Meet, speak and read captions?
- Intent: run a Claude terminal from the call, and show it
- running
- share-desktop.test.js
- Intent: run RFactory in the factory cluster like the other Factory services
- Approved decisions (copied from the spec, so this plan stands alone)
- Spec: Phase 0, the Linux call test
- Intent: A face for the bot that talks when it speaks
- Keyboard
- makeTable
- speak
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
- HextileDecoder
- stt.test.js
- createRecord
- theme.js
- Avatar portraits
- CLAUDE.md
- .claude/CLAUDE.md
- check-image-stt.sh
- SHELL_INVENTORY.md
- source-guard.test.js
- bootstrap-secrets.sh
- hearing.test.js
- assert-signature-location.sh
- JPEGDecoder
- createCfactorySource
- events.js

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `createLifecycle()` - 45 edges
3. `createInvestigationManager()` - 37 edges
4. `makeRedactor()` - 33 edges
5. `Display` - 32 edges
6. `Websock` - 32 edges
7. `checkFacts()` - 28 edges
8. `createCallManager()` - 26 edges
9. `portraits` - 23 edges
10. `run()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Claude login: the shared `factory-cli-creds`, like CFactory` --references--> `checkClaudeHome()`  [INFERRED]
  spec/2026-11-24-33-rfactory-in-cluster.md → core/src/brains/destination.js
- `Verification` --references--> `heard()`  [INFERRED]
  spec/2026-11-21-16-own-speech-to-text.md → core/src/call/hearing.js
- `Source offer to every remote user (AGPL §13)` --references--> `origin()`  [INFERRED]
  spec/2026-11-17-13-talking-avatar.md → core/src/desktop/session.js
- `Verification` --references--> `stopShare()`  [INFERRED]
  spec/2026-11-17-3-agent-workspace.md → core/src/desktop/session.js
- `Decisions carried over from the approved spec` --references--> `checkFacts()`  [INFERRED]
  plan/2026-11-17-5-phase-1a-text-standup.md → core/src/facts.js

## Import Cycles
- None detected.

## Communities (213 total, 38 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "k8s-policy.js"
Cohesion: 0.05
Nodes (45): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+37 more)

### Community 3 - "test/call.test.js"
Cohesion: 0.11
Nodes (16): assert, { createCallManager }, { createInvestigationManager }, { EventEmitter }, fakeActions(), a, fakeClock(), finishSpeech() (+8 more)

### Community 4 - "public app.js"
Cohesion: 0.07
Nodes (50): ago(), clear(), clock(), day(), decide(), decideInvestigation(), decideShare(), el() (+42 more)

### Community 5 - "guard.test.js"
Cohesion: 0.05
Nodes (52): binding(), cidrFamily(), command(), createApi(), get(), createGuard(), apply(), counters() (+44 more)

### Community 6 - "zlib deflate.js"
Cohesion: 0.08
Nodes (39): deflate(), deflate_fast(), deflate_huff(), deflate_rle(), deflate_slow(), deflate_stored(), deflateEnd(), deflateInit() (+31 more)

### Community 7 - "createLifecycle"
Cohesion: 0.16
Nodes (21): createLifecycle(), accept(), allowAccept(), attachAgent(), boot(), cancelNow(), check(), cleanup() (+13 more)

### Community 8 - "control.js"
Cohesion: 0.27
Nodes (10): capText(), createControl(), applyHosts(), closePage(), page(), start(), fs, originOf() (+2 more)

### Community 9 - "core rfb.js"
Cohesion: 0.07
Nodes (18): CopyRectDecoder, RawDecoder, RREDecoder, ZlibDecoder, Deflator, encodings, _buildExtendedClipboardFlags(), clientCutText() (+10 more)

### Community 10 - "core RFB"
Cohesion: 0.06
Nodes (4): clientEncodings(), keyEvent(), RFB, xvpOp()

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.09
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "k14 results: agent workspace desktops on k3d with KubeVirt"
Cohesion: 0.13
Nodes (13): After k14 (2026-11-19), Checks, Evidence, Images under test, k14 results: agent workspace desktops on k3d with KubeVirt, Manual capacity checks (real desktops), Measurements, Open findings (+5 more)

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
Cohesion: 0.05
Nodes (39): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+31 more)

### Community 18 - "runner runner.js"
Cohesion: 0.09
Nodes (27): clearInterval(), { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade(), crypto (+19 more)

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
Cohesion: 0.05
Nodes (36): refused(), name(), Profiles, admin, assert, fakeK8s(), fixture(), fs (+28 more)

### Community 24 - "vnc.test.js"
Cohesion: 0.12
Nodes (19): bridgeViewOnly(), createFilter(), assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session (+11 more)

### Community 25 - "crypto des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 27 - "rfactory-standup.js"
Cohesion: 0.10
Nodes (28): { checkFacts }, count(), fs, main(), path, { setup }, ageOf(), approveClaude() (+20 more)

### Community 28 - "ref_node_http"
Cohesion: 0.29
Nodes (3): http, [portA, portB], state

### Community 29 - "web server.js"
Cohesion: 0.13
Nodes (21): { buildStandup, speakStandupHeadline }, createApp(), DESKTOP_STATIC, fs, HEADERS, http, keepAlive(), main() (+13 more)

### Community 31 - "util browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

### Community 32 - "test claude-cli.test.js"
Cohesion: 0.08
Nodes (33): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, createClaudeBrain(), checkDestination(), propose(), run() (+25 more)

### Community 33 - "gateway.test.js"
Cohesion: 0.12
Nodes (11): assert, base, { createGateway }, fs, gateway(), { loadScope }, { makeRedactor }, os (+3 more)

### Community 34 - "tts.test.js"
Cohesion: 0.12
Nodes (17): Deviations, after(), assert, { createTts }, { EventEmitter }, fs, os, { PassThrough } (+9 more)

### Community 35 - "runner client.test.js"
Cohesion: 0.08
Nodes (21): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+13 more)

### Community 36 - "core RSAAESAuthenticationState"
Cohesion: 0.13
Nodes (3): RA2Cipher, RSAAESAuthenticationState, EventTargetMixin

### Community 37 - "createCallManager"
Cohesion: 0.27
Nodes (19): createCallManager(), addressed(), answer(), armQuiet(), audio(), drain(), incoming(), killGroup() (+11 more)

### Community 38 - "stt-bridge.test.js"
Cohesion: 0.10
Nodes (8): installSttBridge(), assert, fs, { installSttBridge }, path, setup(), test, vm

### Community 39 - "H264Decoder"
Cohesion: 0.16
Nodes (3): H264Context, H264Decoder, H264Parser

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
Cohesion: 0.18
Nodes (18): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+10 more)

### Community 45 - "web/call.js"
Cohesion: 0.11
Nodes (16): source, commit, path, repo, BOT_CMD, { buildStandup, speakStandupHeadline }, { checkFacts }, { createHearing } (+8 more)

### Community 46 - "kubevirt.test.js"
Cohesion: 0.14
Nodes (11): assert, { createAgent }, { createCallWorker }, { createControl }, { dial }, { encode, createDecoder }, net, { parseCmdline } (+3 more)

### Community 47 - "verify net.sh"
Cohesion: 0.16
Nodes (17): BP, connect(), deadline_left(), hello(), mk_target(), mkp(), NIP, node_ip() (+9 more)

### Community 48 - "verify profiles.sh"
Cohesion: 0.23
Nodes (18): app_restore(), app_sync(), argo_app(), attach(), ciphertext(), cm_field(), errmatch(), extra_cleanup() (+10 more)

### Community 50 - "investigations.test.js"
Cohesion: 0.14
Nodes (18): approve(), assert, { createInvestigationManager }, { createRecord }, fs, { loadRoles }, { makeRedactor }, os (+10 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.08
Nodes (19): { buildRendererSource }, crypto, fs, { installSttBridge }, { makeRedactor }, os, path, { SpeechGate } (+11 more)

### Community 53 - "util.js"
Cohesion: 0.15
Nodes (5): DOMKeyTable, codepoints, getKey(), getKeycode(), getKeysym()

### Community 54 - "createInvestigationManager"
Cohesion: 0.13
Nodes (41): count(), createInvestigationManager(), announce(), approve(), clearLiveTimers(), closeLog(), endCall(), expire() (+33 more)

### Community 55 - "@rfactory/core"
Cohesion: 0.13
Nodes (12): @rfactory/core, { deriveEffects, describe }, FINAL, { randomUUID }, { validate, hashPayload, canonical }, approve(), assert, { createActionManager } (+4 more)

### Community 56 - "createProxy"
Cohesion: 0.24
Nodes (18): checkedAddresses(), get(), createProxy(), addresses(), answerDns(), entryFor(), handleConnect(), handleForward() (+10 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.18
Nodes (18): onAgentMessage(), onMessage(), board(), boolean(), columns, count(), exact(), identity (+10 more)

### Community 58 - "logging.js"
Cohesion: 0.12
Nodes (4): toSigned32bit(), DataChannel, rawChannelProps, ReadyStates

### Community 59 - "crypto u8ArrayToBigInt()"
Cohesion: 0.24
Nodes (5): bigIntToU8Array(), modPow(), u8ArrayToBigInt(), DHCipher, DHPublicKey

### Community 60 - "proxy.js"
Cohesion: 0.17
Nodes (14): addressBits(), BASE_PROTECTED, crypto, dgram, dnsReply(), fs, http, inRange() (+6 more)

### Community 62 - "avatars points"
Cohesion: 0.12
Nodes (16): points, C, JL, JR, LB, LL, LM, LR (+8 more)

### Community 63 - "viewer/board.test.js"
Cohesion: 0.19
Nodes (11): assert, board(), browser, column(), open(), { test }, { viewerRoute, URL_BOARD }, fs (+3 more)

### Community 64 - "vm-call.test.js"
Cohesion: 0.18
Nodes (10): assert, { createVmSpawn }, { Duplex }, { test }, createVmSpawn(), { EventEmitter }, firstLine(), { PassThrough } (+2 more)

### Community 65 - "reaper reaper.test.js"
Cohesion: 0.12
Nodes (16): createReaper(), leaseStale(), tick(), fs, main(), assert, { createReaper }, fake() (+8 more)

### Community 66 - "review.js"
Cohesion: 0.15
Nodes (17): discussionNote(), { FAILED }, issueUrl(), NOT_IN_CARD_DATA, reviewCard(), reviewProject(), stageRun(), STAGES (+9 more)

### Community 67 - "makeRedactor"
Cohesion: 0.13
Nodes (21): tools(), makeRedactor(), logSafeWindow(), redactString(), toModel(), PATTERNS, loadScope(), assert (+13 more)

### Community 68 - "ref_node_assert"
Cohesion: 0.08
Nodes (21): toSpeech(), assert, checked(), { checkFacts }, snapshot, test, assert, fs (+13 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.12
Nodes (7): assert, callTool(), cards, { createCfactorySource, mapCard, inScope }, reply(), repos, test

### Community 70 - "agent/call.test.js"
Cohesion: 0.16
Nodes (9): createCallWorker(), { createShare, callLaunchArgs }, { PassThrough }, assert, { createCallWorker, withProxy, TEAMS_CAPTIONS }, { EventEmitter }, fixture(), { test } (+1 more)

### Community 71 - "proxy.test.js"
Cohesion: 0.11
Nodes (12): createApi(), assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard (+4 more)

### Community 72 - "core ._handleMouse()"
Cohesion: 0.25
Nodes (3): extendedPointerEvent(), pointerEvent(), clientToElement()

### Community 73 - "bot bot/package.json"
Cohesion: 0.14
Nodes (13): dependencies, playwright-core, @vibeconferencing/calls, engines, node, playwright-core, @vibeconferencing/calls, license (+5 more)

### Community 74 - "Design"
Cohesion: 0.13
Nodes (14): Alternatives rejected, Claude login: the shared `factory-cli-creds`, like CFactory, Design, Images: built, signed and promoted by CI, like CFactory, One pod, as today, Order and cutover, Owner decisions (proposed defaults), Pod security (+6 more)

### Community 75 - "avatar-renderer.test.js"
Cohesion: 0.09
Nodes (18): idle(), assert, { buildRendererSource }, { chromium }, fs, path, setCameraRenderer(), speechLevel() (+10 more)

### Community 76 - "runner k8s-lifecycle.test.js"
Cohesion: 0.19
Nodes (9): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+1 more)

### Community 77 - "web live-view.test.js"
Cohesion: 0.15
Nodes (11): assert, client(), clientSession, { createApp }, fbUpdate, includes(), { loadRoles }, net (+3 more)

### Community 78 - "crypto md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 79 - "inflator.js"
Cohesion: 0.36
Nodes (4): Z_DEFAULT_COMPRESSION, Z_FULL_FLUSH, inflateInit(), ZStream()

### Community 80 - "actions-record.test.js"
Cohesion: 0.20
Nodes (8): assert, { createRecord }, fs, { makeRedactor }, os, path, setup(), test

### Community 81 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Design, Exposure, Facts this rests on (checked on p620, 2026-11-18), Lifecycle, Live view, Profiles, Risks (+4 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 83 - "lifecycle.js"
Cohesion: 0.22
Nodes (6): { buildPolicy }, { createDecoder, tag, encode, LANGUAGE }, crypto, net, { nonce: newNonce }, { StringDecoder }

### Community 84 - "test run.test.js"
Cohesion: 0.15
Nodes (12): assert, audioJoined(), { EventEmitter }, fs, joined(), { PassThrough }, path, { run } (+4 more)

### Community 85 - "createShareManager"
Cohesion: 0.12
Nodes (32): createShareManager(), approve(), cleanup(), close(), emit(), endCall(), expire(), frameFor() (+24 more)

### Community 86 - "cancel"
Cohesion: 0.29
Nodes (6): Facts checked in the real repos, Open questions for the owner, Plan: Agent workspace, a disposable desktop per call (#3), Prerequisites (named revisions), Rollback, Tests

### Community 87 - "encode"
Cohesion: 0.18
Nodes (14): nonce(), callAttach(), login(), sendCallConfig(), shareStart(), shareStop(), sharing(), toGuest() (+6 more)

### Community 88 - "share.test.js"
Cohesion: 0.13
Nodes (20): callLaunchArgs(), createShare(), capture(), matches(), start(), stop(), tabGone(), teardown() (+12 more)

### Community 89 - "bot run()"
Cohesion: 0.19
Nodes (22): buildRendererSource(), pageLeft(), run(), afterJoin(), discardOpen(), idleAvatar(), leftConfirmed(), newGate() (+14 more)

### Community 90 - "avatars eyes"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 91 - "ref_node_path"
Cohesion: 0.10
Nodes (17): DESTINATIONS, fs, LISTEN, { makeRedactor }, path, resolveListen(), { toWhisperLanguage }, assert (+9 more)

### Community 92 - "test test/board.test.js"
Cohesion: 0.13
Nodes (15): COLUMNS, projectBoard(), { repositoryOf }, STAGES, assert, callTool(), card(), { createCfactorySource } (+7 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "k8s.test.js"
Cohesion: 0.15
Nodes (10): createK8s(), fs, assert, { createK8s }, fs, http, { inClusterConfig }, os (+2 more)

### Community 95 - "web web/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @rfactory/core, devDependencies, playwright-core, engines, node, playwright-core, license (+5 more)

### Community 96 - "action"
Cohesion: 0.17
Nodes (11): action(), 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue), 2. CFactory: an `investigate` action (CFactory repository, its own issue), 3. RFactory: hearing, approval, the shared log, the spoken result, Alternatives rejected, Design, Findings this design rests on (checked 2026-11-19), Order and dependencies (+3 more)

### Community 97 - "ref_node_os"
Cohesion: 0.21
Nodes (7): createProfile(), readHead(), assert, { createProfile }, KEY, setup(), { test }

### Community 98 - "desktop-routes.test.js"
Cohesion: 0.18
Nodes (9): assert, { createApp }, { createDesktop }, grant, { loadRoles }, { makeRedactor }, open, roles (+1 more)

### Community 99 - "roles.test.js"
Cohesion: 0.19
Nodes (10): loadRoles(), has(), rolesOf(), Decisions carried over from the approved spec, Decisions for this plan, Deviations, Plan: v1 roles in code (admin, approver, member), slice "roles" of #2, Rollback (+2 more)

### Community 100 - "Design"
Cohesion: 0.18
Nodes (10): Alternatives rejected, Design, Hearing: wake phrase and end of a question, Packaging, Risks, Spec: Phase 1b, a voice standup in Google Meet, Speech (TTS), Verification (+2 more)

### Community 101 - "k3d k14-env.sh"
Cohesion: 0.44
Nodes (9): app_sync(), argo(), desktops(), env_of(), kc(), kubectl(), runner_restart(), k14-env.sh script (+1 more)

### Community 102 - "verify handover.sh"
Cohesion: 0.42
Nodes (8): fixture_reached(), hits(), open_page(), page_loaded(), session_of(), handover.sh script, trap_page(), wait_attached()

### Community 103 - "heard"
Cohesion: 0.12
Nodes (18): event(), heard(), exec(), Captions vs own transcription, Affected users and systems, Constraints, Decisions (owner, 2026-11-21: "approved"), Intent: the bot hears the call itself (its own speech-to-text) (+10 more)

### Community 104 - "protocol.test.js"
Cohesion: 0.18
Nodes (7): assert, fs, { MAX, encode, createDecoder, tag }, net, os, path, { test }

### Community 105 - "Spec: the bot hears the call itself (its own speech-to-text)"
Cohesion: 0.15
Nodes (12): 1. The service: `rfactory-stt`, 2. In the bot (`bot/run.js`, both deployments): cut speech, send segments, 3. In the call manager (`web/call.js`): transcribe and hear, 4. The listen setting, 5. Packaging and deploy, Alternatives rejected, Design, Measured on p620 (2026-11-21) (+4 more)

### Community 106 - "verify lifecycle.sh"
Cohesion: 0.42
Nodes (7): case_hold(), egress_cut(), fresh(), hold(), settled(), lifecycle.sh script, watch_end()

### Community 108 - "desktop.test.js"
Cohesion: 0.13
Nodes (20): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), origin() (+12 more)

### Community 109 - "avatars portraits"
Cohesion: 0.25
Nodes (8): anchors, file, sha256, file, sha256, portraits, f01, f09

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "desktop.test.js"
Cohesion: 0.09
Nodes (25): CLAIM, COUNT, { summarise }, WORDS, DESKTOP, { mapGithub, summarise, STATES }, NAMES, { origin } (+17 more)

### Community 114 - "shell-browser.test.js"
Cohesion: 0.20
Nodes (6): assert, { chromium }, { createApp }, { loadRoles }, { spawnSync }, test

### Community 115 - "avatars.test.js"
Cohesion: 0.20
Nodes (8): assert, crypto, dir, fs, ids, manifest, path, test

### Community 116 - "core/test/actions.test.js"
Cohesion: 0.22
Nodes (9): assert, card, context, { deriveEffects, describe }, { makeRedactor }, ok(), proposal(), test (+1 more)

### Community 117 - "boundary.test.js"
Cohesion: 0.10
Nodes (14): card(), assert, callTool(), { createApp, recordBrain }, { createCallManager }, { createCfactorySource }, { EventEmitter }, fs (+6 more)

### Community 118 - "createActionManager"
Cohesion: 0.36
Nodes (14): Steps, createActionManager(), approve(), emit(), endCall(), expire(), finish(), list() (+6 more)

### Community 119 - "avatars mesh"
Cohesion: 0.33
Nodes (6): mesh, anchors, file, sha256, triangles, f17

### Community 120 - "avatars move"
Cohesion: 0.33
Nodes (6): move, C, JL, JR, LB, LM

### Community 121 - "Steps"
Cohesion: 0.31
Nodes (7): { Client }, scopedCards(), inScope(), repositoryOf(), STATE, { StreamableHTTPClientTransport }, Steps

### Community 122 - "pod.test.js"
Cohesion: 0.22
Nodes (7): assert, fs, os, path, realPod, { spawnSync }, test

### Community 123 - "verify e2e.sh"
Cohesion: 0.53
Nodes (4): real_ids(), e2e.sh script, teams_call(), WEB_MAX

### Community 124 - "index.js"
Cohesion: 0.09
Nodes (24): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+16 more)

### Community 125 - "k3d k11.sh"
Cohesion: 0.50
Nodes (4): env_of(), RFACTORY_DESKTOP, RFACTORY_RUNNER_URL, k11.sh script

### Community 126 - "k3d mk-tls.sh"
Cohesion: 0.70
Nodes (4): FILES, key(), leaf(), mk-tls.sh script

### Community 127 - "cfactory-write.js"
Cohesion: 0.25
Nodes (7): { Client }, { deriveEffects }, fs, { makeRedactor }, STAGES, { StreamableHTTPClientTransport }, TOOLS

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

### Community 160 - "Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains)"
Cohesion: 0.29
Nodes (5): Decisions carried over from the approved spec, Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains), Recorded GitHub inventory (pinned 1.14.0, captured 2026-11-17), Rollback, Tests

### Community 161 - "RFactory"
Cohesion: 0.14
Nodes (12): How the bot hears, Language, `listen` values and the per-platform `auto` rule, Privacy, Rollback, When own transcription is not configured, Deployment, How the bot hears (+4 more)

### Community 162 - "mapCard"
Cohesion: 0.15
Nodes (13): mapCard(), 10. Intent constraints carried into slice 1, 1. Data comes from four CFactory read tools, all on the existing read key, 2. Scope: one rule, used everywhere, 3. Failure and freshness, 4. `core/src/standup.js` (new, pure): `buildStandup(cards, freshness)`, 6. Review (`core/src/review.js`, new, pure), 8. `core/src/sources/cfactory.js` (+5 more)

### Community 163 - "Desktop VMs on the k3d factory cluster"
Cohesion: 0.15
Nodes (12): 1. Prerequisites, 2. TLS: `mk-tls.sh`, 3. Images: `import-images.sh`, 4. Before the first sync: `prep.sh`, 5. The ArgoCD app, 6. The gate: `gate.sh`, 7. Desktops on: `k11.sh`, 8. Problems we hit (+4 more)

### Community 164 - "Plan: an approved, read-only Claude investigation from the call (RFactory side)"
Cohesion: 0.22
Nodes (8): hashPayload(), revalidate(), Decisions carried over (approved intent and spec), Gates, Plan: an approved, read-only Claude investigation from the call (RFactory side), Rollback, Steps, Tests

### Community 165 - "standup.test.js"
Cohesion: 0.21
Nodes (9): buildStandup(), { FAILED, mapCard }, speakStandupHeadline(), assert, build(), { buildStandup, speakStandupHeadline }, freshness(), { makeRedactor } (+1 more)

### Community 166 - "join"
Cohesion: 0.24
Nodes (9): join(), Decisions carried over from the approved spec, Deviations from the spec (approved with this plan), Plan: Phase 0, the Linux call test, Rollback, Steps, Tests, Pieces (+1 more)

### Community 167 - "Design"
Cohesion: 0.14
Nodes (13): AI disclosure, Alternatives rejected, Cost, Design, Evidence this spec rests on, Licence (owner decision 2: the whole repository is AGPL-3.0), Packaging, Portraits and notices (+5 more)

### Community 169 - "teams-tap-spike.js"
Cohesion: 0.29
Nodes (6): child, [repo, stt], segs, { spawn }, transcribe(), wav()

### Community 170 - "Design"
Cohesion: 0.15
Nodes (12): Alternatives rejected, Answers to the intent's open questions, Design, Feasibility gate (first plan step), Lifecycle and disposal, Live view, Network, Persistent profiles (+4 more)

### Community 171 - "effects.js"
Cohesion: 0.32
Nodes (7): deriveEffects(), describe(), SERVICE, STAGE, stageFor(), stateOf(), WRITES

### Community 172 - "Phase 0 results: can a guest bot join Google Meet, speak and read captions?"
Cohesion: 0.25
Nodes (6): Findings, Not done, Phase 0 results: can a guest bot join Google Meet, speak and read captions?, Run 2 (Chrome) against the pass criteria, Runs, Verdict: **pass**

### Community 173 - "Intent: run a Claude terminal from the call, and show it"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decisions (owner, 2026-11-19), Intent: run a Claude terminal from the call, and show it, Open questions, Problem, Proposed outcome

### Community 174 - "running"
Cohesion: 0.11
Nodes (17): Decisions carried over (approved intent and spec), Gates, Plan: Show the CFactory board in the call, Rollback, Tests, Alternatives rejected, Design, Order and dependencies (+9 more)

### Community 175 - "share-desktop.test.js"
Cohesion: 0.24
Nodes (7): createShareDesktop(), schedule(), stopPolling(), assert, { createShareDesktop }, setup(), test

### Community 176 - "Intent: run RFactory in the factory cluster like the other Factory services"
Cohesion: 0.25
Nodes (7): Affected users and systems, Constraints, Decided, Intent: run RFactory in the factory cluster like the other Factory services, Open questions, Problem, Proposed outcome

### Community 177 - "Approved decisions (copied from the spec, so this plan stands alone)"
Cohesion: 0.33
Nodes (5): Approved decisions (copied from the spec, so this plan stands alone), Plan: Review and standup from the board (#28, slice 1), Roles, Rollback, Tests

### Community 178 - "Spec: Phase 0, the Linux call test"
Cohesion: 0.20
Nodes (9): Alternatives rejected, Context for later phases (not decided here), Decisions on the intent's Phase 0 questions, Design, Goal, Pass / fail, Risks, Spec: Phase 0, the Linux call test (+1 more)

### Community 179 - "Intent: A face for the bot that talks when it speaks"
Cohesion: 0.22
Nodes (8): Affected users and systems, Constraints, Decisions (owner, 2026-11-17), Intent: A face for the bot that talks when it speaks, Open questions, Problem, Proposed outcome (first slice), Source of the portraits

### Community 181 - "makeTable"
Cohesion: 0.67
Nodes (3): crc32(), makeTable(), read_buf()

### Community 182 - "speak"
Cohesion: 0.19
Nodes (18): label(), stopShare(), cancel(), hosts(), Decisions carried over from the approved spec, Deviations from the spec (for approval with this plan), Steps, Decisions carried over from the approved spec and intent (+10 more)

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
Cohesion: 0.10
Nodes (23): 1. Isolation (D11, D13), 2. Standup (exit 0, 4.6 s), 3. Ask (exit 0, 5.3 s), 4. Bench (exit 0, 1 m 16 s), Found by the runs and fixed before the run above, Setup, Standalone mode S1: end-to-end results (#2 step 10), Verdict: **pass** (+15 more)

### Community 195 - "stt-languages.test.js"
Cohesion: 0.38
Nodes (5): toWhisperLanguage(), WHISPER_LANGUAGES, assert, test, { WHISPER_LANGUAGES, toWhisperLanguage }

### Community 197 - "stt.test.js"
Cohesion: 0.12
Nodes (12): Environment and scope reference, Per-call worker environment variables (set internally), Scope fields (`RFACTORY_SCOPE_FILE`), Web server environment variables, createStt(), fs, assert, { createStt } (+4 more)

### Community 198 - "createRecord"
Cohesion: 0.36
Nodes (9): Waves, Steps, createRecord(), files(), lastEntries(), prune(), unfinished(), unfinishedInvestigations() (+1 more)

### Community 199 - "theme.js"
Cohesion: 0.67
Nodes (3): applyTheme(), dark, observer

### Community 200 - "Avatar portraits"
Cohesion: 0.50
Nodes (3): Avatar portraits, Changes, Provenance

### Community 206 - "source-guard.test.js"
Cohesion: 0.10
Nodes (18): Alternatives rejected, Brains, Design, Risks, Scopes, roles, credentials, Shape, Slices, Source adapters (+10 more)

### Community 207 - "bootstrap-secrets.sh"
Cohesion: 0.83
Nodes (3): env_of(), bootstrap-secrets.sh script, write_secret()

### Community 208 - "hearing.test.js"
Cohesion: 0.36
Nodes (6): createHearing(), assert, { createHearing }, fakeClock(), setup(), test

### Community 211 - "createCfactorySource"
Cohesion: 0.48
Nodes (7): createCfactorySource(), call(), comments(), connect(), freshness(), within(), src()

### Community 213 - "events.js"
Cohesion: 0.48
Nodes (5): _capturedElemChanged(), _captureObserver, _captureProxy(), releaseCapture(), setCapture()

## Knowledge Gaps
- **35 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+30 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1539 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Websock` connect `Websock` to `logging.js`, `core rfb.js`, `core RFB`, `core .rQwait()`, `Websock`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `createLifecycle()` (e.g. with `lifecycle.js` and `action()`) actually correct?**
  _`createLifecycle()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _35 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `Steps` connect `desktop.test.js` to `Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains)`, `checkFacts`, `makeRedactor`, `test brain.test.js`, `speak`, `Profiles`, `Websock`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Should `k8s-policy.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05454545454545454 - nodes in this community are weakly interconnected._
- **Why does `Display` connect `Display` to `core rfb.js`, `logging.js`, `Websock`, `createShareManager`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._