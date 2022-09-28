export interface CaseConfig {
  baseUrl: string
  apiBaseUrl: string
  storagePath: string
  appName: string
  tokenName: string
  tokenAllowedDomains: string[]
  googlePlacesAPIKey?: string
  flashMessageTimeout?: number
  production?: boolean
  enablePersistentFilters?: boolean
}
