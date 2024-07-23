import { AppManifest, EntityManifest } from '@mnfst/types'
import { Injectable } from '@nestjs/common'
import {
  PathItemObject,
  SecuritySchemeObject
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'

@Injectable()
export class OpenApiAuthService {
  generateAuthPaths(appManifest: any): Record<string, PathItemObject> {
    const paths: Record<string, PathItemObject> = {
      // Login.
      ['/api/auth/admins/login']: {
        post: {
          summary: 'Login as an admin',
          description: 'Logs in as an admin.',
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
                  email: 'admin@manifest.build',
                  password: 'admin'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Successful login',
              content: {
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
      },

      // Get current user.
      ['/api/auth/admins/me']: {
        get: {
          summary: 'Get current admin',
          description: 'Get the current admin.',
          tags: ['Auth'],
          security: [
            {
              admin: []
            }
          ],
          responses: {}
        }
      }
    }

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
    securitySchemes['Admin auth'] = {
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
      securitySchemes[`${entity.className} auth`] = {
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
