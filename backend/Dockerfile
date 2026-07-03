FROM node:22-alpine AS builder

WORKDIR /app

# build context をリポジトリルートに置く前提。shared/api-types の .d.ts を tsc が参照できるよう同じ相対位置で配置する。
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN npm ci

WORKDIR /app
COPY backend/tsconfig.json backend/tsconfig.build.json ./backend/
COPY backend/src ./backend/src
COPY shared/api-types ./shared/api-types

WORKDIR /app/backend
RUN npm run build

FROM node:22-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/backend/dist ./dist

EXPOSE 8080

CMD ["node", "dist/main.js"]
