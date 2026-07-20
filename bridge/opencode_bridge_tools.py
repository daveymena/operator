import json, os, socket, threading, time, subprocess, base64 as b64lib, requests

HERMES_BRIDGE_PORT = int(os.environ.get('HERMES_BRIDGE_PORT', '20100'))
OPENCODE_CONTROL = os.environ.get('OPENCODE_CONTROL', '0') == '1'
OPERATOR_API_URL = os.environ.get('OPERATOR_API_URL', 'http://localhost:3000')

_socket = None
_lock = threading.Lock()

def _connect():
    global _socket
    if _socket is not None:
        try:
            _socket.send(b'{"type":"ping"}')
            return _socket
        except:
            _socket = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)
        s.connect(('127.0.0.1', HERMES_BRIDGE_PORT))
        _socket = s
        return s
    except:
        return None

def _send(msg):
    with _lock:
        s = _connect()
        if s is None:
            return {'ok': False, 'error': 'Bridge no conectado'}
        try:
            s.sendall((json.dumps(msg) + '\n').encode())
            return {'ok': True}
        except:
            _socket = None
            return {'ok': False, 'error': 'Error de conexion'}

def _node_call(ws_port, payload):
    script = (
        'const ws = require("ws");'
        'const c = new ws("ws://localhost:' + str(ws_port) + '");'
        'c.on("open", () => c.send(JSON.stringify(' + json.dumps(payload) + ')));'
        'c.on("message", d => {console.log(d.toString());process.exit(0)});'
        'setTimeout(() => process.exit(1), 10000);'
    )
    return subprocess.run(['node', '-e', script], capture_output=True, text=True, timeout=15)

def _opencode_cmd(cmd_payload):
    r = _node_call(20102, {'type': 'command', 'cmd': cmd_payload})
    if r.returncode == 0:
        return {'ok': True, 'output': r.stdout.strip()}
    return {'ok': False, 'error': r.stderr.strip() or 'timeout'}

def opencode_screenshot(quality=60, scale=0.75):
    """Toma un screenshot del PC usando OpenCode."""
    return json.dumps(_opencode_cmd({'type': 'screenshot', 'quality': quality, 'scale': scale, 'force': True}))

def opencode_mouse_move(x, y):
    """Mueve el mouse a (x,y) usando OpenCode."""
    return json.dumps(_opencode_cmd({'type': 'mouse_move', 'x': x, 'y': y}))

def opencode_mouse_click(button='left'):
    """Hace click con el mouse usando OpenCode."""
    return json.dumps(_opencode_cmd({'type': 'mouse_click', 'button': button}))

def opencode_keyboard_type(text):
    """Escribe texto con el teclado usando OpenCode."""
    return json.dumps(_opencode_cmd({'type': 'keyboard_type', 'text': text}))

def opencode_sysinfo():
    """Obtiene información del sistema usando OpenCode."""
    return json.dumps(_opencode_cmd({'type': 'sysinfo'}))

def opencode_list_windows():
    """Lista las ventanas abiertas usando OpenCode."""
    return json.dumps(_opencode_cmd({'type': 'list_windows'}))

def opencode_list_apps():
    """Lista las aplicaciones instaladas usando OpenCode."""
    return json.dumps(_opencode_cmd({'type': 'list_apps'}))

# ═══════════════════════════════════════════════════════════════════
#  NUEVAS HERRAMIENTAS (Operator Pro v3.0)
# ═══════════════════════════════════════════════════════════════════

def _api_call(endpoint, method='GET', data=None):
    """Llama a la API REST de Operator Pro."""
    try:
        url = f"{OPERATOR_API_URL}/api/{endpoint}"
        if method == 'GET':
            r = requests.get(url, timeout=30)
        elif method == 'POST':
            r = requests.post(url, json=data, timeout=60)
        return r.json()
    except Exception as e:
        return {'ok': False, 'error': str(e)}

# ─── Browser ───
def operator_browser_navigate(url):
    """Navega a una URL en el navegador."""
    return json.dumps(_api_call('browser/navigate', 'POST', {'url': url}))

