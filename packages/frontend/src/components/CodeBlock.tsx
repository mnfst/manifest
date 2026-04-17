import { createMemo, type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';
import { highlight } from '../services/syntax-highlight.js';

interface Props {
  code: string;
  language: string;
  copyText?: string;
}

const CodeBlock: Component<Props> = (props) => {
  const html = createMemo(() => highlight(props.code, props.language));

  return (
    <div class="setup-method__code">
      <CopyButton text={props.copyText ?? props.code} />
      <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;">
        <code class={`hljs language-${props.language}`} innerHTML={html()} />
      </pre>
    </div>
  );
};

export default CodeBlock;
