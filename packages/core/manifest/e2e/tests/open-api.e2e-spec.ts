describe('Open API (e2e)', () => {
  it('Should generate an UI', async () => {
    const response = await global.request.get('/api')

    expect(response.status).toBe(200)
    expect(response.text).toContain('<html lang="en">')
  })

  it('Should generate a doc for each entity', async () => {
    // TODO: Implement.
    return false
  })

  it('Should generate an auth system for admins', async () => {
    // TODO: Implement.
    return false
  })

  it('Should generate an auth system for authenticable entities', async () => {
    // TODO: Implement.
    return false
  })
})
