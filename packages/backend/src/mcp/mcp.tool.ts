import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppEntity } from '../app/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { ViewEntity } from '../view/view.entity';
import { ReturnValueEntity } from '../return-value/return-value.entity';
import { CallFlowEntity } from '../call-flow/call-flow.entity';
import type { McpToolResponse, LayoutTemplate } from '@chatgpt-app-builder/shared';

/**
 * MCP protocol error for inactive tools
 * Error code -32602 is "Invalid params" per JSON-RPC 2.0 specification
 */
export class McpInactiveToolError extends BadRequestException {
  readonly code = -32602;

  constructor(toolName: string) {
    super({
      code: -32602,
      message: `Tool '${toolName}' is not active and cannot be executed`,
    });
  }
}

/**
 * Service for handling MCP tool calls for published apps
 * Implements ChatGPT Apps SDK response format
 * Each flow in an app becomes an MCP tool
 */
@Injectable()
export class McpToolService {
  constructor(
    @InjectRepository(AppEntity)
    private readonly appRepository: Repository<AppEntity>,
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>,
    @InjectRepository(ViewEntity)
    private readonly viewRepository: Repository<ViewEntity>
  ) {}

  /**
   * Get app by slug (used for MCP server discovery)
   */
  async getAppBySlug(slug: string): Promise<AppEntity | null> {
    return this.appRepository.findOne({
      where: { slug, status: 'published' },
      relations: ['flows'],
    });
  }

  /**
   * Execute an MCP tool call for a published app's flow
   * Returns ChatGPT Apps SDK formatted response
   *
   * For flows with views: returns structuredContent + widget metadata
   * For flows with return values: returns text content array for LLM processing
   */
  async executeTool(
    appSlug: string,
    toolName: string,
    input: { message: string }
  ): Promise<McpToolResponse> {
    const app = await this.getAppBySlug(appSlug);
    if (!app) {
      throw new NotFoundException(`No published app found for slug: ${appSlug}`);
    }

    // Find the flow that matches the tool name (include views, returnValues, and callFlows)
    const flow = await this.flowRepository.findOne({
      where: { appId: app.id, toolName },
      relations: ['views', 'returnValues', 'callFlows', 'callFlows.targetFlow'],
    });

    if (!flow) {
      throw new NotFoundException(`No tool found with name: ${toolName}`);
    }

    // Check if tool is active (T022) - return MCP error -32602 if inactive (T023)
    if (!flow.isActive) {
      throw new McpInactiveToolError(toolName);
    }

    // Check if flow has return values - if so, return text content for LLM
    const returnValues = flow.returnValues?.sort((a, b) => a.order - b.order) || [];
    if (returnValues.length > 0) {
      return this.executeReturnValueFlow(flow, returnValues);
    }

    // Check if flow has call flows - if so, trigger target flows via callTool
    const callFlows = flow.callFlows?.sort((a, b) => a.order - b.order) || [];
    if (callFlows.length > 0) {
      return this.executeCallFlowFlow(app, flow, callFlows);
    }

    // Otherwise, use view-based response with widget
    const views = flow.views?.sort((a, b) => a.order - b.order) || [];
    const primaryView = views[0];

    if (!primaryView) {
      throw new NotFoundException(`No views or return values found for tool: ${toolName}`);
    }

    // Generate response text based on the request
    const responseText = this.generateResponseText(
      flow.name,
      primaryView.layoutTemplate,
      input.message
    );

    // Return ChatGPT Apps SDK formatted response
    // structuredContent: model-visible, widget-readable data
    // content: optional narration for model
    // _meta: widget-only data (hidden from model)
    return {
      structuredContent: primaryView.mockData,
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
      _meta: {
        'openai/outputTemplate': `ui://widget/${app.slug}/${flow.toolName}.html`,
        'openai/widgetPrefersBorder': true,
        // Additional widget-only data
        flowName: flow.name,
        toolName: flow.toolName,
      },
    };
  }

  /**
   * Execute a flow with return values - returns text content array for LLM processing
   * Each return value becomes a separate content item in order
   */
  private executeReturnValueFlow(
    flow: FlowEntity,
    returnValues: ReturnValueEntity[]
  ): McpToolResponse {
    // Return multiple return values as separate content items per MCP protocol
    const content = returnValues.map((rv) => ({
      type: 'text' as const,
      text: rv.text,
    }));

    return {
      content,
      // No structuredContent or widget metadata for return value flows
      // The text is meant for LLM processing, not UI display
    };
  }

