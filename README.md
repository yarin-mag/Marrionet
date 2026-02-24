# Marionette

**Real-time monitoring and analytics for Claude CLI conversations**

Monitor your AI development workflow with live conversation capture, process tracking, and comprehensive analytics.

## ⚡ Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- Git

### Installation & Setup
```bash
git clone https://github.com/your-org/marionette.git
cd marionette
./setup.sh
```

### Development
```bash
# Run backend + frontend together
pnpm dev

# Or run separately:
pnpm dev:backend   # Backend only (http://localhost:8787)
pnpm dev:frontend  # Frontend only (http://localhost:5173)
```

### Production Build
```bash
pnpm build
pnpm start
```

### Alternative: Quick Install (All-in-One)
```bash
./setup.sh  # Automated setup for CI/CD or quick testing
```

For complete installation guide and troubleshooting, see [SETUP.md](SETUP.md)

## 🎯 Features

- **Real-time Conversation Monitoring** - Capture every Claude CLI interaction
- **Process & Network Tracking** - Monitor all system activities
- **Web Dashboard** - Beautiful UI for visualization and analytics
- **MCP Integration** - Seamless Claude Code integration
- **Developer Tools** - REST API, WebSocket events, hooks system

## 📖 Documentation

- [Setup Guide](SETUP.md) - Complete installation
- [Getting Started](scripts/docs/guides/GETTING_STARTED.md) - Quick tutorial
- [Architecture](ARCHITECTURE.md) - System design overview
- [Migration Complete](MIGRATION_COMPLETE.md) - Database architecture decisions
- [API Reference](scripts/docs/api/EVENTS.md) - Event schemas

## 🔧 Development Commands

```bash
pnpm dev          # Run backend + frontend together
pnpm build        # Build all packages
pnpm test         # Run all tests
pnpm lint         # Lint all packages
./status.sh       # Check service status
```

See [SETUP.md](SETUP.md) for detailed setup instructions.

## 🤝 Contributing

### For Contributors

#### Development Workflow
1. Read [CLAUDE.md](CLAUDE.md) for AI assistant integration guidelines
2. Read [ARCHITECTURE.md](ARCHITECTURE.md) for system design overview
3. Run `pnpm dev` to start local development environment
4. Make changes and test locally
5. Run `pnpm test` before committing to ensure all tests pass
6. Run `pnpm lint` to check code quality

#### Key Commands
- `pnpm dev` - Start backend + frontend together
- `pnpm dev:backend` - Start backend only (port 8787)
- `pnpm dev:frontend` - Start frontend only (port 5173)
- `pnpm test` - Run all tests across workspaces
- `pnpm lint` - Check code quality
- `pnpm build` - Production build
- `./status.sh` - Check service health and status

#### Project Structure
- `apps/server/` - Backend API (Express + WebSocket)
- `apps/web/` - Web dashboard (React + Vite)
- `scripts/` - Claude wrapper (TypeScript modules)
- `docs/` - Documentation and guides

See [Contributing Guide](scripts/docs/guides/CONTRIBUTING.md) for more details

## 📜 License

MIT License

---

**Made with ❤️ for the Claude developer community**
