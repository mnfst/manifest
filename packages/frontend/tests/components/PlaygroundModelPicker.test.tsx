import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

interface CapturedProps {
  tierId: string;
  models: unknown[];
  customProviders?: unknown[];
  connectedProviders?: unknown[];
  onSelect: (tierId: string, model: string, provider: string, authType?: string) => void;
  onClose: () => void;
}
let captured: CapturedProps | undefined;

vi.mock('../../src/components/ModelPickerModal.jsx', () => ({
  default: (props: CapturedProps) => {
    captured = props;
    return (
      <div
        data-models={props.models.length}
        data-custom={props.customProviders?.length ?? -1}
        data-connected={props.connectedProviders?.length ?? -1}
      >
        <button
          data-testid="pick"
          onClick={() => props.onSelect(props.tierId, 'gpt-4o', 'openai', 'api_key')}
        >
          pick
        </button>
        <button data-testid="close" onClick={() => props.onClose()}>
          close
        </button>
      </div>
    );
  },
}));

import PlaygroundModelPicker from '../../src/components/playground/PlaygroundModelPicker';

describe('PlaygroundModelPicker', () => {
  beforeEach(() => {
    captured = undefined;
  });

  it('namespaces the tierId per column and adapts onSelect back to the column id', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const { getByTestId } = render(() => (
      <PlaygroundModelPicker
        columnId="col-1"
        models={[{ model_name: 'gpt-4o' } as never]}
        customProviders={[{ id: 'c1' } as never]}
        connectedProviders={[{ id: 'p1' } as never]}
        onSelect={onSelect}
        onClose={onClose}
      />
    ));

    expect(captured?.tierId).toBe('playground:col-1');
    expect(captured?.models).toHaveLength(1);
    expect(captured?.customProviders).toHaveLength(1);
    expect(captured?.connectedProviders).toHaveLength(1);

    fireEvent.click(getByTestId('pick'));
    expect(onSelect).toHaveBeenCalledWith('col-1', 'gpt-4o', 'openai', 'api_key');

    fireEvent.click(getByTestId('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
