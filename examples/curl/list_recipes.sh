#!/usr/bin/env bash
set -euo pipefail

: "${BASE_URL:=http://localhost:8080}"
: "${API_KEY:=}"

AUTH=()
if [ -n "${API_KEY}" ]; then
  AUTH=(-H "Authorization: Bearer ${API_KEY}")
fi

curl -fsS "${AUTH[@]}" "${BASE_URL}/recipes"
echo

