import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

vi.mock('../../src/components/CodeBlock.jsx', () => ({
  default: (props: { code: string; language: string }) => (
    <pre data-testid={`code-${props.language}`}>{props.code}</pre>
  ),
}));

vi.mock('../../src/components/RecordedTurn.jsx', () => ({
  default: (props: { index: number }) => (
    <div class="recorded-modal__turn" data-index={props.index}>
      turn-{props.index}
    </div>
  ),
}));

vi.mock('../../src/components/RecordedOutline.jsx', () => ({
  default: () => <div class="recorded-modal__rail" />,
}));

vi.mock('../../src/components/RecordedResponseTab.jsx', () => ({
  HeadersTable: (props: { headers: unknown; emptyCopy: string }) => (
    <div>{props.headers ? 'headers' : props.emptyCopy}</div>
  ),
  ResponseTab: () => <div>response-tab</div>,
  ToolsList: () => <div>tools-list</div>,
  prettyJson: (v: unknown) => JSON.stringify(v, null, 2),
}));

import { RecordedTabContent } from '../../src/components/RecordedTabContent';
import type { OutlineRow } from '../../src/components/RecordedOutline';
import type { ChatMessage, Role } from '../../src/components/recorded-message-helpers';
import type { MessageDetailResponse } from '../../src/services/api';

function makeData(overrides: Record<string, unknown> = {}): MessageDetailResponse {
  return {
    message: {
      id: 'msg-1',
      timestamp: '2026-01-01',
      model: 'gpt-4o',
      provider: 'openai',
      auth_type: 'api_key',
      status: 'ok',
      input_tokens: 10,
      output_tokens: 5,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      cost_usd: 0.001,
      duration_ms: 100,
      routing_tier: 'standard',
      request_headers: { 'user-agent': 'test' },
    },
    recording: {
      request_body: {
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi' },
        ],
      },
      response_body: { type: 'json', body: { choices: [] } },
      response_headers: { 'content-type': 'application/json' },
      size_bytes: 100,
      created_at: '',
    },
    llm_calls: [],
    tool_executions: [],
    agent_logs: [],
    ...overrides,
  } as unknown as MessageDetailResponse;
}

function makeMessages(): ChatMessage[] {
  return [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'hi' },
  ];
}

function makeRows(): OutlineRow[] {
  return [
    { index: 0, role: 'user', roleLabel: 'user', preview: 'hello', tokens: 3 },
    { index: 1, role: 'assistant', roleLabel: 'assistant', preview: 'hi', tokens: 2 },
  ];
}

const allRoles = new Set<Role>(['user', 'assistant', 'system', 'tool', 'unknown']);

