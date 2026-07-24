import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import RequestMessages from '../../src/components/RequestMessages';

const recording = {
  request_body: {
    messages: [{ role: 'user', content: 'What is the weather?' }],
    tools: [
      {
        type: 'function',
        function: {
          name: 'weather',
          description: 'Read the forecast',
          parameters: { type: 'object' },
        },
      },
    ],
  },
  response_body: {
    type: 'json' as const,
    body: { choices: [{ message: { role: 'assistant', content: 'Sunny.' } }] },
  },
  api_format: 'chat_completions',
  size_bytes: 400,
  created_at: '2026-07-23T10:00:00.000Z',
};

describe('RequestMessages', () => {
  afterEach(cleanup);

  it('renders the recorded conversation and response', () => {
    const { getByText } = render(() => <RequestMessages recording={recording} />);
    expect(getByText('What is the weather?')).toBeTruthy();
    expect(getByText('Sunny.')).toBeTruthy();
  });

  it('shows tool definitions and raw payloads', () => {
    const { getByText } = render(() => <RequestMessages recording={recording} />);

    fireEvent.click(getByText('Tools'));
    expect(getByText('weather')).toBeTruthy();
    expect(getByText('Read the forecast')).toBeTruthy();

    fireEvent.click(getByText('Raw'));
    expect(getByText('Request')).toBeTruthy();
    expect(getByText('Response')).toBeTruthy();
  });

  it('renders message metadata and tool-call details safely', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const detailedRecording = {
      ...recording,
      request_body: {
        messages: [
          { role: 'developer', name: 'planner' },
          {},
          {
            role: 'assistant',
            tool_calls: [{ id: 'call-1', function: { arguments: circular } }],
          },
          { role: 'tool', tool_call_id: 'call-1', content: 'Tool complete' },
        ],
        tools: [{ type: 'custom' }, {}],
      },
      response_body: null,
    };

    const { getByText, getAllByText } = render(() => (
      <RequestMessages recording={detailedRecording} />
    ));

    expect(getByText('developer')).toBeTruthy();
    expect(getByText('unknown')).toBeTruthy();
    expect(getByText('planner')).toBeTruthy();
    expect(getByText('Unknown tool')).toBeTruthy();
    expect(getAllByText('call-1')).toHaveLength(2);
    expect(getByText('[object Object]')).toBeTruthy();
    expect(getByText('Tool complete')).toBeTruthy();

    fireEvent.click(getByText('Tools'));
    expect(getAllByText('custom')).toHaveLength(2);
    expect(getAllByText('function')).toHaveLength(2);
  });

  it('explains empty conversations and tool lists', () => {
    const emptyRecording = {
      ...recording,
      request_body: {},
      response_body: null,
    };
    const { getByText } = render(() => <RequestMessages recording={emptyRecording} />);

    expect(getByText('No conversation turns found.')).toBeTruthy();
    fireEvent.click(getByText('Tools'));
    expect(getByText('No tools were defined.')).toBeTruthy();
  });

  it('explains when recording was disabled', () => {
    const { getByText } = render(() => <RequestMessages recording={null} />);
    expect(getByText('No messages recorded')).toBeTruthy();
  });
});
