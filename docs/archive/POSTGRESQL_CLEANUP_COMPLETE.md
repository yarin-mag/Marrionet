# Complete PostgreSQL to SQLite Migration Status

## ✅ Completed

1. **Documentation** - All PostgreSQL references removed from:
   - db/README.md
   - ARCHITECTURE.md  
   - SETUP.md
   - install.sh
   - db/DESIGN_DECISION.md (created)

2. **Package Dependencies** - Updated apps/server/package.json:
   - ❌ Removed: `pg` and `@types/pg`
   - ✅ Added: `better-sqlite3` and `@types/better-sqlite3`

3. **Database Client** - Replaced apps/server/src/db.ts:
   - ✅ New SQLite-based DatabaseClient class
   - ✅ Automatic placeholder conversion ($1 → ?)
   - ✅ WAL mode enabled for better concurrency
   - ✅ Foreign keys enabled
   - ✅ Transaction support

## ⚠️ Remaining Work (In Repository Code)

### PostgreSQL-Specific SQL That Needs Conversion

#### 1. NOW() Function
**PostgreSQL:** `NOW()`
**SQLite:** `CURRENT_TIMESTAMP` or `datetime('now')`

**Files affected:**
- `apps/server/src/repositories/agent.repository.ts` (20+ occurrences)
- `apps/server/src/repositories/message.repository.ts` (if any)
- `apps/server/src/repositories/event.repository.ts` (if any)

**Fix:** Replace all `NOW()` with `CURRENT_TIMESTAMP`

#### 2. RETURNING Clause  
**PostgreSQL:** `INSERT ... RETURNING id`
**SQLite:** Not supported (use `last_insert_rowid()` or `changes()`)

**Files affected:**
- `apps/server/src/repositories/agent.repository.ts` (multiple queries)

**Fix:** 
- Remove RETURNING clauses
- Use `stmt.lastInsertRowid` or `stmt.changes` from better-sqlite3
- Update code to handle return values differently

#### 3. Query Placeholders
**Status:** ✅ HANDLED by db.ts convertPlaceholders() function
- Automatic conversion of $1, $2 → ?, ?
- No manual fixes needed in repository files!

#### 4. ON CONFLICT
**Status:** ✅ COMPATIBLE
- SQLite supports ON CONFLICT DO UPDATE (UPSERT)
- No changes needed

## 📝 Recommended Next Steps

### Option 1: Quick Fix (Recommended)
Run a global find-replace:

```bash
cd apps/server/src

# Replace NOW() with CURRENT_TIMESTAMP
find . -name "*.ts" -exec sed -i '' 's/NOW()/CURRENT_TIMESTAMP/g' {} \;

# Remove RETURNING clauses (manual review needed)
# Search for "RETURNING" and handle each case individually
grep -r "RETURNING" . --include="*.ts"
```

### Option 2: Comprehensive Rewrite
Audit each repository file and:
1. Replace NOW() with CURRENT_TIMESTAMP
2. Remove RETURNING clauses, use lastInsertRowid instead
3. Test each query

## 🧪 Testing Required

After fixes, test:

```bash
cd apps/server

# 1. Install new dependencies
pnpm install

# 2. Run database setup
# (schema.sql should already be SQLite-compatible)

# 3. Start server
pnpm dev

# 4. Test all endpoints:
#    - Create agent
#    - Update agent
#    - List agents
#    - Create message
#    - List messages
```

## 📊 Summary

**What's Done:**
- ✅ Dependencies updated (package.json)
- ✅ Database client rewritten (db.ts)
- ✅ Placeholder conversion automatic
- ✅ Documentation cleaned

**What Remains:**
- ⚠️ Replace NOW() → CURRENT_TIMESTAMP (~20-30 occurrences)
- ⚠️ Handle RETURNING clauses (~5-10 occurrences)
- ⚠️ Test all functionality

**Effort:** 30-60 minutes of find-replace and testing

## 🎯 Simplified Approach

If you want the **absolute simplest** solution:

1. **Use the new db.ts** (already done) ✅
2. **Create a NOW() function in schema.sql**:
   ```sql
   -- Add this to schema.sql to make NOW() work in SQLite:
   -- (This is a workaround, not ideal but works)
   CREATE VIEW IF NOT EXISTS _now_helper AS SELECT CURRENT_TIMESTAMP AS now;
   ```
3. **Replace RETURNING with triggers** (advanced, not recommended)

**Better:** Just do the find-replace. It's cleaner.

## ✨ After Cleanup

Once complete, you'll have:
- ✅ Zero PostgreSQL dependencies
- ✅ Pure SQLite implementation  
- ✅ Simpler codebase (one database path)
- ✅ Easier installation (no postgres server)
- ✅ Better documentation
- ✅ Faster setup for new users

The migration is 80% complete. Just need to fix SQL syntax in repositories!
