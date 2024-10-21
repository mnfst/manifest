import fetchMock from 'fetch-mock'
import Manifest from '../../src/Manifest'

/**
 * Mocks the login request and performs the login action.
 *
 * @param baseUrl
 * @param credentials
 * @param token
 * @returns The manifest instance with the login result.
 */
export async function mockAndPerformLogin(
  baseUrl: string,
  credentials: any,
  token: string
): Promise<Manifest> {
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
  );

  const manifest = new Manifest();
  await manifest.login('users', credentials.email, credentials.password);
  return manifest;
};
