#!/usr/bin/env bash
# One readiness run: the owner is in the Meet and answers on this terminal. Needs a display (use xvfb-run -a if absent)
# and installed bot/node_modules. This script does not retry a failed run.
# Env: VERIFY_SERVER_URL VERIFY_APPROVER_COOKIE VERIFY_MEET_LINK VERIFY_PROJECT_ID CHROME_PATH;
# optional VERIFY_JOIN_WAIT (240) VERIFY_ANSWER_WAIT (60) VERIFY_TURN_WAIT (95) VERIFY_SETTLE (5) VERIFY_STOP_WAIT (30).
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh disable=SC1091
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
trap 'exit 130' INT TERM

GEN='' STOP_SENT='' EVPID='' OBSPID='' SWITCH_START=''
WORK=$(mktemp -d)
stop_helpers() {
  local pid
  for pid in "${EVPID:-}" "${OBSPID:-}"; do
    if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; fi
  done
  for pid in "${EVPID:-}" "${OBSPID:-}"; do
    if [ -n "$pid" ]; then wait "$pid" 2>/dev/null || true; fi
  done
  EVPID='' OBSPID=''
}

# Called by lib.sh's exit trap, including after a failed or interrupted step.
extra_cleanup() {
  local r
  if [ -n "${GEN:-}" ] && [ -z "${STOP_SENT:-}" ]; then
    r=$(WEB_MAX=${VERIFY_STOP_WAIT:-30} approver DELETE /api/call "$(jq -nc --argjson g "$GEN" '{generation:$g}')") || r=
    if ! jq -e '.ok == true' >/dev/null 2>&1 <<<"$r"; then fail readiness-cleanup-stop 'the call may still be running; check the call page'; fi
  fi
  stop_helpers
  [ -z "${WORK:-}" ] || rm -rf "$WORK"
}

need_cmds curl jq node
need_env VERIFY_SERVER_URL VERIFY_APPROVER_COOKIE VERIFY_MEET_LINK VERIFY_PROJECT_ID CHROME_PATH
[ -x "$CHROME_PATH" ] || die 'CHROME_PATH is not executable'
[ -d "$ROOT/bot/node_modules/@vibeconferencing/calls" ] || die 'install bot/node_modules first'
[ -z "${VERIFY_CONFIRM_DIR:-}" ] || die 'VERIFY_CONFIRM_DIR must be unset: the owner answers on this terminal'
export WEB_MAX=180

# A wait must fail as soon as either helper leaves or the call reports a terminal state.
alive() {
  WAIT_REASON=
  if [ -n "${EVPID:-}" ] && ! kill -0 "$EVPID" 2>/dev/null; then WAIT_REASON='event reader exited'; return 1; fi
  if [ -n "${OBSPID:-}" ] && ! kill -0 "$OBSPID" 2>/dev/null; then WAIT_REASON='observer exited'; return 1; fi
  local terminal
  terminal=$(jq -rs '[.[] | select(.type=="state" and (.state=="error" or .state=="left" or .state=="removed" or .state=="stopped"))] | last // empty | .state // empty' "$EV" 2>/dev/null) || true
  if [ -n "$terminal" ]; then WAIT_REASON="call state $terminal"; return 1; fi
}

# wait_event <line cursor> <jq filter> <absolute SECONDS deadline>
wait_event() {
  local cursor=$1 filter=$2 deadline=$3
  while :; do
    alive || return 1
    if tail -n "+$((cursor + 1))" "$EV" | jq -e "$filter" >/dev/null 2>&1; then return 0; fi
    if [ "$SECONDS" -ge "$deadline" ]; then WAIT_REASON=timeout; return 1; fi
    sleep 0.2
  done
}

# wait_observer <exact line> <absolute SECONDS deadline>
wait_observer() {
  local line=$1 deadline=$2
  while :; do
    alive || return 1
    if [ -f "$OBS" ] && grep -Fxq "$line" "$OBS"; then return 0; fi
    if [ "$SECONDS" -ge "$deadline" ]; then WAIT_REASON=timeout; return 1; fi
    sleep 0.2
  done
}

settle() {
  local deadline=$((SECONDS + ${VERIFY_SETTLE:-5}))
  while [ "$SECONDS" -lt "$deadline" ]; do alive || return 1; sleep 0.2; done
  alive
}

