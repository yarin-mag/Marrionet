# Marionette Database

## Overview

Marionette uses a database to store conversation history, events, and monitoring data. The database runs **automatically** when the backend starts.

## Database: SQLite

**Marionette uses SQLite** - a fast, reliable, zero-configuration database perfect for local development tools.

### Why SQLite?

✅ **No server needed** - just a single file
✅ **Zero configuration** - works out of the box
✅ **Fast enough** - < 1ms reads, < 5ms writes
✅ **Reliable** - battle-tested, used by browsers, mobile apps
✅ **Simple** - one file to backup, no processes to manage
✅ **Perfect for you** - Marionette is a personal tool, not a multi-user SaaS

### How It Works

**Location:** `db/marionette.db`

**Runtime:**
```
Backend starts → Opens SQLite file → Database ready!
```

No separate database process runs. The backend reads/writes directly to the file.

### Performance

SQLite is more than enough for Marionette:
- Handles **millions of messages** easily
- Supports **thousands of events** per session
- Database grows at ~30KB per conversation
- After **10,000 conversations**, only ~300MB

**You'll never outgrow it for personal use!**

---

## Installation Process

### What `./install.sh` Does

```bash
[6/10] Setting Up Database...
```

1. **Checks if database exists:**
   ```bash
   if [ ! -f "db/marionette.db" ]; then
   ```

2. **Reads the schema:**
   ```bash
   schema.sql  # Contains all table definitions
   ```

3. **Creates SQLite database:**
   ```bash
   sqlite3 marionette.db < schema.sql
   ```

4. **Result:**
   ```
   ✓ SQLite database initialized
   ```

The database file is now at: `db/marionette.db` (40 KB initially)

---

## Runtime: How the Database Runs

### With SQLite (Default)

```
User starts backend:
  $ cd backend && npm run dev

Backend startup sequence:
  1. Read DATABASE_URL from .env
     → "sqlite:../db/marionette.db"

  2. Connect to SQLite file
     → Opens file handle
     → No separate process needed

  3. Run migrations (if needed)
     → Check schema_migrations table
     → Apply any pending migrations

  4. Database ready!
     → Backend can read/write data
     → All tables available

Backend running:
  - Reads: SELECT queries on SQLite file
  - Writes: INSERT/UPDATE queries on SQLite file
  - File grows as data accumulates
```

**Key point:** SQLite is **embedded** in the backend process. No separate database server runs.

---

### That's It!

No other database options. SQLite is all you need for Marionette.

If you ever need to migrate to PostgreSQL (e.g., for a hosted version), you can, but **99.9% of users will never need it**.

---

## Database Schema

### Tables Created

1. **agents** - Wrapper instances
2. **conversations** - Conversation metadata
3. **messages** - User/assistant messages
4. **events** - All monitoring events
5. **processes** - Spawned processes
6. **network_requests** - HTTP/HTTPS requests
7. **filesystem_changes** - File modifications
8. **performance_stats** - CPU/memory metrics
9. **heartbeats** - Agent health checks
10. **schema_migrations** - Version tracking

### Relationships

```
agents (1) ──┬── (many) conversations
             ├── (many) messages
             ├── (many) events
             ├── (many) processes
             ├── (many) network_requests
             ├── (many) filesystem_changes
             ├── (many) performance_stats
             └── (many) heartbeats

conversations (1) ── (many) messages
```

---

## Verification

### Check Database Exists

```bash
ls -lh db/marionette.db
# Output: -rw-r--r--  1 user  staff   40K Feb 19 10:30 marionette.db
```

### Query the Database

```bash
# Open SQLite shell
sqlite3 db/marionette.db

# List tables
sqlite> .tables
agents                  heartbeats
conversations           messages
events                  network_requests
filesystem_changes      performance_stats
processes               schema_migrations

# Check agents
sqlite> SELECT * FROM agents;
(empty initially)

# Exit
sqlite> .exit
```

### Check Backend Connection

```bash
cd backend
npm run dev
```

**Look for:**
```
[backend] ✓ Database connected
[backend]   Type: SQLite
[backend]   Location: ../db/marionette.db
[backend] ✓ Migrations up to date
```

---

## Backend Connection Code

The backend connects to the database when it starts:

