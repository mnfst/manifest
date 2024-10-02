import path from 'path'

export default (): {
  paths: { adminPanelFolder: string; manifestFile: string }
} => {
  return {
    paths: {
      adminPanelFolder:
        process.env.NODE_ENV === 'contribution'
          ? path.join(process.cwd(), '..', 'admin', 'dist')
          : `${process.cwd()}/node_modules/manifest/dist/admin`,
      manifestFile: `${process.cwd()}/manifest/backend.yml`
    }
  }
}
