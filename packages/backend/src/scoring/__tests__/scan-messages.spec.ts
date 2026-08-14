import { ScorerMessage, ScorerTool } from '../types';

// Reset the module-level trie cache between tests
beforeEach(() => {
  jest.resetModules();
});

function loadScanMessages() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../scan-messages') as {
    scanMessages: typeof import('../scan-messages').scanMessages;
  };
}

describe('scanMessages', () => {
  it('returns null for empty messages array', () => {
    const { scanMessages } = loadScanMessages();
    expect(scanMessages([])).toBeNull();
  });

  it('returns null for null-ish messages', () => {
    const { scanMessages } = loadScanMessages();
    expect(scanMessages(null as unknown as ScorerMessage[])).toBeNull();
  });

  it('returns null when messages contain no user text', () => {
    const { scanMessages } = loadScanMessages();
    const messages: ScorerMessage[] = [
      { role: 'system', content: 'You are helpful' },
      { role: 'assistant', content: 'Hello!' },
    ];
    expect(scanMessages(messages)).toBeNull();
  });

  it('returns null for non-coding conversational text', () => {
    const { scanMessages } = loadScanMessages();
    const messages: ScorerMessage[] = [
      { role: 'user', content: 'Good morning, how are you today?' },
    ];
    // Casual greeting has no keyword matches above the threshold
    expect(scanMessages(messages)).toBeNull();
  });

  it('detects coding category for code-related messages', () => {
    const { scanMessages } = loadScanMessages();
    const messages: ScorerMessage[] = [
      {
        role: 'user',
        content:
          'Write a function to implement a REST api endpoint. ' +
          'Also write tests and refactor the controller to use middleware.',
      },
    ];
    const result = scanMessages(messages);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('coding');
    expect(result!.confidence).toBeGreaterThan(0);
  });

  it('detects web_browsing with header override', () => {
    const { scanMessages } = loadScanMessages();
    const messages: ScorerMessage[] = [{ role: 'user', content: 'Hello world' }];
    const result = scanMessages(messages, undefined, 'web_browsing');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('web_browsing');
    expect(result!.confidence).toBe(1.0);
  });

  it('passes tools through to detectSpecificity', () => {
    const { scanMessages } = loadScanMessages();
    const messages: ScorerMessage[] = [
      { role: 'user', content: 'Open the browser and navigate to the page' },
    ];
    const tools: ScorerTool[] = [{ name: 'browser_navigate' }, { name: 'browser_click' }];
    const result = scanMessages(messages, tools);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('web_browsing');
  });

  it('reuses the cached trie on subsequent calls', () => {
    const { scanMessages } = loadScanMessages();
    const messages: ScorerMessage[] = [
      {
        role: 'user',
        content: 'Write a function to implement a component and build a module for the api',
      },
    ];
    const result1 = scanMessages(messages);
    const result2 = scanMessages(messages);
    // Both calls produce identical results because the trie is cached
    expect(result1).toEqual(result2);
  });

  it('returns null when user content is empty string', () => {
    const { scanMessages } = loadScanMessages();
    const messages: ScorerMessage[] = [{ role: 'user', content: '' }];
    expect(scanMessages(messages)).toBeNull();
  });

  it('returns null when the last extracted user text is empty (defensive guard)', () => {
    // The production extractor filters empty texts, so this defensive branch
    // is only reachable by simulating a future extractor regression.
    jest.doMock('../text-extractor', () => ({
      extractUserTexts: () => [
        { text: 'filler', positionWeight: 0.5, messageIndex: 0 },
        { text: '', positionWeight: 1.0, messageIndex: 1 },
      ],
      countConversationMessages: () => 0,
      combinedText: () => '',
    }));
    const { scanMessages } = loadScanMessages();
    const messages: ScorerMessage[] = [{ role: 'user', content: 'anything' }];
    expect(scanMessages(messages)).toBeNull();
    jest.dontMock('../text-extractor');
  });
});
