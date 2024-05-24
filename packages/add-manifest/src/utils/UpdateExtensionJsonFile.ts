export const updateExtensionJsonFile = ({
  extensions,
  fileContent
}: {
  extensions: string[]
  fileContent: {
    recommendations: string[]
  }
}): string => {
  extensions.forEach((extension: string) => {
    if (!fileContent.recommendations.includes(extension)) {
      fileContent.recommendations.push(extension)
    }
  })
  return JSON.stringify(fileContent, null, 2)
}