```typescript
// backend/src/database.ts
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function connectDatabase() {
  const databaseUrl = process.env.DATABASE_URL || 'sqlite:../db/marionette.db';

  if (databaseUrl.startsWith('sqlite:')) {
    // SQLite: Open file
    const dbPath = databaseUrl.replace('sqlite:', '');
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    console.log('✓ Database connected (SQLite)');
    return db;
  } else {
    // PostgreSQL: Connect to server
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: databaseUrl });
    await pool.query('SELECT NOW()'); // Test connection
    console.log('✓ Database connected (PostgreSQL)');
    return pool;
  }
}
```

---

## Migrations

### Current Migration: v1 (Initial Schema)

The `schema.sql` file is migration version 1. The `schema_migrations` table tracks which migrations have been applied.

### Future Migrations

When the schema needs to change, create new migration files:

```bash
db/
├── schema.sql              # v1: Initial schema
├── migrations/
│   ├── 002_add_tags.sql   # v2: Add tags feature
│   └── 003_add_users.sql  # v3: Add multi-user support
```

The backend automatically applies pending migrations on startup.

---

## Data Retention

### Default Behavior

Data is kept indefinitely by default.

### Cleanup (Optional)

To clean old data:

```bash
# Delete data older than 30 days
sqlite3 db/marionette.db << EOF
DELETE FROM messages WHERE timestamp < datetime('now', '-30 days');
DELETE FROM events WHERE timestamp < datetime('now', '-30 days');
DELETE FROM processes WHERE spawned_at < datetime('now', '-30 days');
-- etc.
EOF
```

Or add automatic cleanup to backend:

```typescript
// Clean old data daily
setInterval(async () => {
  await db.run(`DELETE FROM messages WHERE timestamp < datetime('now', '-30 days')`);
  await db.run(`DELETE FROM events WHERE timestamp < datetime('now', '-30 days')`);
}, 24 * 60 * 60 * 1000); // Every 24 hours
```

---

## Backup

### SQLite Backup

```bash
# Simple copy
cp db/marionette.db db/marionette.backup.db

# Or use SQLite backup command
sqlite3 db/marionette.db ".backup db/marionette.backup.db"

# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
sqlite3 db/marionette.db ".backup db/backups/marionette_$DATE.db"
```

### PostgreSQL Backup

```bash
pg_dump marionette > db/backups/marionette_$(date +%Y%m%d_%H%M%S).sql
```

---

## Troubleshooting

### "Database locked" Error (SQLite)

**Cause:** Multiple processes trying to write simultaneously

**Solution:**
```bash
# Use WAL mode for better concurrency
sqlite3 db/marionette.db "PRAGMA journal_mode=WAL;"
```

### "Connection refused" (PostgreSQL)

**Cause:** PostgreSQL not running

**Solution:**
```bash
# Start PostgreSQL
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Linux
```

### "File not found" Error

**Cause:** Database file doesn't exist

**Solution:**
```bash
# Reinitialize database
cd db
sqlite3 marionette.db < schema.sql
```

### Corrupt Database

**Solution:**
```bash
# Restore from backup
cp db/marionette.backup.db db/marionette.db

# Or reinitialize (loses data!)
rm db/marionette.db
sqlite3 db/marionette.db < db/schema.sql
```

---

## Performance

### SQLite Performance

- **Reads:** Very fast (< 1ms per query)
- **Writes:** Fast (< 5ms per query)
- **Concurrent writes:** Limited (one at a time)
- **Database size:** Works well up to 10GB+

**Optimization:**
```sql
-- Enable WAL mode
PRAGMA journal_mode=WAL;

-- Increase cache
PRAGMA cache_size=10000;

-- Vacuum periodically
VACUUM;
```

### PostgreSQL Performance

- **Reads:** Fast (< 2ms per query)
- **Writes:** Fast (< 5ms per query)
- **Concurrent writes:** Excellent (many simultaneous)
- **Database size:** Scales to 100GB+ easily

---

## Summary

**SQLite (Default):**
- ✅ No separate server
- ✅ Zero configuration
- ✅ Starts automatically with backend
- ✅ Perfect for most users
- 📁 Single file: `db/marionette.db`

**PostgreSQL (Optional):**
- 🔧 Requires PostgreSQL server
- 🔧 Manual setup needed
- ✅ Better for production/scale
- 🌐 Network-accessible

**For new users:** SQLite works perfectly. Just run `./install.sh` and the database is automatically set up and ready!
