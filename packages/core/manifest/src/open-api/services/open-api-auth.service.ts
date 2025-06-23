import { AppManifest, EntityManifest, PolicyManifest } from '@repo/types'
import { Injectable } from '@nestjs/common'
import {
  PathItemObject,
  SecuritySchemeObject
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { ADMIN_ENTITY_MANIFEST } from '../../constants'

@Injectable()
export class OpenApiAuthService {
  /**
   * Generates the paths for the OpenAPI spec: Login, signup ang get current user for authenticable entities.
   *
   * @param appManifest The manifest of the application.
   *
   * @returns The paths.
   *
   */
  generateAuthPaths(appManifest: AppManifest): Record<string, PathItemObject> {
    const paths: Record<string, PathItemObject> = {}

    // Authenticable entities and admins.
    const authenticableEntities: EntityManifest[] = Object.values(
      appManifest.entities as Record<string, EntityManifest>
    )
      .filter((entity: EntityManifest) => entity.authenticable)
      .concat(ADMIN_ENTITY_MANIFEST)

    const successfulAuthResponse = {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            token: {
              type: 'string'
            }
          }
        },
        example: {
          token: '12345'
        }
      }
    }

    authenticableEntities.forEach((entity: EntityManifest) => {
      // Login.
      paths[`/auth/${entity.slug}/login`] = {
        post: {
          summary: `Login as a ${entity.nameSingular}`,
          description: `Logs in as a ${entity.nameSingular}.`,
          tags: ['Auth'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: {
                      type: 'string'
                    },
                    password: {
                      type: 'string'
                    }
                  },
                  required: ['email', 'password']
                },
                example: {
                  email: 'example@manifest.build',
                  password: 'password'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Successful login',
              content: successfulAuthResponse
            },
            '401': {
              description: 'Invalid credentials',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      statusCode: {
                        type: 'number'
                      },
                      message: {
                        type: 'string'
                      }
                    }
                  },
                  example: {
                    message: 'Invalid email or password',
                    statusCode: 401
                  }
                }
              }
            },
            '400': {
              description: 'Bad request',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      statusCode: {
                        type: 'number'
                      },
                      message: {
                        type: 'array',
                        items: {
                          type: 'string'
                        }
                      },
                      error: {
                        type: 'string'
                      }
                    }
                  },
                  example: {
                    message: ['password should not be empty'],
                    statusCode: 400,
                    error: 'Bad Request'
                  }
                }
              }
            }
          }
        }
      }

      // Get current user.
      paths[`/auth/${entity.slug}/me`] = {
        get: {
          summary: `Get current ${entity.nameSingular}`,
          description: `Get current ${entity.nameSingular}.`,
          tags: ['Auth'],
          security: [
            {
              [entity.className]: []
            }
          ],
          responses: {
            '200': {
              description: 'Successful request',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: {
                        type: 'number'
                      },
                      email: {
                        type: 'string'
                      }
                    }
                  },
                  example: {
                    id: 1,
                    email: 'user@example.com'
                  }
                }
              }
            },
            '403': {
              description: 'Forbidden',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      statusCode: {
                        type: 'number'
                      },
                      message: {
                        type: 'string'
                      },
                      error: {
                        type: 'string'
                      }
                    }
                  },
                  example: {
                    message: 'Forbidden resource',
                    error: 'Forbidden',
                    statusCode: 403
                  }
                }
              }
            }
          }
        }
      }

      // Signup (if available).
      if (
        entity.policies.signup.every(
          (policy: PolicyManifest) => policy.access === 'public'
        )
      ) {
        paths[`/auth/${entity.slug}/signup`] = {
          post: {
            summary: `Signup as ${entity.nameSingular}`,
            description: `Signs up as ${entity.nameSingular}.`,
            tags: ['Auth'],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      email: {
                        type: 'string'
                      },
                      password: {
                        type: 'string'
                      }
                    },
                    required: ['email', 'password']
                  },
                  example: {
                    email: 'user@example.com',
                    password: 'password'
                  }
                }
              }
            },
            responses: {
              '200': {
                description: 'Successful signup',
                content: successfulAuthResponse
              },
              '400': {
                description: 'Bad request',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        statusCode: {
                          type: 'number'
                        },
                        message: {
                          type: 'array',
                          items: {
                            type: 'string'
                          }
                        },
                        error: {
                          type: 'string'
                        }
                      }
                    },
                    example: {
                      message: ['password should not be empty'],
                      statusCode: 400,
                      error: 'Bad Request'
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    return paths
  }

  /**
   * Generates the security schemes for the OpenAPI spec: Admin auth and authenticable entities auth.
   *
   * @param appManifest The manifest of the application.
   * @returns The security schemes.
   *
   */
  getSecuritySchemes(
    appManifest: AppManifest
  ): Record<string, SecuritySchemeObject> {
    const securitySchemes: Record<string, SecuritySchemeObject> = {}

    // Admin auth.
    securitySchemes['Admin'] = {
      type: 'http',
      scheme: 'bearer',
      name: 'Admin auth',
      bearerFormat: 'JWT',
      description:
        'Authentication for Admin entity. Use POST /auth/admins/login to get a token.'
    }

    // Authenticable entities auth.
    const authenticableEntities: EntityManifest[] = Object.values(
      appManifest.entities
    ).filter((entity: any) => entity.authenticable)

    authenticableEntities.forEach((entity: EntityManifest) => {
      securitySchemes[`${entity.className}`] = {
        type: 'http',
        scheme: 'bearer',
        name: `${entity.className} auth`,
        bearerFormat: 'JWT',
        description: `Authentication for ${entity.nameSingular} entity. Use POST /auth/${entity.slug}/login to get a token.`
      }
    })

    return securitySchemes
  }
}