describe('RecordedTabContent - ResizableConversation drag behavior', () => {
  it('mousedown on resize handle + mousemove changes sidebar width + mouseup stops drag', () => {
    const { container } = render(() => (
      <RecordedTabContent
        tab="conversation"
        data={makeData()}
        messages={makeMessages()}
        rows={makeRows()}
        visibleRoles={allRoles}
        expandedTurns={new Set([0, 1])}
        activeTurnIndex={null}
        renderMode="rendered"
        searchQuery=""
        onSearch={vi.fn()}
        onToggleTurn={vi.fn()}
        outlineProps={{
          activeIndex: null,
          searchQuery: '',
          onSearch: vi.fn(),
          onJump: vi.fn(),
          onToggleRole: vi.fn(),
          onJumpFirstUser: vi.fn(),
          onJumpLastUser: vi.fn(),
          onJumpLastAssistant: vi.fn(),
        }}
      />
    ));

    const layout = container.querySelector('.recorded-drawer__conversation-layout') as HTMLElement;
    const handle = container.querySelector('.recorded-drawer__resize-handle') as HTMLElement;
    expect(handle).not.toBeNull();

    // Mock getBoundingClientRect for the layout
    layout.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => {},
    });

    // Start drag
    fireEvent.mouseDown(handle, { clientX: 260 });

    // Should be dragging
    expect(layout.classList.contains('recorded-drawer__conversation-layout--dragging')).toBe(true);

    // Simulate mousemove to x = 400 (within bounds)
    const moveEvent = new MouseEvent('mousemove', { clientX: 400, bubbles: true });
    document.dispatchEvent(moveEvent);

    // Check that sidebar width changed
    expect(layout.style.gridTemplateColumns).toContain('400px');

    // Simulate mouseup
    const upEvent = new MouseEvent('mouseup', { bubbles: true });
    document.dispatchEvent(upEvent);

    // Should stop dragging
    expect(layout.classList.contains('recorded-drawer__conversation-layout--dragging')).toBe(false);
  });

  it('drag to x < SIDEBAR_MIN (150) collapses the sidebar', () => {
    const { container } = render(() => (
      <RecordedTabContent
        tab="conversation"
        data={makeData()}
        messages={makeMessages()}
        rows={makeRows()}
        visibleRoles={allRoles}
        expandedTurns={new Set([0, 1])}
        activeTurnIndex={null}
        renderMode="rendered"
        searchQuery=""
        onSearch={vi.fn()}
        onToggleTurn={vi.fn()}
        outlineProps={{
          activeIndex: null,
          searchQuery: '',
          onSearch: vi.fn(),
          onJump: vi.fn(),
          onToggleRole: vi.fn(),
          onJumpFirstUser: vi.fn(),
          onJumpLastUser: vi.fn(),
          onJumpLastAssistant: vi.fn(),
        }}
      />
    ));

    const layout = container.querySelector('.recorded-drawer__conversation-layout') as HTMLElement;
    const handle = container.querySelector('.recorded-drawer__resize-handle') as HTMLElement;

    layout.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => {},
    });

    fireEvent.mouseDown(handle, { clientX: 260 });

    // Move to x < 150 to collapse
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, bubbles: true }));

    // Should show collapsed grid columns
    expect(layout.style.gridTemplateColumns).toBe('0px 4px 1fr');

    // Cleanup
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });

  it('when collapsed, dragging the handle past SIDEBAR_MIN expands the sidebar', () => {
    const { container } = render(() => (
      <RecordedTabContent
        tab="conversation"
        data={makeData()}
        messages={makeMessages()}
        rows={makeRows()}
        visibleRoles={allRoles}
        expandedTurns={new Set([0, 1])}
        activeTurnIndex={null}
        renderMode="rendered"
        searchQuery=""
        onSearch={vi.fn()}
        onToggleTurn={vi.fn()}
        outlineProps={{
          activeIndex: null,
          searchQuery: '',
          onSearch: vi.fn(),
          onJump: vi.fn(),
          onToggleRole: vi.fn(),
          onJumpFirstUser: vi.fn(),
          onJumpLastUser: vi.fn(),
          onJumpLastAssistant: vi.fn(),
        }}
      />
    ));

    const layout = container.querySelector('.recorded-drawer__conversation-layout') as HTMLElement;
    const handle = container.querySelector('.recorded-drawer__resize-handle') as HTMLElement;

    layout.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => {},
    });

    // First collapse the sidebar by dragging below min
    fireEvent.mouseDown(handle, { clientX: 260 });
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    // Verify collapsed
    expect(layout.style.gridTemplateColumns).toBe('0px 4px 1fr');
    expect(handle.classList.contains('recorded-drawer__resize-handle--collapsed')).toBe(true);

    // Start another drag on the handle (startDrag fires since it's the compiled handler)
    fireEvent.mouseDown(handle, { clientX: 0 });

    // Move to x = 260 (above SIDEBAR_MIN) — this expands from collapsed
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 260, bubbles: true }));

    // Should now be expanded to 260px
    expect(layout.style.gridTemplateColumns).toContain('260px');
    // collapsed should be false
    expect(handle.classList.contains('recorded-drawer__resize-handle--collapsed')).toBe(false);

    // Cleanup
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });

  it('drag to x > SIDEBAR_MAX (550) caps sidebar width at 550', () => {
    const { container } = render(() => (
      <RecordedTabContent
        tab="conversation"
        data={makeData()}
        messages={makeMessages()}
        rows={makeRows()}
        visibleRoles={allRoles}
        expandedTurns={new Set([0, 1])}
        activeTurnIndex={null}
        renderMode="rendered"
        searchQuery=""
        onSearch={vi.fn()}
        onToggleTurn={vi.fn()}
        outlineProps={{
          activeIndex: null,
          searchQuery: '',
          onSearch: vi.fn(),
          onJump: vi.fn(),
          onToggleRole: vi.fn(),
          onJumpFirstUser: vi.fn(),
          onJumpLastUser: vi.fn(),
          onJumpLastAssistant: vi.fn(),
        }}
      />
    ));

    const layout = container.querySelector('.recorded-drawer__conversation-layout') as HTMLElement;
    const handle = container.querySelector('.recorded-drawer__resize-handle') as HTMLElement;

    layout.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => {},
    });

    fireEvent.mouseDown(handle, { clientX: 260 });

    // Move beyond max
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 700, bubbles: true }));

    // Should be capped at 550
    expect(layout.style.gridTemplateColumns).toContain('550px');

    // Cleanup
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });

  it('expandFromEdge re-expands a collapsed sidebar and starts a drag', () => {
    const { container } = render(() => (
      <RecordedTabContent
        tab="conversation"
        data={makeData()}
        messages={makeMessages()}
        rows={makeRows()}
        visibleRoles={allRoles}
        expandedTurns={new Set([0, 1])}
        activeTurnIndex={null}
        renderMode="rendered"
        searchQuery=""
        onSearch={vi.fn()}
        onToggleTurn={vi.fn()}
        outlineProps={{
          activeIndex: null,
          searchQuery: '',
          onSearch: vi.fn(),
          onJump: vi.fn(),
          onToggleRole: vi.fn(),
          onJumpFirstUser: vi.fn(),
          onJumpLastUser: vi.fn(),
          onJumpLastAssistant: vi.fn(),
        }}
      />
    ));

    const layout = container.querySelector('.recorded-drawer__conversation-layout') as HTMLElement;
    const handle = container.querySelector('.recorded-drawer__resize-handle') as HTMLElement;

    layout.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => {},
    });

    // Collapse the sidebar by dragging below min
    fireEvent.mouseDown(handle, { clientX: 260 });
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(layout.style.gridTemplateColumns).toBe('0px 4px 1fr');

    // Now click the collapsed handle — expandFromEdge should fire
    fireEvent.mouseDown(handle, { clientX: 2 });

    // The sidebar should expand to the default width and be in drag mode
    expect(layout.style.gridTemplateColumns).toContain('260px');
    expect(layout.classList.contains('recorded-drawer__conversation-layout--dragging')).toBe(true);

    // Cleanup
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
});

describe('RecordedTabContent - non-openai format', () => {
  it('renders a hint when the request body format is not openai', () => {
    const data = makeData({
      recording: {
        request_body: {
          contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
        },
        response_body: { type: 'json', body: {} },
        response_headers: {},
        size_bytes: 50,
        created_at: '',
      },
    });
    const { container } = render(() => (
      <RecordedTabContent
        tab="conversation"
        data={data}
        messages={[]}
        rows={[]}
        visibleRoles={allRoles}
        expandedTurns={new Set()}
        activeTurnIndex={null}
        renderMode="rendered"
        searchQuery=""
        onSearch={vi.fn()}
        onToggleTurn={vi.fn()}
      />
    ));
    expect(container.textContent).toContain('Raw tab');
  });
});
