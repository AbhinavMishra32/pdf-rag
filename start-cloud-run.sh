#!/bin/sh
set -e

echo "[entrypoint] starting web + worker"

# Cleanup on exit
cleanup() {
	echo "[entrypoint] Shutting down..."
	if [ -n "${WORKER_PID}" ] && kill -0 "$WORKER_PID" 2>/dev/null; then
		echo "[entrypoint] Killing worker PID ${WORKER_PID}"
		kill $WORKER_PID 2>/dev/null || true
		wait $WORKER_PID 2>/dev/null || true
	fi
}
trap cleanup TERM INT EXIT

# If we launch a dedicated worker process here, disable embedded autostart
export ENABLE_EMBEDDED_WORKER=0

# Start worker (background)
npm run worker &
WORKER_PID=$!
echo "[entrypoint] Worker started with PID ${WORKER_PID}"

# Web (foreground)
echo "[entrypoint] Launching Next.js on port ${PORT:-8080}"
npm run start

# Exited
echo "[entrypoint] Web process exited"
