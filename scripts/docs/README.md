# Claude Wrapper Documentation

Welcome to the Marionette Claude Wrapper documentation! This wrapper captures Claude CLI conversations and streams them to the Marionette backend for monitoring and analysis.

## Quick Links

- **[Architecture Overview](architecture/OVERVIEW.md)** - System design and components
- **[Getting Started](guides/GETTING_STARTED.md)** - Quick start guide
- **[Module Reference](modules/)** - Deep dives into each module
- **[API Reference](api/)** - Event schemas and interfaces
- **[Development Guide](guides/DEVELOPMENT.md)** - Contributing and development workflow

## Documentation Structure

### 📐 [Architecture](architecture/)
System design, principles, and data flow diagrams:
- [OVERVIEW.md](architecture/OVERVIEW.md) - High-level architecture
- [DESIGN_PRINCIPLES.md](architecture/DESIGN_PRINCIPLES.md) - SOLID principles and patterns
- [DATA_FLOW.md](architecture/DATA_FLOW.md) - Message and event flow
- [DEPENDENCY_GRAPH.md](architecture/DEPENDENCY_GRAPH.md) - DI container details

### 🧩 [Modules](modules/)
Deep technical documentation for each module:
- [CORE.md](modules/CORE.md) - Core components (Logger, IdGenerator, ClaudeWrapperApp)
- [WEBSOCKET.md](modules/WEBSOCKET.md) - WebSocket communication
- [CAPTURE.md](modules/CAPTURE.md) - Message capture system
- [PROCESS.md](modules/PROCESS.md) - Process management
- [MONITORING.md](modules/MONITORING.md) - Monitoring framework
- [LIFECYCLE.md](modules/LIFECYCLE.md) - Startup and shutdown
- [HOOKS.md](modules/HOOKS.md) - Hook registry system
- [FACTORY.md](modules/FACTORY.md) - Dependency injection

### 📚 [API Reference](api/)
Complete API documentation:
- [EVENTS.md](api/EVENTS.md) - Event type catalog with schemas
- [INTERFACES.md](api/INTERFACES.md) - Interface contracts
- [TYPES.md](api/TYPES.md) - Type definitions
- [CONFIG.md](api/CONFIG.md) - Configuration options

### 📖 [Guides](guides/)
How-to guides and tutorials:
- [GETTING_STARTED.md](guides/GETTING_STARTED.md) - Installation and setup
- [DEVELOPMENT.md](guides/DEVELOPMENT.md) - Development workflow
- [TESTING.md](guides/TESTING.md) - Testing guide
- [DEBUGGING.md](guides/DEBUGGING.md) - Debugging tips
- [CONTRIBUTING.md](guides/CONTRIBUTING.md) - Contribution guidelines

### 🔄 [Migration](migration/)
Migration and rollback information:
- [FROM_V1.md](migration/FROM_V1.md) - Migrating from legacy wrapper
- [ROLLBACK.md](migration/ROLLBACK.md) - Rollback procedure

## For Developers

### Quick Start
```bash
# Install dependencies
npm install

# Build the wrapper
npm run build

# Run tests
npm run test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

### Key Resources
- [Development Workflow](guides/DEVELOPMENT.md)
- [Testing Strategy](guides/TESTING.md)
- [Contributing Guidelines](guides/CONTRIBUTING.md)
- [Debugging Guide](guides/DEBUGGING.md)

## Version Information

- **Current Version**: 2.0.0 (TypeScript Refactoring)
- **Legacy Version**: 1.x (JavaScript)
- **Compatibility**: 100% backward compatible with v1.x

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/marionette)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/marionette/discussions)
- **Documentation**: This directory

## License

[Your License Here]
