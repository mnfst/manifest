import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { agentPath } from '../../services/routing.js';

interface Props {
  agentName: string;
}

const BenchmarkEmptyState: Component<Props> = (props) => (
  <div class="benchmark-empty">
    <h2 class="benchmark-empty__title">Connect a provider to start benchmarking</h2>
    <p class="benchmark-empty__body">
      Benchmark compares responses from multiple models side by side. Connect at least one provider
      on the Routing page and we'll pick a pair for you.
    </p>
    <A class="benchmark-empty__cta" href={agentPath(props.agentName, '/routing')}>
      Go to Routing
    </A>
  </div>
);

export default BenchmarkEmptyState;
