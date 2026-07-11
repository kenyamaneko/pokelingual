#!/bin/bash
set -euo pipefail

# dev デプロイ後の検出専用スモーク。デプロイ済み Cloud Run に対しヘルスと認証付き read を
# 1 本ずつ叩き、デプロイ・環境・secret の配線が生きていることを確認する。
# 失敗しても自動ロールバックはしない (検出・通知のみ)。
#
# 必要な環境変数:
#   SERVICE_URL         - デプロイ済み Cloud Run サービスの URL
#   SMOKE_USER_EMAIL    - allowed_emails に常設した、事前作成済み・メール確認済みのフィクスチャユーザのメール
#   SMOKE_USER_PASSWORD - フィクスチャユーザのパスワード
#   FIREBASE_API_KEY    - Firebase Auth REST 用の API キー

: "${SERVICE_URL:?SERVICE_URL is not set}"
: "${SMOKE_USER_EMAIL:?SMOKE_USER_EMAIL is not set}"
: "${SMOKE_USER_PASSWORD:?SMOKE_USER_PASSWORD is not set}"
: "${FIREBASE_API_KEY:?FIREBASE_API_KEY is not set}"

# 新リビジョンのコールドスタートと --allow-unauthenticated の IAM 反映を吸収する待ち。
# health が 200 を返せば IAM も通過している (401/403 は IAM レベルの拒否)。
readonly HEALTH_MAX_ATTEMPTS=12
readonly HEALTH_RETRY_SECONDS=5

echo "== Health check: GET /health =="
health_ok=false
for attempt in $(seq 1 "${HEALTH_MAX_ATTEMPTS}"); do
  status=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health")
  if [ "${status}" = "200" ]; then
    health_ok=true
    echo "OK: /health returned 200 (attempt ${attempt})"
    break
  fi
  echo "  /health not ready (attempt ${attempt}/${HEALTH_MAX_ATTEMPTS}, status ${status})"
  sleep "${HEALTH_RETRY_SECONDS}"
done
if [ "${health_ok}" != "true" ]; then
  echo "FAIL: /health did not return 200"
  exit 1
fi

# 事前プロビジョンした検証済みフィクスチャユーザでサインインし ID トークンを取得する。
# backend がメール確認を必須にするため、signUp で作られる未確認ユーザーは認証付き read を通れない。
echo "== Acquire Firebase ID token for fixture user =="
response=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${SMOKE_USER_EMAIL}\",\"password\":\"${SMOKE_USER_PASSWORD}\",\"returnSecureToken\":true}")
token=$(echo "${response}" | jq -r '.idToken')
if [ "${token}" = "null" ] || [ -z "${token}" ]; then
  echo "FAIL: could not sign in fixture user (事前作成済み・メール確認済みであること)"
  echo "${response}" | jq .
  exit 1
fi

echo "== Authenticated read: GET /api/usage =="
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${token}" \
  "${SERVICE_URL}/api/usage")
if [ "${status}" != "200" ]; then
  echo "FAIL: GET /api/usage returned ${status}"
  exit 1
fi
echo "OK: /api/usage returned 200"

echo "Smoke passed: health + authenticated read against the deployed dev backend."