  /**
   * Execute a flow with call flows - returns HTML widget that triggers target flows
   * Uses window.openai.callTool() from the ChatGPT Apps SDK to invoke target flows
   */
  private executeCallFlowFlow(
    app: AppEntity,
    flow: FlowEntity,
    callFlows: CallFlowEntity[]
  ): McpToolResponse {
    // Get the first call flow (for now we support single call flow per flow)
    const primaryCallFlow = callFlows[0];
    const targetFlow = primaryCallFlow.targetFlow;

    if (!targetFlow) {
      // Target flow was deleted - return error message
      return {
        content: [
          {
            type: 'text',
            text: `Error: The target flow for this action no longer exists.`,
          },
        ],
      };
    }

    // Return response with widget that will trigger the target flow
    return {
      structuredContent: {
        action: 'callFlow',
        targetToolName: targetFlow.toolName,
        targetFlowName: targetFlow.name,
      },
      content: [
        {
          type: 'text',
          text: `Triggering ${targetFlow.name}...`,
        },
      ],
      _meta: {
        'openai/outputTemplate': `ui://widget/${app.slug}/${flow.toolName}-callflow.html`,
        'openai/widgetPrefersBorder': false,
        flowName: flow.name,
        toolName: flow.toolName,
        targetToolName: targetFlow.toolName,
      },
    };
  }

  /**
   * List all tools available for an MCP server (one per flow)
   * Tools with views include widget metadata, tools with return values do not
   */
  async listTools(appSlug: string): Promise<{
    name: string;
    description: string;
    inputSchema: object;
  }[]> {
    const app = await this.getAppBySlug(appSlug);
    if (!app) {
      return [];
    }

    const flows = await this.flowRepository.find({
      where: { appId: app.id, isActive: true },
      relations: ['views', 'returnValues', 'callFlows'],
    });

    return flows.map((flow) => {
      // Build composite description with whenToUse/whenNotToUse
      const parts = [flow.toolDescription || `Execute the ${flow.name} flow`];
      if (flow.whenToUse) {
        parts.push(`\nWHEN TO USE:\n${flow.whenToUse}`);
      }
      if (flow.whenNotToUse) {
        parts.push(`\nWHEN NOT TO USE:\n${flow.whenNotToUse}`);
      }
      const description = parts.join('');

      // Check if flow has views or call flows (needs widget) or return values (no widget)
      const hasViews = flow.views && flow.views.length > 0;
      const hasCallFlows = flow.callFlows && flow.callFlows.length > 0;

      const toolDef: {
        name: string;
        description: string;
        inputSchema: object;
        _meta?: object;
      } = {
        name: flow.toolName,
        description,
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'User query or request',
            },
          },
          required: ['message'],
        },
      };

      // Only include widget metadata for flows with views or call flows
      if (hasViews) {
        toolDef._meta = {
          'openai/outputTemplate': `ui://widget/${appSlug}/${flow.toolName}.html`,
          'openai/toolInvocation/invoking': `Loading ${flow.name}...`,
          'openai/toolInvocation/invoked': `Loaded ${flow.name}`,
        };
      } else if (hasCallFlows) {
        toolDef._meta = {
          'openai/outputTemplate': `ui://widget/${appSlug}/${flow.toolName}-callflow.html`,
          'openai/toolInvocation/invoking': `Triggering ${flow.name}...`,
          'openai/toolInvocation/invoked': `Triggered ${flow.name}`,
        };
      }

