export const updateExtensionJsonFile = ({
  extensions,
  fileContent
}: {
  extensions: string[]
  fileContent: {
    recommendations: string[]
  }
}): string => {
  extensions.forEach((recommendation) => {
    if (!fileContent.recommendations.includes(recommendation)) {
      fileContent.recommendations.push(recommendation)
    }
  })

  return JSON.stringify(fileContent, null, 2)
}
