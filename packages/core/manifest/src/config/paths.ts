export default (): {
  paths: { adminPanelFolder: string; manifestFile: string }
} => {
  return {
    paths: {
      adminPanelFolder: `${process.cwd()}/node_modules/@mnfst/admin/dist`,
      manifestFile: `${process.cwd()}/manifest/backend.yml`
    }
  }
}
