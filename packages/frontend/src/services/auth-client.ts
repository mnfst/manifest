import { createAuthClient } from "better-auth/solid";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: "/api/auth",
});
