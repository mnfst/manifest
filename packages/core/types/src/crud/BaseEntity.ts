/**
 * Base entity interface.
 * All entities should implement this interface.
 *
 * @property id The entity's unique identifier.
 * @property createdAt The date and time the entity was created.
 * @property updatedAt The date and time the entity was last updated.
 *
 * */
export interface BaseEntity {
  /**
   * The entity's unique identifier (UUID).
   */
  id: string

  /**
   * The date and time the entity was created (automatic).
   */
  createdAt: Date

  /**
   * The date and time the entity was last updated (automatic).
   */
  updatedAt: Date

  /**
   * Any other properties.
   */
  [key: string]: unknown
}
