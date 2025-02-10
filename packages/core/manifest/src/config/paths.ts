import path from 'path'

export default (): {
  paths: {
    adminPanelFolder: string
    publicFolder: string
    manifestFile: string
    handlersFolder: string
  }
} => {
  return {
    paths: {
      adminPanelFolder:
        process.env.NODE_ENV === 'contribution'
          ? path.join(process.cwd(), '..', 'admin', 'dist')
          : `${process.cwd()}/node_modules/manifest/dist/admin`,
      publicFolder: process.env.PUBLIC_FOLDER || `${process.cwd()}/public`,
      manifestFile:
        process.env.MANIFEST_FILE_PATH ||
        `${process.cwd()}/manifest/backend.yml`,
      handlersFolder:
        process.env.MANIFEST_HANDLERS_FOLDER ||
        path.join(process.cwd(), 'manifest', 'handlers')
    }
  }
}
