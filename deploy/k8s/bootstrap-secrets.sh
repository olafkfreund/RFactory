#!/usr/bin/env bash
set -euo pipefail
umask 077

cfg=${RFACTORY_CONFIG:-$HOME/.config/rfactory}
rotated=0 restart=1 dry_run=0
while (($#)); do
  case $1 in
    --rotated) rotated=1; shift ;;
    --no-restart) restart=0; shift ;;
    --dry-run) dry_run=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

for f in scope.cluster.json cfactory-read-key cfactory-write-key stt-path keycloak-client-secret oauth2-cookie-secret roles.env desktop-runner/client.crt desktop-runner/client.key desktop-runner/ca.crt; do
  [[ -f $cfg/$f ]] || { echo "missing $cfg/$f" >&2; exit 2; }
  [[ $(stat -c %a "$cfg/$f") == 600 ]] || { echo "$cfg/$f must be mode 600" >&2; exit 2; }
done
for f in keycloak-client-secret oauth2-cookie-secret; do
  [[ -s $cfg/$f ]] || { echo "$f is empty" >&2; exit 2; }
  [[ $(tail -c1 "$cfg/$f" | od -An -c | tr -d ' ') != '\n' ]] || { echo "$f must not end with a newline" >&2; exit 2; }
done
case $(stat -c %s "$cfg/oauth2-cookie-secret") in
  16|24|32) ;;
  *) echo "oauth2-cookie-secret must be 16, 24 or 32 bytes" >&2; exit 2 ;;
esac
[[ $(stat -c %s "$cfg/stt-path") == 32 && $(<"$cfg/stt-path") =~ ^[0-9a-f]{32}$ ]] || { echo "stt-path must be 32 lowercase hex characters" >&2; exit 2; }

kubectl_cmd=(kubectl --context "${RFACTORY_KUBE_CONTEXT:-k3d-factory}" -n factory)
# The Deployment in git owns the switches; the scope must agree with them or the web app refuses to start.
env_of() {
  "${kubectl_cmd[@]}" get deploy rfactory -o "jsonpath={.spec.template.spec.containers[?(@.name==\"rfactory-web\")].env[?(@.name==\"$1\")].value}" 2>/dev/null
}
if ! writes=$(env_of RFACTORY_WRITES) || ! shares=$(env_of RFACTORY_SHARES); then
  echo "cannot read deploy/rfactory's switches; is factory-gitops synced?" >&2; exit 2
fi
# #18: an absent RFACTORY_INVESTIGATIONS is off (the web app reads it that way too)
investigations=$(env_of RFACTORY_INVESTIGATIONS) || investigations=
investigations=${investigations:-off}
# #58: an absent RFACTORY_NOTES is off too
notes=$(env_of RFACTORY_NOTES) || notes=
notes=${notes:-off}
agents=$(env_of RFACTORY_AGENTS) || agents=
agents=${agents:-off}
if [[ ! $writes =~ ^(on|off)$ || ! $shares =~ ^(on|off)$ || ! $investigations =~ ^(on|off)$ || ! $notes =~ ^(on|off)$ || ! $agents =~ ^(on|off)$ ]]; then
  echo "deploy/rfactory's RFACTORY_WRITES, RFACTORY_SHARES, RFACTORY_INVESTIGATIONS, RFACTORY_NOTES and RFACTORY_AGENTS must be on or off" >&2; exit 2
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
python3 - "$cfg" "$writes" "$shares" "$investigations" "$notes" "$agents" "$tmp" <<'PY'
import json
import pathlib
import re
import sys

