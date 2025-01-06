export const getLatestPackageVersion = async (
  packageName: string
): Promise<string> => {
  const response = await fetch(`https://registry.npmjs.org/${packageName}`)
  const data = await response.json()
  return data['dist-tags'].latest
}
