import { getEntities } from '../yml'

export default () => {
  // TODO: Join the YML section here.

  const entities = getEntities()

  return {
    database: {
      type: 'sqlite',
      database: `${process.cwd()}/manifest/db/case.sqlite`,
      synchronize: true,
      entities: []
    }
  }
}
