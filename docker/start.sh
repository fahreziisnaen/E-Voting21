#!/bin/sh
# Dijalankan setiap container `app` start: migrasi → seed (hanya jika database kosong) → server.
set -e

echo "[evoting] Menerapkan migrasi database…"
npx --no-install prisma migrate deploy

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "[evoting] Memeriksa data awal…"
  SEED_ONLY_IF_EMPTY=true npx --no-install prisma db seed
fi

exec node dist/index.js
