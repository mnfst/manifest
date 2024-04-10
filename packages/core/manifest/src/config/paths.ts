import { join } from 'path'

export default (): { paths: { admin: string } } => {
  return {
    paths: {
      admin: join(__dirname, '../../node_modules/@manifest-yml/admin/dist')
    }
  }
}
