// The `.hljs` token styles that pair with this highlighter. Co-locating the CSS
// with the service (instead of the global theme) loads it only into the chunks
// that actually render highlighted code (CodeBlock, MarkdownContent, etc.).
import '../styles/syntax-highlight.css';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';
import json from 'highlight.js/lib/languages/json';

// Slim hljs core: only the grammars we actually render. Importing the full
// `highlight.js` bundle pulls ~190 languages (~500 KB). These six cover the
// setup snippets (CodeBlock / HermesSetup / FrameworkSnippets) and the common
// fenced blocks in Playground responses; anything else falls back to escaped
// plain text via `highlight()` below.
hljs.registerLanguage('python', python);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('json', json);

/** True when a grammar is registered for `language` (including hljs aliases). */
export function isSupported(language: string): boolean {
  return !!hljs.getLanguage(language);
}

export function highlight(code: string, language: string): string {
  if (!isSupported(language)) return escapeHtml(code);
  return hljs.highlight(code, { language }).value;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
