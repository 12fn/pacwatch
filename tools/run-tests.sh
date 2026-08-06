#!/usr/bin/env bash
# Run the full PACWATCH test suite: JavaScript app logic + Python data pipeline.
# Usage: tools/run-tests.sh
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

echo "=== JavaScript (node --test) ==="
if compgen -G "tests/*.test.js" > /dev/null; then
  node --test tests/*.test.js || fail=1
else
  echo "(no JS tests yet)"
fi

echo
echo "=== Python (unittest) ==="
if compgen -G "tests/test_*.py" > /dev/null; then
  python3 -m unittest discover -s tests -p 'test_*.py' -v || fail=1
else
  echo "(no Python tests yet)"
fi

echo
if [ "$fail" -eq 0 ]; then echo "ALL TESTS PASSED"; else echo "TESTS FAILED"; fi
exit "$fail"