cfg, writes, shares, investigations, notes, agents, tmp = sys.argv[1:]
try:
    scope = json.loads((pathlib.Path(cfg) / 'scope.cluster.json').read_text())
    if scope['writes_enabled'] is not (writes == 'on') or scope['shares_enabled'] is not (shares == 'on'):
        raise ValueError("scope's writes_enabled/shares_enabled disagree with deploy/rfactory")
    if scope.get('investigations_enabled', False) is not (investigations == 'on'):
        raise ValueError("scope's investigations_enabled disagrees with deploy/rfactory")
    if scope.get('notes_enabled', False) is not (notes == 'on'):
        raise ValueError("scope's notes_enabled disagrees with deploy/rfactory")
    scope_agents = scope.get('agents')
    if agents == 'on':
        if not isinstance(scope_agents, list) or not 1 <= len(scope_agents) <= 10:
            raise ValueError("scope's agents disagrees with deploy/rfactory")
    elif 'agents' in scope:
        raise ValueError("scope's agents disagrees with deploy/rfactory")
    agent_names = []
    allowed = set()
    if scope_agents:
        projects = scope.get('projects')
        allow = projects.get('allow') if isinstance(projects, dict) else None
        if not isinstance(scope.get('source'), dict) or scope['source'].get('kind') != 'cfactory' or not isinstance(projects, dict) or set(projects) != {'allow'} or \
                not isinstance(allow, list) or not 1 <= len(allow) <= 50:
            raise ValueError('invalid projects')
        for project in allow:
            if not isinstance(project, dict) or set(project) != {'id'} or not isinstance(project['id'], str) or \
                    not re.fullmatch(r'repo:\d+|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', project['id']) or project['id'] in allowed:
                raise ValueError('invalid projects')
            allowed.add(project['id'])
    for agent in scope_agents or []:
        if not isinstance(agent, dict) or set(agent) != {'name', 'key_file', 'scope', 'projects'}:
            raise ValueError('invalid agent entry')
        name = agent.get('name')
        if not isinstance(name, str) or not re.fullmatch(r'[a-z0-9-]{1,32}', name) or name in agent_names:
            raise ValueError('invalid agent name')
        if agent.get('key_file') != f'/run/rfactory/keys/agent-{name}':
            raise ValueError('invalid agent key_file')
        projects = agent.get('projects')
        if agent.get('scope') != 'read' or not isinstance(projects, list) or not projects or \
                any(not isinstance(p, str) or p not in allowed for p in projects) or len(set(projects)) != len(projects):
            raise ValueError('invalid agent scope or projects')
        agent_names.append(name)
    lines = (pathlib.Path(cfg) / 'roles.env').read_text().splitlines()
    if len(lines) != 3 or any(not line.startswith(name + '=') for line, name in zip(lines, ('ALLOWED', 'APPROVERS', 'ADMINS'))):
        raise ValueError('roles.env needs ALLOWED, APPROVERS, ADMINS in order')
    roles = [line.split('=', 1)[1].split(',') if line.split('=', 1)[1] else [] for line in lines]
    if not roles[0] or any(not re.fullmatch(r'[^,\s@]+@[^,\s@]+', email) for role in roles for email in role):
        raise ValueError('invalid role list')
    allowed = {email.lower() for email in roles[0]}
    if any(email.lower() not in allowed for role in roles[1:] for email in role):
        raise ValueError('approvers and admins must be allowed')
