# Database Design Decision: SQLite Only

## Decision

**Marionette uses SQLite exclusively.** No PostgreSQL support.

## Rationale

### Marionette's Nature

Marionette is a **local development tool** for monitoring your own Claude CLI usage:
- Single user (you)
- Local machine
- Low write volume (human conversation speed)
- Small-medium data size (conversations + events)

### Why SQLite is Perfect

1. **Zero Configuration**
   - No server to install
   - No connection strings to configure
   - Works immediately after `./install.sh`

2. **Zero Operational Overhead**
   - No server process to start/stop
   - No memory consumed by database daemon
   - No port conflicts
   - Nothing to troubleshoot

3. **Sufficient Performance**
   - Reads: < 1ms (plenty fast for UI)
   - Writes: < 5ms (faster than humans type)
   - Handles thousands of conversations easily

4. **Reliability**
   - Used by browsers, mobile apps, embedded systems
   - Battle-tested for 20+ years
   - ACID compliant
   - Crash-safe with WAL mode

5. **Simplicity**
   - One file to backup (cp command)
   - Easy to inspect (sqlite3 command)
   - No network complexity
   - No authentication/permissions

### Why PostgreSQL is Overkill

PostgreSQL would only be needed for:
- ❌ Multi-user access (not our use case)
- ❌ High concurrency (not our use case)  
- ❌ Complex queries (our queries are simple)
- ❌ Cloud deployment (runs locally)
- ❌ Horizontal scaling (single user)

**None of these apply to Marionette!**

### Real-World Numbers

```
Typical usage:
  • 10 conversations/day × 20 messages each
  • 100 events per conversation
  • ~30KB per conversation

Daily growth: 300 KB
Monthly growth: 9 MB
Yearly growth: 108 MB
10 years: 1 GB (still tiny!)
```

SQLite handles multi-GB databases effortlessly. You'll never hit limits.

### Alternative Considered: PostgreSQL Support

**Option:** Support both SQLite and PostgreSQL

**Rejected because:**
1. Adds complexity (2x code paths)
2. Adds maintenance burden
3. Adds documentation overhead
4. Confuses users ("which should I use?")
5. **Zero real-world benefit** for 99.9% of users

### If You Ever Need PostgreSQL

If Marionette becomes a hosted multi-user service (unlikely), migration is straightforward:
1. Export SQLite: `sqlite3 marionette.db .dump`
2. Import to PostgreSQL: `psql < dump.sql`
3. Update connection string

But for a local dev tool? **SQLite is the right choice.**

## Benefits of This Decision

✅ **Simpler installation** - One less thing to configure
✅ **Simpler documentation** - No database options to explain
✅ **Simpler codebase** - Single code path
✅ **Better user experience** - Just works™
✅ **Easier troubleshooting** - No connection issues
✅ **Easier backup** - Copy one file

## Conclusion

**Keep it simple. Use SQLite. It's perfect for Marionette.**

The best database is the one you don't have to think about. 🎯
