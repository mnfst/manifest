export default () => {
  return {
    database: {
      type: 'sqlite',
      database: `${process.cwd()}/manifest/db/case.sqlite`,
      synchronize: true
    }
  }
}
