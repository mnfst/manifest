export interface PatchActionConfig {
  path: string
  successMessage: string
  errorMessage: string
  formData?: FormData

  // Redirect after successful patch.
  redirectTo?: string
  redirectToQueryParams?: { [key: string]: string }
}
