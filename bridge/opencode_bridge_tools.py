import json, os, socket, threading, time, subprocess, base64 as b64lib

HERMES_BRIDGE_PORT = int(os.environ.get('HERMES_BRIDGE_PORT', '20100'))
OPENCODE_CONTROL = os.environ.get('OPENCODE_CONTROL', '0') == '1'

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
