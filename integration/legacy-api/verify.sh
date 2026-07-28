#!/usr/bin/env bash
# Verify an fmevents API install.
#
#   ./verify.sh https://theclub.friendlymanager.com <api-key>
#
# READ-ONLY by default: it only GETs, so it is safe to run against a live club.
# Pass --writes to also exercise the write endpoints — that CREATES AND THEN
# DELETES a test event, so only do it somewhere you don't mind that happening.
#
# Exit code 0 = everything passed.

set -uo pipefail

BASE="${1:-}"
KEY="${2:-}"
WRITES=false
[[ "${3:-}" == "--writes" || "${2:-}" == "--writes" ]] && WRITES=true

if [[ -z "$BASE" || -z "$KEY" || "$KEY" == "--writes" ]]; then
  echo "usage: ./verify.sh <base-url> <api-key> [--writes]"
  exit 2
fi

BASE="${BASE%/}/api/v1/fmevents"
AUTH="Authorization: token $KEY"
PASS=0; FAIL=0

# check <label> <path> [jq-ish python expression to prove the shape]
check() {
  local label="$1" path="$2" probe="${3:-}"
  local body code
  body=$(curl -s -m 20 -w $'\n%{http_code}' -H "$AUTH" "$BASE/$path" 2>/dev/null)
  code="${body##*$'\n'}"; body="${body%$'\n'*}"

  if [[ "$code" != "200" ]]; then
    printf '  ✗ %-34s HTTP %s  %s\n' "$label" "$code" "$(echo "$body" | head -c 90)"
    ((FAIL++)); return
  fi
  if [[ -n "$probe" ]]; then
    local out
    out=$(printf '%s' "$body" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception as e:
    print('not JSON:', e); sys.exit(1)
try:
    print($probe)
except Exception as e:
    print('unexpected shape:', e); sys.exit(1)
" 2>&1) || { printf '  ✗ %-34s %s\n' "$label" "$out"; ((FAIL++)); return; }
    printf '  ✓ %-34s %s\n' "$label" "$out"
  else
    printf '  ✓ %-34s\n' "$label"
  fi
  ((PASS++))
}

echo
echo "Verifying $BASE"
echo

echo "AUTH"
code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 "$BASE/club")
if [[ "$code" == "403" ]]; then printf '  ✓ %-34s refuses an unauthenticated call\n' "no key"; ((PASS++));
else printf '  ✗ %-34s expected 403, got %s\n' "no key" "$code"; ((FAIL++)); fi

echo
echo "CLUB REFERENCE"
check "club"          "club"                    "'%s · %s' % (d['name'], d['timezone'])"
check "categories"    "categories"              "'%d categories' % len(d)"
check "venues"        "venues"                  "'%d venues' % len(d)"
check "terms"         "terms"                   "'%d terms' % len(d)"
check "codes"         "codes"                   "'%d codes' % len(d)"
check "groups"        "groups"                  "'%d classes' % len(d)"
check "customFields"  "customFields"            "'%d custom fields' % len(d)"
check "programs"      "programs"                "'%d programmes' % len(d)"

echo
echo "PEOPLE"
check "people (search)" "people?q=a&limit=3"     "'%d of %d' % (len(d['people']), d['total'])"
FIRST_PERSON=$(curl -s -m 20 -H "$AUTH" "$BASE/people?limit=1" | python3 -c "import sys,json; p=json.load(sys.stdin)['people']; print(p[0]['id'] if p else '')" 2>/dev/null)
[[ -n "$FIRST_PERSON" ]] && check "person"        "person?personID=$FIRST_PERSON" "'%s %s' % (d['firstName'], d['lastName'])"
[[ -n "$FIRST_PERSON" ]] && check "personEvents"  "personEvents?personID=$FIRST_PERSON" "'%d events' % len(d)"

FIRST_GROUP=$(curl -s -m 20 -H "$AUTH" "$BASE/groups" | python3 -c "import sys,json; g=json.load(sys.stdin); print(g[0]['id'] if g else '')" 2>/dev/null)
[[ -n "$FIRST_GROUP" ]] && check "roster"         "roster?groupID=$FIRST_GROUP" "'%d on the roster' % len(d)"

echo
echo "EVENTS"
YEAR=$(date +%Y)
check "events (range)" "events?start=$((YEAR-1))-01-01&end=$((YEAR+2))-01-01" "'%d events' % len(d)"
FIRST_EVENT=$(curl -s -m 20 -H "$AUTH" "$BASE/events?start=$((YEAR-1))-01-01&end=$((YEAR+2))-01-01" | python3 -c "import sys,json; e=json.load(sys.stdin); print(e[0]['id'] if e else '')" 2>/dev/null)
if [[ -n "$FIRST_EVENT" ]]; then
  check "event"        "event?eventID=$FIRST_EVENT"      "d['name']"
  check "attendance"   "attendance?eventID=$FIRST_EVENT" "'%d on the roll' % len(d)"
  check "fees"         "fees?eventID=$FIRST_EVENT"       "'%d charges' % len(d)"
fi

if $WRITES; then
  echo
  echo "WRITES  (creates a test event, then deletes it)"
  NEW=$(curl -s -m 20 -X POST -H "$AUTH" -H 'Content-Type: application/json' "$BASE/event" \
    -d "{\"name\":\"fmevents install check\",\"date\":\"$YEAR-01-01\",\"startTime\":\"09:00:00\",\"endTime\":\"10:00:00\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('eventID',''))" 2>/dev/null)
  if [[ -n "$NEW" ]]; then
    printf '  ✓ %-34s created event %s\n' "postEvent" "$NEW"; ((PASS++))
    OUT=$(curl -s -m 20 -X POST -H "$AUTH" -H 'Content-Type: application/json' "$BASE/eventDelete" -d "{\"eventID\":$NEW}")
    if echo "$OUT" | grep -q '"deleted":true'; then
      printf '  ✓ %-34s and deleted it again\n' "postEventDelete"; ((PASS++))
    else
      printf '  ✗ %-34s could NOT delete event %s — remove it by hand\n' "postEventDelete" "$NEW"; ((FAIL++))
    fi
  else
    printf '  ✗ %-34s could not create\n' "postEvent"; ((FAIL++))
  fi
fi

echo
if (( FAIL == 0 )); then
  echo "All $PASS checks passed."
  exit 0
fi
echo "$PASS passed, $FAIL FAILED."
echo "If everything failed: check the API key row in fm_system.ApiKey and that"
echo "classes/Api/fmevents.php is present. Errors are logged to /var/log/fm/api.log."
exit 1
