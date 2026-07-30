import { execute as directExecute } from './actions.mjs';

/**
 * Cliente hacia opencode-core/agent-server.mjs — el hub WebSocket donde se
 * registra opencode-core/pc-agent.mjs (corriendo en la PC real). agent-server
 * ya relaya comandos correctamente por su ruta HTTP `POST /agents/:id`
 * (sendCommandToAgent → WS al pc-agent → espera `{type:'result', requestId}`),
 * así que este cliente habla HTTP contra esa ruta en vez de mantener su propia
 * conexión WebSocket.
 *
 * (opencode-core/bridge-server.mjs, la otra pieza "puente" del repo, reenvía
 * comandos sobre SU PROPIA conexión WS hacia agent-server, pero agent-server
 * solo entiende `register`/`result` de un cliente WS — nunca relaya `command`
 * entre dos conexiones. Por eso no se usa aquí: nunca llegaría a la PC.)
 */
export class BridgeClient {
  constructor(config = {}) {
    this.agentHttpUrl = (config.agentHttpUrl || process.env.AGENT_SERVER_HTTP_URL || 'http://localhost:21291').replace(/\/$/, '');
    this.agentId = config.agentId || process.env.PC_AGENT_ID || null; // null = usa el primer agente conectado
    this.authToken = config.authToken || process.env.AGENT_SERVER_TOKEN || '';
    this.verbose = config.verbose !== false;
    this._connected = false;
    this._resolvedAgentId = null;
  }

  get connected() {
    return this._connected;
  }

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.authToken) h['Authorization'] = `Bearer ${this.authToken}`;
    return h;
  }

  async connect() {
    try {
      const id = await this._resolveAgentId();
      this._connected = !!id;
      if (this.verbose) {
        console.log(this._connected
          ? `  ✅ Bridge conectado (PC agent: ${id} vía ${this.agentHttpUrl})`
          : `  ⚙️ Ningún PC agent conectado en ${this.agentHttpUrl}, usando acciones directas`);
      }
      return this._connected;
    } catch (e) {
      if (this.verbose) console.log(`  ⚙️ Bridge no disponible (${this.agentHttpUrl}): ${e.message}`);
      this._connected = false;
      return false;
    }
  }

  async _resolveAgentId() {
    if (this.agentId) { this._resolvedAgentId = this.agentId; return this.agentId; }
    const res = await fetch(`${this.agentHttpUrl}/agents`, { headers: this._headers(), signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const agents = await res.json();
    if (!Array.isArray(agents) || agents.length === 0) return null;
    this._resolvedAgentId = agents[0].id;
    return this._resolvedAgentId;
  }

  /**
   * Envía un comando a la PC remota sin fallback local. A diferencia de
   * execute(), nunca delega a actions.mjs — actions.mjs/directExecute termina
   * llamando de vuelta al orchestrator singleton, y el orchestrator usa este
   * método para sus propias acciones de plataforma, así que execute() aquí
   * crearía una recursión infinita cuando no hay agente conectado.
   * Devuelve null si no hay agente conectado o la llamada falla, para que el
   * llamador decida su propio fallback (típicamente `platform.*` local).
   */
  async sendCommand(action) {
    try {
      const agentId = this._resolvedAgentId || await this._resolveAgentId();
      if (!agentId) { this._connected = false; return null; }
      const res = await fetch(`${this.agentHttpUrl}/agents/${encodeURIComponent(agentId)}`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify(action),
        signal: AbortSignal.timeout((action.timeout || 30000) + 2000)
      });
      if (!res.ok) {
        if (res.status === 404) this._resolvedAgentId = null; // agente desconectado, re-resolver la próxima vez
        return null;
      }
      this._connected = true;
      return await res.json();
    } catch {
      return null;
    }
  }

  async execute(action) {
    if (!action || !action.type) return { ok: false, error: 'acción inválida' };

    if (this._connected || this.agentId) {
      const result = await this.sendCommand(action);
      if (result) return result;
      // Solo cae a ejecución local si no hay agente/HTTP alcanzable;
      // un error legítimo de comando ya viene envuelto en `result`.
    }

    return directExecute(action);
  }

  close() {
    this._connected = false;
  }
}