def operator_browser_click(selector=None, text=None, x=None, y=None):
    """Hace click en un elemento del navegador."""
    return json.dumps(_api_call('browser/click', 'POST', {
        'selector': selector, 'text': text, 'x': x, 'y': y
    }))

def operator_browser_type(text, selector=None):
    """Escribe texto en el navegador."""
    return json.dumps(_api_call('browser/type', 'POST', {'text': text, 'selector': selector}))

def operator_browser_screenshot():
    """Toma screenshot del navegador."""
    return json.dumps(_api_call('browser/screenshot', 'POST', {}))

def operator_browser_content():
    """Obtiene el contenido de la página actual."""
    return json.dumps(_api_call('browser/content', 'GET'))

# ─── Terminal ───
def operator_terminal(command, cwd=None, timeout=30000):
    """Ejecuta un comando en la terminal."""
    return json.dumps(_api_call('terminal/exec', 'POST', {
        'command': command, 'cwd': cwd, 'timeout': timeout
    }))

# ─── Facebook Ads ───
def operator_fb_create_campaign(name, objective='OUTCOME_TRAFFIC', budget=5000, via_api=True):
    """Crea una campaña en Facebook Ads."""
    return json.dumps(_api_call('facebook/campaign', 'POST', {
        'name': name, 'objective': objective, 'budget': budget, 'via_api': via_api
    }))

def operator_fb_analyze_metrics(date_preset='last_7d'):
    """Analiza métricas de Facebook Ads."""
    return json.dumps(_api_call('facebook/metrics', 'POST', {'date_preset': date_preset}))

def operator_fb_segment_audience(location='Colombia', age_min=18, age_max=65, interests=None):
    """Segmenta audiencia para Facebook Ads."""
    return json.dumps(_api_call('facebook/audience', 'POST', {
        'location': location, 'age_min': age_min, 'age_max': age_max, 'interests': interests or []
    }))

# ─── Auto-Optimizer ───
def operator_start_optimizer(interval_minutes=30):
    """Inicia el auto-optimizador de campañas."""
    return json.dumps(_api_call('optimizer/start', 'POST', {'interval': interval_minutes}))

def operator_stop_optimizer():
    """Detiene el auto-optimizador."""
    return json.dumps(_api_call('optimizer/stop', 'POST', {}))

# ─── Alerts ───
def operator_get_alerts():
    """Obtiene alertas activas."""
    return json.dumps(_api_call('alerts/active', 'GET'))

# ─── Tasks ───
def operator_run_task(task_description, max_steps=50):
    """Ejecuta una tarea autónoma compleja."""
    return json.dumps(_api_call('tasks/run', 'POST', {
        'task': task_description, 'max_steps': max_steps
    }))

def operator_get_active_tasks():
    """Lista tareas activas."""
    return json.dumps(_api_call('tasks/active', 'GET'))

# ─── Files ───
def operator_read_file(path):
    """Lee un archivo."""
    return json.dumps(_api_call('files/read', 'POST', {'path': path}))

def operator_write_file(path, content):
    """Escribe un archivo."""
    return json.dumps(_api_call('files/write', 'POST', {'path': path, 'content': content}))

def operator_list_dir(path='.'):
    """Lista directorio."""
    return json.dumps(_api_call('files/list', 'POST', {'path': path}))

# ─── System ───
def operator_system_info():
    """Obtiene información del sistema."""
    return json.dumps(_api_call('system/info', 'GET'))

def operator_list_processes():
    """Lista procesos del sistema."""
    return json.dumps(_api_call('system/processes', 'GET'))

def opencode_execute_powershell(script):
    """Ejecuta un script de PowerShell usando OpenCode."""
    b64 = b64lib.b64encode(script.encode()).decode()
    return json.dumps(_opencode_cmd({'type': 'powershell', 'script': b64}))

def opencode_get_clipboard():
    """Obtiene el texto del portapapeles."""
    return json.dumps(_opencode_cmd({'type': 'get_clipboard'}))

def opencode_set_clipboard(text):
    """Establece texto en el portapapeles."""
    return json.dumps(_opencode_cmd({'type': 'set_clipboard', 'text': text}))

