#!/bin/bash
# Docker entrypoint — starts the market-stream service and Next.js app.

set -e

echo "Starting market-stream service..."
cd /app/mini-services/market-stream
bun index.ts &
STREAM_PID=$!

sleep 2

echo "Starting Next.js terminal..."
cd /app
bun run db:push
bun x next start -p 3000 &
APP_PID=$!

# Wait for either process to exit
wait -n $STREAM_PID $APP_PID
EXIT_CODE=$?

# Kill the other process
kill $STREAM_PID $APP_PID 2>/dev/null || true
exit $EXIT_CODE
