export const updateSettingsJsonFile = ({
  fileContent,
  settings
}: {
  fileContent: Record<string, unknown>
  settings: Record<string, unknown>
}): string => {
  return JSON.stringify(
    {
      ...fileContent,
      ...settings
    },
    null,
    2
  )
}
