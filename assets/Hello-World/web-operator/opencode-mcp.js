#!/usr/bin/env node
/**
 * MCP Server para Web Operator
 * Permite a OpenCode controlar el navegador directamente
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { WebOperator } from './operator.js';
import { operatorConfig, LoopDetector } from './config.js';

const server = new Server(
  {
    name: 'web-operator',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Global operator instance
let operator = null;
let loopDetector = null;
let taskInProgress = false;

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'web_navigate',
        description: 'Navega a una URL específica en el navegador',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL completa a navegar (ej: https://google.com)',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'web_execute_task',
        description: 'Ejecuta una tarea completa en el navegador (navega, busca, interactúa, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'Descripción de la tarea a realizar (ej: "Ve a Google y busca OpenCode")',
            },
            startUrl: {
              type: 'string',
              description: 'URL inicial (opcional)',
            },
            maxIterations: {
              type: 'number',
              description: 'Máximo de iteraciones (default: 30)',
            },
          },
          required: ['task'],
        },
      },
      {
        name: 'web_click',
        description: 'Hace click en un elemento específico',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'Selector CSS o descripción del elemento',
            },
          },
          required: ['selector'],
        },
      },
      {
        name: 'web_type',
        description: 'Escribe texto en un campo',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'Selector CSS del campo',
            },
            text: {
              type: 'string',
              description: 'Texto a escribir',
            },
          },
          required: ['selector', 'text'],
        },
      },
      {
        name: 'web_screenshot',
        description: 'Toma una captura de pantalla de la página actual',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'web_extract',
        description: 'Extrae contenido de la página actual',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Qué extraer (opcional)',
            },
          },
        },
      },
      {
        name: 'web_stop',
        description: 'Detiene la tarea actual si está en bucle o atascada',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'web_status',
        description: 'Obtiene el estado actual del navegador y detecta bucles',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    // Inicializar operator si no existe
    if (!operator) {
      operator = new WebOperator({
        headless: false,
        verbose: true,
        maxIterations: operatorConfig.maxIterations,
      });
      loopDetector = new LoopDetector();
    }

    switch (name) {
      case 'web_navigate': {
        const { url } = args;
        await operator.browser.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        return {
          content: [{ type: 'text', text: `✅ Navegado a: ${url}` }],
        };
      }

      case 'web_execute_task': {
        if (taskInProgress) {
          return {
            content: [{ type: 'text', text: '❌ Ya hay una tarea en progreso. Usa web_stop para detenerla.' }],
            isError: true,
          };
        }

        const { task, startUrl, maxIterations } = args;
        taskInProgress = true;
        loopDetector.reset();

        try {
          const result = await operator.runTask(task, startUrl, maxIterations);
          taskInProgress = false;

          return {
            content: [
              {
                type: 'text',
                text: `${result.success ? '✅' : '❌'} Tarea completada\n\n` +
                      `Mensaje: ${result.message}\n` +
                      `Iteraciones: ${result.iterations}\n` +
                      `URL final: ${result.finalUrl}\n` +
                      `\nContenido extraído:\n${result.pageContent?.slice(0, 2000) || 'N/A'}`,
              },
            ],
          };
        } catch (error) {
          taskInProgress = false;
          throw error;
        }
      }

      case 'web_screenshot': {
        const screenshot = await operator.browser.takeScreenshot();
        const pageInfo = await operator.browser.getPageInfo();

        return {
          content: [
            {
              type: 'text',
              text: `📸 Screenshot capturado\nURL: ${pageInfo.url}\nTítulo: ${pageInfo.title}`,
            },
            {
              type: 'image',
              data: screenshot,
              mimeType: 'image/png',
            },
          ],
        };
      }

      case 'web_extract': {
        const pageContent = await operator.browser.extractPageContent();
        return {
          content: [
            {
              type: 'text',
              text: `📄 Contenido extraído:\n\n${pageContent.slice(0, 5000)}`,
            },
          ],
        };
      }

      case 'web_stop': {
        taskInProgress = false;
        return {
          content: [{ type: 'text', text: '⏹️ Tarea detenida' }],
        };
      }

      case 'web_status': {
        const loopStatus = loopDetector.isInLoop();
        const pageInfo = await operator.browser.getPageInfo();

        let status = `📊 Estado del Web Operator\n\n`;
        status += `URL actual: ${pageInfo.url}\n`;
        status += `Título: ${pageInfo.title}\n`;
        status += `Tarea en progreso: ${taskInProgress ? 'Sí' : 'No'}\n`;
        status += `\n🔄 Detección de Bucles:\n`;
        status += `En bucle: ${loopStatus.inLoop ? '⚠️ SÍ' : '✅ NO'}\n`;

        if (loopStatus.inLoop) {
          status += `Razón: ${loopStatus.reason}\n`;
          status += `Recomendación: Usa web_stop para detener\n`;
        }

        return {
          content: [{ type: 'text', text: status }],
        };
      }

      default:
        throw new Error(`Tool desconocido: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Web Operator MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
