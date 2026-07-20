# 🤖 Operator Pro v3.0

**Autonomous AI Agent — Web, Desktop & Server**

Operator Pro is a professional-grade autonomous agent that works fluently across the web, your desktop, and any server. It combines multi-model AI reasoning with real browser automation, terminal control, and screen understanding to autonomously complete complex tasks.

## ✨ Features

### 🌐 Web Automation
- **Smart Browser Engine** — Playwright/Puppeteer with auto-connection
- Find elements by text, selector, role, or aria-label
- Form auto-fill, cookie management, multi-tab control
- Network interception, file downloads, PDF generation

### 🖥️ Desktop Control
- **Cross-Platform** — Works on Windows, Linux, and macOS
- Screenshot capture with OCR text recognition
- Mouse and keyboard simulation
- Window management, clipboard operations

### ⚡ Terminal & Server
- Persistent shell sessions with state
- Run scripts (Node.js, Python, Bash, PowerShell)
- Git operations, npm management
- System monitoring and process management

### 🧠 AI Brain
- **20+ AI providers** — Groq, OpenAI, Copilot, NVIDIA, Anthropic, Google, DeepSeek, and more
- Automatic failover between backends
- Visual understanding via multimodal models
- Task planning, verification, and error recovery

### 🔌 Extensible
- **Plugin system** — Add custom actions
- Built-in web scraper and system monitor plugins
- REST API + WebSocket for external integration
- Web dashboard for monitoring

---

## 🚀 Quick Start

### Install
```bash
npm install
npx playwright install chromium  # For browser automation
```

### Run a task (CLI)
```bash
node operator.mjs "search Google for AI agents and summarize the top 3"
node operator.mjs "create a Python script that scrapes product prices from a website"
node operator.mjs "list all running processes and kill the one using the most memory"
```

### Start API server
```bash
node operator.mjs --server
# → Dashboard: http://localhost:3000/dashboard
# → API: http://localhost:3000/api
# → WebSocket: ws://localhost:3000/ws
```

### Execute a single action
```bash
node operator.mjs --action=screenshot
node operator.mjs --action=browser_goto --url=https://google.com
node operator.mjs --action=terminal_exec --command="ls -la"
```

---

## 📁 Architecture

```
operator/
├── operator.mjs              ← Main entry point (CLI + Server)
├── operator/
│   ├── brain.mjs             ← Multi-provider AI reasoning
│   ├── memory.mjs            ← Task persistence
│   ├── knowledge.mjs         ← Documentation loader
│   ├── actions.mjs           ← Action registry (backward-compat)
│   ├── platform/
│   │   └── index.mjs         ← Cross-platform OS abstraction
│   ├── engines/
│   │   ├── browser.mjs       ← Browser automation (Playwright/Puppeteer)
│   │   ├── terminal.mjs      ← Shell execution engine
│   │   ├── screen.mjs        ← Screenshot + OCR + vision
│   │   └── filesystem.mjs    ← File ops + HTTP client
│   ├── core/
│   │   ├── orchestrator.mjs  ← Task coordination & execution loop
│   │   └── plugins.mjs       ← Plugin system
│   ├── server/
│   │   └── api.mjs           ← REST API + WebSocket server
│   └── plugins/              ← Custom plugins directory
├── dashboard/
│   └── index.html            ← Web dashboard
└── config/
    └── .env                  ← API keys and settings
```

## 🔧 Configuration

Create `config/.env`:
```env
# AI Providers (at least one required)
GROQ_API_KEY=your_groq_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key
NVIDIA_API_KEY=your_nvidia_key
OPENCODE_ZEN_API_KEY=your_opencode_key

# Server
OPERATOR_PORT=3000
OPERATOR_API_KEY=your_secret_key
```

## 📡 API Reference

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tasks` | Create and run a task |
| GET | `/api/tasks` | List active tasks |
| GET | `/api/tasks/:id` | Get task details |
| DELETE | `/api/tasks/:id` | Cancel a task |
| GET | `/api/history` | Task history |

### Actions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/actions/execute` | Execute a single action |
| POST | `/api/actions/batch` | Execute multiple actions |

### Browser
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/browser/connect` | Connect to browser |
| POST | `/api/browser/goto` | Navigate to URL |
| POST | `/api/browser/click` | Click element |
| POST | `/api/browser/type` | Type text |
| POST | `/api/browser/screenshot` | Take screenshot |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/system/info` | System information |
| GET | `/api/system/processes` | List processes |
| POST | `/api/terminal/exec` | Execute command |

### WebSocket
Connect to `ws://host:port/ws` for real-time task monitoring.

## 🔌 Creating Plugins

Create a file in `operator/plugins/`:
```javascript
export default {
  name: 'my-plugin',
  version: '1.0.0',
  actions: ['my_action'],
  async execute(action) {
    if (action.type === 'my_action') {
      return { ok: true, message: 'Done!' };
    }
  }
};
```

Or use the template generator:
```bash
curl -X POST http://localhost:3000/api/plugins/template \
  -H "Content-Type: application/json" \
  -d '{"name":"my-plugin"}'
```

## 🛡️ Safety

Operator Pro includes a safety layer that:
- Detects dangerous commands (rm -rf /, format, drop database, etc.)
- Requests confirmation before destructive operations
- Can be configured with `--auto-confirm` for unattended operation
- Tracks all actions in persistent memory for audit

## 📄 License

MIT