# Find the first answer after the first question past a cursor; scored answers also need data and a clean lookup.
answer_after_question() {
  tail -n "+$((1 + $1))" "$EV" | jq -nr --argjson rich "$2" '
    reduce inputs as $e ({heard:false, failed:false, answered:false, settled:false};
      if .settled then .
      elif $e.type == "question" and (.heard | not) then .heard = true
      elif .heard and $e.type == "log" and (($e.message // "") | startswith("brain failed") or startswith("source failed")) then .failed = true
      elif .heard and $e.type == "answer" then .settled = true | .answered = (if $rich then ((($e | has("sources")) or ($e | has("snapshot"))) and (.failed | not)) else true end)
      else . end) | if .answered then "answered" elif .settled then "invalid" else "pending" end' 2>/dev/null
}

# A successful stop is the only point where this script releases its generation.
stop_call() {
  local mode=$1 r status deadline remaining
  if [ "$mode" = platform ]; then SWITCH_START=$SECONDS; fi
  deadline=$((SECONDS + ${VERIFY_STOP_WAIT:-30}))
  touch "$WORK/$mode/end"
  STOP_SENT=1
  remaining=$((deadline - SECONDS))
  if [ "$remaining" -gt 0 ] &&
    r=$(WEB_MAX=$remaining approver DELETE /api/call "$(jq -nc --argjson g "$GEN" '{generation:$g}')") &&
    jq -e '.ok == true' >/dev/null 2>&1 <<<"$r"; then
    while (( (remaining = deadline - SECONDS) > 0 )); do
      if status=$(WEB_MAX=$remaining approver GET /api/call/status) &&
        jq -e '.running == false and .starting == false' >/dev/null 2>&1 <<<"$status" &&
        [ "$SECONDS" -lt "$deadline" ]; then
        pass "readiness-$mode-stop"
        GEN='' STOP_SENT=''
        stop_helpers
        return
      fi
      sleep 0.2
    done
  fi
  fail "readiness-$mode-stop" 'the call may still be running; check the call page'
  exit 1
}

mode_checks() {
  local mode=$1 state limits cursor deadline started heard_at turn_deadline expected notice
  if ! wait_event 0 'select(.type=="state" and .state=="in-call")' "$((JOIN_START + ${VERIFY_JOIN_WAIT:-240}))"; then
    state=$(jq -rs '[.[] | select(.type=="state")] | last // {} | [.state // "none", .code // "none"] | join(" ")' "$EV")
    fail "readiness-$mode-join" "$WAIT_REASON; last state/code: $state"; return 1
  fi
  pass "readiness-$mode-join"
  echo "readiness-$mode-join-seconds $((SECONDS - JOIN_START))"
  if [ "$mode" = audio ] && [ -n "$SWITCH_START" ]; then echo "readiness-switch-seconds $((SECONDS - SWITCH_START))"; fi

  expected=captions
  if [ "$mode" = audio ]; then expected=own; fi
  deadline=$((SECONDS + ${VERIFY_JOIN_WAIT:-240}))
  while :; do
    alive || { fail "readiness-$mode-hearing" "$WAIT_REASON"; return 1; }
    state=$(jq -rs '[.[] | select(.type=="hearing")] | last // {} | .state // "none"' "$EV")
    if [ "$state" = "$expected" ]; then break; fi
    if [ "$state" = no-audio ] || [ "$state" = notice-failed ] || [ "$SECONDS" -ge "$deadline" ]; then
      fail "readiness-$mode-hearing" "state $state"; return 1
    fi
    sleep 0.2
  done
  pass "readiness-$mode-hearing"

  # Limits are emitted at startup, before the greeting, and included in the stream replay.
  if ! wait_event 0 'select(.type=="limits" or .type=="greeting")' "$((SECONDS + 60))"; then
    fail "readiness-$mode-limits" "$WAIT_REASON"; return 1
  fi
  limits=$(jq -cs '[.[] | select(.type=="limits")] | last' "$EV")
  if jq -e '.budget_usd == 2' >/dev/null <<<"$limits"; then pass "readiness-$mode-limits"
  elif [ "$limits" = null ]; then fail "readiness-$mode-limits" 'no limits event: lookups are off in the deployed scope'; return 1
  else fail "readiness-$mode-limits" "budget is $(jq -r '.budget_usd // "missing"' <<<"$limits"), not 2"; return 1; fi

  node "$ROOT/desktop/verify/observer.js" "$CHROME_PATH" "$WORK/$mode" >"$OBS" 2>&1 &
  OBSPID=$!
  if wait_observer in-call "$((SECONDS + ${VERIFY_JOIN_WAIT:-240}))"; then pass "readiness-$mode-observer"
  else fail "readiness-$mode-observer" "$WAIT_REASON"; return 1; fi

  if ! wait_event 0 'select(.type=="greeting" and .result=="done")' "$((SECONDS + 60))"; then
    fail "readiness-$mode-greeting" "$WAIT_REASON"; return 1
  fi
  settle || { fail "readiness-$mode-greeting" "$WAIT_REASON"; return 1; }
  pass "readiness-$mode-greeting"

  if [ "$mode" = platform ]; then
    cursor=$(wc -l <"$EV")
    started=$SECONDS
    touch "$WORK/$mode/ask-throwaway"
    if wait_event "$cursor" 'select(.type=="question")' "$((started + ${VERIFY_ANSWER_WAIT:-60}))"; then
      turn_deadline=$((started + ${VERIFY_TURN_WAIT:-95}))
      while :; do
        alive || { fail readiness-platform-throwaway "$WAIT_REASON"; return 1; }
        if [ "$(answer_after_question "$cursor" false)" = answered ]; then break; fi
        if [ "$SECONDS" -ge "$turn_deadline" ]; then fail readiness-platform-throwaway 'heard but not settled'; return 1; fi
        sleep 0.2
      done
      echo 'readiness-platform-throwaway heard=yes'
      settle || { fail readiness-platform-throwaway "$WAIT_REASON"; return 1; }
    elif [ "$WAIT_REASON" = timeout ]; then echo 'readiness-platform-throwaway heard=no'
    else fail readiness-platform-throwaway "$WAIT_REASON"; return 1; fi
  fi

  cursor=$(wc -l <"$EV")
  touch "$WORK/$mode/ask-ask"
  if ! wait_observer 'asked ask' "$((SECONDS + ${VERIFY_JOIN_WAIT:-240}))"; then
    fail "readiness-$mode-heard" "$WAIT_REASON"; fail "readiness-$mode-answered" 'ask was not played'; return 1
  fi
  heard_at=$SECONDS
  deadline=$((heard_at + ${VERIFY_ANSWER_WAIT:-60}))
  if ! wait_event "$cursor" 'select(.type=="question")' "$deadline"; then
    fail "readiness-$mode-heard" "$WAIT_REASON"; fail "readiness-$mode-answered" 'question was not heard'; return 1
  fi
  pass "readiness-$mode-heard"
  while :; do
    alive || { fail "readiness-$mode-answered" "$WAIT_REASON"; return 1; }
    case $(answer_after_question "$cursor" true) in
      answered) break ;;
      invalid) fail "readiness-$mode-answered" 'first answer did not qualify'; return 1 ;;
    esac
    if [ "$SECONDS" -ge "$deadline" ]; then fail "readiness-$mode-answered" 'no qualifying answer within the wait'; return 1; fi
    sleep 0.2
  done
  pass "readiness-$mode-answered"
  echo "readiness-$mode-answer-seconds $((SECONDS - heard_at))"

  notice="Did the bot post a new Meet chat notice for this captions join saying 'Factory (AI) is listening; say'?"
  if [ "$mode" = audio ]; then
    notice="Did the bot post a new Meet chat notice for this audio join saying it 'transcribes this call on RFactory's own servers'?"
  fi
  owner_confirm "readiness-$mode-notice" "$notice"
  alive || { fail "readiness-$mode-live" "$WAIT_REASON after notice confirmation"; return 1; }
  [ "$CONFIRMED" = 1 ] || return 1
  owner_confirm "readiness-$mode-spoken" "Did you hear the bot answer 'how many cards are in progress'?"
  alive || { fail "readiness-$mode-live" "$WAIT_REASON after spoken confirmation"; return 1; }
  [ "$CONFIRMED" = 1 ]
}

