describe('Open API (e2e)', () => {
  it('GET /api', async () => {
    const response = await global.request.get('/api')

    expect(response.status).toBe(200)
    expect(response.text).toContain('<html lang="en">')
  })
})