except (OSError, UnicodeError, json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
    print(f'invalid configuration: {error}', file=sys.stderr)
    sys.exit(2)
for name, line in zip(('allowed-emails', 'approvers', 'admins'), lines):
    (pathlib.Path(tmp) / name).write_text(line.split('=', 1)[1])
(pathlib.Path(tmp) / 'agents').write_text('\n'.join(agent_names))
PY

mapfile -t agent_names <"$tmp/agents"
agent_key_names=()
agent_key_args=()
for name in "${agent_names[@]}"; do
  f="agent-keys/$name"
  [[ -f $cfg/$f ]] || { echo "missing $cfg/$f" >&2; exit 2; }
  [[ $(stat -c %a "$cfg/$f") == 600 ]] || { echo "$cfg/$f must be mode 600" >&2; exit 2; }
  agent_key_names+=("agent-$name")
  agent_key_args+=("--from-file=agent-$name=$cfg/$f")
done
python3 - "$cfg" "${agent_names[@]}" <<'PY' || { echo "invalid agent key file" >&2; exit 2; }
import pathlib
import re
import sys
try:
    keys = [(pathlib.Path(sys.argv[1]) / 'agent-keys' / name).read_text().strip() for name in sys.argv[2:]]
    valid = all(re.fullmatch(r'rfk_[A-Za-z0-9]{32,}', key) for key in keys) and len(set(keys)) == len(keys)
except (OSError, UnicodeError):
    valid = False
sys.exit(0 if valid else 1)
PY

names=(rfactory-config rfactory-keys rfactory-stt-path oauth2-proxy-rfactory rfactory-runner-client)
keys=(
  'scope.json allowed-emails approvers admins'
  "cfactory-read-key cfactory-write-key${agent_key_names[*]:+ ${agent_key_names[*]}}"
  'path'
  'client-secret cookie-secret'
  'client.crt client.key ca.crt'
)
if ((dry_run)); then
  for i in "${!names[@]}"; do echo "${names[i]}: ${keys[i]}"; done
  exit 0
fi

write_secret() {
  local name=$1 existing date=''
  shift
  existing=$("${kubectl_cmd[@]}" get secret "$name" --ignore-not-found -o name 2>/dev/null) || { echo "reading $name failed" >&2; exit 1; }
  if [[ -n $existing ]]; then
    date=$("${kubectl_cmd[@]}" get secret "$name" -o 'jsonpath={.metadata.annotations.rotation\.factory\.dev/rotated-at}' 2>/dev/null) ||
      { echo "reading $name's rotation date failed" >&2; exit 1; }
  fi
  if [[ -z $existing || $rotated == 1 ]]; then date=$(date -u +%Y-%m-%d); fi
  # one request: the new data and the (kept or new) rotation date together; replace without --force never deletes
  local annotate=(cat)
  [[ -z $date ]] || annotate=("${kubectl_cmd[@]}" annotate --local -f - --overwrite "rotation.factory.dev/rotated-at=$date" -o yaml)
  local verb=(create -f -)
  [[ -z $existing ]] || verb=(replace -f -)
  "${kubectl_cmd[@]}" create secret generic "$name" "$@" --dry-run=client -o yaml 2>/dev/null | "${annotate[@]}" 2>/dev/null |
    "${kubectl_cmd[@]}" "${verb[@]}" >/dev/null 2>&1 || { echo "writing $name failed" >&2; exit 1; }
}

write_secret rfactory-config \
  "--from-file=scope.json=$cfg/scope.cluster.json" \
  "--from-file=allowed-emails=$tmp/allowed-emails" \
  "--from-file=approvers=$tmp/approvers" \
  "--from-file=admins=$tmp/admins"
write_secret rfactory-keys \
  "--from-file=cfactory-read-key=$cfg/cfactory-read-key" \
  "--from-file=cfactory-write-key=$cfg/cfactory-write-key" \
  "${agent_key_args[@]}"
write_secret rfactory-stt-path "--from-file=path=$cfg/stt-path"
write_secret oauth2-proxy-rfactory \
  "--from-file=client-secret=$cfg/keycloak-client-secret" \
  "--from-file=cookie-secret=$cfg/oauth2-cookie-secret"
write_secret rfactory-runner-client \
  "--from-file=client.crt=$cfg/desktop-runner/client.crt" \
  "--from-file=client.key=$cfg/desktop-runner/client.key" \
  "--from-file=ca.crt=$cfg/desktop-runner/ca.crt"
if ((restart)); then
  "${kubectl_cmd[@]}" rollout restart deploy/rfactory >/dev/null 2>&1 ||
    { echo "the Secrets are written, but restarting deploy/rfactory failed; restart it to apply them" >&2; exit 1; }
fi
