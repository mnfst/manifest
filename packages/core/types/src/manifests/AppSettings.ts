export interface AppSettings {
  /**
   * The rate limits for the app.
   */
  rateLimits?: {
    /**
     * The name of the rate limit.
     */
    name?: string

    /**
     * The limit of requests.
     */
    limit: number

    /**
     * The duration (TTL) in milliseconds for the rate limit.
     */
    ttl: number
  }[]
}
