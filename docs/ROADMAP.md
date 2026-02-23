# Marionette Feature Roadmap

## Overview

This document outlines the planned features and enhancements for Marionette, organized by implementation phases. Features are categorized by effort level and expected value to users.

---

## Phase 1: Immediate Enhancements (Next 2-4 weeks)

High value, low to medium effort features that significantly improve usability.

### 1. Docker Compose Setup
**Priority:** HIGH
**Effort:** Medium
**Description:** One-command containerized deployment including backend, frontend, and database.

**Benefits:**
- Simplified deployment and setup
- Consistent environment across development and production
- Easier onboarding for new contributors
- Portable and reproducible builds

**Implementation:**
- Create `docker-compose.yml` with services for backend, frontend, database
- Add Dockerfiles for backend and frontend
- Update documentation with Docker setup instructions
- Test on multiple platforms (macOS, Linux, Windows)

---

### 2. Agent Search & Filtering
**Priority:** HIGH
**Effort:** Low
**Description:** Add search bar and filters to quickly find agents by name, status, or task.

**Features:**
- Text search for agent names and tasks
- Filter by status (active, idle, error)
- Date range filter for agent history
- Sort by various metrics (token usage, uptime, last activity)

**Benefits:**
- Essential for managing multiple agents
- Improves dashboard usability significantly
- Quick access to specific agent data

---

### 3. Performance Metrics Visualization
**Priority:** HIGH
**Effort:** Medium
**Description:** Add charts and graphs for visualizing agent performance over time.

**Features:**
- Token usage trends (line charts)
- Response time distribution (histograms)
- Memory and CPU usage graphs
- Comparative metrics across agents

**Implementation:**
- Integrate charting library (Chart.js or Recharts)
- Create reusable chart components
- Add time range selectors (1h, 6h, 24h, 7d, 30d)
- Store historical metrics in database

---

### 4. Export Functionality
**Priority:** MEDIUM
**Effort:** Low
**Description:** Export agent conversations and performance reports to various formats.

**Features:**
- Export conversation to JSON
- Export conversation to Markdown
- Export performance reports to CSV
- Export dashboard screenshots to PNG

**Benefits:**
- Data portability and backup
- Share insights with team members
- Offline analysis and reporting
- Integration with external tools

---

## Phase 2: User Experience (1-2 months)

Features that enhance daily usage and developer productivity.

### 5. Dark Mode
**Priority:** MEDIUM
**Effort:** Low
**Description:** Toggle between light and dark themes with persistent preference.

**Implementation:**
- CSS variable-based theme system
- Toggle switch in dashboard header
- Persist preference in localStorage
- Smooth transitions between themes

---

### 6. VS Code Extension
**Priority:** HIGH
**Effort:** High
**Description:** View Marionette metrics directly in VS Code sidebar.

**Features:**
- Real-time agent status in sidebar
- Quick access to conversation history
- Jump to agent context from editor
- Performance metrics at a glance
- Inline notifications for errors

**Benefits:**
- Seamless integration with developer workflow
- No context switching required
- Increased adoption among developers

---

### 7. CI/CD Pipeline
**Priority:** MEDIUM
**Effort:** Medium
**Description:** Automated testing and deployment pipeline with GitHub Actions.

**Features:**
- Automated testing on pull requests
- Lint and type checking
- Build verification
- Automated deployments on merge to main
- Version tagging and release notes

---

### 8. Agent Comparison
**Priority:** MEDIUM
**Effort:** Medium
**Description:** Side-by-side comparison of multiple agents' performance metrics.

**Features:**
- Select 2-4 agents to compare
- Visualize metrics side-by-side
- Compare token usage, error rates, response times
- Identify performance differences
- Export comparison reports

**Use Cases:**
- A/B testing different configurations
- Debugging performance issues
- Optimizing agent parameters

---

## Phase 3: Advanced Features (2-3 months)

Power user features for teams and advanced use cases.

### 9. Custom Dashboards
**Priority:** MEDIUM
**Effort:** High
**Description:** User-defined dashboard layouts with drag-and-drop widgets.

**Features:**
- Customizable grid layout
- Widget library (charts, metrics, lists, tables)
- Drag-and-drop interface
- Save and load custom views
- Share dashboard configurations

**Implementation:**
- React Grid Layout or similar library
- Widget plugin system
- Dashboard configuration storage
- Import/export dashboard configs

