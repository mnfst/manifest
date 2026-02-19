import { A, useLocation } from "@solidjs/router";
import { Show, type Component } from "solid-js";
import { useAgentName, agentPath } from "../services/routing.js";

const Sidebar: Component = () => {
  const location = useLocation();
  const getAgentName = useAgentName();

  const path = (sub: string) => agentPath(getAgentName(), sub);

  const isActive = (sub: string) => {
    const p = path(sub);
    if (sub === "") return location.pathname === p;
    return location.pathname.startsWith(p);
  };

  return (
    <nav class="sidebar" aria-label="Agent navigation">
      <Show when={!getAgentName()}>
        <A
          href="/"
          class="sidebar__link"
          classList={{ active: location.pathname === "/" }}
          aria-current={location.pathname === "/" ? "page" : undefined}
        >
          Agents
        </A>
      </Show>

      <Show when={getAgentName()}>
        <div class="sidebar__section-label">MONITORING</div>
        <A
          href={path("")}
          class="sidebar__link"
          classList={{ active: isActive("") }}
          aria-current={isActive("") ? "page" : undefined}
        >
          Overview
        </A>
        <A
          href={path("/messages")}
          class="sidebar__link"
          classList={{ active: isActive("/messages") }}
          aria-current={isActive("/messages") ? "page" : undefined}
        >
          Messages
        </A>

        <div class="sidebar__section-label">MANAGE</div>
        <A href={path("/settings")} class="sidebar__link" classList={{ active: isActive("/settings") }} aria-current={isActive("/settings") ? "page" : undefined}>
          Settings
        </A>
        <A
          href={path("/notifications")}
          class="sidebar__link"
          classList={{ active: isActive("/notifications") }}
          aria-current={isActive("/notifications") ? "page" : undefined}
        >
          Notifications
        </A>
      </Show>

      <Show when={getAgentName()}>
        <div class="sidebar__section-label">RESOURCES</div>
        <A
          href={path("/model-prices")}
          class="sidebar__link"
          classList={{ active: isActive("/model-prices") }}
          aria-current={isActive("/model-prices") ? "page" : undefined}
        >
          Model Prices
        </A>
        <A
          href={path("/help")}
          class="sidebar__link"
          classList={{ active: isActive("/help") }}
          aria-current={isActive("/help") ? "page" : undefined}
        >
          Help
        </A>
      </Show>
    </nav>
  );
};

export default Sidebar;
