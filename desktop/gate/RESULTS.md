# Step 2 feasibility gate: results

Plan step 2: if any row is `fail`, stop and report; do not build steps 3
onward. The owner's name is replaced by "Owner" in quoted lines.

Run: 2026-11-17, p620, `feat/3-agent-workspace` at `49b6415` (fact 4 after
the same harness), microvm.nix `fdfc1821a0eb76e44a13d206b72e6ca6961fbb7c`,
nixpkgs `e554fab72f81915600f3f449b786fd9af40439a5`, nft from nixpkgs
`nftables` 1.1.7 for the run only (plan deviation 9).

## Verdict: **pass**, all four facts

| # | Fact | Script | Result | Evidence |
|---|---|---|---|---|
| 1 | A VM is created and destroyed at runtime without a host rebuild; writes outside `/tmp` do not survive a destroy | `vm.sh` | **pass** | `PASS vm-boot (7s to VNC banner)`, `PASS vm-destroy`, `PASS no-persist-var`, `PASS no-persist-tmp` |
| 2 | vsock carries length-prefixed JSON and VNC passes through the socat bridge | `vsock.sh` | **pass** | `PASS framed-json: {"type":"probe-result","result":"connected"}`, `PASS unknown-type-answered-as-error`, `PASS vnc-banner: RFB 003.008`, `PASS connect-22-refused` |
| 3 | Per-tap nftables block host, metadata and private ranges, IPv4 and IPv6 | `net.sh` | **pass** (19/19) | baselines reachable; `PASS blocked-host-tap-{tcp,udp}-v{4,6}`, `blocked-host-lan-v4`, `blocked-metadata`, `blocked-rfc1918{,-udp}`, `blocked-cgnat`, `blocked-ula-v6`, `blocked-linklocal-v6`, `resolver-open-{tcp,udp}`; `counter-host (26 packets)`, `counter-metadata (3 packets)`, `counter-private (7 packets)` |
| 4 | Inside the VM, Meet still passes #1's Phase 0 criteria (as amended by #1 plan D9) | `meet.sh <link>` | **pass** (run 2) | see below |

### Fact 4, run 2 (probe VM, Chrome from nixpkgs, NAT through `rfgate0`)

| Criterion | Evidence |
|---|---|
| in-call | `[9245ms] state: in-call` |
| captions on | `[14768ms] [CC] Captions confirmed on … after 5250 ms` |
| clip heard | mic live and unmuted (`Queuing TTS audio … AudioContext state: running`, `mic buttons: … "Turn off microphone","muted":"false"`); Owner answered on the call: `[17769ms] partial Owner: Yes, I do.` |
| sentence-1 words within 10 s of being said | `[26768ms] partial Owner: … This is the or factory stand up test.` (grew one word per second from 23.8 s) |
| one caption grows across the sentences, finalised on leave | `[49768ms] … This is sentence number two.`, `[65767ms] … sentence number three.`, `[111973ms] leaving`, `[111990ms] final Owner: …` |
| exit 0 | `exit: 0`, `PASS meet-join` |

Run 1 (same link) was refused 35 s after reaching the lobby
(`couldn't enter call (denied or removed?)`), not the immediate refusal
Chromium got in Phase 0. The owner retried without a code change and run 2
was admitted at once, so run 1 is recorded as a lobby/admission miss.

## Cleanup after every run

No `rfactory-vm-*` unit, no `rfgate0` tap and no `rfgate*` nft table left
(checked after each script).

## Harness bugs found and fixed before the results above

1. `systemd-run` unit had no coreutils on `PATH`, so `microvm-run` exited
   at `rm` (fixed in `lib.sh`).
2. `vm_wait` on the probe port waited for the guest to speak first (fixed:
   it sends a frame).
3. The nft counter was named `meta`, an nft keyword (renamed `metadata`).
4. The probe's spike build used `npm pack`, which needs a package name
   (fixed: copy install).

None of these is a feasibility failure; each run above used the fixed harness.
