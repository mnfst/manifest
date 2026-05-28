import { type Component } from 'solid-js';

/**
 * Agent-level Providers tab: lists all user-level providers with toggles
 * to enable/disable each one for this specific agent.
 */
const AgentProviders: Component = () => {
  return (
    <div>
      <div class="section-empty">
        <p style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground));">
          Coming soon
        </p>
        <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground));">
          Toggle which providers this agent can use. All connected providers are enabled by default.
        </p>
      </div>
    </div>
  );
};

export default AgentProviders;
