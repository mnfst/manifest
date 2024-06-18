import { EntityManifest } from '@mnfst/types'

describe('Manifest (e2e)', () => {
  it('GET /manifest', async () => {
    const response = await global.request.get('/manifest')

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
    const response = await global.request.get('/manifest/entities/dogs')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject<Partial<EntityManifest>>({
      properties: expect.any(Array)
    })

    if (response.body.belongsTo !== undefined) {
      expect(response.body.belongsTo).toEqual(expect.any(Array))
    }
  })
})
