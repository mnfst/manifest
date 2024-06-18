import { Paginator } from '@mnfst/types'

describe('CRUD (e2e)', () => {
  it('GET /dynamic/:entity', async () => {
    const response = await global.request.get('/dynamic/dogs')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject<Paginator<any>>({
      data: expect.any(Array),
      currentPage: expect.any(Number),
      lastPage: expect.any(Number),
      from: expect.any(Number),
      to: expect.any(Number),
      total: expect.any(Number),
      perPage: expect.any(Number)
    })
    // expect(response.body.data.length).toBeGreaterThan(0)
  })

  // TODO: Test individually each CRUD endpoint.
  // TODO: Seed test database.
})
