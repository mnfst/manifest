import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  forwardRef
} from '@nestjs/common'
import {
  EntityManifest,
  EntitySchema,
  CrudEventName,
  HookManifest,
  HooksSchema,
  PropType,
  PropertySchema,
  RelationshipSchema,
  EntityManifestCommonFields,
  crudEventNames,
  MiddlewaresSchema,
  MiddlewareManifest,
  GroupSchema,
  PropertyManifest
} from '@repo/types'
import pluralize from 'pluralize'
import slugify from 'slugify'
import dasherize from 'dasherize'
import { RelationshipManifestService } from './relationship-manifest.service'
import {
  ADMIN_ACCESS_POLICY,
  AUTHENTICABLE_PROPS,
  DEFAULT_SEED_COUNT,
  FORBIDDEN_ACCESS_POLICY,
  PUBLIC_ACCESS_POLICY
} from '../../constants'

import { ManifestService } from './manifest.service'
import { HookService } from '../../hook/hook.service'
import { PolicyService } from '../../policy/policy.service'
import { PropertyManifestService } from './property-manifest.service'
import { camelize } from '../../../../common/src'

@Injectable()
export class EntityManifestService {
  constructor(
    private relationshipManifestService: RelationshipManifestService,
    @Inject(forwardRef(() => ManifestService))
    private manifestService: ManifestService,
    private propertyManifestService: PropertyManifestService,
    private hookService: HookService,
    private policyService: PolicyService
  ) {}

  /**
   * Load the entities from the manifest and fill in the defaults.
   *
   * @param options The options to load the entities.
   *
   * @returns The entity manifests.
   *
   * */
  getEntityManifests(options?: { fullVersion?: boolean }): EntityManifest[] {
    const entities: EntityManifest[] = Object.values(
      this.manifestService.getAppManifest({ fullVersion: true }).entities
    )

    if (!options?.fullVersion) {
      return entities.map((entity) =>
        this.hideEntitySensitiveInformation(entity)
      )
    }

    return entities
  }

  /**
   * Load a single entity from the manifest and fill in the defaults.
   *
   * @param className The class name of the entity to load.
   * @param slug The slug of the entity to load.
   * @param fullVersion Whether to return the full version of the entity manifest or not.
   * @param includeNested Whether to include nested entities in the manifest. Defaults to false as nested entities cannot be accessed directly.
   *
   * @returns The entity manifest.
   *
   * */
  getEntityManifest({
    className,
    slug,
    fullVersion,
    includeNested = false
  }: {
    className?: string
    slug?: string
    fullVersion?: boolean
    includeNested?: boolean
  }): EntityManifest {
    if (!className && !slug) {
      throw new HttpException(
        `Either className or slug must be provided`,
        HttpStatus.BAD_REQUEST
      )
    }

    const entities: EntityManifest[] = this.getEntityManifests({ fullVersion })

    let entityManifest: EntityManifest

    if (className) {
      entityManifest = entities.find((entity) => entity.className === className)
    } else {
      entityManifest = entities.find((entity) => entity.slug === slug)
    }

    if (!entityManifest || (entityManifest.nested && !includeNested)) {
      throw new HttpException(
        `Entity ${className || slug} not found in manifest`,
        HttpStatus.NOT_FOUND
      )
    }

    if (!fullVersion) {
      return this.hideEntitySensitiveInformation(entityManifest)
    }

    return entityManifest
  }

