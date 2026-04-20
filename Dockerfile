# syntax=docker/dockerfile:1.7

# ============================================================================
# Stage 1: build — устанавливаем зависимости монорепы и собираем api-server
# ============================================================================
FROM node:22-alpine AS builder

# pnpm ставим через corepack (встроен в Node 22, не нужно brew/npm i -g)
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /repo

# Сначала копируем ТОЛЬКО манифесты — чтобы Docker закешировал pnpm install
# и не переустанавливал зависимости при каждом изменении кода
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/portal/package.json artifacts/portal/
COPY lib/db/package.json lib/db/
COPY scripts/package.json scripts/

# Ставим все зависимости монорепы (нужны для сборки, включая dev)
RUN pnpm install --frozen-lockfile

# Теперь копируем весь исходный код
COPY . .

# Собираем api-server (esbuild бандлит src/index.ts → dist/index.mjs)
RUN pnpm --filter @workspace/api-server run build

# pnpm deploy — создаёт self-contained папку /deploy с только нужными
# для api-server файлами и production-зависимостями
RUN pnpm --filter @workspace/api-server deploy --prod /deploy

# ============================================================================
# Stage 2: runtime — маленький образ только с тем что нужно для запуска
# ============================================================================
FROM node:22-alpine AS runtime

WORKDIR /app

# Копируем готовый срез из build-стадии
COPY --from=builder /deploy/dist ./dist
COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /deploy/package.json ./package.json

# Запускаем под непривилегированным пользователем (безопаснее)
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

# Azure Container Apps подставит свой PORT, этот EXPOSE — чисто документация
EXPOSE 8080

# Стартовый скрипт из artifacts/api-server/package.json
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]