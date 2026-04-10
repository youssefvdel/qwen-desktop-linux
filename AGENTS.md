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
| **claw** | `idle` | — | — | 2026-04-10 |

### How to Register

When you start working, add yourself to the table above:

```
| <your-name> | `active` | <what you're doing> | <files you'll edit> | <timestamp> |
```

When you finish, update your status to `idle` and clear your locked files.

---

## 📦 Task Queue

Add tasks here. Agents pick them top-to-bottom.

| # | Task | Priority | Assigned To | Status |
|---|------|----------|-------------|--------|
| 1 | fix process not end after close the window | high | main | `done` |
| 2 | add icon tray in the | medium | claw | `done` |
| 3 | bump version to 1.0.1 + rebuild + install | high | main | `done` |
| 4 | fix local MCP (fetch, filesystem, sequential-thinking) — wrong bundled runtime paths | high | main | `done` |
| 5 | fix EPERM chmod error on /opt bundled runtimes | medium | main | `done` |
| 6 | auto-create default MCP servers (Fetch, Filesystem, Sequential-Thinking) on first launch | high | main | `done` |
| — | *(add more tasks below)* | — | — | — |

### How to Add a Task
Add a row to the table above. Use priority: `high`, `medium`, or `low`.
Leave "Assigned To" blank — agents claim tasks themselves.

### How Agents Claim Tasks
1. Read the queue — find the highest-priority `unassigned` task.
2. Update the row: set "Assigned To" to your name and "Status" to `in progress`.
3. Register in the **Agent Registry** with your locked files.
4. Do the work.
5. Update "Status" to `done` when finished, then set to `idle` in the registry.

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
