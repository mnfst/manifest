import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

const { inner } = vi.hoisted(() => ({
  inner: {} as { lastProps?: Record<string, unknown> },
}));

vi.mock('../../src/components/ModelPickerModal.jsx', () => ({
  default: (props: Record<string, unknown>) => {
    inner.lastProps = props;
    return (
      <div data-testid="inner-modal">
        <button
          data-testid="inner-select"
          onClick={() =>
            (props.onSelect as (t: string, m: string, p: string, a: string) => void)(
              props.tierId as string,
              'gpt-4o',
              'openai',
              'api_key',
            )
          }
        >
          select
        </button>
        <button data-testid="inner-close" onClick={() => (props.onClose as () => void)()}>
          close
        </button>
      </div>
    );
  },
}));

import BenchmarkModelPicker from '../../src/components/benchmark/BenchmarkModelPicker';

describe('BenchmarkModelPicker', () => {
  it('synthesizes the tierId from the columnId and forwards it to ModelPickerModal', () => {
    render(() => (
      <BenchmarkModelPicker
        columnId="col-7"
        models={[]}
        onSelect={() => {}}
        onClose={() => {}}
      />
    ));
    expect(inner.lastProps?.tierId).toBe('benchmark:col-7');
  });

  it('unwraps the (tierId, model, provider, authType) callback into (columnId, model, provider, authType)', () => {
    const onSelect = vi.fn();
    const { getByTestId } = render(() => (
      <BenchmarkModelPicker columnId="col-7" models={[]} onSelect={onSelect} onClose={() => {}} />
    ));
    fireEvent.click(getByTestId('inner-select'));
    expect(onSelect).toHaveBeenCalledWith('col-7', 'gpt-4o', 'openai', 'api_key');
  });

  it('propagates the onClose callback', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(() => (
      <BenchmarkModelPicker columnId="col-1" models={[]} onSelect={() => {}} onClose={onClose} />
    ));
    fireEvent.click(getByTestId('inner-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
