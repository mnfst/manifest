import Manifest from '../src/Manifest'

describe('Manifest', () => {
  it('should create a new instance of the client with default values', () => {
    const manifest = new Manifest()

    expect(manifest.baseUrl).toBe('http://localhost:1111/api')
  })

  it('should create a new instance of the client with custom values', () => {
    const customPort = 2222

    const manifest = new Manifest(`http://localhost:${customPort}`)

    expect(manifest.baseUrl).toBe(`http://localhost:${customPort}/api`)
  })

  it('should set the slug of the entity to query', () => {
    const manifest = new Manifest()

    expect(manifest.from('cats')).toBe(manifest)
    expect(manifest['slug']).toBe('cats')
  })
})
