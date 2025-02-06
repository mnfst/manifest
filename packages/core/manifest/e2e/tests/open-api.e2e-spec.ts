describe('Open API (e2e)', () => {
  it('Should generate an UI', async () => {
    const response = await global.request.get('/api')

    expect(response.status).toBe(200)
    expect(response.text).toContain('<html lang="en">')
  })
})
