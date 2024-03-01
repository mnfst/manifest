export const updateSettingsJsonFile = ({
  fileContent,
  newSettings
}: {
  fileContent: Record<string, unknown>
  newSettings: Record<string, unknown>
}): string => {
  return JSON.stringify(
    {
      ...fileContent,
      ...newSettings
    },
    null,
    2
  )
}
