import { join } from 'path'
import { User } from './core-entities/user.entity'

export default () => {
  // Contribution mode is used when running the app from the "server" folder with "npm run start:dev" script.
  const contributionMode: boolean = process.argv[2] === 'contribution'

  const appRoot: string = contributionMode
    ? process.cwd() + '/src/_contribution-root'
    : join(__dirname, '../../../../../../..')

  const distRoot: string = contributionMode
    ? join(__dirname, '../../../dist')
    : join(__dirname, '../dist')

  console.log('appRoot', appRoot)

  return {
    port: parseInt(process.env.PORT, 10) || 3000,
    appRoot,
    distRoot,
    publicFolder: `${appRoot}/public`,
    clientAppFolder: `${distRoot}/client`,
    storageFolder: `${appRoot}/public/storage`,
    database: {
      type: 'sqlite',
      database: `${appRoot}/db/case.sqlite`,
      entities: [
        // `${appRoot}/entities/*.entity.ts`,
        User
      ],
      synchronize: true
    }
  }
}
