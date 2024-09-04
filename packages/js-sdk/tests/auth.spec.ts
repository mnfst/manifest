import fetchMock from 'fetch-mock'
import Manifest from '../src/Manifest'

describe('Auth', () => {
  const baseUrl: string = 'http://localhost:1111/api/auth'

  const credentials = {
    email: 'admin@manifest.build',
    password: 'admin',
  }
  const token: string = '12345'

  beforeEach(() => {
    fetchMock.restore()
  })

  it('should login', async () => {
    fetchMock.mock(
      {
        url: `${baseUrl}/users/login`,
        method: 'POST',
        body: credentials,
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        token: token,
      }
    )

    const manifest = new Manifest()
    const response = await manifest.login(
      'users',
      credentials.email,
      credentials.password
    )

    expect(response).toEqual(true)
  })

  it('should add token to headers after login', async () => {
    fetchMock.mock(
      {
        url: `${baseUrl}/users/login`,
        method: 'POST',
        body: credentials,
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        token: token,
      }
    )

    const manifest = new Manifest()
    await manifest.login('users', credentials.email, credentials.password)

    expect(manifest['headers']['Authorization']).toEqual(`Bearer ${token}`)
  })

  it('should logout', async () => {
    const manifest = new Manifest()
    manifest['headers']['Authorization'] = `Bearer ${token}`

    await manifest.logout()

    expect(manifest['headers']['Authorization']).toBeUndefined()
  })

  it('should sign up', async () => {
    fetchMock.mock(
      {
        url: `${baseUrl}/users/signup`,
        method: 'POST',
        body: credentials,
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        token: token,
      }
    )

    const manifest = new Manifest()
    const response = await manifest.signup(
      'users',
      credentials.email,
      credentials.password
    )

    expect(response).toEqual(true)
    expect(manifest['headers']['Authorization']).toEqual(`Bearer ${token}`)
  })

  it('should return the current user', async () => {
    fetchMock.mock(
      {
        url: `${baseUrl}/users/me`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        email: credentials.email,
      }
    )

    const manifest = new Manifest()
    manifest['headers']['Authorization'] = `Bearer ${token}`
    const response = await manifest.from('users').me()

    expect(response).toEqual({ email: credentials.email })
  })
})
