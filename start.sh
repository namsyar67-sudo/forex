#!/bin/bash
# Start the AI Trading Terminal with correct PostgreSQL environment
# This script ensures DATABASE_URL is always set to Supabase PostgreSQL

cd /home/z/my-project

# Kill any existing instances
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
sleep 2
rm -f .next/dev/lock

# CRITICAL: Override any inherited DATABASE_URL with PostgreSQL
export DATABASE_URL="postgresql://postgres.ibsmqmcbrqftcnypdyrq:RwNZjzlLfwxAfxnz@aws-0-eu-west-3.pooler.supabase.com:5432/postgres"

# Start the dev server with watchdog
while true; do
  echo "[watchdog] starting server at $(date)" >> /home/z/my-project/dev.log
  node --max-old-space-size=1536 node_modules/next/dist/bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  echo "[watchdog] server exited, restarting in 3s..." >> /home/z/my-project/dev.log
  sleep 3
done
