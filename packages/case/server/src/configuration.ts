import { join } from 'path'
import { User } from './core-entities/user.entity'

/**
 * Default function to configure the application.
 * @function default
 * @returns The configuration object for the application.
 */
export default () => {
  // Contribution mode is used when running the app from the "server" folder with "npm run start:dev" script.
  const contributionMode: boolean = process.argv[2] === 'contribution'

  const appRoot: string = contributionMode
    ? process.cwd() + '/src/_contribution-root'
    : process.cwd()

  const packageRoot: string = contributionMode
    ? join(__dirname, '../../../dist')
    : join(__dirname, '../..')

  return {
    port: parseInt(process.env.PORT, 10) || 4000,
    appRoot,
    packageRoot,
    publicFolder: `${appRoot}/public`,
    clientAppFolder: `${packageRoot}/client`,
    storageFolder: `${appRoot}/public/storage`,
    database: {
      type: 'sqlite',
      database: `${appRoot}/db/case.sqlite`,
      entities: [
        contributionMode
          ? `${packageRoot}/server/src/_contribution-root/entities/*.entity.js`
          : `${process.cwd()}/dist/entities/*.entity.js`,
        ,
        User
      ],
      synchronize: true
    },
    appConfigFilePath: contributionMode
      ? `${packageRoot}/server/src/_contribution-root/app-config.js`
      : `${appRoot}/dist/app-config.js`
  }
}
