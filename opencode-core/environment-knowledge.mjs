const envKnowledge = {
  // The AI should understand what the user's environment looks like
  // without having to re-discover it every time

  typicalWindowsApps: {
    browser: {
      names: ['msedge.exe', 'chrome.exe', 'firefox.exe', 'brave.exe', 'opera.exe'],
      userDataPaths: {
        edge: '%LOCALAPPDATA%\\Microsoft\\Edge\\User Data',
        chrome: '%LOCALAPPDATA%\\Google\\Chrome\\User Data',
        firefox: '%APPDATA%\\Mozilla\\Firefox\\Profiles'
      },
      automationTips: {
        edge: 'Usa --remote-debugging-port=9222 para depuración CDP',
        chrome: 'Usa --remote-debugging-port=9222 para depuración CDP'
      }
    },
    terminals: ['cmd.exe', 'powershell.exe', 'WindowsTerminal.exe', 'wt.exe'],
    fileManagers: ['explorer.exe', 'TotalCmd.exe', 'DirectoryOpus.exe'],
    editors: ['code.exe', 'notepad++.exe', 'sublime_text.exe', 'notepad.exe']
  },

  commonWindowPatterns: {
    dialog: {
      patterns: ['dialog', 'confirmar', 'guardar', 'abrir', 'configuración', 'settings',
                  'preferences', 'propiedades', 'properties', 'warning', 'error', 'alert',
                  'modal', 'popup', 'notificación', 'notification'],
      actionHint: 'Busca botones Aceptar/OK, Cancelar/Cancel, Cerrar/Close, Sí/Yes, No'
    },
    form: {
      patterns: ['formulario', 'form', 'registro', 'register', 'login', 'iniciar sesión',
                  'crear cuenta', 'checkout', 'pago', 'payment'],
      actionHint: 'Identifica campos de texto, checkboxes, botones de envío'
    },
    browser: {
      patterns: [' - Google Chrome', ' - Microsoft Edge', ' - Mozilla Firefox',
                  ' - Opera', ' - Brave'],
      actionHint: 'Usa Ctrl+L para la barra de direcciones, Ctrl+Tab para cambiar pestañas'
    },
    fileDialog: {
      patterns: ['Abrir', 'Guardar', 'Examinar', 'Browse', 'Save As', 'Open File',
                  'Seleccionar archivo', 'Choose File'],
      actionHint: 'Usa Ctrl+V para pegar ruta, Enter para abrir, Tab para navegar'
    }
  },

  windowsKeyboard: {
    global: {
      'Ctrl+C': 'Copiar', 'Ctrl+V': 'Pegar', 'Ctrl+X': 'Cortar',
      'Ctrl+Z': 'Deshacer', 'Ctrl+Y': 'Rehacer', 'Ctrl+A': 'Seleccionar todo',
      'Ctrl+S': 'Guardar', 'Ctrl+O': 'Abrir', 'Ctrl+P': 'Imprimir',
      'Ctrl+F': 'Buscar', 'Ctrl+H': 'Reemplazar', 'Ctrl+N': 'Nueva ventana',
      'Ctrl+W': 'Cerrar pestaña', 'Ctrl+T': 'Nueva pestaña',
      'Alt+Tab': 'Cambiar ventana', 'Alt+F4': 'Cerrar ventana',
      'Win+D': 'Mostrar escritorio', 'Win+E': 'Abrir explorador',
      'Win+R': 'Ejecutar', 'Win+L': 'Bloquear', 'Print Screen': 'Capturar pantalla',
      'Win+Shift+S': 'Recorte de pantalla'
    },
    browser: {
      'Ctrl+Tab': 'Siguiente pestaña', 'Ctrl+Shift+Tab': 'Pestaña anterior',
      'Ctrl+1-8': 'Pestaña #', 'Ctrl+9': 'Última pestaña', 'Ctrl+L': 'Barra direcciones',
      'Ctrl+D': 'Marcador', 'Ctrl+J': 'Descargas', 'Ctrl+H': 'Historial',
      'Ctrl+Shift+Del': 'Limpiar datos', 'F5': 'Recargar', 'Ctrl+F5': 'Recargar fuerte',
      'F11': 'Pantalla completa', 'F12': 'DevTools'
    },
    textEditing: {
      'Ctrl+←/→': 'Palabra anterior/siguiente', 'Ctrl+Shift+←/→': 'Seleccionar palabra',
      'Home': 'Inicio línea', 'End': 'Fin línea', 'Ctrl+Home': 'Inicio documento',
      'Ctrl+End': 'Fin documento', 'Shift+Home/End': 'Seleccionar hasta inicio/fin línea',
      'Ctrl+Backspace': 'Eliminar palabra anterior', 'Ctrl+Delete': 'Eliminar palabra siguiente'
    }
  },

  webDomKnowledge: {
    commonSelectors: {
      buttons: ['button', '[role="button"]', 'input[type="submit"]', 'input[type="button"]',
                '.btn', '.button', '[class*="btn-"]', 'a.btn', 'a.button'],
      inputs: ['input:not([type="hidden"])', 'textarea', 'select', '[contenteditable="true"]',
               '[role="textbox"]', '[role="combobox"]', '[role="searchbox"]'],
      links: ['a[href]', '[role="link"]'],
      forms: ['form', '[role="form"]'],
      modals: ['[role="dialog"]', '[role="alertdialog"]', '.modal', '.dialog', '[class*="modal"]'],
      menus: ['[role="menu"]', '[role="menubar"]', '.dropdown', '[class*="dropdown"]', '[class*="menu"]'],
      notifications: ['[role="alert"]', '[role="status"]', '.toast', '.notification',
                      '[class*="alert"]', '[class*="notification"]'],
      errors: ['.error', '.has-error', '[aria-invalid="true"]', '[class*="error"]',
               '[class*="invalid"]', '.text-danger', '.red'],
      loading: ['.spinner', '.loading', '[class*="spinner"]', '[class*="loading"]',
                '[aria-busy="true"]']
    },
    interactionPatterns: {
      clickWait: 'Después de hacer clic, espera 500-2000ms para que la página reaccione',
      typeWait: 'Después de escribir, espera 200-500ms',
      navigationWait: 'Después de navegar, espera 1000-3000ms para carga completa',
      formSubmitWait: 'Después de enviar formulario, espera 2000-5000ms',
      animationWait: 'Si hay animaciones, espera 500-1000ms adicionales',
      fileUpload: 'Para subir archivos, busca input[type="file"] o arrastra al área designada',
      dropdownSelect: 'Para selects nativos usa Ctrl+↓/↑ para navegar opciones',
      checkboxToggle: 'Para checkboxes/radios, haz clic en el label en lugar del input'
    },
    whatToLookFor: {
      firstScreen: ['Encabezados h1-h6', 'Botones principales', 'Campos visibles',
                    'Enlaces importantes', 'Menú de navegación'],
      afterAction: ['Mensajes de éxito/error', 'Cambios en la URL', 'Nuevos elementos emergentes',
                    'Deshabilitación/habilitación de botones', 'Carga de contenido dinámico'],
      problemSigns: ['Elementos superpuestos', 'Botones deshabilitados', 'Spinners infinitos',
                     'Campos vacíos con borde rojo', 'toast de error', 'cambios de URL inesperados']
    },
    siteSpecific: {
      google: {
        forms: 'Los formularios de Google a veces tienen iframes - busca dentro de ellos',
        recaptcha: 'reCAPTCHA requiere interacción manual - busca el checkbox'
      },
      facebook: {
        selectors: '[aria-label] es clave en Facebook - los botones tienen labels descriptivos',
        navigation: 'Facebook Business Suite usa divs con role="button" para navegar'
      },
      commonSites: {
        whatsapp: 'WhatsApp Web carga en http://web.whatsapp.com - usa input[contenteditable]',
        gmail: 'Gmail usa role="main" y role="navigation" para estructura',
        youtube: 'YouTube tiene player con role="application" y botones con aria-label'
      }
    }
  },

  pcAgentCapabilities: {
    input: {
      mouse: ['mouse_move (x, y)', 'mouse_click (button: left|right)',
              'mouse_double_click', 'mouse_scroll (clicks: number)', 'drag_and_drop (x1, y1, x2, y2)'],
      keyboard: ['keyboard_type (text)', 'keyboard_press (key: ENTER|TAB|ESC|...)',
                 'keyboard_shortcut (modifiers: ["ctrl","alt"], key: "c")'],
      clipboard: ['get_clipboard', 'set_clipboard (text)']
    },
    output: {
      screen: ['screenshot (quality: 1-100, scale: 0.1-1.0, force: true/false)',
               'screenshot_stable (waits and then captures)'],
      info: ['sysinfo', 'list_windows', 'list_apps', 'browser_tabs', 'get_cursor']
    },
    files: {
      read: ['read_file (path)', 'list_dir (path)'],
      write: ['write_file (path, content)'],
      execute: ['powershell (script)', 'cmd (command)'],
      download: ['download_file (url, path)']
    },
    system: {
      open: ['open_url (url)', 'open_file (path)'],
      focus: ['focus_window (pid)'],
      notify: ['notify (message, title)'],
      wait: ['wait (ms)']
    }
  },

  performance: {
    screenshotTimings: {
      'quality=60, scale=0.75': '~300-500ms envío, ~50-100KB',
      'quality=40, scale=0.5': '~200-300ms envío, ~20-40KB',
      'quality=80, scale=1.0': '~500-1000ms envío, ~150-300KB',
      tip: 'Usa calidad 40-60 para tareas rápidas, 80 solo cuando necesites leer texto pequeño'
    },
    commandTimings: {
      'mouse_move': '~50ms', 'mouse_click': '~80ms', 'keyboard_type': '~5ms por carácter',
      'powershell': '~200-500ms', 'screenshot': '~200-500ms',
      tip: 'Agrupa comandos relacionados o usa batch para reducir latencia'
    },
    bestPractices: [
      'Toma screenshot solo cuando sea necesario - no en cada paso',
      'Usa keyboard_shortcut en lugar de múltiples teclas individuales',
      'Para tareas largas, reduce calidad del screenshot a 40',
      'Usa wait(ms) entre acciones para dejar que la UI se estabilice',
      'Si el screenshot no cambió (unchanged=true), espera e intenta de nuevo'
    ]
  },

  mediaServer: {
    baseUrl: '/media/',
    uploadEndpoint: '/api/media/upload (POST con base64)',
    uploadUrlEndpoint: '/api/media/upload-url (POST con URL)',
    listEndpoint: '/api/media/list (GET)',
    screenshotEndpoint: '/api/media/screenshot (POST - captura la PC y la guarda)',
    tip: 'Las imágenes se guardan en media/ y se acceden via /media/nombre. Usa upload-url para descargar imágenes de internet y guardarlas localmente.',
    useCases: [
      'Tomar screenshot y guardarlo para referencia futura',
      'Descargar imágenes de sitios web al servidor',
      'Subir imágenes para que la IA las analice',
      'Almacenar capturas de evidencia de tareas completadas'
    ]
  },

  commonTaskPatterns: {
    webAutomation: {
      steps: [
        'Abrir navegador/URL con open_url',
        'Esperar carga (wait 1000-2000ms)',
        'Tomar screenshot para ver el estado',
        'Identificar elementos a interactuar',
        'Usar mouse_move + mouse_click o keyboard_shortcut para navegar',
        'Usar keyboard_type para llenar campos',
        'Verificar resultado con screenshot'
      ]
    },
    fileManagement: {
      steps: [
        'Navegar con explorer.exe o open_file',
        'Listar directorio con list_dir',
        'Leer/escribir archivos con read_file/write_file',
        'Mover/copiar con PowerShell'
      ]
    },
    systemAdministration: {
      steps: [
        'Ejecutar PowerShell para comandos administrativos',
        'Verificar estado con sysinfo',
        'Gestionar procesos con taskkill/Start-Process'
      ]
    }
  }
};

export { envKnowledge };
export default envKnowledge;
