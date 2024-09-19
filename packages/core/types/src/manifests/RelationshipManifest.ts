/**
 * A relationship between two entities
 */
export type RelationshipManifest = {
  /**
   * The name of the relation
   */
  name: string
  /**
   * The entity that the relationship is with
   */
  entity: string
  /**
   * Whether the relationship should be eager loaded. Otherwise, you need to explicitly request the relation in the client SDK or API.
   * Defaults to false.
   */
  eager?: boolean

  /**
   * The type of the relationship.
   */
  type: 'many-to-one' | 'many-to-many'
}
