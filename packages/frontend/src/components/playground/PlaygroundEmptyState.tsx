import type { Component } from 'solid-js';
import NoConnectionsPrompt from '../NoConnectionsPrompt.jsx';

interface Props {
  onConnect: () => void;
}

const PlaygroundEmptyState: Component<Props> = () => <NoConnectionsPrompt />;

export default PlaygroundEmptyState;
