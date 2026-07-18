#!/bin/bash
set -euo pipefail

# dev は新規登録を無効化しているため、実サインアップを通せる環境は prod のみ。
# 実 SMTP 配信・メールテンプレ描画・verify エンドポイント自体は検証しない (Admin で迂回するため)。
#
# 必要な環境変数:
#   SERVICE_URL              - デプロイ済み Cloud Run サービスの URL
#   FIREBASE_API_KEY         - Firebase Auth REST 用の API キー
#   GOOGLE_CLOUD_PROJECT_ID  - Identity Platform Admin REST 用のプロジェクト ID
#   SIGNUP_TEST_EMAIL_DOMAIN - 使い捨てユーザーのメールドメイン
#   GITHUB_RUN_ID            - 使い捨てユーザーのメールをユニーク化するための実行 ID

: "${SERVICE_URL:?SERVICE_URL is not set}"
: "${FIREBASE_API_KEY:?FIREBASE_API_KEY is not set}"
: "${GOOGLE_CLOUD_PROJECT_ID:?GOOGLE_CLOUD_PROJECT_ID is not set}"
: "${SIGNUP_TEST_EMAIL_DOMAIN:?SIGNUP_TEST_EMAIL_DOMAIN is not set}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID is not set}"

readonly TEST_EMAIL="smoke-signup+${GITHUB_RUN_ID}@${SIGNUP_TEST_EMAIL_DOMAIN}"
TEST_PASSWORD="Smoke-$(openssl rand -hex 16)"
readonly TEST_PASSWORD
readonly ADMIN_ACCOUNTS_URL="https://identitytoolkit.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT_ID}/accounts"

local_id=""

# 作成した使い捨てユーザーを、以降のどのステップで失敗しても必ず削除する。
# 削除できないまま残ると次回以降の実行に影響しうるため、削除失敗はスモーク自体の失敗として扱う。
cleanup() {
  local exit_code=$?
  if [ -n "${local_id}" ]; then
    echo "== Cleanup: delete disposable test user =="
    local delete_response=""
    delete_response=$(curl -s -X POST "${ADMIN_ACCOUNTS_URL}:delete" \
      -H "Authorization: Bearer $(gcloud auth print-access-token)" \
      -H "Content-Type: application/json" \
      -d "{\"localId\":\"${local_id}\"}") || true
    local delete_error=""
    delete_error=$(printf '%s' "${delete_response}" | jq -r '.error.message // empty' 2>/dev/null) || true
    if [ -z "${delete_response}" ] || [ -n "${delete_error}" ]; then
      echo "FAIL: could not delete test user ${local_id}: ${delete_error:-no response}"
      exit_code=1
    else
      echo "OK: deleted ${local_id}"
    fi
  fi
  exit "${exit_code}"
}
trap cleanup EXIT

echo "== Sign up disposable test user =="
signup_response=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\",\"returnSecureToken\":true}")
local_id=$(echo "${signup_response}" | jq -r '.localId')
if [ "${local_id}" = "null" ] || [ -z "${local_id}" ]; then
  echo "FAIL: signUp did not return a localId (prod で新規登録が無効化されていないか確認)"
  echo "${signup_response}" | jq .
  local_id=""
  exit 1
fi
echo "OK: signed up ${TEST_EMAIL}"

# email_verified は ID トークンへ発行時点の値が刻まれる。ログインより前に確認済みへ
# 更新しないと、後続の /api/usage が未確認トークンとして 403 になる。
echo "== Force-verify email via Admin API =="
update_response=$(curl -s -X POST "${ADMIN_ACCOUNTS_URL}:update" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d "{\"localId\":\"${local_id}\",\"emailVerified\":true}")
if [ "$(echo "${update_response}" | jq -r '.localId')" != "${local_id}" ]; then
  echo "FAIL: could not force-verify email"
  echo "${update_response}" | jq .
  exit 1
fi
echo "OK: email marked verified"

echo "== Sign in as verified test user =="
signin_response=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\",\"returnSecureToken\":true}")
id_token=$(echo "${signin_response}" | jq -r '.idToken')
if [ "${id_token}" = "null" ] || [ -z "${id_token}" ]; then
  echo "FAIL: could not sign in verified test user"
  echo "${signin_response}" | jq .
  exit 1
fi

echo "== Authenticated read: GET /api/usage =="
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${id_token}" \
  "${SERVICE_URL}/api/usage")
if [ "${status}" != "200" ]; then
  echo "FAIL: GET /api/usage returned ${status}"
  exit 1
fi
echo "OK: /api/usage returned 200"

echo "Smoke passed: signUp -> email verify -> signIn -> authenticated read against prod."
