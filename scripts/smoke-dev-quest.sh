#!/bin/bash
set -euo pipefail

# ヘルス＋read だけでは実 Gemini 採点と Firestore 書き込み (レート制限カウンタ・図鑑) の
# 経路を検出できないため、フィクスチャユーザでクエストを1周させて配線切れを検知する。

: "${SERVICE_URL:?SERVICE_URL is not set}"
: "${TEST_USER_EMAIL:?TEST_USER_EMAIL is not set}"
: "${TEST_USER_PASSWORD:?TEST_USER_PASSWORD is not set}"
: "${FIREBASE_API_KEY:?FIREBASE_API_KEY is not set}"

echo "== Acquire Firebase ID token for fixture user =="
response=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_USER_EMAIL}\",\"password\":\"${TEST_USER_PASSWORD}\",\"returnSecureToken\":true}")
token=$(echo "${response}" | jq -r '.idToken')
if [ "${token}" = "null" ] || [ -z "${token}" ]; then
  echo "FAIL: could not sign in fixture user (事前作成済み・メール確認済みであること)"
  echo "${response}" | jq .
  exit 1
fi

auth_curl() {
  curl -s -H "Authorization: Bearer ${token}" "$@"
}

echo "== GET /api/quest/new =="
new_resp=$(auth_curl "${SERVICE_URL}/api/quest/new")
description=$(echo "${new_resp}" | jq -r '.description_en // empty')
if [ -z "${description}" ]; then
  echo "FAIL: /api/quest/new did not return description_en"
  echo "${new_resp}" | jq .
  exit 1
fi
echo "OK: quest issued (description_en length ${#description})"

echo "== POST /api/quest/score (real Gemini) =="
score_resp=$(auth_curl -X POST "${SERVICE_URL}/api/quest/score" \
  -H "Content-Type: application/json" \
  -d '{"translation":"これはデプロイ後スモークによる自動採点です"}')
score=$(echo "${score_resp}" | jq -r '.score // empty')
if [ -z "${score}" ]; then
  echo "FAIL: /api/quest/score did not return score"
  echo "${score_resp}" | jq .
  exit 1
fi
echo "OK: scored (score=${score})"

echo "== POST /api/quest/skip-guess =="
skip_resp=$(auth_curl -X POST "${SERVICE_URL}/api/quest/skip-guess")
ball_type=$(echo "${skip_resp}" | jq -r '.ball_type // empty')
if [ -z "${ball_type}" ]; then
  echo "FAIL: /api/quest/skip-guess did not return ball_type"
  echo "${skip_resp}" | jq .
  exit 1
fi
echo "OK: ball_type decided (${ball_type})"

echo "== POST /api/quest/capture (Firestore write) =="
capture_resp=$(auth_curl -X POST "${SERVICE_URL}/api/quest/capture")
captured=$(echo "${capture_resp}" | jq -r 'if has("captured") then .captured else empty end')
if [ -z "${captured}" ]; then
  echo "FAIL: /api/quest/capture did not return captured"
  echo "${capture_resp}" | jq .
  exit 1
fi
echo "OK: capture attempted (captured=${captured})"

echo "Smoke passed: quest cycle (Gemini scoring + Firestore writes) against the deployed dev backend."
