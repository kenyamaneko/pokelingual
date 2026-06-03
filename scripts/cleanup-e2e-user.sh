#!/bin/bash
set -euo pipefail

# E2E テストユーザの後始末: Firebase Auth ユーザと Firestore の users/{uid} データを削除する。
# 許可リスト (config/auth.allowed_emails) のメールは恒久フィクスチャなので削除しない。
# pre-clean（中断後の残骸掃除）と post-clean（テスト最後）の両方で冪等に使える。
#
# 必要な環境変数:
#   E2E_USER_EMAIL    - テストユーザのメールアドレス
#   E2E_USER_PASSWORD - テストユーザのパスワード
#   FIREBASE_API_KEY  - Firebase Web API キー
#   GCP_PROJECT_ID    - GCP プロジェクト ID

for var in E2E_USER_EMAIL E2E_USER_PASSWORD FIREBASE_API_KEY GCP_PROJECT_ID; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: ${var} is not set"
    exit 1
  fi
done

# サインインして uid を得る。ユーザが存在しなければ掃除対象なしとして正常終了する。
RESPONSE=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${E2E_USER_EMAIL}\",\"password\":\"${E2E_USER_PASSWORD}\",\"returnSecureToken\":true}")
UID=$(echo "${RESPONSE}" | jq -r '.localId // empty')
if [ -z "${UID}" ]; then
  echo "No E2E user to clean up (sign-in returned no uid)"
  exit 0
fi

ACCESS_TOKEN=$(gcloud auth print-access-token)
BASE="https://firestore.googleapis.com/v1/projects/${GCP_PROJECT_ID}/databases/(default)/documents"

# 1. users/{uid}/pokemon/* を削除
echo "Deleting pokemon data for uid ${UID}..."
DOCS=$(curl -s -H "Authorization: Bearer ${ACCESS_TOKEN}" "${BASE}/users/${UID}/pokemon")
echo "${DOCS}" | jq -r '.documents[]?.name // empty' | while read -r doc_path; do
  curl -s -X DELETE -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    "https://firestore.googleapis.com/v1/${doc_path}"
  echo "  Deleted: ${doc_path}"
done

# 2. users/{uid} 親ドキュメントを削除
curl -s -X DELETE -H "Authorization: Bearer ${ACCESS_TOKEN}" "${BASE}/users/${UID}"

# 3. Firebase Auth ユーザを削除
echo "Deleting Firebase Auth user ${UID}..."
curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/projects/${GCP_PROJECT_ID}/accounts:delete" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"localId\":\"${UID}\"}"

echo "Cleanup complete: pokemon data, users doc, auth user removed (allowlist kept)"
