# 🤖 Operator Pro v4.0

**Autonomous AI Agent — Web, Desktop & Server**

> 🔥 **v4.0**: AI Gateway con OpenCode Zen + GMI Cloud, Auth, Watch Mode, Task Scheduler, Deep Research, y Dashboard completo.

---

## ✨ What's New in v4.0

| Feature | Description |
|---------|-------------|
| 🧠 **AI Gateway** | Unified multi-provider gateway with smart routing & failover. OpenCode Zen (primary) + GMI Cloud (secondary) + 21 more providers |
| 🔐 **Auth System** | JWT-based authentication, API keys, role-based access (admin/user/viewer) |
| 🛡️ **Watch Mode** | Monitors financial, social, admin sites. Blocks dangerous actions. Requires confirmation for irreversible operations |
| ⏰ **Task Scheduler** | Cron-like recurring tasks, retry policies, webhook notifications |
| 🔍 **Deep Research** | Multi-step web research with source verification, citations, and confidence scoring |
| 📊 **Full Dashboard** | Real-time monitoring, provider status, terminal, browser control, and more |

---

## 🚀 Quick Start

### 1. Install
```bash
npm install
npx playwright install chromium  # For browser automation
```

### 2. Configure API Keys
```bash
cp config/.env.example config/.env
# Edit config/.env with your API keys (at minimum OPENCODE_ZEN_API_KEY)
```

**Free API key**: Get one at [https://opencode.ai/auth](https://opencode.ai/auth) — includes 7 free models!

### 3. Run

```bash
# Start server with dashboard
node operator.mjs --server

# Run a single task
node operator.mjs "search Google for AI agents and summarize the top 3"

# List available AI models
node operator.mjs --models

# Check gateway status
node operator.mjs --gateway-status
```

---

## 🧠 AI Gateway

The v4.0 Gateway provides unified access to 23+ AI providers with:

- **Smart routing**: Automatically picks the best provider for each model
- **Failover**: If one provider fails, automatically tries the next
- **Key rotation**: Round-robin API key rotation for load balancing
- **Rate limiting**: Respects per-provider rate limits
- **Cost tracking**: Real-time token and cost tracking
- **Streaming**: SSE streaming support for real-time responses

### Provider Priority

| Priority | Provider | Key Env Var | Free? |
|----------|----------|-------------|-------|
| 1️⃣ | **OpenCode Zen** | `OPENCODE_ZEN_API_KEY` | ✅ 7 free models |
| 2️⃣ | **GMI Cloud** | `GMI_API_KEY` | ❌ |
| 3️⃣ | OpenCode Go | `OPENCODE_GO_API_KEY` | ❌ |
| 4️⃣ | GitHub Copilot | `GITHUB_COPILOT_TOKEN` | ✅ (subscription) |
| 5️⃣ | Nous Portal | `NOUS_API_KEY` | ✅ |
| 6️⃣ | NVIDIA NIM | `NVIDIA_API_KEY` | ❌ |
| 7️⃣ | DeepSeek | `DEEPSEEK_API_KEY` | ❌ |
| 8️⃣ | Anthropic | `ANTHROPIC_API_KEY` | ❌ |
| 9️⃣ | OpenAI | `OPENAI_API_KEY` | ❌ |
| 🔟 | Google Gemini | `GOOGLE_API_KEY` | ✅ Free tier |
| ... | + 13 more providers | | |

### Gateway API

```bash
# List models
curl http://localhost:3000/api/gateway/models

# Chat completion
curl -X POST http://localhost:3000/api/gateway/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"big-pickle","messages":[{"role":"user","content":"Hello"}]}'

# Stream chat
curl -X POST http://localhost:3000/api/gateway/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"Hello"}],"stream":true}'
```

---

## 🔐 Authentication

v4.0 includes a full auth system with JWT tokens and role-based access.

```bash
# Login with API key
curl -X POST http://localhost:3000/api/auth/login \
  -d '{"apiKey":"op-admin-..."}'

# Use token for API calls
curl http://localhost:3000/api/tasks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Roles

| Role | Permissions |
|------|------------|
| **admin** | Full access: tasks, browser, terminal, files, system, users, config, scheduler |
| **user** | Standard: tasks, browser, terminal, files, research |
| **viewer** | Read-only: view tasks and system info |

---

## 🛡️ Watch Mode & Safety

The Safety System protects against:

- **Dangerous commands**: `rm -rf /`, `format`, `mkfs`, fork bombs (blocked)
- **Sensitive URLs**: Financial, social, admin, government sites (flagged)
- **PII leakage**: Detects phone numbers, SSN, credit cards, emails
- **Irreversible actions**: Deletes, drops, truncates (require confirmation)

```bash
# Check URL category
curl "http://localhost:3000/api/safety/check-url?url=https://paypal.com"

# View safety audit log
curl http://localhost:3000/api/safety/log
```

---

## ⏰ Task Scheduler

Schedule recurring tasks with cron expressions or intervals:

```bash
# Schedule a weekly task (every Monday at 9 AM)
curl -X POST http://localhost:3000/api/scheduler \
  -H "Authorization: Bearer TOKEN" \
  -d '{"task":"update weekly spreadsheet","cron":"0 9 * * 1","name":"Weekly Report"}'

# Schedule with interval (every 24 hours)
curl -X POST http://localhost:3000/api/scheduler \
  -d '{"task":"backup logs","interval":86400000}'

# List scheduled jobs
curl http://localhost:3000/api/scheduler

# Toggle job
curl -X POST http://localhost:3000/api/scheduler/job_id/toggle \
  -d '{"enabled":false}'

# Delete job
curl -X DELETE http://localhost:3000/api/scheduler/job_id
```

---

## 🔍 Deep Research

Multi-step research powered by OpenCode Zen + GMI Cloud:

```bash
# Start research
curl -X POST http://localhost:3000/api/research \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "query": "What are the latest trends in AI agents 2026?",
    "options": {
      "depth": 2,
      "language": "es",
      "format": "markdown"
    }
  }'
