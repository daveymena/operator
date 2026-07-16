// Test rápido del sistema completo
// node test-system.mjs

const BASE = process.env.BRIDGE_URL || 'http://localhost:21295';
const AGENT = process.env.AGENT_URL || 'http://localhost:21291';
const MCP = process.env.MCP_URL || 'http://localhost:21296';
const WS_AGENT = process.env.AGENT_WS || 'ws://localhost:21291/agent';

async function test(name, fn) {
  try {
    const result = await fn();
    const ok = result && !result.error;
    console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : ': ' + (result?.error || 'falló')}`);
    return result;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════╗
║     OpenCode Evolved — Test del Sistema          ║
╚══════════════════════════════════════════════════╝
  `);

  // 1. Test Agent Server
  console.log('[1] Agent Server (21291)');
  const agentHealth = await test('GET /health', () =>
    fetch(`${AGENT}/health`).then(r => r.json()));

  // 2. Test Bridge Server
  console.log('\n[2] Bridge Server (21295)');
  const bridgeStatus = await test('GET /status', () =>
    fetch(`${BASE}/status`).then(r => r.json()));
  const bridgeHealth = await test('GET /health', () =>
    fetch(`${BASE}/health`).then(r => r.json()));

  // 3. Test MCP Server
  console.log('\n[3] MCP Server (21296)');
  const mcpHealth = await test('GET /health', () =>
    fetch(`${MCP}/health`).then(r => r.json()));
  const mcpTools = await test('GET /tools', () =>
    fetch(`${MCP}/tools`).then(r => r.json()));

  // 4. Test Environment Knowledge
  console.log('\n[4] Environment Knowledge');
  const envKeys = await test('env_knowledge all', () =>
    fetch(`${MCP}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'env_knowledge', arguments: { category: 'all' } })
    }).then(r => r.json()));

  // 5. Test PC Agent connection (via bridge)
  console.log('\n[5] PC Agent');
  if (bridgeStatus?.agentConnected) {
    await test('sysinfo', () =>
      fetch(`${BASE}/cmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sysinfo' })
      }).then(r => r.json()));
    await test('screenshot', () =>
      fetch(`${BASE}/screenshot?quality=40&scale=0.5`).then(r => r.json()));
  } else {
    console.log('  ⚠  PC Agent no conectado (esperado si no hay PC remota)');
  }

  // Summary
  console.log(`
╔══════════════════════════════════════════════════╗
║     Resumen                                      ║
╠══════════════════════════════════════════════════╣`);
  console.log(`║  Agent Server: ${agentHealth?.ok ? '✓ ONLINE' : '✗ OFFLINE'}${' '.repeat(32)}║`);
  console.log(`║  Bridge Server: ${bridgeHealth?.ok ? '✓ ONLINE' : '✗ OFFLINE'}${' '.repeat(31)}║`);
  console.log(`║  MCP Server: ${mcpHealth?.status === 'ok' ? '✓ ONLINE' : '✗ OFFLINE'}${' '.repeat(33)}║`);
  console.log(`║  PC Agent: ${bridgeStatus?.agentConnected ? '✓ CONECTADO' : '◻ DESCONECTADO'}${' '.repeat(31)}║`);

  if (mcpTools?.tools) {
    console.log(`║  MCP Tools: ${mcpTools.tools.length} registradas${' '.repeat(28)}║`);
  }

  console.log(`╚══════════════════════════════════════════════════╝`);

  if (!agentHealth?.ok && !bridgeHealth?.ok) {
    console.log('\n⚠  Los servidores no estan corriendo.');
    console.log('   Ejecuta: start-mimo-system.bat');
  } else {
    console.log('\n✓ Sistema funcionando.');
  }
}

main().catch(console.error);
