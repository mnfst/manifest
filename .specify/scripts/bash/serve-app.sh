#!/bin/bash
# Serve the app on random available ports for testing
# Usage: .specify/scripts/bash/serve-app.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Function to find a random available port
find_available_port() {
    local port
    while true; do
        # Generate random port between 3000 and 9999
        port=$((RANDOM % 7000 + 3000))
        # Check if port is available
        if ! lsof -i :$port >/dev/null 2>&1; then
            echo $port
            return
        fi
    done
}

# Find available ports
BACKEND_PORT=$(find_available_port)
# Make sure frontend port is different
while true; do
    FRONTEND_PORT=$(find_available_port)
    if [ "$FRONTEND_PORT" != "$BACKEND_PORT" ]; then
        break
    fi
done

echo ""
echo "=========================================="
echo "  Starting App for Testing"
echo "=========================================="
echo ""
echo "Backend port:  $BACKEND_PORT"
echo "Frontend port: $FRONTEND_PORT"
echo ""

# Kill any existing processes on these ports (safety check)
lsof -ti :$BACKEND_PORT | xargs kill -9 2>/dev/null || true
lsof -ti :$FRONTEND_PORT | xargs kill -9 2>/dev/null || true

# Start backend in background
echo "Starting backend..."
cd "$PROJECT_ROOT/packages/backend"
PORT=$BACKEND_PORT pnpm dev > /tmp/backend-$BACKEND_PORT.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
echo -n "Waiting for backend to start"
for i in {1..30}; do
    if curl -s http://localhost:$BACKEND_PORT/api >/dev/null 2>&1; then
        echo " ready!"
        break
    fi
    echo -n "."
    sleep 1
done

# Start frontend in background
echo "Starting frontend..."
cd "$PROJECT_ROOT/packages/frontend"
VITE_API_URL="http://localhost:$BACKEND_PORT" npx vite --port $FRONTEND_PORT > /tmp/frontend-$FRONTEND_PORT.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to be ready
echo -n "Waiting for frontend to start"
for i in {1..30}; do
    if curl -s http://localhost:$FRONTEND_PORT >/dev/null 2>&1; then
        echo " ready!"
        break
    fi
    echo -n "."
    sleep 1
done

echo ""
echo "=========================================="
echo "  App is Running!"
echo "=========================================="
echo ""
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "  Backend:  http://localhost:$BACKEND_PORT"
echo "  API:      http://localhost:$BACKEND_PORT/api"
echo ""
echo "  Backend PID:  $BACKEND_PID"
echo "  Frontend PID: $FRONTEND_PID"
echo ""
echo "  Logs:"
echo "    Backend:  /tmp/backend-$BACKEND_PORT.log"
echo "    Frontend: /tmp/frontend-$FRONTEND_PORT.log"
echo ""
echo "  To stop: kill $BACKEND_PID $FRONTEND_PID"
echo "=========================================="
echo ""

# Create a stop script for convenience
STOP_SCRIPT="/tmp/stop-app-$BACKEND_PORT-$FRONTEND_PORT.sh"
cat > "$STOP_SCRIPT" << EOF
#!/bin/bash
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
echo "App stopped."
EOF
chmod +x "$STOP_SCRIPT"
echo "  Quick stop: $STOP_SCRIPT"
echo ""
