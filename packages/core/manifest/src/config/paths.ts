export default (): { paths: { admin: string; database: string } } => {
  return {
    paths: {
      admin: `${process.cwd()}/node_modules/@mnfst/admin/dist`,
      database: `${process.cwd()}/manifest/backend.yml`
    }
  }
}