---

### 10. Alert Rules
**Priority:** MEDIUM
**Effort:** Medium
**Description:** Define custom alert conditions and receive notifications.

**Features:**
- Rule builder UI (if token usage > X, alert)
- Multiple notification channels (email, webhook, Slack)
- Alert history and acknowledgment
- Threshold-based and anomaly detection alerts
- Alert scheduling (business hours only)

**Use Cases:**
- Monitor production agents
- Detect performance degradation
- Track budget/token limits
- Identify error spikes

---

### 11. API Documentation (OpenAPI/Swagger)
**Priority:** MEDIUM
**Effort:** Low
**Description:** Interactive API documentation with Swagger UI.

**Features:**
- Complete REST API documentation
- Try endpoints directly from browser
- Request/response examples
- Authentication documentation
- Code generation for multiple languages

---

## Phase 4: Future Enhancements (3+ months)

Long-term features requiring significant architectural changes.

### 12. Multi-User Support
**Priority:** LOW
**Effort:** Very High
**Description:** Basic authentication and user management system.

**Features:**
- User registration and login
- User profiles and preferences
- Role-based access control (admin, viewer)
- Shared agent visibility
- Team collaboration features

**Note:** Requires significant architecture changes (database schema, authentication layer, session management)

---

### 13. Slack/Discord Bot
**Priority:** MEDIUM
**Effort:** Medium
**Description:** Post agent updates and query status from chat platforms.

**Features:**
- Real-time agent status updates
- Query agent information via commands
- Alert notifications to channels
- Share agent insights with team
- Slash commands for common operations

---

### 14. Observability Stack
**Priority:** LOW
**Effort:** Very High
**Description:** Enterprise-grade observability with OpenTelemetry integration.

**Features:**
- OpenTelemetry instrumentation
- Distributed tracing across services
- Prometheus metrics export
- Grafana dashboard templates
- Log aggregation and search

**Target Audience:** Enterprise users with existing observability infrastructure

---

### 15. Real-time Notifications
**Priority:** LOW
**Effort:** Low
**Description:** Browser notifications for agent status changes.

**Features:**
- Browser push notifications
- Sound alerts for errors/completions
- Notification preferences (sound, desktop, none)
- Do Not Disturb mode
- Notification history

---

## Implementation Timeline

### Q1 2026 (Current Quarter)
- ✅ PostgreSQL to SQLite migration (COMPLETED)
- ✅ Claude wrapper TypeScript refactoring (COMPLETED)
- 🔄 Codebase cleanup and consolidation (IN PROGRESS)
- 🎯 Docker Compose setup
- 🎯 Agent search & filtering
- 🎯 Performance metrics visualization

### Q2 2026
- Export functionality
- Dark mode
- CI/CD pipeline
- Agent comparison
- VS Code extension (start)

### Q3 2026
- VS Code extension (complete)
- Custom dashboards
- Alert rules
- API documentation

### Q4 2026 and Beyond
- Multi-user support
- Slack/Discord bot
- Observability stack
- Additional integrations

---

## Priority Matrix

### High Value + Low Effort (Do First)
1. Agent search & filtering
2. Export functionality
3. Dark mode
4. API documentation

### High Value + High Effort (Plan Carefully)
5. Docker Compose setup
6. VS Code extension
7. Performance metrics visualization
8. Custom dashboards

### Medium Value + Low Effort (Quick Wins)
9. Real-time notifications
10. Alert rules (basic)

### Medium/Low Value + High Effort (Evaluate Need)
11. Multi-user support
12. Observability stack
13. Slack/Discord bot (if team requests)

---

## Feature Voting

We welcome community input on feature prioritization! If you'd like to see a specific feature implemented sooner:

1. Open a GitHub issue with the `feature-request` label
2. Describe your use case and why the feature is valuable
3. Upvote existing feature requests you'd like to see

Popular feature requests will be moved up in the roadmap.

---

## Contributing

Want to help build these features? Check out:
- [CONTRIBUTING.md](../scripts/docs/guides/CONTRIBUTING.md) - Contribution guidelines
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
- [CLAUDE.md](../CLAUDE.md) - AI assistant integration

---

## Notes

- Priorities may shift based on user feedback and adoption
- Timeline is approximate and subject to change
- Some features may be implemented by community contributors
- Enterprise features (multi-user, observability) are low priority unless sponsored

**Last Updated:** February 2026
