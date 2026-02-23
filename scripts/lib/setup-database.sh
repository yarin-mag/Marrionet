#!/usr/bin/env bash
#
# Marionette - Setup Database
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/helpers.sh"

setup_database() {
    print_header "Setting Up Database"

    if ! docker info &> /dev/null; then
        print_warning "Docker not running - skipping database setup"
        print_warning "Start Docker and run: docker-compose up -d"
        return
    fi

    print_step "Starting PostgreSQL container..."
    cd "$PROJECT_ROOT"
    docker-compose up -d

    # Wait for database to be ready
    print_step "Waiting for database to be ready..."
    sleep 5

    # Run migrations
    print_step "Running database migrations..."
    pnpm --filter marionette-server migrate

    print_success "Database ready"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    setup_database
fi
