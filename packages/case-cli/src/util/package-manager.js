import ConfigStore from 'configstore'
import reporter from '../reporter'

let config

const packageMangerConfigKey = `cli.packageManager`

export const getPackageManager = () => {
  if (!config) {
    config = new ConfigStore(`case`, {}, { globalConfigPath: true })
  }

  return config.get(packageMangerConfigKey)
}

export const setPackageManager = (packageManager) => {
  if (!config) {
    config = new ConfigStore(`case`, {}, { globalConfigPath: true })
  }
  config.set(packageMangerConfigKey, packageManager)
  reporter.info(`Preferred package manager set to "${packageManager}"`)
}
