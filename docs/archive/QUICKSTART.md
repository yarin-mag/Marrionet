# Marionette Quick Start Guide

## 🚀 From Clone to Running in 5 Minutes

### Step 1: Clone & Install (2 minutes)

```bash
git clone https://github.com/your-org/marionette.git
cd marionette
./install.sh
```

**What happens:**
- ✅ Installs all dependencies
- ✅ Builds the Claude wrapper
- ✅ **Creates database** (SQLite file at `db/marionette.db`)
- ✅ Links wrapper globally

**The database is ready!** It's a single file that was just created.

---

### Step 2: Start Backend (Database included!)

```bash
cd backend && npm run dev
```

**You'll see:**
```
[backend] ✓ Database connected (SQLite)
[backend] ✓ Ready!
```

**What happened:**
- Backend opened `db/marionette.db` file
- **No separate database server** started
- Database is now "running" (it's just a file the backend reads/writes)

---

### Step 3: Start Web + Use Claude

```bash
# Terminal 2
cd web && npm run dev

# Terminal 3
claude chat
```

**Done!** Everything is running. The database is the SQLite file that backend reads/writes.

---

## 🎯 Key Point: The Database

**The database doesn't "run" as a separate process.**

It's a **file** at `marionette/db/marionette.db` that the backend reads and writes to.

When you start the backend, it opens this file. That's it!

```
Backend starts → Opens db/marionette.db → Ready!
```

No `systemctl start database` or `brew services start postgres` needed!

---

See [ARCHITECTURE.md](ARCHITECTURE.md) for complete details.
