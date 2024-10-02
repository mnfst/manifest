import { base64ToBlob } from '@repo/helpers'

// TODO: We should mock the file system to avoid writing to the disk.
describe('Upload (e2e)', () => {
  beforeEach(() => {})

  describe('Upload file', () => {
    const file = new Blob(['Hello, this is a test file!'], {
      type: 'text/plain'
    })

    it('should upload a file', async () => {
      // Convert the Blob into a Buffer
      const arrayBuffer = await file.arrayBuffer()
      const fileBuffer = Buffer.from(arrayBuffer)

      const response = await global.request
        .post('/upload/file')
        .field('entity', 'companies')
        .field('property', 'document')
        .attach('file', fileBuffer, 'test-file.txt')

      expect(response.status).toBe(201)
      expect(response.body.path).toContain('companies/document')
    })
  })

  describe('Upload image', () => {
    const base64Image =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAwAB/eb7jLwAAAAASUVORK5CYII='
    const image: Blob = base64ToBlob(base64Image, 'image/png')

    it('should upload an image and resize it to the specified sizes', async () => {
      const arrayBuffer = await image.arrayBuffer()
      const imageBuffer = Buffer.from(arrayBuffer)

      const response = await global.request
        .post('/upload/image')
        .field('entity', 'companies')
        .field('property', 'logo')
        .attach('image', imageBuffer, 'test-image.png')

      expect(response.status).toBe(201)
      expect(Object.keys(response.body)).toEqual(['small', 'medium', 'large'])
    })
  })
})
