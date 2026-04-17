import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';

hljs.registerLanguage('python', python);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('yaml', yaml);

export function highlight(code: string, language: string): string {
  if (!hljs.getLanguage(language)) return escapeHtml(code);
  return hljs.highlight(code, { language }).value;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
