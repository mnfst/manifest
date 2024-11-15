
/**
 * Generates the forbidden response object.
 *
 * @returns The forbidden response object.
 */

export function getForbiddenResponse() {
    return {
        description: 'Forbidden',
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string'
                        },
                        error: {
                            type: 'string'
                        },
                        statusCode: {
                            type: 'number'
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