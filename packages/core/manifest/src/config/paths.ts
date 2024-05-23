export default (): { paths: { admin: string } } => {
  return {
    paths: {
      admin: `${process.cwd()}/node_modules/@mnfst/admin/dist`
    }
  }
}
