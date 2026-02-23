#!/usr/bin/env bash
#
# Marionette - Create Startup Scripts
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/helpers.sh"

create_startup_scripts() {
    print_header "Creating Startup Scripts"

    # Create start script
    cat > "$PROJECT_ROOT/start.sh" << 'EOF'
#!/usr/bin/env bash
# Start all Marionette services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting Marionette..."
echo ""

# Start database
echo "📊 Starting database..."
docker-compose up -d

# Wait for database
sleep 2

# Start server in background
echo "🖥️  Starting server..."
cd "$SCRIPT_DIR/apps/server"
pnpm dev > /tmp/marionette-server.log 2>&1 &
SERVER_PID=$!

# Start web dashboard in background
echo "🌐 Starting dashboard..."
cd "$SCRIPT_DIR/apps/web"
pnpm dev > /tmp/marionette-web.log 2>&1 &
WEB_PID=$!

cd "$SCRIPT_DIR"

echo ""
echo "✅ Marionette started!"
echo ""
echo "📊 Dashboard: http://localhost:5173"
echo "🔌 API:       http://localhost:8787"
echo ""
echo "📝 Logs:"
echo "   Server:    tail -f /tmp/marionette-server.log"
echo "   Dashboard: tail -f /tmp/marionette-web.log"
echo ""
echo "🛑 To stop: ./stop.sh"
EOF

    chmod +x "$PROJECT_ROOT/start.sh"
    print_success "Start script created: ./start.sh"

    # Create stop script
    cat > "$PROJECT_ROOT/stop.sh" << 'EOF'
#!/usr/bin/env bash
# Stop all Marionette services

echo "🛑 Stopping Marionette..."

# Kill Node processes
pkill -f "marionette.*pnpm" || true
pkill -f "marionette.*vite" || true

# Stop database
docker-compose down

echo "✅ Marionette stopped"
EOF

    chmod +x "$PROJECT_ROOT/stop.sh"
    print_success "Stop script created: ./stop.sh"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    create_startup_scripts
fi
