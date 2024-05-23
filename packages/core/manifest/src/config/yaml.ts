export default (): { yaml: { filePath: string } } => {
  return {
    yaml: {
      filePath: `${process.cwd()}/manifest/backend.yml`
    }
  }
}