  /**
   *
   * Transform an entityObject into an EntityManifest array ensuring that undefined properties are filled in with defaults
   * and short form properties are transformed into long form.
   *
   * @param an object with entities and groups properties.
   *
   * @returns the entity manifests with defaults filled in and short form properties transformed into long form.
   */
  transformEntityManifests({
    entities,
    groups
  }: {
    entities: { [k: string]: EntitySchema }
    groups?: { [k: string]: GroupSchema }
  }): EntityManifest[] {
    const entityManifests: EntityManifest[] = [
      ...Object.entries(entities || {}),
      ...Object.entries(groups || {})
    ].map(([className, entitySchema]: [string, EntitySchema | GroupSchema]) => {
      // Build the partial entity manifest with common properties of both collection and single entities.
      const partialEntityManifest: EntityManifestCommonFields = {
        className: entitySchema['className'] || className,
        nameSingular: entitySchema['nameSingular']
          ? camelize(entitySchema['nameSingular'])
          : camelize(
              pluralize.singular(entitySchema['className'] || className)
            ),
        slug:
          entitySchema['slug'] ||
          slugify(
            dasherize(
              entitySchema['single']
                ? entitySchema['className'] || className
                : entitySchema['namePlural'] ||
                    pluralize.plural(entitySchema['className'] || className)
            ).toLowerCase()
          ),
        single: entitySchema['single'] || false,
        properties: (entitySchema.properties || [])
          // Filter out the eventual id property as we are adding it manually.
          .filter(
            (propSchema: PropertySchema) =>
              propSchema !== 'id' &&
              (propSchema as { name: string }).name !== 'id'
          )
          .map((propSchema: PropertySchema) =>
            this.propertyManifestService.transformPropertyManifest(
              propSchema,
              entitySchema
            )
          ),
        hooks: this.transformHookObject(entitySchema['hooks']) || {},
        middlewares: entitySchema['middlewares'] || {},
        nested: Object.prototype.hasOwnProperty.call(groups || {}, className)
      }

      if (entitySchema['single']) {
        return this.getSingleEntityManifestProps(
          partialEntityManifest,
          entitySchema
        )
      }

      return this.getCollectionEntityManifestProps(
        partialEntityManifest,
        entitySchema
      )
    })

    // Add nested entities relationships.
    entityManifests
      .filter((entityManifest: EntityManifest) => entityManifest.nested)
      .forEach((nestedEntity: EntityManifest) => {
        nestedEntity.relationships.push(
          ...this.relationshipManifestService.getRelationshipManifestsFromNestedProperties(
            nestedEntity,
            entityManifests.filter((e) => !e.nested)
          )
        )

        // Set seed count to 1 for nested entities that have one-to-one relationships as we only can seed one nested entity per parent entity.
        if (
          nestedEntity.relationships.some(
            (relationship) => relationship.type === 'one-to-one'
          )
        ) {
          nestedEntity.seedCount = 1
        }
      })

    // Generate the OneToMany relationships from the opposite ManyToOne relationships.
    entityManifests.forEach((entityManifest: EntityManifest) => {
      entityManifest.relationships.push(
        ...this.relationshipManifestService.getOppositeOneToManyRelationships(
          entityManifests,
          entityManifest
        )
      )
    })

    // Generate the ManyToMany relationships from the opposite ManyToMany relationships.
    entityManifests.forEach((entityManifest: EntityManifest) => {
      if (entityManifest.single) return

      entityManifest.relationships.push(
        ...this.relationshipManifestService.getOppositeManyToManyRelationships(
          entityManifests,
          entityManifest
        )
      )
    })

    // Generate the OneToOne relationships from the opposite OneToOne relationships.
    entityManifests.forEach((entityManifest: EntityManifest) => {
      entityManifest.relationships.push(
        ...this.relationshipManifestService.getOppositeOneToOneRelationships(
          entityManifests,
          entityManifest
        )
      )
    })

    // Remove "group" properties from the manifest as they have been transformed into relationships.
    entityManifests.forEach((entityManifest: EntityManifest) => {
      entityManifest.properties = entityManifest.properties.filter(
        (prop: PropertyManifest) => prop.type !== PropType.Nested
      )
    })

    return entityManifests
  }

