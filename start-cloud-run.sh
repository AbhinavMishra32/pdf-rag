#!/bin/sh
set -e

echo "[entrypoint] starting web (in-memory worker embedded)"

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

echo "[entrypoint] Launching Next.js on port ${PORT:-8080}"
NODE_ENV=production npm run start

# Exited
echo "[entrypoint] Web process exited"
