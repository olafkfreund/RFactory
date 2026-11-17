# Step 2 feasibility gate: results

Filled by hand after the owner runs the scripts on p620. Plan step 2:
if any row is `fail`, stop and report; do not build steps 3 onward.

Run: date, host, commit, image revisions (microvm.nix, nixpkgs).

| # | Fact | Script | Result (pass / fail) | Evidence (paste the PASS/FAIL lines) |
|---|---|---|---|---|
| 1 | A VM is created and destroyed at runtime without a host rebuild (cloud-hypervisor, `systemd-run --unit=rfactory-vm-gate`); writes outside `/tmp` do not survive a destroy | `vm.sh` | | |
| 2 | vsock carries length-prefixed JSON and VNC passes through the socat bridge | `vsock.sh` | | |
| 3 | Per-tap nftables block host, metadata and private ranges, IPv4 and IPv6 (guest-to-guest not covered: step 17) | `net.sh` | | |
| 4 | Inside the VM, Meet still passes #1's Phase 0 criteria | `meet.sh` (partial) + by hand | | |

Notes:
- `meet.sh` only shows Chrome starts and reaches Meet's landing page. The Phase 0 join (in-call, captions, audio) needs the spike code in the guest and is done by hand.
- Unchecked until a build: Playwright in the guest against `playwright-core` 1.65.1, and `google-chrome` under the unfree predicate.