```

Research flow:
1. **Analyze** → Understand the query, generate search queries
2. **Search** → Execute web searches via browser or AI knowledge
3. **Extract** → Pull key findings, data, and citations
4. **Deep Dive** → Follow-up queries for deeper understanding
5. **Synthesize** → Generate comprehensive report with confidence score

---

## 📡 Full API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with API key or password |
| POST | `/api/auth/logout` | Logout (revoke token) |
| GET | `/api/auth/me` | Get current user info |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tasks` | Create and run a task |
| GET | `/api/tasks` | List active tasks |
| GET | `/api/tasks/:id` | Get task details |
| DELETE | `/api/tasks/:id` | Cancel a task |

### Browser
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/browser/connect` | Connect to browser |
| POST | `/api/browser/goto` | Navigate to URL |
| POST | `/api/browser/click` | Click element |
| POST | `/api/browser/type` | Type text |
| POST | `/api/browser/screenshot` | Take screenshot |

### Terminal
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/terminal/exec` | Execute command |

### Research
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/research` | Start deep research |

### Scheduler
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scheduler` | Schedule a new job |
| GET | `/api/scheduler` | List scheduled jobs |
| DELETE | `/api/scheduler/:id` | Delete a job |
| POST | `/api/scheduler/:id/toggle` | Enable/disable job |

### Gateway
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gateway/status` | Gateway health & usage |
| GET | `/api/gateway/models` | List available models |
| POST | `/api/gateway/chat` | Chat completion (supports streaming) |

### Safety
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/safety/log` | Safety audit log |
| POST | `/api/safety/confirm/:id` | Approve/deny pending action |
| GET | `/api/safety/check-url` | Check URL category |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (public) |
| GET | `/api/status` | System status |
| GET | `/api/system/info` | Detailed system info |

### WebSocket
Connect to `ws://host:port/ws` for real-time events.

---

## 📁 Architecture (v4.0)