      return toolDef;
    });
  }

  /**
   * List all UI resources for an app (flows with views or call flows)
   */
  async listResources(appSlug: string): Promise<{
    uri: string;
    name: string;
    description: string;
    mimeType: string;
  }[]> {
    const app = await this.getAppBySlug(appSlug);
    if (!app) {
      return [];
    }

    const flows = await this.flowRepository.find({
      where: { appId: app.id, isActive: true },
      relations: ['views', 'callFlows'],
    });

    // Include flows that have views or call flows (not return value flows)
    const resources: { uri: string; name: string; description: string; mimeType: string }[] = [];

    for (const flow of flows) {
      if (flow.views && flow.views.length > 0) {
        resources.push({
          uri: `ui://widget/${appSlug}/${flow.toolName}.html`,
          name: `${flow.name} Widget`,
          description: `UI widget for ${flow.toolName}`,
          mimeType: 'text/html+skybridge',
        });
      } else if (flow.callFlows && flow.callFlows.length > 0) {
        resources.push({
          uri: `ui://widget/${appSlug}/${flow.toolName}-callflow.html`,
          name: `${flow.name} Call Flow Widget`,
          description: `Call flow trigger widget for ${flow.toolName}`,
          mimeType: 'text/html+skybridge',
        });
      }
    }

    return resources;
  }

  /**
   * Read a UI resource and return its HTML content
   */
  async readResource(appSlug: string, uri: string): Promise<{
    uri: string;
    mimeType: string;
    text: string;
  }> {
    const app = await this.getAppBySlug(appSlug);
    if (!app) {
      throw new NotFoundException(`No published app found for slug: ${appSlug}`);
    }

    // Parse the URI: ui://widget/{appSlug}/{toolName}.html or {toolName}-callflow.html
    const callFlowMatch = uri.match(/^ui:\/\/widget\/([^/]+)\/([^-]+)-callflow\.html$/);
    const viewMatch = uri.match(/^ui:\/\/widget\/([^/]+)\/([^.]+)\.html$/);

    if (callFlowMatch && callFlowMatch[1] === appSlug) {
      // Call flow widget
      const toolName = callFlowMatch[2];
      const flow = await this.flowRepository.findOne({
        where: { appId: app.id, toolName, isActive: true },
        relations: ['callFlows', 'callFlows.targetFlow'],
      });

      if (!flow) {
        throw new NotFoundException(`No active flow found for tool: ${toolName}`);
      }

      const callFlows = flow.callFlows?.sort((a, b) => a.order - b.order) || [];
      const primaryCallFlow = callFlows[0];

      if (!primaryCallFlow || !primaryCallFlow.targetFlow) {
        throw new NotFoundException(`No valid call flow found for tool: ${toolName}`);
      }

      // Generate the call flow widget HTML
      const widgetHtml = this.generateCallFlowWidgetHtml(
        flow.name,
        primaryCallFlow.targetFlow.toolName,
        primaryCallFlow.targetFlow.name
      );

      return {
        uri,
        mimeType: 'text/html+skybridge',
        text: widgetHtml,
        _meta: {
          'openai/widgetPrefersBorder': false,
          'openai/widgetDescription': `Call flow trigger for ${flow.name}`,
        },
      };
    } else if (viewMatch && viewMatch[1] === appSlug) {
      // Regular view widget
      const toolName = viewMatch[2];
      const flow = await this.flowRepository.findOne({
        where: { appId: app.id, toolName, isActive: true },
        relations: ['views'],
      });

      if (!flow) {
        throw new NotFoundException(`No active flow found for tool: ${toolName}`);
      }

      const views = flow.views?.sort((a, b) => a.order - b.order) || [];
      const primaryView = views[0];

      if (!primaryView) {
        throw new NotFoundException(`No views found for tool: ${toolName}`);
      }

      // Generate the widget HTML using ChatGPT Apps SDK bridge
      const widgetHtml = this.generateWidgetHtml(
        flow.name,
        primaryView.layoutTemplate,
        app.themeVariables
      );

      return {
        uri,
        mimeType: 'text/html+skybridge',
        text: widgetHtml,
        _meta: {
          'openai/widgetPrefersBorder': true,
          'openai/widgetDescription': `Interactive widget for ${flow.name}`,
        },
      };
    }

    throw new NotFoundException(`Invalid resource URI: ${uri}`);
  }

  /**
   * Generate widget HTML with ChatGPT Apps SDK bridge
   * Follows https://developers.openai.com/apps-sdk/build/chatgpt-ui/
   */
  private generateWidgetHtml(
    flowName: string,
    layoutTemplate: LayoutTemplate,
    themeVariables: Record<string, string>
  ): string {
    const cssVariables = Object.entries(themeVariables)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value};`)
      .join('\n      ');

    if (layoutTemplate === 'table') {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${flowName}</title>
  <style>
    :root {
      ${cssVariables}
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      /* Transparent background for seamless iframe embedding */
      background: transparent;
      color: var(--text-color, #1a1a2e);
      padding: 12px;
    }
    /* Support ChatGPT dark/light theme */
    body.dark { --text-color: #e5e5e5; --bg-muted: #2d2d2d; --border-color: #404040; }
    body.light { --text-color: #1a1a2e; --bg-muted: #f5f5f5; --border-color: #e5e5e5; }
    .table-container {
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid var(--border-color, #e5e5e5);
    }
    table { width: 100%; border-collapse: collapse; }
    th {
      background: var(--bg-muted, #f5f5f5);
      font-weight: 500;
      text-align: left;
      padding: 12px 16px;
      font-size: 14px;
    }
    td {
      padding: 12px 16px;
      font-size: 14px;
      border-top: 1px solid var(--border-color, #e5e5e5);
    }
    tr:hover td { background: var(--bg-muted, #f5f5f5); opacity: 0.7; }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      font-size: 12px;
      font-weight: 500;
      border-radius: 4px;
      background: #10a37f;
      color: white;
    }
    .badge.warning { background: #f59e0b; }
    .badge.error { background: #ef4444; }
    .loading { text-align: center; padding: 40px; color: #666; }
    button {
      padding: 6px 12px;
      background: #10a37f;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    button:hover { background: #0d8e6f; }
  </style>
</head>
<body>
  <div id="root">
    <div id="loading" class="loading">Loading...</div>
    <div class="table-container" id="table-container" style="display: none;">
      <table id="data-table">
        <thead><tr id="header-row"></tr></thead>
        <tbody id="body-rows"></tbody>
      </table>
    </div>
  </div>

  <script>
    // ChatGPT Apps SDK Widget
    // https://developers.openai.com/apps-sdk/build/chatgpt-ui/

    (function() {
      // Apply theme from ChatGPT
      function applyTheme() {
        var theme = window.openai && window.openai.theme ? window.openai.theme : 'light';
        document.body.className = theme;
      }

      // Read data from ChatGPT Apps SDK
      // toolOutput contains structuredContent from tool response
      function getToolData() {
        if (window.openai && window.openai.toolOutput) {
          return window.openai.toolOutput;
        }
        return null;
      }

      // Initialize widget with data
      function initWidget() {
        applyTheme();
        var data = getToolData();
        if (data) {
          renderTable(data);
        }
      }

      // Listen for data updates via openai:set_globals event
      window.addEventListener('openai:set_globals', function(event) {
        applyTheme();
        if (event.detail && event.detail.toolOutput) {
          renderTable(event.detail.toolOutput);
        }
      });

      // Fallback: postMessage for testing/iframe embedding
      window.addEventListener('message', function(event) {
        if (event.data && (event.data.structuredContent || event.data.columns)) {
          renderTable(event.data.structuredContent || event.data);
        }
      });

      function renderTable(data) {
        if (!data || !data.columns || !data.rows) return;

        document.getElementById('loading').style.display = 'none';
        document.getElementById('table-container').style.display = 'block';

        var headerRow = document.getElementById('header-row');
        var bodyRows = document.getElementById('body-rows');

        headerRow.innerHTML = data.columns
          .map(function(col) { return '<th>' + escapeHtml(col.header) + '</th>'; })
          .join('');

        bodyRows.innerHTML = data.rows
          .map(function(row, idx) {
            return '<tr data-row-id="' + idx + '">' + data.columns.map(function(col) {
              var value = row[col.key] != null ? row[col.key] : '';
              if (col.type === 'badge') {
                var badgeClass = 'badge';
                if (value === 'Out of Stock' || value === 'Error') badgeClass += ' error';
                else if (value === 'Low Stock' || value === 'Pending') badgeClass += ' warning';
                return '<td><span class="' + badgeClass + '">' + escapeHtml(value) + '</span></td>';
              }
              return '<td>' + escapeHtml(String(value)) + '</td>';
            }).join('') + '</tr>';
          }).join('');

        // Notify ChatGPT of content height
        if (window.openai && window.openai.notifyIntrinsicHeight) {
          window.openai.notifyIntrinsicHeight(document.body.scrollHeight);
        }
      }

      function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }

      // Example: Call tool from widget (for interactive widgets)
      window.callMcpTool = function(toolName, args) {
        if (window.openai && window.openai.callTool) {
          window.openai.callTool(toolName, args);
        }
      };

      // Initialize on load
      if (document.readyState === 'complete') {
        initWidget();
      } else {
        window.addEventListener('DOMContentLoaded', initWidget);
      }
    })();
  </script>
</body>
</html>`;
    } else {
      // Card layout
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${flowName}</title>
  <style>
    :root {
      ${cssVariables}
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: transparent;
      color: var(--text-color, #1a1a2e);
      padding: 12px;
    }
    body.dark { --text-color: #e5e5e5; --bg-card: #2d2d2d; --border-color: #404040; }
    body.light { --text-color: #1a1a2e; --bg-card: #ffffff; --border-color: #e5e5e5; }
    .card {
      background: var(--bg-card, #ffffff);
      border: 1px solid var(--border-color, #e5e5e5);
      border-radius: 8px;
      padding: 16px;
    }
    .card-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .card-content {
      color: var(--text-color, #666);
      line-height: 1.5;
    }
    .loading { text-align: center; padding: 40px; color: #666; }
  </style>
</head>
<body>
  <div id="root">
    <div id="loading" class="loading">Loading...</div>
    <div id="card-container" class="card" style="display: none;">
      <div id="card-title" class="card-title"></div>
      <div id="card-content" class="card-content"></div>
    </div>
  </div>

  <script>
    (function() {
      function applyTheme() {
        var theme = window.openai && window.openai.theme ? window.openai.theme : 'light';
        document.body.className = theme;
      }

      function getToolData() {
        if (window.openai && window.openai.toolOutput) {
          return window.openai.toolOutput;
        }
        return null;
      }

      function initWidget() {
        applyTheme();
        var data = getToolData();
        if (data) {
          renderCard(data);
        }
      }

      window.addEventListener('openai:set_globals', function(event) {
        applyTheme();
        if (event.detail && event.detail.toolOutput) {
          renderCard(event.detail.toolOutput);
        }
      });

      window.addEventListener('message', function(event) {
        if (event.data) {
          renderCard(event.data.structuredContent || event.data);
        }
      });

      function renderCard(data) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('card-container').style.display = 'block';
        document.getElementById('card-title').textContent = data.title || 'Content';
        document.getElementById('card-content').innerHTML = data.content || JSON.stringify(data, null, 2);

        if (window.openai && window.openai.notifyIntrinsicHeight) {
          window.openai.notifyIntrinsicHeight(document.body.scrollHeight);
        }
      }

      if (document.readyState === 'complete') {
        initWidget();
      } else {
        window.addEventListener('DOMContentLoaded', initWidget);
      }
    })();
  </script>
</body>
</html>`;
    }
  }

  /**
   * Generate call flow widget HTML that triggers window.openai.callTool
   * This widget automatically invokes the target flow when rendered
   */
  private generateCallFlowWidgetHtml(
    flowName: string,
    targetToolName: string,
    targetFlowName: string
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${flowName} - Call Flow</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: transparent;
      color: #1a1a2e;
      padding: 12px;
    }
    body.dark { color: #e5e5e5; }
    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #666;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #e5e5e5;
      border-top-color: #10a37f;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .success { color: #10a37f; }
    .error { color: #ef4444; }
  </style>
</head>
<body>
  <div id="root">
    <div class="status" id="status">
      <div class="spinner"></div>
      <span>Triggering ${targetFlowName}...</span>
    </div>
  </div>

  <script>
    // ChatGPT Apps SDK - Call Flow Widget
    // Automatically triggers the target flow using window.openai.callTool
    (function() {
      var TARGET_TOOL = '${targetToolName}';
      var triggered = false;

      function applyTheme() {
        var theme = window.openai && window.openai.theme ? window.openai.theme : 'light';
        document.body.className = theme;
      }

      function showSuccess() {
        var status = document.getElementById('status');
        status.innerHTML = '<span class="success">✓ Flow triggered successfully</span>';
      }

      function showError(message) {
        var status = document.getElementById('status');
        status.innerHTML = '<span class="error">✕ ' + message + '</span>';
      }

      function triggerFlow() {
        if (triggered) return;
        triggered = true;

        applyTheme();

        // Use ChatGPT Apps SDK to call the target tool
        if (window.openai && window.openai.callTool) {
          try {
            // callTool(toolName, args) - invoke another MCP tool
            window.openai.callTool(TARGET_TOOL, { message: 'Triggered from call flow action' });
            showSuccess();
          } catch (e) {
            showError('Failed to trigger flow: ' + e.message);
          }
        } else {
          // SDK not available - show message
          showError('ChatGPT Apps SDK not available');
        }

        // Notify ChatGPT of content height
        if (window.openai && window.openai.notifyIntrinsicHeight) {
          window.openai.notifyIntrinsicHeight(document.body.scrollHeight);
        }
      }

      // Trigger on load or when globals are set
      window.addEventListener('openai:set_globals', function() {
        applyTheme();
        triggerFlow();
      });

      // Initialize on load
      if (document.readyState === 'complete') {
        triggerFlow();
      } else {
        window.addEventListener('DOMContentLoaded', triggerFlow);
      }
    })();
  </script>
</body>
</html>`;
  }

  /**
   * Generate response text based on flow context
   */
  private generateResponseText(
    flowName: string,
    layoutTemplate: LayoutTemplate,
    _message: string
  ): string {
    if (layoutTemplate === 'table') {
      return `Here are the results from ${flowName}:`;
    } else {
      return `Here's the content from ${flowName}:`;
    }
  }
}
