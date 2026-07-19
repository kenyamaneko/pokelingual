.PHONY: dev dev-up dev-down dev-logs dev-restart test test-backend test-frontend coverage coverage-backend coverage-frontend emulator-up emulator-down mutation mutation-backend snapshot-clone-api-data snapshot-generate snapshot-upload-dev snapshot-upload-prod

# ローカル開発環境（Docker Compose）
dev: dev-up

dev-up:
	docker compose -f docker-compose.dev.yml up --build -d

dev-down:
	docker compose -f docker-compose.dev.yml down

dev-logs:
	docker compose -f docker-compose.dev.yml logs -f

dev-restart:
	docker compose -f docker-compose.dev.yml down
	docker compose -f docker-compose.dev.yml up --build -d

# Firestore Emulator は Java を必要とする。Homebrew で入れた keg-only な openjdk@21 を PATH 先頭に置く。
# システム /usr/bin/java はスタブで実体が無いことが多いため、ここで明示的に解決する。
JAVA_BIN := /opt/homebrew/opt/openjdk@21/bin
EMULATOR_ENV := PATH=$(JAVA_BIN):$$PATH

# Firestore Emulator 単独起動（手動デバッグ用、テストは test-backend が自動起動する）
emulator-up:
	cd backend && $(EMULATOR_ENV) npx firebase emulators:start --only firestore --project pokelingual-test

# テスト
test: test-backend test-frontend

# backend テストは Firestore Emulator を必須化している。
# firebase emulators:exec が Emulator 起動 → FIRESTORE_EMULATOR_HOST を自動注入 → 終了時に停止まで面倒を見る。
# 結合テスト (test:integration) は Valkey コンテナを testcontainers で起動するため Docker が必要。
test-backend:
	cd backend && npm run lint && npx tsc --noEmit && $(EMULATOR_ENV) npx firebase emulators:exec --only firestore --project pokelingual-test "npm test" && npm run test:integration

test-frontend:
	cd frontend && npm run lint && npx tsc --noEmit && npx vitest run

# カバレッジ計測
coverage: coverage-backend coverage-frontend

# backend テストと同じく Firestore Emulator を必須とするため emulators:exec で包む。
coverage-backend:
	cd backend && $(EMULATOR_ENV) npx firebase emulators:exec --only firestore --project pokelingual-test "npm run test:coverage" && npm run test:integration

coverage-frontend:
	cd frontend && npm run test:coverage

# Mutation testing (StrykerJS)。純粋ロジックのみ対象のため Emulator 不要 = emulators:exec で包まない。
mutation: mutation-backend

mutation-backend:
	cd backend && npm run mutation

# ポケモンスナップショットの生成・配置。手動運用のため CI では実行しない。
# 対象バージョン (X〜ソード/シールド) の EN/JA 説明文が揃う第8世代の全国図鑑上限。
POKEMON_SNAPSHOT_MAX_ID := 898
POKEMON_API_DATA_DIR := api-data

snapshot-clone-api-data:
	test -d $(POKEMON_API_DATA_DIR) || git clone --depth 1 https://github.com/PokeAPI/api-data.git $(POKEMON_API_DATA_DIR)

# 生成物 (backend/pokemon-snapshot.json) はポケモン社の著作物を含むため、公開リポジトリにコミットしない。
snapshot-generate: snapshot-clone-api-data
	cd backend && npm run generate-snapshot -- --api-data ../$(POKEMON_API_DATA_DIR) --out pokemon-snapshot.json --max-id $(POKEMON_SNAPSHOT_MAX_ID)

snapshot-upload-dev:
	gcloud storage cp backend/pokemon-snapshot.json gs://pokelingual-dev-pokemon-snapshot/pokemon-snapshot.json

snapshot-upload-prod:
	gcloud storage cp backend/pokemon-snapshot.json gs://pokelingual-prod-pokemon-snapshot/pokemon-snapshot.json
