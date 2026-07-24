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

  it('explains when recording was disabled', () => {
    const { getByText } = render(() => <RequestMessages recording={null} />);
    expect(getByText('No messages recorded')).toBeTruthy();
  });
});
