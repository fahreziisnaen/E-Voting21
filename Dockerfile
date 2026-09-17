# syntax=docker/dockerfile:1

# Satu image berisi API Express + hasil build React (satu origin, cookie SameSite=Strict).

# ── Basis: Debian slim (glibc) agar binary native argon2 & Prisma cocok ─────────────
FROM node:24-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
  NPM_CONFIG_FUND=false \
  NPM_CONFIG_AUDIT=false \
  CHECKPOINT_DISABLE=1
WORKDIR /app

# ── Build: kompilasi server (tsc) dan client (vite) ─────────────────────────────────
FROM base AS build
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci
COPY client ./client
COPY server ./server
# `prisma generate` hanya membaca DATABASE_URL dari konfigurasi; tidak terhubung ke database.
RUN DATABASE_URL="mysql://build:build@localhost:3306/build" npm run build

# ── Dependensi produksi server saja (tanpa Vite, Vitest, TypeScript, dll.) ───────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci --omit=dev --workspace server

# ── Runtime ──────────────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production \
  PORT=4000
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/server/package.json /app/server/prisma.config.ts ./server/
COPY --from=build /app/server/prisma ./server/prisma
# Sumber TypeScript (termasuk Prisma Client hasil generate) dipakai seeder lewat tsx.
COPY --from=build /app/server/src ./server/src
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
COPY docker/start.sh /usr/local/bin/evoting-start
RUN sed -i 's/\r$//' /usr/local/bin/evoting-start \
  && chmod +x /usr/local/bin/evoting-start \
  && mkdir -p /app/server/uploads \
  && chown node:node /app/server/uploads

USER node
WORKDIR /app/server
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["evoting-start"]
