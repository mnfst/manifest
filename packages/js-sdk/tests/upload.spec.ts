import fetchMock from 'fetch-mock'
import Manifest from '../src/Manifest'
import { base64ToBlob } from '@repo/helpers'

describe('Upload', () => {
  const baseUrl: string = 'http://localhost:1111/api'

  beforeEach(() => {
    fetchMock.restore()
  })

  it('should upload a file', async () => {
    const file = new Blob(['Hello, this is a test file!'], {
      type: 'text/plain'
    })

    // TODO: Ensure that the FormData object is in the correct format.
    fetchMock.mock({
      url: `${baseUrl}/upload/file`,
      method: 'POST',
      response: {
        status: 200,
        body: true
      }
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
        body: true
      }
    })

    const manifest = new Manifest()
    const response = await manifest.from('cats').uploadImage('avatar', image)

    expect(response).toEqual(true)
  })
})
