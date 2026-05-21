import { createSignal, For, Show, type JSX } from 'solid-js';
import type { MessageRow, MessageColumnKey } from './message-table-types.js';
import MessageDetails from './MessageDetails.jsx';
import { columnHeader, renderCell } from './message-table-cells.jsx';

export interface MessageTableProps {
  items: MessageRow[];
  columns: MessageColumnKey[];
  agentName: string;
  customProviderName: (model: string) => string | undefined;
  onFallbackErrorClick?: (model: string) => void;
  onFeedbackLike?: (id: string) => void;
  onFeedbackDislike?: (id: string) => void;
  onFeedbackClear?: (id: string) => void;
  onOpenRecording?: (id: string) => void;
  rowIdPrefix?: string;
  showHeaderTooltips?: boolean;
  expandable?: boolean;
}

function ChevronIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function EyeIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ExpandableRow(props: {
  item: MessageRow;
  columns: MessageColumnKey[];
  tableProps: MessageTableProps;
  rowId?: string;
}): JSX.Element {
  const [expanded, setExpanded] = createSignal(false);
  const colSpan = () => props.columns.length + 1;
  const ctx = {
    agentName: props.tableProps.agentName,
    customProviderName: props.tableProps.customProviderName,
    onFallbackErrorClick: props.tableProps.onFallbackErrorClick,
    onFeedbackLike: props.tableProps.onFeedbackLike,
    onFeedbackDislike: props.tableProps.onFeedbackDislike,
    onFeedbackClear: props.tableProps.onFeedbackClear,
    onOpenRecording: props.tableProps.onOpenRecording,
  };

  const isRecorded = () => props.item.recorded && !!props.tableProps.onOpenRecording;

  const handleRowClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, [role="button"]')) return;
    if (isRecorded()) {
      props.tableProps.onOpenRecording!(props.item.id);
    } else {
      setExpanded(!expanded());
    }
  };

  return (
    <>
      <tr
        id={props.rowId}
        class={`msg-row--clickable${expanded() ? ' msg-row--expanded' : ''}`}
        onClick={handleRowClick}
      >
        <For each={props.columns}>{(col) => renderCell(col, props.item, ctx)}</For>
        <td class="msg-detail__chevron-cell">
          <Show
            when={isRecorded()}
            fallback={
              <button
                class={`msg-detail__chevron-btn${expanded() ? ' msg-detail__chevron-btn--open' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded());
                }}
                aria-expanded={expanded()}
                aria-label={expanded() ? 'Collapse details' : 'Expand details'}
                title={expanded() ? 'Collapse details' : 'Expand details'}
              >
                <ChevronIcon />
              </button>
            }
          >
            <span class="msg-detail__eye-btn" title="View log details">
              <EyeIcon />
            </span>
          </Show>
        </td>
      </tr>
      <Show when={expanded() && !isRecorded()}>
        <tr class="msg-detail__row">
          <td colspan={colSpan()} class="msg-detail__cell">
            <MessageDetails messageId={props.item.id} />
          </td>
        </tr>
      </Show>
    </>
  );
}

function PlainRow(props: {
  item: MessageRow;
  columns: MessageColumnKey[];
  tableProps: MessageTableProps;
  rowId?: string;
}): JSX.Element {
  const ctx = {
    agentName: props.tableProps.agentName,
    customProviderName: props.tableProps.customProviderName,
    onFallbackErrorClick: props.tableProps.onFallbackErrorClick,
    onFeedbackLike: props.tableProps.onFeedbackLike,
    onFeedbackDislike: props.tableProps.onFeedbackDislike,
    onFeedbackClear: props.tableProps.onFeedbackClear,
    onOpenRecording: props.tableProps.onOpenRecording,
  };
  return (
    <tr id={props.rowId}>
      <For each={props.columns}>{(col) => renderCell(col, props.item, ctx)}</For>
    </tr>
  );
}

export default function MessageTable(props: MessageTableProps): JSX.Element {
  return (
    <table class="data-table">
      <thead>
        <tr>
          <For each={props.columns}>
            {(col) => <th>{columnHeader(col, props.showHeaderTooltips)}</th>}
          </For>
          <Show when={props.expandable}>
            <th class="msg-detail__chevron-th" />
          </Show>
        </tr>
      </thead>
      <tbody>
        <For each={props.items}>
          {(item) =>
            props.expandable ? (
              <ExpandableRow
                item={item}
                columns={props.columns}
                tableProps={props}
                rowId={props.rowIdPrefix ? `${props.rowIdPrefix}${item.id}` : undefined}
              />
            ) : (
              <PlainRow
                item={item}
                columns={props.columns}
                tableProps={props}
                rowId={props.rowIdPrefix ? `${props.rowIdPrefix}${item.id}` : undefined}
              />
            )
          }
        </For>
      </tbody>
    </table>
  );
}
