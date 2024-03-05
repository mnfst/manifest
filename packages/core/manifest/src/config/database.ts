export default () => {
  // TODO: Join the YML section here.

  // const entities = getEntities()

  return {
    database: {
      type: 'sqlite',
      database: `${process.cwd()}/manifest/manifest.db`,
      synchronize: true,
      entities: []
    }
  }
}
