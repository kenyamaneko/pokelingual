.PHONY: dev dev-up dev-down dev-logs dev-restart test test-backend test-frontend coverage coverage-backend coverage-frontend emulator-up emulator-down mutation mutation-backend

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
test-backend:
	cd backend && npm run lint && npx tsc --noEmit && $(EMULATOR_ENV) npx firebase emulators:exec --only firestore --project pokelingual-test "npm test"

test-frontend:
	cd frontend && npm run lint && npx tsc --noEmit && npx vitest run

# カバレッジ計測
coverage: coverage-backend coverage-frontend

# backend テストと同じく Firestore Emulator を必須とするため emulators:exec で包む。
coverage-backend:
	cd backend && $(EMULATOR_ENV) npx firebase emulators:exec --only firestore --project pokelingual-test "npm run test:coverage"

coverage-frontend:
	cd frontend && npm run test:coverage

# Mutation testing (StrykerJS)。純粋ロジックのみ対象のため Emulator 不要 = emulators:exec で包まない。
mutation: mutation-backend

mutation-backend:
	cd backend && npm run mutation
