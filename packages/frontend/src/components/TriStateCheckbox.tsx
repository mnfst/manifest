import { createEffect, type Component } from 'solid-js';

export type TriState = 'all' | 'some' | 'none';

interface TriStateCheckboxProps {
  state: TriState;
  onToggle: () => void;
  label: string;
}

/**
 * Native checkbox with the `indeterminate` flag driven by props, so the
 * "some of the selected agents carry this" dash renders as the browser draws
 * it rather than as a custom glyph.
 */
const TriStateCheckbox: Component<TriStateCheckboxProps> = (props) => {
  let ref: HTMLInputElement | undefined;
  createEffect(() => {
    if (ref) ref.indeterminate = props.state === 'some';
  });
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={props.state === 'all'}
      aria-checked={props.state === 'some' ? 'mixed' : props.state === 'all'}
      aria-label={props.label}
      onChange={() => props.onToggle()}
    />
  );
};

export default TriStateCheckbox;