  /**
   * Returns the entity manifest with the collection entity properties.
   *
   * @param partialEntityManifest the partial entity manifest.
   * @param entitySchema the entity schema to which the entity belongs.
   *
   * @returns the complete entity manifest with the collection entity properties.
   *
   */
  private getCollectionEntityManifestProps(
    partialEntityManifest: EntityManifestCommonFields,
    entitySchema: EntitySchema
  ): EntityManifest {
    if (entitySchema.authenticable) {
      partialEntityManifest.properties.push(...AUTHENTICABLE_PROPS)
    }

    return {
      ...partialEntityManifest,
      properties: partialEntityManifest.properties,
      hooks: partialEntityManifest.hooks,
      namePlural: entitySchema.namePlural
        ? camelize(entitySchema.namePlural)
        : camelize(pluralize.plural(partialEntityManifest.className)),
      mainProp:
        entitySchema.mainProp ||
        partialEntityManifest.properties.find(
          (prop) => prop.type === PropType.String
        )?.name ||
        'id',
      seedCount: entitySchema.seedCount || DEFAULT_SEED_COUNT,
      relationships: [
        ...(entitySchema.belongsTo || []).map(
          (relationship: RelationshipSchema) =>
            this.relationshipManifestService.transformRelationship(
              relationship,
              'many-to-one'
            )
        ),
        ...(entitySchema.belongsToMany || []).map(
          (relationship: RelationshipSchema) =>
            this.relationshipManifestService.transformRelationship(
              relationship,
              'many-to-many',
              partialEntityManifest.className
            )
        )
      ],
      authenticable: entitySchema.authenticable || false,
      policies: {
        create: this.policyService.transformPolicies(
          entitySchema.policies?.create,
          ADMIN_ACCESS_POLICY
        ),
        read: this.policyService.transformPolicies(
          entitySchema.policies?.read,
          ADMIN_ACCESS_POLICY
        ),
        update: this.policyService.transformPolicies(
          entitySchema.policies?.update,
          ADMIN_ACCESS_POLICY
        ),
        delete: this.policyService.transformPolicies(
          entitySchema.policies?.delete,
          ADMIN_ACCESS_POLICY
        ),
        signup: entitySchema.authenticable
          ? this.policyService.transformPolicies(
              entitySchema.policies?.signup,
              PUBLIC_ACCESS_POLICY
            )
          : [FORBIDDEN_ACCESS_POLICY]
      }
    }
  }

  /**
   * Returns the entity manifest with the single entity properties.
   *
   * @param partialEntityManifest the partial entity manifest.
   * @param entitySchema the entity schema to which the entity belongs.
   *
   * @returns the complete entity manifest with the single entity properties.
   */
  private getSingleEntityManifestProps(
    partialEntityManifest: EntityManifestCommonFields,
    entitySchema: EntitySchema
  ): EntityManifest {
    return {
      ...partialEntityManifest,
      namePlural: partialEntityManifest.nameSingular,
      authenticable: false,
      mainProp: null,
      properties: partialEntityManifest.properties,
      hooks: partialEntityManifest.hooks,
      seedCount: 1,
      relationships: [],
      policies: {
        create: [FORBIDDEN_ACCESS_POLICY],
        read: this.policyService.transformPolicies(
          entitySchema.policies?.read,
          ADMIN_ACCESS_POLICY
        ),
        update: this.policyService.transformPolicies(
          entitySchema.policies?.update,
          ADMIN_ACCESS_POLICY
        ),
        delete: [FORBIDDEN_ACCESS_POLICY],
        signup: [FORBIDDEN_ACCESS_POLICY]
      }
    }
  }

  /**
   * Transform EntitySchema hook object into an array of HookManifest.
   *
   * @param hookObject
   *
   * @returns an array of hooks
   */
  transformHookObject(
    hooksSchema: HooksSchema
  ): Record<CrudEventName, HookManifest[]> {
    return crudEventNames.reduce(
      (acc, event: CrudEventName) => {
        acc[event] = (hooksSchema?.[event] || []).map((hook) =>
          this.hookService.transformHookSchemaIntoHookManifest(hook, event)
        )
        return acc
      },
      {} as Record<CrudEventName, HookManifest[]>
    )
  }

  /** Transform MiddlewareSchema object into an array of MiddlewareManifest.
   *
   * @param middlewareSchema The middleware schema.
   *
   * @returns an array of middlewares
   *
   */
  transformMiddlewareObject(
    middlewareSchema: MiddlewaresSchema
  ): Record<CrudEventName, MiddlewareManifest[]> {
    return crudEventNames.reduce(
      (acc, event: CrudEventName) => {
        acc[event] = (middlewareSchema?.[event] || []).map((middleware) => ({
          event,
          handler: middleware.handler
        }))
        return acc
      },
      {} as Record<CrudEventName, MiddlewareManifest[]>
    )
  }

  /**
   * Hide entity sensitive information from the manifest to be sent to the client.
   *
   * @param entityManifest The entity manifest.
   *
   * @returns The entity manifest with sensitive information hidden.
   */
  hideEntitySensitiveInformation(
    entityManifest: EntityManifest
  ): EntityManifest {
    return {
      ...entityManifest,
      properties: entityManifest.properties
        .filter((prop) => !prop.hidden)
        .map((prop) => {
          delete prop.hidden
          return prop
        })
    }
  }
}
