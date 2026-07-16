import { WebSocket } from 'ws';
import { execute as directExecute } from './actions.mjs';

export class BridgeClient {
  constructor(config = {}) {
    this.bridgeUrl = config.bridgeUrl || 'ws://localhost:20100';
    this.ws = null;
    this._connected = false;
    this.verbose = config.verbose !== false;
    this._responseHandlers = new Map();
  }

  async connect() {
    try {
      this.ws = new WebSocket(this.bridgeUrl);
      await new Promise((resolve, reject) => {
        this.ws.on('open', resolve);
        this.ws.on('error', reject);
        this.ws.on('message', (data) => this._handleMessage(data));
        setTimeout(() => reject(new Error('timeout')), 5000);
      });
      this._connected = true;
      if (this.verbose) console.log('  ✅ Bridge conectado');
      return true;
    } catch {
      if (this.verbose) console.log('  ⚙️ Bridge no disponible, usando acciones directas');
      this._connected = false;
      return false;
    }
  }

  _handleMessage(data) {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.id && this._responseHandlers.has(msg.id)) {
        this._responseHandlers.get(msg.id)(msg);
        this._responseHandlers.delete(msg.id);
      }
    } catch {}
  }

  async _send(msg) {
    if (!this._connected || !this.ws) return { error: 'Bridge no conectado' };
    return new Promise((resolve) => {
      const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
      const timer = setTimeout(() => {
        this._responseHandlers.delete(id);
        resolve({ error: 'timeout', id });
      }, 30000);
      this._responseHandlers.set(id, (response) => {
        clearTimeout(timer);
        resolve(response);
      });
      try { this.ws.send(JSON.stringify({ ...msg, id })); }
      catch (e) { clearTimeout(timer); this._responseHandlers.delete(id); resolve({ error: e.message }); }
    });
  }

  async execute(action) {
    if (!action || !action.type) return { ok: false, error: 'acción inválida' };

    if (this._connected) {
      const result = await this._send({ type: 'action', action });
      if (result && !result.error) return result;
    }

    return directExecute(action);
  }

  close() {
    if (this.ws) { try { this.ws.close(); } catch {} }
    this._connected = false;
  }
}
