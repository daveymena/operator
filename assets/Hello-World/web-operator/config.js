// Configuración del Web Operator para prevenir bucles infinitos

export const operatorConfig = {
  // ── Límites de Iteraciones ──
  maxIterations: 30,              // Reducido de 50 a 30 para evitar bucles largos
  maxConsecutiveFails: 3,         // Detener después de 3 fallos consecutivos
  maxNoProgressIterations: 5,     // Detener si no hay progreso en 5 iteraciones
  maxRepeatedActions: 3,          // Detener si repite la misma acción 3 veces
  
  // ── Timeouts ──
  pageLoadTimeout: 30000,         // 30s para cargar página
  actionTimeout: 10000,           // 10s por acción
  totalTaskTimeout: 300000,       // 5 minutos total por tarea
  
  // ── Detección de Bucles ──
  detectLoopThreshold: 3,         // Detectar bucle si repite 3 veces lo mismo
  loopDetectionWindow: 5,         // Mirar las últimas 5 acciones
  
  // ── Comportamiento ──
  autoStopOnLoop: true,           // Detener automáticamente si detecta bucle
  autoStopOnCaptcha: true,        // Detener automáticamente en CAPTCHA
  autoStopOnLogin: false,         // NO detener en login (intentar automático)
  
  // ── Modo Humano ──
  humanModeDelayMin: 800,         // Delay mínimo entre acciones (ms)
  humanModeDelayMax: 2300,        // Delay máximo entre acciones (ms)
  
  // ── Estrategias Anti-Bucle ──
  strategies: {
    onLoop: 'stop',                // 'stop', 'replanhuman', 'notify'
    onStuck: 'replan',             // 'stop', 'replan', 'notify'
    onCaptcha: 'notify',           // 'stop', 'solve', 'notify'
    onLogin: 'auto',               // 'stop', 'auto', 'notify'
  },
  
  // ── Logging ──
  verboseLogging: true,
  logIterations: true,
  logScreenshots: true,
  
  // ── OpenCode Integration ──
  openCodeControl: true,          // Permitir control desde OpenCode
  openCodeBreakpoints: true,      // Pausar en puntos específicos
  openCodeStepMode: false,        // Modo paso a paso (útil para debugging)
};

// Detector de bucles inteligente
export class LoopDetector {
  constructor(config = operatorConfig) {
    this.config = config;
    this.actionHistory = [];
    this.urlHistory = [];
    this.screenshotHashes = [];
  }
  
  addAction(action, url, screenshotHash) {
    this.actionHistory.push({
      action: JSON.stringify(action),
      url,
      timestamp: Date.now(),
    });
    
    if (this.actionHistory.length > this.config.loopDetectionWindow) {
      this.actionHistory.shift();
    }
    
    this.urlHistory.push(url);
    if (this.urlHistory.length > this.config.loopDetectionWindow) {
      this.urlHistory.shift();
    }
    
    if (screenshotHash) {
      this.screenshotHashes.push(screenshotHash);
      if (this.screenshotHashes.length > this.config.loopDetectionWindow) {
        this.screenshotHashes.shift();
      }
    }
  }
  
  isInLoop() {
    if (this.actionHistory.length < this.config.detectLoopThreshold) {
      return { inLoop: false };
    }
    
    // Detectar si repite la misma acción
    const recentActions = this.actionHistory.slice(-this.config.detectLoopThreshold);
    const uniqueActions = new Set(recentActions.map(a => a.action));
    
    if (uniqueActions.size === 1) {
      return {
        inLoop: true,
        reason: 'Repitiendo la misma acción',
        action: recentActions[0].action,
        count: recentActions.length,
      };
    }
    
    // Detectar si está en el mismo URL
    const recentUrls = this.urlHistory.slice(-this.config.detectLoopThreshold);
    const uniqueUrls = new Set(recentUrls);
    
    if (uniqueUrls.size === 1 && this.actionHistory.length > 3) {
      return {
        inLoop: true,
        reason: 'Atascado en la misma URL',
        url: recentUrls[0],
        iterations: recentUrls.length,
      };
    }
    
    // Detectar patrón repetitivo (A→B→A→B)
    if (this.actionHistory.length >= 4) {
      const last4 = this.actionHistory.slice(-4).map(a => a.action);
      if (last4[0] === last4[2] && last4[1] === last4[3]) {
        return {
          inLoop: true,
          reason: 'Patrón repetitivo detectado',
          pattern: [last4[0], last4[1]],
        };
      }
    }
    
    return { inLoop: false };
  }
  
  reset() {
    this.actionHistory = [];
    this.urlHistory = [];
    this.screenshotHashes = [];
  }
}

export default operatorConfig;
