# shellcheck shell=bash
# Shared by the step 2 gate scripts. Source it; then `trap gate_cleanup EXIT`.
# Owner-gated: needs root, builds the guest and starts a VM. Do not run without the owner's OK.
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
HERE=$ROOT/desktop/gate
GATE_UNIT=rfactory-vm-gate
GATE_DIR=/run/rfactory-desktop/gate
# microvm.nix fixes the cloud-hypervisor vsock socket name to notify.vsock in the VM's cwd
SOCK=$GATE_DIR/notify.vsock
FAILS=0
UNIT_STARTED=0
DIR_CREATED=0

die() { echo "gate: $*" >&2; exit 2; }
pass() { echo "PASS $1"; }
fail() { echo "FAIL $1: $2"; FAILS=$((FAILS + 1)); }

need_root() { [ "$(id -u)" = 0 ] || die "needs root (tap, nft, systemd-run)"; }
need_cmds() { local c; for c in "$@"; do command -v "$c" >/dev/null || die "missing command: $c"; done; }

build_runner() { nix build --no-link --print-out-paths "path:$ROOT#nixosConfigurations.$1.config.microvm.declaredRunner"; }

# Refuses to touch an existing gate unit or directory: they are not ours.
vm_start() {
  local runner=$1
  if systemctl list-units --all --no-legend "$GATE_UNIT.service" | grep -q .; then die "$GATE_UNIT already exists, not ours"; fi
  [ ! -e "$GATE_DIR" ] || die "$GATE_DIR already exists, not ours"
  mkdir -p "$GATE_DIR"; DIR_CREATED=1
  # microvm-run calls coreutils; a systemd-run unit's default PATH has none
  systemd-run --quiet --unit="$GATE_UNIT" --collect -p "WorkingDirectory=$GATE_DIR" -p RuntimeMaxSec=900 \
    --setenv=PATH=/run/current-system/sw/bin "$runner/bin/microvm-run"
  UNIT_STARTED=1
}

vm_stop() {
  if [ "$UNIT_STARTED" = 1 ]; then systemctl stop "$GATE_UNIT.service" 2>/dev/null || true; UNIT_STARTED=0; fi
  if [ "$DIR_CREATED" = 1 ]; then rm -rf "$GATE_DIR"; DIR_CREATED=0; fi
}

# vm_wait <port> [seconds]: succeeds once the guest answers CONNECT on that port
vm_wait() {
  local port=$1 end=$((SECONDS + ${2:-120}))
  while [ $SECONDS -lt $end ]; do
    # 5900 (VNC) speaks first; the probe on 5000 only answers a frame, so send one (any reply means it's up)
    if [ "$port" = 5000 ]; then
      node "$HERE/frame.js" "$SOCK" "$port" '{"type":"ping"}' >/dev/null 2>&1 && return 0
    else
      node "$HERE/frame.js" "$SOCK" "$port" >/dev/null 2>&1 && return 0
    fi
    sleep 2
  done
  return 1
}

probe_ping() { node "$HERE/frame.js" "$SOCK" 5000 "$1"; }

# Scripts may define extra_cleanup (tap, nft); it runs before the VM is stopped.
gate_cleanup() {
  if declare -F extra_cleanup >/dev/null; then extra_cleanup || true; fi
  vm_stop
}

finish() { [ "$FAILS" = 0 ] || exit 1; }
