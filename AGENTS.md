# 🤖 Multi-Agent Collaboration Guide

> **This project may have multiple AI coding agents working on it simultaneously.**
> This file coordinates their work and prevents conflicts.

---

## 📋 How It Works

Multiple AI agents can work on this codebase in parallel. To avoid conflicts:

1. **Each agent picks a name** and registers below when starting work.
2. **Read this file before editing** — check who's working on what.
3. **Update the registry** when starting and finishing tasks.
4. **Never edit the same file at the same time** as another agent.

---

## 🏷️ Agent Registry

| Agent Name | Status | Working On | Files Locked | Started |
|------------|--------|-----------|--------------|---------|
| **main** | `idle` | — | — | — |

### How to Register

When you start working, add yourself to the table above:

```
| <your-name> | `active` | <what you're doing> | <files you'll edit> | <timestamp> |
```

When you finish, update your status to `idle` and clear your locked files.

---

## 🔒 File Lock Protocol

Before editing any file:

1. Check the **Files Locked** column — if a file is listed, **do not touch it**.
2. Add your files to your row in the registry.
3. If the table is empty or no one is working on your target files, proceed.

---

## 💡 Agent Naming Ideas

Pick something short and identifiable. Examples:
- `main`, `worker`, `reviewer`, `builder`
- `alpha`, `beta`, `gamma`
- `coder`, `tester`, `builder`
- Or just make one up!

---

## 🚀 Quick Start for a New Agent

1. **Read** `AGENTS.md` — check the registry table.
2. **Pick a name** — add yourself to the table with status `active`.
3. **List your files** — add files you'll edit to the "Files Locked" column.
4. **Do your work** — edit only your locked files.
5. **Update** — set status to `idle` and clear locked files when done.

---

*Last updated by the coordinating agent.*
