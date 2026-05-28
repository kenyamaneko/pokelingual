.PHONY: dev dev-up dev-down dev-logs dev-restart test test-backend test-frontend

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

# テスト
test: test-backend test-frontend

test-backend:
	cd backend && npx tsc --noEmit && npm test

test-frontend:
	cd frontend && npm run lint && npx tsc --noEmit && npx vitest run