def opencode_open_url(url):
    """Abre una URL en el navegador."""
    return json.dumps(_opencode_cmd({'type': 'open_url', 'url': url}))

def opencode_focus_window(pid):
    """Enfoca una ventana por su PID."""
    return json.dumps(_opencode_cmd({'type': 'focus_window', 'pid': pid}))

HERMES_OPENCODE_TOOLS = [
    {"name": "opencode_screenshot", "description": "Toma un screenshot del escritorio. Usa quality (1-100) y scale (0-1).", "handler": opencode_screenshot, "parameters": {"type": "object", "properties": {"quality": {"type": "integer", "description": "Calidad JPEG 1-100"}, "scale": {"type": "number", "description": "Escala 0-1"}}}},
    {"name": "opencode_mouse_move", "description": "Mueve el cursor del mouse a una posicion (x, y).", "handler": opencode_mouse_move, "parameters": {"type": "object", "properties": {"x": {"type": "integer", "description": "Coordenada X"}, "y": {"type": "integer", "description": "Coordenada Y"}}, "required": ["x", "y"]}},
    {"name": "opencode_mouse_click", "description": "Hace click con el mouse. button: left o right.", "handler": opencode_mouse_click, "parameters": {"type": "object", "properties": {"button": {"type": "string", "enum": ["left", "right"]}}}},
    {"name": "opencode_keyboard_type", "description": "Escribe texto en el teclado activo.", "handler": opencode_keyboard_type, "parameters": {"type": "object", "properties": {"text": {"type": "string", "description": "Texto a escribir"}}, "required": ["text"]}},
    {"name": "opencode_sysinfo", "description": "Obtiene info del sistema: RAM, CPU, SO, hostname.", "handler": opencode_sysinfo, "parameters": {"type": "object", "properties": {}}},
    {"name": "opencode_list_windows", "description": "Lista las ventanas abiertas con titulo y PID.", "handler": opencode_list_windows, "parameters": {"type": "object", "properties": {}}},
    {"name": "opencode_list_apps", "description": "Lista las aplicaciones instaladas.", "handler": opencode_list_apps, "parameters": {"type": "object", "properties": {}}},
    {"name": "opencode_execute_powershell", "description": "Ejecuta un script de PowerShell en el PC.", "handler": opencode_execute_powershell, "parameters": {"type": "object", "properties": {"script": {"type": "string", "description": "Script PowerShell"}}, "required": ["script"]}},
    {"name": "opencode_get_clipboard", "description": "Obtiene texto del portapapeles.", "handler": opencode_get_clipboard, "parameters": {"type": "object", "properties": {}}},
    {"name": "opencode_set_clipboard", "description": "Establece texto en el portapapeles.", "handler": opencode_set_clipboard, "parameters": {"type": "object", "properties": {"text": {"type": "string", "description": "Texto a copiar"}}, "required": ["text"]}},
    {"name": "opencode_open_url", "description": "Abre una URL en el navegador predeterminado.", "handler": opencode_open_url, "parameters": {"type": "object", "properties": {"url": {"type": "string", "description": "URL a abrir"}}, "required": ["url"]}},
    {"name": "opencode_focus_window", "description": "Enfoca una ventana por su PID.", "handler": opencode_focus_window, "parameters": {"type": "object", "properties": {"pid": {"type": "integer", "description": "PID de la ventana"}}, "required": ["pid"]}},
]

if OPENCODE_CONTROL:
    try:
        from tools.registry import registry
        for tool in HERMES_OPENCODE_TOOLS:
            registry.register(
                name=tool["name"], toolset="opencode",
                schema={"name": tool["name"], "description": tool["description"], "parameters": tool.get("parameters", {"type": "object", "properties": {}})},
                handler=lambda args, handler=tool["handler"], **kw: handler(**{k: v for k, v in args.items() if k != 'task_id'}),
                requires_env=[],
            )
        print("[BRIDGE] %d herramientas OpenCode inyectadas en Hermes!" % len(HERMES_OPENCODE_TOOLS))
    except Exception as e:
        print("[BRIDGE] Error inyectando herramientas: %s" % e)
