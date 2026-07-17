#!/bin/bash
# Start the market-stream mini-service and the Next.js dev server.
# Designed to survive shell exit (uses setsid + nohup semantics).
cd /home/z/my-project

# Kill any stale instances
pkill -f "market-stream/index" 2>/dev/null
pkill -f "next-server" 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 2

# Start market-stream service (REST 3004 + WS 3003)
setsid bun --hot mini-services/market-stream/index.ts > /home/z/my-project/market-stream.log 2>&1 < /dev/null &
echo "market-stream pid $!"

sleep 2

# Start Next.js dev server directly (avoid bun x wrapper which orphans children)
setsid node node_modules/next/dist/bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1 < /dev/null &
echo "next dev pid $!"

sleep 1
echo "Both services launched."
