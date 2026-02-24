export interface TrieMatch {
  keyword: string;
  dimension: string;
  position: number;
}

interface TrieNode {
  children: Map<string, TrieNode>;
  terminals: Array<{ keyword: string; dimension: string }>;
}

function createNode(): TrieNode {
  return { children: new Map(), terminals: [] };
}

/** Matches [0-9A-Za-z_] — used for word-boundary detection. */
export function isWordCharCode(code: number): boolean {
  return (
    (code >= 48 && code <= 57) ||   // 0-9
    (code >= 65 && code <= 90) ||   // A-Z
    (code >= 97 && code <= 122) ||  // a-z
    code === 95                     // _
  );
}

function isWordChar(c: string): boolean {
  return isWordCharCode(c.charCodeAt(0));
}

export class KeywordTrie {
  private root: TrieNode = createNode();
  private keywordCount = 0;

  constructor(
    dimensions: Array<{ name: string; keywords: string[] }>,
  ) {
    for (const dim of dimensions) {
      for (const keyword of dim.keywords) {
        this.insert(keyword.toLowerCase(), keyword.toLowerCase(), dim.name);
      }
    }
  }

  private insert(
    chars: string,
    keyword: string,
    dimension: string,
  ): void {
    let node = this.root;
    for (const ch of chars) {
      let child = node.children.get(ch);
      if (!child) {
        child = createNode();
        node.children.set(ch, child);
      }
      node = child;
    }
    node.terminals.push({ keyword, dimension });
    this.keywordCount++;
  }

  /** Max characters to scan. Inputs beyond this are truncated for scoring. */
  private static readonly MAX_SCAN_LENGTH = 100_000;

  scan(text: string): TrieMatch[] {
    const matches: TrieMatch[] = [];
    const lower = text.toLowerCase();
    const len = Math.min(lower.length, KeywordTrie.MAX_SCAN_LENGTH);

    for (let i = 0; i < len; i++) {
      if (i > 0 && isWordChar(lower[i - 1])) continue;

      let node = this.root;
      for (let j = i; j < len; j++) {
        const child = node.children.get(lower[j]);
        if (!child) break;
        node = child;

        if (node.terminals.length > 0) {
          const afterIdx = j + 1;
          if (afterIdx < len && isWordChar(lower[afterIdx])) continue;

          for (const terminal of node.terminals) {
            matches.push({
              keyword: terminal.keyword,
              dimension: terminal.dimension,
              position: i,
            });
          }
        }
      }
    }

    return matches;
  }

  get size(): number {
    return this.keywordCount;
  }
}
