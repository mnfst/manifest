import fetchMock from 'fetch-mock'
import Manifest from '../src/Manifest'

describe('Upload', () => {
  const baseUrl: string = 'http://localhost:1111/api'

  beforeEach(() => {
    fetchMock.restore()
  })

  it('should upload a file', async () => {
    const file = new Blob(['Hello, this is a test file!'], {
      type: 'text/plain',
    })

    // TODO: Ensure that the FormData object is in the correct format.
    fetchMock.mock({
      url: `${baseUrl}/upload/file`,
      method: 'POST',
      response: {
        status: 200,
        body: true,
      },
    })

    const manifest = new Manifest()
    const response = await manifest.from('cats').upload('certificate', file)

    expect(response).toEqual(true)
  })

  it('should upload an image', async () => {
    const base64Image =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAwAB/eb7jLwAAAAASUVORK5CYII='
    const image: Blob = base64ToBlob(base64Image, 'image/png')

    // TODO: Ensure that the FormData object is in the correct format.
    fetchMock.mock({
      url: `${baseUrl}/upload/image`,
      method: 'POST',
      response: {
        status: 200,
        body: true,
      },
    })

    const manifest = new Manifest()
    const response = await manifest.from('cats').uploadImage('avatar', image)

    expect(response).toEqual(true)
  })
})

// Helper function to convert base64 to Blob
function base64ToBlob(base64: string, contentType: string): Blob {
  const byteCharacters = atob(base64)
  const byteArrays: Uint8Array[] = []

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512)
    const byteNumbers = new Array(slice.length)

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    byteArrays.push(byteArray)
  }

  return new Blob(byteArrays, { type: contentType })
}
