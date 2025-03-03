import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions'
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions'
import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions'

export default (): {
  database: {
    sqlite: SqliteConnectionOptions
    postgres: PostgresConnectionOptions
    mysql: MysqlConnectionOptions
  }
} => {
  return {
    database: {
      sqlite: {
        type: 'sqlite',
        database: process.env.DB_PATH || `${process.cwd()}/manifest/backend.db`,
        dropSchema: process.env.DB_DROP_SCHEMA === 'true' || false,
        synchronize: true
      },
      postgres: {
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'manifest',
        dropSchema: process.env.DB_DROP_SCHEMA === 'true' || false,
        ssl:
          process.env.DB_SSL === 'true'
            ? {
                rejectUnauthorized: false,
                requestCert: true
              }
            : false,
        synchronize: true
      },
      mysql: {
        type: 'mysql',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        username: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_DATABASE || 'manifest',
        dropSchema: process.env.DB_DROP_SCHEMA === 'true' || false,
        ssl:
          process.env.DB_SSL === 'true'
            ? {
                rejectUnauthorized: false,
                requestCert: true
              }
            : false,
        synchronize: true
      }
    }
  }
}
