/**
 * Updates the package.json file with new packages and scripts.
 *
 * @param {Object} params - The parameters for updating the package.json file.
 * @param {JSON} params.fileContent - The current content of the package.json file.
 * @param {Record<string, string>} params.newPackages - An object where the keys are the names of the new packages and the values are the versions.
 * @param {Record<string, string>} params.newScripts - An object where the keys are the names of the new scripts and the values are the script commands.
 *
 * @returns {string} The updated content of the package.json file.
 */
export const updatePackageJsonFile = ({
  fileContent,
  newPackages,
  newScripts
}: {
  fileContent: {
    scripts: Record<string, string>
    dependencies: Record<string, string>
  }
  newPackages: Record<string, string>
  newScripts: Record<string, string>
}): string => {
  fileContent.scripts = {
    ...fileContent.scripts,
    ...newScripts
  }
  fileContent.dependencies = {
    ...fileContent.dependencies,
    ...newPackages
  }
  return JSON.stringify(fileContent, null, 2)
}
