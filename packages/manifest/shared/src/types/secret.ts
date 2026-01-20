/**
 * App Secret types for the secrets vault feature
 */

/**
 * A secret key-value pair associated with an app
 */
export interface AppSecret {
  id: string;
  appId: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a new secret
 */
export interface CreateSecretRequest {
  key: string;
  value: string;
}

/**
 * Request to update an existing secret
 */
export interface UpdateSecretRequest {
  key?: string;
  value?: string;
}

/**
 * Response containing a list of secrets
 */
export interface SecretListResponse {
  secrets: AppSecret[];
}
