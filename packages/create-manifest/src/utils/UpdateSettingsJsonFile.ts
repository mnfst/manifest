export const updateSettingsJsonFile = ({
  fileContent,
  settings
}: {
  fileContent: Record<string, unknown>
  settings: Record<string, unknown>
}): string => {
  Object.keys(settings).forEach((key: string) => {
    fileContent[key] = settings[key]
  })

  return JSON.stringify(fileContent, null, 2)
}