for mode in platform audio; do
  mkdir -p "$WORK/$mode"
  cp "$ROOT/desktop/verify/fixtures/"*.wav "$WORK/$mode/"
  EV="$WORK/$mode/events.jsonl" OBS="$WORK/$mode/observer.log"
  : >"$EV"; : >"$OBS"
  body=$(jq -nc --arg l "$VERIFY_MEET_LINK" --arg m "$mode" --arg p "$VERIFY_PROJECT_ID" '{link:$l,listen:$m,project_id:$p}')
  JOIN_START=$SECONDS
  transport=
  r=$(approver POST /api/call "$body") || transport=1
  if [ -n "$transport" ] || ! jq -e . >/dev/null 2>&1 <<<"$r"; then die 'check the call page; a call may be running'; fi
  if ! jq -e '.ok == true' >/dev/null 2>&1 <<<"$r"; then
    error=$(jq -r '.error // "unknown"' <<<"$r")
    fail "readiness-$mode-start" "error $error"
    continue
  fi
  pass "readiness-$mode-start"
  r=$(approver GET /api/call/status) || true
  if ! jq -e --arg p "$VERIFY_PROJECT_ID" '.running == true and .project.id == $p and (.generation | type == "number" and . >= 0 and . == floor)' >/dev/null 2>&1 <<<"$r"; then
    die 'check the call page; a call may be running'
  fi
  GEN=$(jq -r '.generation' <<<"$r")
  pass "readiness-$mode-generation"

  node "$ROOT/desktop/verify/callevents.js" "$VERIFY_PROJECT_ID" --full >"$EV" 2>"$EV.err" &
  EVPID=$!
  if wait_event 0 '.' "$((SECONDS + 15))"; then pass "readiness-$mode-stream"
  else
    error=$(head -c 200 "$EV.err" 2>/dev/null || true)
    fail "readiness-$mode-stream" "$WAIT_REASON; reader: $error"
    stop_call "$mode"
    continue
  fi

  mode_checks "$mode" || true
  stop_call "$mode"
done
finish
