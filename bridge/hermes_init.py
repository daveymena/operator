"""
Inicialización del puente Hermes-OpenCode.
Se ejecuta automáticamente cuando HERMES_BRIDGE_PORT está configurado.
"""

import os
import sys
import json

BRIDGE_PORT = os.environ.get('HERMES_BRIDGE_PORT', '20100')
OPENCODE_CONTROL = os.environ.get('OPENCODE_CONTROL', '0')

def init_bridge():
    """Inyecta herramientas OpenCode en Hermes."""
    if OPENCODE_CONTROL != '1':
        return

    # Importar e inyectar herramientas OpenCode
    bridge_tools_path = os.path.join(os.path.dirname(__file__), 'opencode_bridge_tools.py')
    if os.path.exists(bridge_tools_path):
        spec = import_spec_from_path(bridge_tools_path)
        if spec:
            # Intentar inyectar en el registry de Hermes
            try:
                from tools.registry import registry
                from opencode_bridge_tools import HERMES_OPENCODE_TOOLS

                for tool in HERMES_OPENCODE_TOOLS:
                    already = False
                    for existing in registry._tools:
                        if existing["name"] == tool["name"]:
                            already = True
                            break
                    if not already:
                        registry.register(
                            name=tool["name"],
                            toolset="opencode",
                            schema={
                                "name": tool["name"],
                                "description": tool["description"],
                                "parameters": tool.get("parameters", {"type": "object", "properties": {}})
                            },
                            handler=lambda args, handler=tool["handler"], **kw: handler(
                                **{k: v for k, v in args.items() if k != 'task_id'}
                            ) if 'task_id' not in kw else handler(
                                **{k: v for k, v in args.items() if k != 'task_id'}
                            ),
                            requires_env=[],
                        )

                print(f"\033[32m[BRIDGE] {len(HERMES_OPENCODE_TOOLS)} herramientas OpenCode inyectadas en Hermes!\033[0m")
                print(f"\033[33m[BRIDGE] Modo ULTRAPODEROSO ACTIVADO - Hermes controla OpenCode\033[0m")
            except ImportError:
                print("[BRIDGE] No se pudo importar tools.registry - las herramientas se cargarán via plugin")
                _install_as_plugin()
            except Exception as e:
                print(f"[BRIDGE] Error: {e}")
                _install_as_plugin()

def import_spec_from_path(filepath):
    """Importa un módulo desde una ruta de archivo."""
    import importlib.util
    module_name = os.path.splitext(os.path.basename(filepath))[0]
    spec = importlib.util.spec_from_file_location(module_name, filepath)
    if spec and spec.loader:
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        return spec
    return None

def _install_as_plugin():
    """Instala como plugin de Hermes si el registry no está disponible."""
    plugin_dir = os.path.expanduser("~/.hermes/plugins/opencode-bridge")
    os.makedirs(plugin_dir, exist_ok=True)

    # Crear plugin.yaml
    with open(os.path.join(plugin_dir, "plugin.yaml"), "w") as f:
        f.write("""name: opencode-bridge
description: Puente OpenCode - Control de PC para Hermes
version: 1.0.0

tools:
""")
        # No podemos inyectar tools directamente desde YAML, pero el __init__.py lo hará
        with open(os.path.join(plugin_dir, "__init__.py"), "w") as f2:
            f2.write('"""Plugin OpenCode Bridge - inyecta herramientas de control de PC."""\n\n')
            f2.write('import os, sys, json\n')
            f2.write(f'sys.path.insert(0, {json.dumps(os.path.dirname(__file__))})\n\n')
            f2.write('def register(ctx):\n')
            f2.write('    """Registra las herramientas OpenCode en Hermes."""\n')
            f2.write('    from opencode_bridge_tools import HERMES_OPENCODE_TOOLS\n')
            f2.write('    for tool in HERMES_OPENCODE_TOOLS:\n')
            f2.write('        ctx.register_tool(\n')
            f2.write('            name=tool["name"],\n')
            f2.write('            description=tool["description"],\n')
            f2.write('            parameters=tool.get("parameters", {"type": "object", "properties": {}}),\n')
            f2.write('            handler=tool["handler"],\n')
            f2.write('        )\n')
            f2.write(f'    print("\\033[32m[BRIDGE] Plugin OpenCode activado!\\033[0m")\n')

    print(f"[BRIDGE] Plugin instalado en {plugin_dir}")
    print("[BRIDGE] Ejecuta: hermes plugin enable opencode-bridge")

# Auto-ejecutar al importar
init_bridge()

print(f"[BRIDGE] Puerto: {BRIDGE_PORT}, OpenCode Control: {OPENCODE_CONTROL}")
