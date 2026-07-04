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
# 401 = Cloud Run の IAM レベルで拒否されている（まだ伝播していない）
# 200/403 = IAM は通過した（403 はアプリレベルの認証問題なのでここでは無視）
echo "Waiting for Cloud Run IAM policy to propagate..."
for i in $(seq 1 18); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "${AUTH_HEADER}" "${BASE_URL}/quest/new")
  if [ "${STATUS}" != "401" ]; then
    echo "IAM policy ready (status: ${STATUS})"
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

  local curl_args=(-s -w "\n%{http_code}\n%{time_total}" -H "${AUTH_HEADER}")
  if [ "${method}" = "POST" ]; then
    curl_args+=(-X POST -H "Content-Type: application/json")
    if [ -n "${body}" ]; then
      curl_args+=(-d "${body}")
    fi
  fi

  local raw_response
  raw_response=$(curl "${curl_args[@]}" "${BASE_URL}${path}")

  local response_body http_code response_time
  response_time=$(echo "${raw_response}" | tail -1)
  http_code=$(echo "${raw_response}" | tail -2 | head -1)
  response_body=$(echo "${raw_response}" | sed -n '1,/^[0-9]\{3\}$/{ /^[0-9]\{3\}$/!p; }' | head -n -0)
  # More robust extraction: remove last two lines (http_code and time)
  response_body=$(echo "${raw_response}" | head -n -2)

  echo "  Status: ${http_code}, Time: ${response_time}s"

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

  # Export response body for further validation
  LAST_RESPONSE="${response_body}"
  LAST_TIME="${response_time}"

  echo "PASS (${http_code})"
  PASSED=$((PASSED + 1))
  return 0
}

fail_test() {
  local name="$1"
  local reason="$2"
  echo "FAIL [${name}]: ${reason}"
  FAILED=$((FAILED + 1))
}

pass_test() {
  local name="$1"
  echo "PASS [${name}]"
  PASSED=$((PASSED + 1))
}

LAST_RESPONSE=""
LAST_TIME=""

echo "========================================="
echo " PokeLingual Integration Tests"
echo " Target: ${SERVICE_URL}"
echo "========================================="

# ============================================================
# Test 0: prod モード検証 — 認証なしリクエストは 401 を返すこと
# devmock はどのリクエストも認証なしで通すため、401 なら prod モード確定
# ============================================================
echo ""
echo "=== Test: Verify Prod Mode (no auth → 401) ==="
NO_AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/quest/new")
if [ "${NO_AUTH_STATUS}" = "401" ]; then
  pass_test "Prod Mode Check"
  echo "  Auth middleware is active (401 without token)"
else
  fail_test "Prod Mode Check" "Expected 401 without auth, got ${NO_AUTH_STATUS}. Backend may be running devmock!"
fi

# ============================================================
# Test 1: 新しいクエストを開始（実 PokeAPI）
# ============================================================
run_test "New Quest" "GET" "/quest/new" "" "pokemon_id,description_en" || true

if [ -n "${LAST_RESPONSE}" ]; then
  # pokemon_id は 1-898 の範囲であること
  POKEMON_ID=$(echo "${LAST_RESPONSE}" | jq -r '.pokemon_id')
  if [ "${POKEMON_ID}" -ge 1 ] && [ "${POKEMON_ID}" -le 898 ]; then
    pass_test "Pokemon ID Range (${POKEMON_ID})"
  else
    fail_test "Pokemon ID Range" "pokemon_id=${POKEMON_ID} is out of range 1-898"
  fi

  # description_en が 20 文字以上であること（実際の図鑑説明は長い）
  DESC_EN=$(echo "${LAST_RESPONSE}" | jq -r '.description_en')
  DESC_LEN=${#DESC_EN}
  if [ "${DESC_LEN}" -ge 20 ]; then
    pass_test "Description Length (${DESC_LEN} chars)"
  else
    fail_test "Description Length" "description_en is only ${DESC_LEN} chars: '${DESC_EN}'"
  fi
fi

# ============================================================
# Test 2: 翻訳をスコアリング（実 Gemini API）
# ============================================================
run_test "Score Translation" "POST" "/quest/score" \
  '{"translation":"テスト翻訳です"}' \
  "score,review,description_ja" || true

if [ -n "${LAST_RESPONSE}" ]; then
  # score は 0-100 の数値であること
  SCORE=$(echo "${LAST_RESPONSE}" | jq -r '.score')
  SCORE_INT=$(printf "%.0f" "${SCORE}" 2>/dev/null || echo "-1")
  if [ "${SCORE_INT}" -ge 0 ] && [ "${SCORE_INT}" -le 100 ]; then
    pass_test "Score Range (${SCORE})"
  else
    fail_test "Score Range" "score=${SCORE} is out of range 0-100"
  fi

  # description_ja が存在すること
  DESC_JA=$(echo "${LAST_RESPONSE}" | jq -r '.description_ja')
  if [ -n "${DESC_JA}" ] && [ "${DESC_JA}" != "null" ]; then
    pass_test "Description JA exists"
  else
    fail_test "Description JA" "description_ja is empty or null"
  fi
fi

# ============================================================
# Test 3: ポケモンを捕獲
# ============================================================
run_test "Capture Pokemon" "POST" "/quest/capture" "" \
  "pokemon_id,name_en,name_ja,sprite_url,description_en,description_ja" || true

if [ -n "${LAST_RESPONSE}" ]; then
  # captured は boolean であること
  CAPTURED=$(echo "${LAST_RESPONSE}" | jq -r '.captured')
  if [ "${CAPTURED}" = "true" ] || [ "${CAPTURED}" = "false" ]; then
    pass_test "Captured is boolean (${CAPTURED})"
  else
    fail_test "Captured type" "captured=${CAPTURED} is not a boolean"
  fi
fi

# ============================================================
# Test 4: 図鑑取得
# ============================================================
run_test "Get Pokedex" "GET" "/pokedex" "" \
  "pokemon" || true

# ============================================================
# 結果サマリー
# ============================================================
echo ""
echo "========================================="
echo " Results: ${PASSED} passed, ${FAILED} failed"
echo "========================================="

if [ "${FAILED}" -gt 0 ]; then
  echo "Integration tests FAILED"
  exit 1
fi

echo "All integration tests PASSED"
