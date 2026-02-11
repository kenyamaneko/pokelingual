#!/bin/bash
set -euo pipefail

# 結合テスト: デプロイ済み Cloud Run バックエンドに対して API エンドポイントを検証
#
# 必要な環境変数:
#   SERVICE_URL  - Cloud Run サービスの URL (例: https://pokelingual-api-dev-xxx.run.app)
#   ID_TOKEN     - Firebase Auth の ID トークン

if [ -z "${SERVICE_URL:-}" ]; then
  echo "ERROR: SERVICE_URL is not set"
  exit 1
fi

if [ -z "${ID_TOKEN:-}" ]; then
  echo "ERROR: ID_TOKEN is not set"
  exit 1
fi

BASE_URL="${SERVICE_URL}/api"
AUTH_HEADER="Authorization: Bearer ${ID_TOKEN}"
PASSED=0
FAILED=0

# IAM ポリシーの伝播を待つ（--allow-unauthenticated 設定後、反映まで最大数分かかる場合がある）
echo "Waiting for Cloud Run service to be ready..."
for i in $(seq 1 18); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "${AUTH_HEADER}" "${BASE_URL}/quest/new")
  if [ "${STATUS}" != "401" ]; then
    echo "Service is ready (status: ${STATUS})"
    break
  fi
  if [ "${i}" -eq 18 ]; then
    echo "ERROR: Service still returning 401 after 3 minutes. IAM policy may not have propagated."
    exit 1
  fi
  echo "  IAM policy propagating... (attempt ${i}/18, status: ${STATUS})"
  sleep 10
done

run_test() {
  local name="$1"
  local method="$2"
  local path="$3"
  local body="${4:-}"
  local expected_fields="${5:-}"

  echo ""
  echo "=== Test: ${name} ==="

  local curl_args=(-s -w "\n%{http_code}" -H "${AUTH_HEADER}")
  if [ "${method}" = "POST" ]; then
    curl_args+=(-X POST -H "Content-Type: application/json")
    if [ -n "${body}" ]; then
      curl_args+=(-d "${body}")
    fi
  fi

  local response
  response=$(curl "${curl_args[@]}" "${BASE_URL}${path}")

  local http_code
  http_code=$(echo "${response}" | tail -1)
  local response_body
  response_body=$(echo "${response}" | sed '$d')

  if [ "${http_code}" != "200" ]; then
    echo "FAIL: Expected 200, got ${http_code}"
    echo "Response: ${response_body}"
    FAILED=$((FAILED + 1))
    return 1
  fi

  if [ -n "${expected_fields}" ]; then
    IFS=',' read -ra fields <<< "${expected_fields}"
    for field in "${fields[@]}"; do
      local value
      value=$(echo "${response_body}" | jq -r ".${field}")
      if [ "${value}" = "null" ] || [ -z "${value}" ]; then
        echo "FAIL: Missing field '${field}' in response"
        echo "Response: ${response_body}"
        FAILED=$((FAILED + 1))
        return 1
      fi
    done
  fi

  echo "PASS (${http_code})"
  PASSED=$((PASSED + 1))
  return 0
}

echo "========================================="
echo " PokeLingual Integration Tests"
echo " Target: ${SERVICE_URL}"
echo "========================================="

# Test 1: 新しいクエストを開始
run_test "New Quest" "GET" "/quest/new" "" "pokemon_id,description_en" || true

# Test 2: 翻訳をスコアリング（実 Gemini API）
run_test "Score Translation" "POST" "/quest/score" \
  '{"translation":"テスト翻訳です"}' \
  "score" || true

# Test 3: ポケモンを捕獲
run_test "Capture Pokemon" "POST" "/quest/capture" "" \
  "pokemon_id" || true

# Test 4: コレクション取得
run_test "Get Collection" "GET" "/collection" "" \
  "pokemon" || true

# 結果サマリー
echo ""
echo "========================================="
echo " Results: ${PASSED} passed, ${FAILED} failed"
echo "========================================="

if [ "${FAILED}" -gt 0 ]; then
  echo "Integration tests FAILED"
  exit 1
fi

echo "All integration tests PASSED"
