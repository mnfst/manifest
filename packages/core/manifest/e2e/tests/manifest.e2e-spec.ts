import { EntityManifest } from '@mnfst/types'
import { DEFAULT_ADMIN_CREDENTIALS } from '../../src/constants'

describe('Manifest (e2e)', () => {
  let adminToken: string

  beforeAll(async () => {
    adminToken = (
      await global.request
        .post('/auth/admins/login')
        .send(DEFAULT_ADMIN_CREDENTIALS)
    ).body['token']
  })

  it('GET /manifest', async () => {
    const response = await global.request
      .get('/manifest')
      .set('Authorization', 'Bearer ' + adminToken)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      name: expect.any(String),
      entities: expect.any(Object)
    })

    expect(Object.keys(response.body.entities).length).toBeGreaterThan(0)

    Object.values(response.body.entities).forEach((entity: EntityManifest) => {
      expect(entity).toMatchObject<Partial<EntityManifest>>({
        properties: expect.any(Array)
      })

      if (entity.belongsTo !== undefined) {
        expect(entity.belongsTo).toEqual(expect.any(Array))
      }
    })
  })

  it('GET /manifest/entities/:slug', async () => {
    const response = await global.request
      .get('/manifest/entities/dogs')
      .set('Authorization', 'Bearer ' + adminToken)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject<Partial<EntityManifest>>({
      properties: expect.any(Array)
    })

    if (response.body.belongsTo !== undefined) {
      expect(response.body.belongsTo).toEqual(expect.any(Array))
    }
  })
})
