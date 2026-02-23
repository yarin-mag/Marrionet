#!/usr/bin/env bash
#
# Marionette - Install Dependencies and Build Projects
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/helpers.sh"

install_dependencies() {
    print_header "Installing Dependencies"

    print_step "Installing Node packages..."
    cd "$PROJECT_ROOT"
    pnpm install
    print_success "Dependencies installed"
}

build_projects() {
    print_header "Building Projects"

    cd "$PROJECT_ROOT"

    print_step "Building shared package..."
    pnpm --filter @marionette/shared build
    print_success "Shared package built"

    print_step "Building server..."
    pnpm --filter marionette-server build
    print_success "Server built"

    print_step "Building MCP server..."
    pnpm --filter @marionette/mcp-server build
    print_success "MCP server built"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    install_dependencies
    build_projects
fi
