import path from 'path'

export default (): {
  paths: {
    adminPanelFolder: string
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
      manifestFile:
        process.env.MANIFEST_FILE_PATH ||
        `${process.cwd()}/manifest/backend.yml`,
      handlersFolder:
        process.env.MANIFEST_HANDLERS_FOLDER ||
        path.join(process.cwd(), 'manifest', 'handlers')
    }
  }
}
