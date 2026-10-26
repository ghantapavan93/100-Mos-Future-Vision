#!/usr/bin/env bash
# Every browser check, one after another, against the running dev server
# (npm run dev, port 3240; LAB_URL to point elsewhere). One PASS/FAIL line per
# script; full output in shots/checks/<name>.log. One browser at a time, so
# it runs on a laptop that's busy with other things.
#
#   bash scripts/check-all.sh
cd "$(dirname "$0")/.." || exit 1
mkdir -p shots/checks
fails=0
for s in check-story check-scenes check-member check-coach check-circles check-impact check-commerce check-founder check-future check-roadmap check-behind check-vision check-guidance check-commission walk; do
  if node "scripts/$s.mjs" > "shots/checks/$s.log" 2>&1; then
    echo "PASS $s ($(grep -cE '^\s*ok' "shots/checks/$s.log") ok)"
  else
    echo "FAIL $s"
    tail -4 "shots/checks/$s.log" | sed 's/^/     /'
    fails=$((fails + 1))
  fi
done
echo "failures: $fails"
[ "$fails" -eq 0 ]
