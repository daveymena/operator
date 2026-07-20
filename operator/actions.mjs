/**
 * Operator Pro — Unified Actions Registry (v3.0)
 * 
 * Backward-compatible action executor that delegates to the new
 * engine system (Browser, Terminal, Screen, Filesystem, Platform).
 * 
 * This module provides the `execute()` function used by the original
 * operator.mjs loop while routing everything through the new engines.
 */

import { getOrchestrator } from './core/orchestrator.mjs';

let _orchestrator = null;

async function getOrch() {
  if (!_orchestrator) {
    _orchestrator = getOrchestrator({ verbose: false });
    await _orchestrator.init();
  }
  return _orchestrator;
}

/**
 * Execute an action — main entry point compatible with the original API.
 * Routes to the appropriate engine based on action type.
 */
export async function execute(action) {
  const orch = await getOrch();
  return orch.executeAction(action);
}

/**
 * Map legacy action types to new types for backward compatibility
 */
const LEGACY_MAP = {
  'browser_wait': 'browser_wait',
  'open_url': 'open_url',
  'open_file': 'open_file',
  'run_script': 'terminal_run',
  'notify': 'notify',
  'wait': 'wait',
  'done': 'done',
  'plan': 'done',
  'verify': 'done',
  'reflect': 'done',
};

/**
 * Get list of all available actions
 */
export function getAvailableActions() {
  return {
    browser: [
      'browser_goto', 'browser_click', 'browser_type', 'browser_press',
      'browser_select', 'browser_check', 'browser_evaluate', 'browser_screenshot',
      'browser_content', 'browser_find', 'browser_fill_form', 'browser_submit',
      'browser_wait', 'browser_tabs', 'browser_switch_tab', 'browser_new_tab',
      'browser_back', 'browser_forward', 'browser_reload', 'browser_cookies',
      'browser_download'
    ],
    screen: [
      'screenshot', 'screen_region', 'screen_ocr', 'screen_find_text', 'screen_info'
    ],
    terminal: [
      'terminal_exec', 'terminal_run', 'terminal_npm', 'terminal_git'
    ],
    filesystem: [
      'read_file', 'write_file', 'list_dir', 'search_files', 'grep_files',
      'delete_file', 'copy_file', 'move_file', 'mkdir', 'delete_dir'
    ],
    network: [
      'http_get', 'http_post', 'http_request', 'download'
    ],
    input: [
      'mouse_move', 'mouse_click', 'mouse_scroll', 'keyboard_type',
      'keyboard_press', 'get_cursor'
    ],
    system: [
      'sysinfo', 'list_windows', 'list_processes', 'open_url', 'open_file',
      'get_clipboard', 'set_clipboard', 'notify'
    ],
    meta: ['wait', 'done']
  };
}

export default { execute, getAvailableActions };
