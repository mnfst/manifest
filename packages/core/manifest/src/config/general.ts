import { DEFAULT_PORT, DEFAULT_TOKEN_SECRET_KEY } from '../constants'

export default (): {
  port: number | string
  nodeEnv: string
  tokenSecretKey: string
  baseUrl: string
} => {
  return {
    port: process.env.PORT || DEFAULT_PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    tokenSecretKey: process.env.TOKEN_SECRET_KEY || DEFAULT_TOKEN_SECRET_KEY,
    baseUrl:
      process.env.BASE_URL ||
      `http://localhost:${process.env.PORT || DEFAULT_PORT}`
  }
}
