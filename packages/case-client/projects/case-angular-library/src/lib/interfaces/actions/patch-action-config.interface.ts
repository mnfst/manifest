export interface PatchActionConfig {
  path: string
  successMessage: string
  errorMessage: string
  body?: any

  // Redirect after successful patch.
  redirectTo?: string
  redirectToQueryParams?: { [key: string]: string }
}
