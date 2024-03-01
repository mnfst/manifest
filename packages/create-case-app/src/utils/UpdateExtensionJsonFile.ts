export const updateExtensionJsonFile = ({
  fileContent,
  newExtensions
}: {
  fileContent: {
    recommendations: string[]
  }
  newExtensions: string[]
}): string => {
  fileContent.recommendations.forEach((recommendation) => {
    if (!fileContent.recommendations.includes(recommendation)) {
      fileContent.recommendations.push(recommendation)
    }
  })

  return JSON.stringify(fileContent, null, 2)
}
