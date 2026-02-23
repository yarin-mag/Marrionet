# PostgreSQL to SQLite Migration Checklist

## Files That Need Changes

### 1. Package Dependencies
- [ ] apps/server/package.json - Remove `pg` and `@types/pg`, add `better-sqlite3`

### 2. Database Connection
- [ ] apps/server/src/db.ts - Replace PostgreSQL Pool with SQLite

### 3. Queries (if PostgreSQL-specific)
- [ ] Check all repositories for PostgreSQL syntax ($1, $2 placeholders)
- [ ] Convert to SQLite syntax (?, ? placeholders)

### 4. Schema
- [ ] Verify schema.sql is SQLite-compatible (already is)

### 5. Documentation
- [x] db/README.md - Remove PostgreSQL
- [x] ARCHITECTURE.md - Remove PostgreSQL
- [x] SETUP.md - Remove PostgreSQL
- [x] install.sh - Remove PostgreSQL comments

## Changes Needed

### apps/server/package.json
Remove:
- "pg": "^8.12.0"
- "@types/pg": "^8.11.6"

Add:
- "better-sqlite3": "^11.0.0"
- "@types/better-sqlite3": "^7.6.11"

### apps/server/src/db.ts
Replace entire file with SQLite version

### All repository files
Change PostgreSQL placeholders ($1, $2) to SQLite (?, ?)
