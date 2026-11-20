# Graph Report - graph-RFactory  (2026-11-20)

## Corpus Check
- 414 files · ~329,115 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: (none) 8, .nix 6, .css 3)

## Summary
- 2453 nodes · 4518 edges · 160 communities (130 shown, 30 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 373 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- verify lib.sh
- runner k8s-policy.js
- core Display
- test test/call.test.js
- public app.js
- guard guard.test.js
- zlib deflate.js
- runner createLifecycle()
- agent index.js
- core rfb.js
- core RFB
- test desktop-ui.test.js
- web createShareManager()
- zlib inflate.js
- runner runner.test.js
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
- core ._negotiateServerInit()
- bin rfactory-standup.js
- test cli.test.js
- web server.js
- input GestureHandler
- util browser.js
- test claude-cli.test.js
- src gateway.js
- agent agent.test.js
- runner client.test.js
- core RSAAESAuthenticationState
- ref_node_path
- test scope.test.js
- bench ollama-standup.js
- test cfactory-write.test.js
- runner kyverno-scope.test.js
- verify verify.test.js
- web desktop-routes.js
- decoders TightDecoder
- proxy createProxy()
- runner Profiles
- verify net.sh
- verify profiles.sh
- test tts.test.js
- runner profiles.test.js
- spike hello-call.test.js
- crypto crypto.js
- input util.js
- core Websock
- proxy proxy.js
- proxy proxy.test.js
- runner protocol.js
- util logging.js
- crypto u8ArrayToBigInt()
- core .constructor()
- util Cursor
- avatars points
- sinks cfactory-write.js
- test desktop.test.js
- reaper reaper.test.js
- ref_node_stream
- core ._updateClip()
- ref_node_test
- test cfactory.test.js
- agent agent/call.test.js
- ref_node_fs
- core ._handleMouse()
- bot bot/package.json
- test gateway.test.js
- viewer viewer/board.test.js
- runner k8s-lifecycle.test.js
- web live-view.test.js
- crypto md5.js
- core inflator.js
- test avatar-renderer.test.js
- ref_node_assert
- spike spike/package.json
- input Keyboard
- test run.test.js
- core core/package.json
- brains claude-cli.js
- ref_node_os
- agent share.test.js
- bot run()
- avatars eyes
- bot run.js
- test test/board.test.js
- desktop desktop/package.json
- runner protocol.test.js
- web web/package.json
- test desktop-routes.test.js
- test source-guard.test.js
- test avatars.test.js
- desktop createSessions()
- src makeRedactor()
- k3d k14-env.sh
- verify handover.sh
- test hearing.test.js
- agent createShare()
- proxy Socket
- verify lifecycle.sh
- decoders ZRLEDecoder
- test pod.test.js
- avatars portraits
- k3d gate.sh
- runner lifecycle.js
- crypto LegacyCrypto
- crypto RSACipher
- share share/board.js
- ref_node_http
- verify main()
- core deflator.js
- util events.js
- avatars mesh
- avatars move
- sources cfactory.js
- test fake-github-mcp.js
- verify e2e.sh
- sources createCfactorySource()
- k3d k11.sh
- k3d mk-tls.sh
- agent share.js
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

## God Nodes (most connected - your core abstractions)
1. `RFB` - 103 edges
2. `createLifecycle()` - 45 edges
3. `Display` - 32 edges
4. `Websock` - 32 edges
5. `makeRedactor()` - 29 edges
6. `portraits` - 23 edges
7. `Profiles` - 23 edges
8. `GestureHandler` - 23 edges
9. `mesh` - 20 edges
10. `Cursor` - 19 edges

## Surprising Connections (you probably didn't know these)
- `teardown()` --indirect_call--> `stopShare()`  [INFERRED]
  desktop/guest/agent/share.js → core/src/desktop/session.js
- `list()` --indirect_call--> `safe()`  [INFERRED]
  web/actions.js → desktop/runner/protocol.js
- `run()` --calls--> `makeRedactor()`  [EXTRACTED]
  bot/run.js → core/src/redact.js
- `setup()` --calls--> `makeRedactor()`  [EXTRACTED]
  web/test/call.test.js → core/src/redact.js
- `shareCall()` --calls--> `makeRedactor()`  [EXTRACTED]
  web/test/call.test.js → core/src/redact.js

## Import Cycles
- None detected.

## Communities (160 total, 30 thin omitted)

### Community 0 - "verify lib.sh"
Cohesion: 0.07
Nodes (50): act(), admin(), api(), api_up(), approver(), as_pod_user(), ask(), beat() (+42 more)

### Community 1 - "runner k8s-policy.js"
Cohesion: 0.05
Nodes (46): crypto, FILE, fs, main(), net, parseCidrs(), path, refresh() (+38 more)

### Community 2 - "core Display"
Cohesion: 0.07
Nodes (5): H264Context, H264Decoder, H264Parser, Display, toSigned32bit()

### Community 3 - "test test/call.test.js"
Cohesion: 0.07
Nodes (40): BOT_CMD, { checkFacts }, createCallManager(), addressed(), answer(), drain(), incoming(), killGroup() (+32 more)

### Community 4 - "public app.js"
Cohesion: 0.08
Nodes (33): ago(), clock(), day(), decide(), decideShare(), el(), fill(), handleAction() (+25 more)

### Community 5 - "guard guard.test.js"
Cohesion: 0.08
Nodes (39): binding(), cidrFamily(), command(), createApi(), get(), createGuard(), apply(), counters() (+31 more)

### Community 6 - "zlib deflate.js"
Cohesion: 0.08
Nodes (38): deflate(), deflate_fast(), deflate_huff(), deflate_rle(), deflate_slow(), deflate_stored(), deflateEnd(), deflateInit2() (+30 more)

### Community 7 - "runner createLifecycle()"
Cohesion: 0.11
Nodes (35): createLifecycle(), accept(), action(), allowAccept(), attachAgent(), boot(), callAttach(), cancel() (+27 more)

### Community 8 - "agent index.js"
Cohesion: 0.08
Nodes (30): octets(), parseCmdline(), startHeartbeat(), createAgent(), run(), { createCallWorker }, { createControl }, { createProfile } (+22 more)

### Community 9 - "core rfb.js"
Cohesion: 0.08
Nodes (16): CopyRectDecoder, RawDecoder, RREDecoder, Deflator, encodings, _buildExtendedClipboardFlags(), clientCutText(), clientFence() (+8 more)

### Community 10 - "core RFB"
Cohesion: 0.07
Nodes (4): clientEncodings(), keyEvent(), RFB, xvpOp()

### Community 11 - "test desktop-ui.test.js"
Cohesion: 0.08
Nodes (21): API(), boot(), clear(), countdownText(), el(), post(), render(), renderProfiles() (+13 more)

### Community 12 - "web createShareManager()"
Cohesion: 0.12
Nodes (29): createShareManager(), approve(), cleanup(), emit(), endCall(), expire(), reject(), request() (+21 more)

### Community 13 - "zlib inflate.js"
Cohesion: 0.09
Nodes (22): adler32(), crc32(), makeTable(), read_buf(), inflate_fast(), fixedtables(), inflate(), inflateSetDictionary() (+14 more)

### Community 14 - "runner runner.test.js"
Cohesion: 0.08
Nodes (19): agentSetup(), assert, baseConfig(), { createHandler, createUpgrade, inClusterConfig, main }, { createLifecycle }, { createRunnerClient }, { encode: enc, createDecoder: dec, encode }, { EventEmitter } (+11 more)

### Community 16 - "zlib trees.js"
Cohesion: 0.16
Nodes (28): bi_flush(), bi_reverse(), bi_windup(), build_bl_tree(), build_tree(), compress_block(), copy_block(), d_code() (+20 more)

### Community 17 - "test github.test.js"
Cohesion: 0.09
Nodes (24): { Client }, connect(), call(), fetchScope(), getItem(), itemActivity(), paged(), { execFileSync } (+16 more)

### Community 18 - "runner runner.js"
Cohesion: 0.10
Nodes (25): { bridgeViewOnly }, clientStatus(), createHandler(), { createK8s }, { createLifecycle }, createUpgrade(), crypto, dgram (+17 more)

### Community 19 - "web createActionManager()"
Cohesion: 0.13
Nodes (24): createActionManager(), approve(), emit(), endCall(), expire(), finish(), list(), live() (+16 more)

### Community 20 - "test server.test.js"
Cohesion: 0.08
Nodes (20): assert, { claudeHash }, { createApp, makeLogin }, { createClaudeBrain }, { EventEmitter }, fakeBrain, fs, { handleCall } (+12 more)

### Community 21 - "test brain.test.js"
Cohesion: 0.11
Nodes (20): { createHash }, destinationHash(), fs, path, resolveDestination(), createBrain(), turn(), { destinationHash } (+12 more)

### Community 22 - "test avatar-state.test.js"
Cohesion: 0.11
Nodes (13): installAvatar(), draw(), portrait(), triangle(), { source }, stateFactory(), createState(), meshAt() (+5 more)

### Community 23 - "test core/test/actions.test.js"
Cohesion: 0.13
Nodes (22): ACTIONS, bounded(), canonical(), CREATE_STATUSES, { createHash }, criteria(), FIELDS, hashPayload() (+14 more)

### Community 24 - "runner vnc.test.js"
Cohesion: 0.12
Nodes (19): bridgeViewOnly(), createFilter(), assert, { createFilter, bridgeViewOnly }, { Duplex }, fbReq, run(), session (+11 more)

### Community 25 - "crypto des.js"
Cohesion: 0.09
Nodes (13): DES, DESCBCCipher, DESECBCipher, PC2, SP1, SP2, SP3, SP4 (+5 more)

### Community 26 - "core ._negotiateServerInit()"
Cohesion: 0.13
Nodes (3): fbUpdateRequest(), decodeUTF8(), encodeUTF8()

### Community 27 - "bin rfactory-standup.js"
Cohesion: 0.13
Nodes (22): ageOf(), causes(), { checkFacts }, { connect }, { createBrain }, { createCfactorySource }, { createClaudeBrain, ARGV: CLAUDE_ARGV }, { createGateway } (+14 more)

### Community 28 - "test cli.test.js"
Cohesion: 0.09
Nodes (15): assert, CLI, { destinationHash, claudeHash }, dir, env, { EventEmitter }, { execFile }, fs (+7 more)

### Community 29 - "web server.js"
Cohesion: 0.13
Nodes (22): @rfactory/core, BRAIN_CODES, codeOf(), composeWrites(), createApp(), standup(), DESKTOP_STATIC, fs (+14 more)

### Community 31 - "util browser.js"
Cohesion: 0.09
Nodes (5): dragThreshold, hasScrollbarGutter, isTouchDevice, supportsCursorURIs, supportsWebCodecsH264Decode

### Community 32 - "test claude-cli.test.js"
Cohesion: 0.13
Nodes (20): approveClaude(), createClaudeBrain(), propose(), run(), turn(), checkClaudeHome(), hasOverride(), claudeHash() (+12 more)

### Community 33 - "src gateway.js"
Cohesion: 0.12
Nodes (16): DESKTOP, { mapGithub, summarise, STATES }, NAMES, { origin }, SCHEMAS, FAIL, failing(), labelNames() (+8 more)

### Community 34 - "agent agent.test.js"
Cohesion: 0.12
Nodes (18): assert, browser, { createAgent }, { createProfile }, { encode }, http, { startHeartbeat }, { test, mock } (+10 more)

### Community 35 - "runner client.test.js"
Cohesion: 0.10
Nodes (16): createRunnerClient(), call(), fs, https, ROUTE_TIMEOUT_MS, assert, { createHandler, createUpgrade }, { createRunnerClient } (+8 more)

### Community 36 - "core RSAAESAuthenticationState"
Cohesion: 0.13
Nodes (3): RA2Cipher, RSAAESAuthenticationState, EventTargetMixin

### Community 37 - "ref_node_path"
Cohesion: 0.13
Nodes (16): createRecord(), files(), lastEntries(), prune(), unfinished(), unfinishedShares(), fs, path (+8 more)

### Community 38 - "test scope.test.js"
Cohesion: 0.12
Nodes (17): source, commit, path, repo, DESTINATIONS, fs, loadScope(), { makeRedactor } (+9 more)

### Community 39 - "bench ollama-standup.js"
Cohesion: 0.13
Nodes (16): { checkFacts }, count(), fs, main(), path, { setup }, checkFacts(), CLAIM (+8 more)

### Community 40 - "test cfactory-write.test.js"
Cohesion: 0.11
Nodes (17): createCfactoryWriter(), assert, bareBlocked, bareStarted, before, card, { createCfactoryWriter }, fs (+9 more)

### Community 41 - "runner kyverno-scope.test.js"
Cohesion: 0.14
Nodes (16): assert, dir, { firstHost }, fs, path, policies, probeCidrs(), test (+8 more)

### Community 42 - "verify verify.test.js"
Cohesion: 0.11
Nodes (16): join(), assert, beats(), CHECKS, fs, http, INPUT, { join } (+8 more)

### Community 43 - "web desktop-routes.js"
Cohesion: 0.17
Nodes (19): createDesktop(), handle(), request(), runnerState(), createDesktopQueue(), approve(), enqueue(), reject() (+11 more)

### Community 45 - "proxy createProxy()"
Cohesion: 0.22
Nodes (18): createApi(), get(), createProxy(), answerDns(), entryFor(), handleConnect(), handleForward(), serve() (+10 more)

### Community 47 - "verify net.sh"
Cohesion: 0.16
Nodes (17): BP, connect(), deadline_left(), hello(), mk_target(), mkp(), NIP, node_ip() (+9 more)

### Community 48 - "verify profiles.sh"
Cohesion: 0.23
Nodes (18): app_restore(), app_sync(), argo_app(), attach(), ciphertext(), cm_field(), errmatch(), extra_cleanup() (+10 more)

### Community 49 - "test tts.test.js"
Cohesion: 0.13
Nodes (16): after(), assert, { createTts }, { EventEmitter }, fs, os, { PassThrough }, path (+8 more)

### Community 50 - "runner profiles.test.js"
Cohesion: 0.12
Nodes (15): fs, LABEL, { randomUUID, hkdfSync }, admin, assert, fakeK8s(), fixture(), fs (+7 more)

### Community 51 - "spike hello-call.test.js"
Cohesion: 0.14
Nodes (11): botName(), path, run(), assert, { EventEmitter }, fs, JoinError, os (+3 more)

### Community 53 - "input util.js"
Cohesion: 0.15
Nodes (5): DOMKeyTable, codepoints, getKey(), getKeycode(), getKeysym()

### Community 55 - "proxy proxy.js"
Cohesion: 0.16
Nodes (15): addressBits(), BASE_PROTECTED, checkedAddresses(), addresses(), crypto, dgram, dnsReply(), fs (+7 more)

### Community 56 - "proxy proxy.test.js"
Cohesion: 0.12
Nodes (11): assert, auth(), { createApi, createProxy, parseHello, checkedAddresses, parseDns }, entry, { EventEmitter }, fs, guard, os (+3 more)

### Community 57 - "runner protocol.js"
Cohesion: 0.20
Nodes (14): board(), columns, count(), exact(), hosts(), identity, login(), optional() (+6 more)

### Community 58 - "util logging.js"
Cohesion: 0.12
Nodes (3): DataChannel, rawChannelProps, ReadyStates

### Community 59 - "crypto u8ArrayToBigInt()"
Cohesion: 0.24
Nodes (5): bigIntToU8Array(), modPow(), u8ArrayToBigInt(), DHCipher, DHPublicKey

### Community 60 - "core .constructor()"
Cohesion: 0.15
Nodes (3): HextileDecoder, JPEGDecoder, ZlibDecoder

### Community 62 - "avatars points"
Cohesion: 0.12
Nodes (16): points, C, JL, JR, LB, LL, LM, LR (+8 more)

### Community 63 - "sinks cfactory-write.js"
Cohesion: 0.15
Nodes (14): deriveEffects(), describe(), SERVICE, STAGE, stageFor(), stateOf(), WRITES, { Client } (+6 more)

### Community 64 - "test desktop.test.js"
Cohesion: 0.15
Nodes (13): createGateway(), call(), numberFrom(), snapshot(), assert, { createGateway }, { createSessions }, { makeRedactor } (+5 more)

### Community 65 - "reaper reaper.test.js"
Cohesion: 0.17
Nodes (13): createReaper(), leaseStale(), tick(), fs, main(), assert, { createReaper }, fake() (+5 more)

### Community 66 - "ref_node_stream"
Cohesion: 0.16
Nodes (10): assert, { createVmSpawn }, { Duplex }, { test }, createVmSpawn(), { EventEmitter }, firstLine(), { PassThrough } (+2 more)

### Community 68 - "ref_node_test"
Cohesion: 0.15
Nodes (10): loadRoles(), has(), rolesOf(), assert, { loadRoles }, test, assert, fs (+2 more)

### Community 69 - "test cfactory.test.js"
Cohesion: 0.14
Nodes (7): assert, callTool(), cards, { createCfactorySource, mapCard }, reply(), repos, test

### Community 70 - "agent agent/call.test.js"
Cohesion: 0.18
Nodes (10): createCallWorker(), { createShare, callLaunchArgs }, { PassThrough }, assert, { createCallWorker, withProxy }, { EventEmitter }, fixture(), { test } (+2 more)

### Community 71 - "ref_node_fs"
Cohesion: 0.15
Nodes (10): createK8s(), fs, assert, { createK8s }, fs, http, { inClusterConfig }, os (+2 more)

### Community 72 - "core ._handleMouse()"
Cohesion: 0.25
Nodes (3): extendedPointerEvent(), pointerEvent(), clientToElement()

### Community 73 - "bot bot/package.json"
Cohesion: 0.14
Nodes (13): dependencies, playwright-core, @vibeconferencing/calls, engines, node, playwright-core, @vibeconferencing/calls, license (+5 more)

### Community 74 - "test gateway.test.js"
Cohesion: 0.14
Nodes (9): assert, base, { createGateway }, fs, { loadScope }, { makeRedactor }, os, path (+1 more)

### Community 75 - "viewer viewer/board.test.js"
Cohesion: 0.18
Nodes (11): assert, board(), browser, column(), open(), { test }, { viewerRoute, URL_BOARD }, fs (+3 more)

### Community 76 - "runner k8s-lifecycle.test.js"
Cohesion: 0.19
Nodes (9): assert, { createDecoder }, { createLifecycle }, { createUpgrade }, { EventEmitter }, pod, setup(), Socket (+1 more)

### Community 77 - "web live-view.test.js"
Cohesion: 0.15
Nodes (10): assert, clientSession, { createApp }, fbUpdate, includes(), { loadRoles }, net, start() (+2 more)

### Community 78 - "crypto md5.js"
Cohesion: 0.31
Nodes (12): add(), cmn(), ff(), gg(), hh(), ii(), M(), MD5() (+4 more)

### Community 79 - "core inflator.js"
Cohesion: 0.20
Nodes (7): Inflate, inflateInit(), inflateInit2(), inflateReset(), inflateReset2(), inflateResetKeep(), InflateState()

### Community 80 - "test avatar-renderer.test.js"
Cohesion: 0.15
Nodes (6): assert, { buildRendererSource }, { chromium }, fs, path, test

### Community 81 - "ref_node_assert"
Cohesion: 0.17
Nodes (9): toSpeech(), assert, fs, path, root, test, assert, test (+1 more)

### Community 82 - "spike spike/package.json"
Cohesion: 0.15
Nodes (12): dependencies, playwright-core, @vibeconferencing/calls, playwright-core, @vibeconferencing/calls, license, name, private (+4 more)

### Community 84 - "test run.test.js"
Cohesion: 0.21
Nodes (9): assert, { EventEmitter }, joined(), { PassThrough }, { run }, setup(), stopsOnce(), test (+1 more)

### Community 85 - "core core/package.json"
Cohesion: 0.17
Nodes (11): dependencies, @modelcontextprotocol/sdk, openai, engines, node, license, name, private (+3 more)

### Community 86 - "brains claude-cli.js"
Cohesion: 0.17
Nodes (11): ACTION_SYSTEM_PROMPT, ARGV, { checkFacts }, { claudeHash, checkClaudeHome }, DESKTOP_SYSTEM_PROMPT, fs, os, path (+3 more)

### Community 87 - "ref_node_os"
Cohesion: 0.21
Nodes (7): createProfile(), readHead(), assert, { createProfile }, KEY, setup(), { test }

### Community 88 - "agent share.test.js"
Cohesion: 0.18
Nodes (8): assert, browser, { createShare, titleFor, callLaunchArgs, installCaptureGuard }, http, pick(), { test }, { URL_BOARD }, titleFor()

### Community 89 - "bot run()"
Cohesion: 0.38
Nodes (11): buildRendererSource(), run(), afterJoin(), idleAvatar(), leftConfirmed(), onLine(), play(), start() (+3 more)

### Community 90 - "avatars eyes"
Cohesion: 0.22
Nodes (11): eyes, maxDrop, anchors, file, sha256, anchors, anchors, file (+3 more)

### Community 91 - "bot run.js"
Cohesion: 0.18
Nodes (7): { buildRendererSource }, crypto, fs, { makeRedactor }, os, path, TERMINAL

### Community 92 - "test test/board.test.js"
Cohesion: 0.20
Nodes (9): assert, callTool(), card(), { createCfactorySource }, { makeRedactor }, { projectBoard }, redactor, repos (+1 more)

### Community 93 - "desktop desktop/package.json"
Cohesion: 0.18
Nodes (10): dependencies, playwright-core, engines, node, playwright-core, name, private, scripts (+2 more)

### Community 94 - "runner protocol.test.js"
Cohesion: 0.18
Nodes (7): assert, fs, { MAX, encode, createDecoder, tag }, net, os, path, { test }

### Community 95 - "web web/package.json"
Cohesion: 0.18
Nodes (10): dependencies, @rfactory/core, engines, node, license, name, private, scripts (+2 more)

### Community 96 - "test desktop-routes.test.js"
Cohesion: 0.18
Nodes (9): assert, { createApp }, { createDesktop }, grant, { loadRoles }, { makeRedactor }, open, roles (+1 more)

### Community 97 - "test source-guard.test.js"
Cohesion: 0.20
Nodes (9): assert, fs, git(), guard, os, path, repo(), { spawnSync } (+1 more)

### Community 98 - "test avatars.test.js"
Cohesion: 0.20
Nodes (8): assert, crypto, dir, fs, ids, manifest, path, test

### Community 99 - "desktop createSessions()"
Cohesion: 0.36
Nodes (9): ACTIONS, createSessions(), approveShare(), check(), get(), grant(), revoke(), stopShare() (+1 more)

### Community 100 - "src makeRedactor()"
Cohesion: 0.27
Nodes (8): makeRedactor(), redactString(), toModel(), PATTERNS, assert, { makeRedactor }, test, { toModel, logSafe }

### Community 101 - "k3d k14-env.sh"
Cohesion: 0.44
Nodes (9): app_sync(), argo(), desktops(), env_of(), kc(), kubectl(), runner_restart(), k14-env.sh script (+1 more)

### Community 102 - "verify handover.sh"
Cohesion: 0.42
Nodes (8): fixture_reached(), hits(), open_page(), page_loaded(), session_of(), handover.sh script, trap_page(), wait_attached()

### Community 103 - "test hearing.test.js"
Cohesion: 0.33
Nodes (7): createHearing(), heard(), assert, { createHearing }, fakeClock(), setup(), test

### Community 104 - "agent createShare()"
Cohesion: 0.47
Nodes (9): createShare(), capture(), matches(), start(), stop(), tabGone(), teardown(), installCaptureGuard() (+1 more)

### Community 106 - "verify lifecycle.sh"
Cohesion: 0.42
Nodes (7): case_hold(), egress_cut(), fresh(), hold(), settled(), lifecycle.sh script, watch_end()

### Community 108 - "test pod.test.js"
Cohesion: 0.22
Nodes (7): assert, fs, os, path, realPod, { spawnSync }, test

### Community 109 - "avatars portraits"
Cohesion: 0.25
Nodes (8): anchors, file, sha256, file, sha256, portraits, f01, f09

### Community 110 - "k3d gate.sh"
Cohesion: 0.25
Nodes (7): RUNNER_URL, gate.sh script, VERIFY_CA, VERIFY_CERT, VERIFY_KEY, VERIFY_NODE_CLI, VERIFY_PROBE_IMAGE

### Community 111 - "runner lifecycle.js"
Cohesion: 0.25
Nodes (6): { buildPolicy }, { createDecoder, tag, encode }, crypto, net, { nonce: newNonce }, { StringDecoder }

### Community 114 - "share share/board.js"
Cohesion: 0.33
Nodes (6): COLUMNS, projectBoard(), { repositoryOf }, STAGES, repositoryOf(), view()

### Community 115 - "ref_node_http"
Cohesion: 0.29
Nodes (3): http, [portA, portB], state

### Community 116 - "verify main()"
Cohesion: 0.43
Nodes (5): connect(), handshake(), main(), [mode, url], out()

### Community 117 - "core deflator.js"
Cohesion: 0.38
Nodes (4): deflateInit(), Z_DEFAULT_COMPRESSION, Z_FULL_FLUSH, ZStream()

### Community 118 - "util events.js"
Cohesion: 0.48
Nodes (5): _capturedElemChanged(), _captureObserver, _captureProxy(), releaseCapture(), setCapture()

### Community 119 - "avatars mesh"
Cohesion: 0.33
Nodes (6): mesh, anchors, file, sha256, triangles, f17

### Community 120 - "avatars move"
Cohesion: 0.33
Nodes (6): move, C, JL, JR, LB, LM

### Community 121 - "sources cfactory.js"
Cohesion: 0.33
Nodes (4): { Client }, mapCard(), STATE, { StreamableHTTPClientTransport }

### Community 122 - "test fake-github-mcp.js"
Cohesion: 0.33
Nodes (4): { ListToolsRequestSchema, CallToolRequestSchema }, { Server }, { StdioServerTransport }, @modelcontextprotocol/sdk

### Community 123 - "verify e2e.sh"
Cohesion: 0.53
Nodes (4): real_ids(), e2e.sh script, teams_call(), WEB_MAX

### Community 124 - "sources createCfactorySource()"
Cohesion: 0.60
Nodes (5): createCfactorySource(), call(), connect(), within(), src()

### Community 125 - "k3d k11.sh"
Cohesion: 0.50
Nodes (4): env_of(), RFACTORY_DESKTOP, RFACTORY_RUNNER_URL, k11.sh script

### Community 126 - "k3d mk-tls.sh"
Cohesion: 0.70
Nodes (4): FILES, key(), leaf(), mk-tls.sh script

### Community 127 - "agent share.js"
Cohesion: 0.40
Nodes (3): nonce(), { randomBytes }, { viewerRoute, URL_BOARD, ORIGIN }

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

## Knowledge Gaps
- **32 isolated node(s):** `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE`, `VERIFY_CERT`, `VERIFY_KEY` (+27 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 1120 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Display` connect `core Display` to `core rfb.js`, `util logging.js`, `web createShareManager()`, `core .constructor()`?**
  _High betweenness centrality (0.307) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `createLifecycle()` (e.g. with `lifecycle.js` and `action()`) actually correct?**
  _`createLifecycle()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@vibeconferencing/calls`, `playwright-core`, `VERIFY_PROBE_IMAGE` to the rest of the system?**
  _32 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `verify lib.sh` be split into smaller, more focused modules?**
  _Cohesion score 0.07080200501253132 - nodes in this community are weakly interconnected._
- **Why does `createShareManager()` connect `web createShareManager()` to `runner protocol.js`?**
  _High betweenness centrality (0.280) - this node is a cross-community bridge._
- **Should `runner k8s-policy.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05389610389610389 - nodes in this community are weakly interconnected._
- **Should `core Display` be split into smaller, more focused modules?**
  _Cohesion score 0.07197763801537387 - nodes in this community are weakly interconnected._