import { join } from 'path'
import { Admin } from './core-entities/admin.entity'

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
    nodeEnv: process.env.NODE_ENV || 'development',
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
        Admin
      ],
      synchronize: true
    }
  }
}
