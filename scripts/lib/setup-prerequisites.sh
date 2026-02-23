#!/usr/bin/env bash
#
# Marionette - Check Prerequisites
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check if Claude CLI is installed
    if ! command -v claude &> /dev/null; then
        print_error "Claude CLI not found!"
        echo -e "  Install Claude CLI first: ${YELLOW}npm install -g @anthropics/claude-code${NC}"
        exit 1
    fi
    print_success "Claude CLI found: $(command -v claude)"

    # Check if pnpm is installed
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm not found!"
        echo -e "  Install pnpm: ${YELLOW}npm install -g pnpm${NC}"
        exit 1
    fi
    print_success "pnpm found: $(pnpm --version)"

    # Check if Docker is running
    if ! docker info &> /dev/null; then
        print_warning "Docker not running - you'll need to start it for the database"
    else
        print_success "Docker is running"
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    check_prerequisites
fi
