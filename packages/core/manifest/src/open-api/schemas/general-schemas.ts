import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'

export const generalSchemas: Record<string, SchemaObject> = {
  Paginator: {
    type: 'object',
    description:
      'A paginated response object, containing an array of data and pagination information.',
    properties: {
      data: {
        type: 'array',
        items: {
          type: 'object'
        }
      },
      currentPage: {
        type: 'integer',
        example: 1
      },
      lastPage: {
        type: 'integer',
        example: 20
      },
      from: {
        type: 'integer',
        example: 1
      },
      to: {
        type: 'integer',
        example: 10
      },
      total: {
        type: 'integer',
        example: 200
      },
      perPage: {
        type: 'integer',
        example: 10
      }
    },
    required: [
      'data',
      'currentPage',
      'lastPage',
      'from',
      'to',
      'total',
      'perPage'
    ]
  },
  SelectOption: {
    type: 'object',
    description:
      'A small object representing a selectable option. Useful for dropdowns in admin panels.',
    properties: {
      id: {
        type: 'number'
      },
      label: {
        type: 'string'
      }
    },
    required: ['id', 'label']
  },
  AppManifest: {
    type: 'object',
    description:
      'The manifest of the application, containing metadata and entities. Gives an overview of the application structure.',
    properties: {
      name: {
        type: 'string'
      },
      entities: {
        type: 'object',
        additionalProperties: {
          $ref: '#/components/schemas/EntityManifest'
        }
      }
    }
  },
  EntityManifest: {
    type: 'object',
    description:
      'The manifest of an entity, containing its properties and relationships. Provides a detailed structure of the entity.',
    properties: {
      className: {
        type: 'string'
      },
      nameSingular: {
        type: 'string'
      },
      namePlural: {
        type: 'string'
      },
      slug: {
        type: 'string'
      },
      mainProp: {
        type: 'string'
      },
      seedCount: {
        type: 'number'
      },
      belongsTo: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/RelationshipManifest'
        }
      },
      properties: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/PropertyManifest'
        }
      }
    },
    required: [
      'className',
      'nameSingular',
      'namePlural',
      'slug',
      'mainProp',
      'seedCount'
    ]
  },
  RelationshipManifest: {
    type: 'object',
    description:
      'The manifest of a relationship between entities, describing how they are connected.',
    properties: {
      name: {
        type: 'string'
      },
      entity: {
        type: 'string'
      },
      eager: {
        type: 'boolean'
      }
    },
    required: ['name', 'entity']
  },
  PropertyManifest: {
    type: 'object',
    description:
      'The manifest of a property of an entity, describing its type and characteristics.',
    properties: {
      name: {
        type: 'string'
      },
      type: {
        type: 'string'
      }
    },
    required: ['name', 'type']
  }
}
