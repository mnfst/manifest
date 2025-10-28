export type Rule =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'signup'
  | 'dynamic-endpoint' // This is a special rule that applies for custom endpoints.
