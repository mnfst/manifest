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
  id: number
  createdAt: Date
  updatedAt: Date
}