```
operator/
├── operator.mjs                    ← CLI entry point
├── operator/
│   ├── brain.mjs                   ← Multi-provider AI reasoning
│   ├── memory.mjs                  ← Task persistence
│   ├── knowledge.mjs               ← Documentation loader
│   ├── gateway/                    ← 🆕 AI Gateway
│   │   ├── index.mjs               ← Gateway with routing & failover
│   │   ├── providers.mjs           ← 23 provider definitions
│   │   └── tracker.mjs             ← Cost & usage tracking
│   ├── auth/                       ← 🆕 Authentication
│   │   └── index.mjs               ← JWT, API keys, RBAC
│   ├── safety/                     ← 🆕 Watch Mode & Safety
│   │   └── index.mjs               ← URL categories, PII detection, audit
│   ├── scheduler/                  ← 🆕 Task Scheduler
│   │   └── index.mjs               ← Cron scheduling, retry, notifications
│   ├── engines/
│   │   ├── browser.mjs             ← Browser automation (Playwright)
│   │   ├── computer-use.mjs        ← CUA engine
│   │   ├── terminal.mjs            ← Shell execution
│   │   ├── screen.mjs              ← Screenshots + OCR
│   │   ├── filesystem.mjs          ← File ops + HTTP
│   │   └── research.mjs            ← 🆕 Deep Research engine
│   ├── core/
│   │   ├── orchestrator.mjs        ← Task coordination
│   │   └── plugins.mjs             ← Plugin system
│   ├── server/
│   │   ├── api.mjs                 ← Original API server (v3)
│   │   ├── api-v4.mjs              ← 🆕 Full API server (v4)
│   │   └── start.mjs               ← 🆕 Server entry point
│   └── platform/
│       └── index.mjs               ← Cross-platform OS abstraction
├── dashboard/                      ← 🆕 Full Web Dashboard
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── config/
│   └── .env                        ← API keys and settings
└── data/                           ← Auto-created data directory
    ├── auth.json                   ← User store
    ├── usage.json                  ← Usage tracking
    └── scheduler.json              ← Scheduled jobs
```

---

## 🔧 CLI Commands

```bash
# Server mode
node operator.mjs --server                     # Start on port 3000
node operator.mjs --server --port=8080         # Custom port
node operator.mjs --server --watch-mode        # Enable Watch Mode
node operator.mjs --server --verbose           # Debug logging

# CLI tasks
node operator.mjs "search Google for AI news"  # Run autonomous task
node operator.mjs "create a Python script"     # Code generation
node operator.mjs --brain=opencodeZen "task"   # Force specific provider

# Info commands
node operator.mjs --models                     # List all AI models
node operator.mjs --gateway-status             # Provider health & stats
node operator.mjs --list                       # Task history
node operator.mjs --help                       # Show help
```

---

## 🆚 Comparison: Operator Pro v4.0 vs ChatGPT Operator

| Feature | ChatGPT Operator | Operator Pro v4.0 |
|---------|-------------------|-------------------|
| AI Providers | OpenAI only | 23+ providers (OpenCode Zen, GMI Cloud, etc.) |
| Free Models | ❌ | ✅ 7+ free models via OpenCode Zen |
| API Key Rotation | ❌ | ✅ Round-robin with auto-failover |
| Auth System | OpenAI account | JWT + API keys + RBAC |
| Self-hosted | ❌ | ✅ Run anywhere |
| Watch Mode | ✅ | ✅ + Custom URL categories |
| Task Scheduler | ✅ (ChatGPT Agent) | ✅ Cron + intervals + webhooks |
| Deep Research | ✅ (separate tool) | ✅ Built-in with citations |
| Computer Use | Browser only | Browser + Desktop + Terminal |
| Plugin System | ❌ | ✅ Custom plugins |
| Open Source | ❌ | ✅ MIT License |
| Dashboard | Basic | Full web UI with real-time |
| Cost Tracking | ❌ | ✅ Per-provider cost analytics |

---

## 📄 License

MIT
