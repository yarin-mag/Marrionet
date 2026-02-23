# Marionette Setup Library

Modular setup components for Marionette installation and configuration.

## Overview

The setup system is split into focused, reusable modules that can be run independently or orchestrated together.

## Modules

### Core Helpers

**`helpers.sh`** - Shared utility functions
- Color definitions (RED, GREEN, YELLOW, BLUE, CYAN)
- Print functions (print_header, print_step, print_success, print_warning, print_error)
- Used by all other modules

### Setup Phases

**`setup-prerequisites.sh`** - Check system requirements
- Verifies Claude CLI is installed
- Verifies pnpm is installed
- Checks if Docker is running
- **Standalone usage:** `./scripts/lib/setup-prerequisites.sh`

**`setup-dependencies.sh`** - Install and build packages
- Installs all pnpm dependencies
- Builds shared package
- Builds server
- Builds MCP server
- **Standalone usage:** `./scripts/lib/setup-dependencies.sh`

**`setup-database.sh`** - Setup PostgreSQL database
- Starts Docker Compose database
- Waits for database to be ready
- Runs migrations
- **Standalone usage:** `./scripts/lib/setup-database.sh`

**`setup-wrapper.sh`** - Configure Claude wrapper
- Makes wrapper script executable
- Detects shell (bash/zsh/fish)
- Adds alias to shell config
- Configures MARIONETTE_API_URL
- **Standalone usage:** `./scripts/lib/setup-wrapper.sh`

**`setup-hooks.sh`** - Install Claude hooks
- Creates ~/.claude directory
- Backs up existing hooks
- Installs 8 lifecycle hooks:
  - user-prompt-submit
  - agent-response-complete
  - tool-execution-start
  - tool-execution-complete
  - session-start
  - session-end
  - error
  - agent-blocked
- **Standalone usage:** `./scripts/lib/setup-hooks.sh`

**`setup-mcp.sh`** - Configure MCP server
- Creates MCP settings directory
- Installs or updates ~/.claude/mcp_settings.json
- Configures marionette MCP server
- **Standalone usage:** `./scripts/lib/setup-mcp.sh`

**`setup-scripts.sh`** - Create start/stop scripts
- Creates start.sh (launch all services)
- Creates stop.sh (shutdown all services)
- Makes scripts executable
- **Standalone usage:** `./scripts/lib/setup-scripts.sh`

**`print-instructions.sh`** - Display final setup instructions
- Prints completion message
- Shows next steps
- Lists features enabled
- Provides useful commands
- **Standalone usage:** `./scripts/lib/print-instructions.sh`

## Usage

### Complete Setup (Recommended)

Run the main orchestrator:
```bash
./setup.sh
```

This runs all modules in sequence.

### Selective Updates

Run individual modules for targeted updates:

```bash
# Update only hooks
./scripts/lib/setup-hooks.sh

# Rebuild dependencies
./scripts/lib/setup-dependencies.sh

# Reconfigure MCP server
./scripts/lib/setup-mcp.sh

# Recreate start/stop scripts
./scripts/lib/setup-scripts.sh
```

### Custom Workflows

Source modules in custom scripts:
```bash
#!/usr/bin/env bash
source ./scripts/lib/helpers.sh
source ./scripts/lib/setup-hooks.sh

print_header "Custom Setup"
setup_hooks
print_success "Done!"
```

## File Sizes

- Main setup.sh: **48 lines** (down from 510 lines)
- helpers.sh: ~40 lines
- setup-prerequisites.sh: ~45 lines
- setup-dependencies.sh: ~50 lines
- setup-database.sh: ~40 lines
- setup-wrapper.sh: ~60 lines
- setup-hooks.sh: ~180 lines (hook definitions)
- setup-mcp.sh: ~60 lines
- setup-scripts.sh: ~80 lines
- print-instructions.sh: ~60 lines

**Total:** ~660 lines across 10 focused files vs 510 lines in one monolithic file

## Benefits

### Maintainability
- Each file has a single responsibility
- Easy to find and modify specific functionality
- Clear separation of concerns

### Testability
- Each module can be tested independently
- Easy to verify individual components

### Reusability
- Modules can be used in other scripts
- Shared helpers reduce duplication

### User Experience
- Users can update specific parts without full reinstall
- Faster for selective changes
- Clear documentation per module

## Architecture

```
setup.sh (orchestrator)
├── helpers.sh (utilities)
├── setup-prerequisites.sh (checks)
├── setup-dependencies.sh (install + build)
├── setup-database.sh (postgres)
├── setup-wrapper.sh (wrapper config)
├── setup-hooks.sh (8 hooks)
├── setup-mcp.sh (MCP config)
├── setup-scripts.sh (start/stop)
└── print-instructions.sh (final message)
```

## Best Practices

Each module follows these patterns:

1. **Shebang and description**
   ```bash
   #!/usr/bin/env bash
   #
   # Marionette - Module Description
   #
   ```

2. **Strict error handling**
   ```bash
   set -euo pipefail
   ```

3. **Source helpers**
   ```bash
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   source "$SCRIPT_DIR/helpers.sh"
   ```

4. **Main function**
   ```bash
   module_function() {
       print_header "Phase Name"
       # ... implementation
       print_success "Phase complete"
   }
   ```

5. **Standalone execution**
   ```bash
   if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
       module_function
   fi
   ```

This allows modules to be both sourced and executed directly.
