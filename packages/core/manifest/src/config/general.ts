import { DEFAULT_PORT } from '../constants'

export default (): { port: number | string; nodeEnv: string } => {
  return {
    port: process.env.PORT || DEFAULT_PORT,
    nodeEnv: process.env.NODE_ENV || 'development'
  }
}
