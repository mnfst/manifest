import { useLocation } from '@solidjs/router';

export function useAgentName(): () => string | null {
  const location = useLocation();
  return () => {
    const match = location.pathname.match(/^\/agents\/([^/]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  };
}

export function agentPath(agentName: string | null, sub: string): string {
  return agentName ? `/agents/${encodeURIComponent(agentName)}${sub}` : '/';
}

export function userPath(userId: string, sub = ''): string {
  return `/users/${encodeURIComponent(userId)}${sub}`;
}

export function projectPath(projectId: string, sub = ''): string {
  return `/projects/${encodeURIComponent(projectId)}${sub}`;
}
