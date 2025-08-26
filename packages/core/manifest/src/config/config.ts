import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions'
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions'
import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions'
import {
  DEFAULT_PORT,
  DEFAULT_TOKEN_SECRET_KEY,
  GENERATED_FOLDER_PATH
} from '../constants'
import path from 'path'

export default (): {
  port: number | string
  nodeEnv: string
  tokenSecretKey: string
  baseUrl: string
  showOpenApiDocs: boolean
  paths: {
    /**
     * The folder where the admin panel is built.
     */
    adminPanelFolder: string
    /**
     * The folder where the public files are stored.
     * This is used to serve static files like images, css, js, etc.
     */
    publicFolder: string
    /**
     * The path to the manifest file.
     * This is used to load the manifest and generate the types.
     */
    manifestFile: string
    /**
     * The root folder of the project.
     * This is used to resolve relative paths in the project.
     */
    projectRoot: string
    /**
     * The folder where the generated files are stored.
     * This is used for storing the database, openapi spec and types.
     */
    generatedFolder: string
    /**
     * The folder where the manifest handlers are stored.
     * This is used for storing custom handlers functions.
     */
    handlersFolder: string
  }
  database: {
    sqlite: SqliteConnectionOptions
    postgres: PostgresConnectionOptions
    mysql: MysqlConnectionOptions
  }
  storage: {
    s3Bucket: string
    s3Endpoint: string
    s3Region: string
    s3AccessKeyId: string
    s3SecretAccessKey: string
    s3FolderPrefix?: string
    s3ManifestFilePath?: string
  }
} => {
  const projectRoot: string =
    process.env.NODE_ENV === 'contribution'
      ? `${process.cwd()}/manifest`
      : process.env.NODE_ENV === 'test'
        ? `${process.cwd()}/e2e/manifest`
        : process.cwd()
  const generatedFolder: string = path.join(projectRoot, GENERATED_FOLDER_PATH)

  return {
    // General configuration.
    port: process.env.PORT || DEFAULT_PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    tokenSecretKey: process.env.TOKEN_SECRET_KEY || DEFAULT_TOKEN_SECRET_KEY,
    baseUrl:
      process.env.BASE_URL ||
      `http://localhost:${process.env.PORT || DEFAULT_PORT}`,
    showOpenApiDocs:
      process.env.OPEN_API_DOCS === 'true' ||
      process.env.NODE_ENV !== 'production',

    paths: {
      adminPanelFolder:
        process.env.NODE_ENV === 'contribution'
          ? path.join(process.cwd(), '..', 'admin', 'dist')
          : `${process.cwd()}/node_modules/manifest/dist/admin`,
      publicFolder: process.env.PUBLIC_FOLDER || `${projectRoot}/public`,
      projectRoot: projectRoot,
      generatedFolder: generatedFolder,
      manifestFile: process.env.S3_MANIFEST_FILE_PATH
        ? `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${process.env.S3_FOLDER_PREFIX}/${process.env.S3_MANIFEST_FILE_PATH}`
        : `${projectRoot}/manifest.yml`,
      handlersFolder:
        process.env.MANIFEST_HANDLERS_FOLDER ||
        path.join(projectRoot, 'handlers')
    },
    database: {
      sqlite: getSqliteConnectionOptions(generatedFolder),
      postgres: getPostgresConnectionOptions(),
      mysql: getMysqlConnectionOptions()
    },
    storage: {
      s3Bucket: process.env.S3_BUCKET,
      s3Endpoint: process.env.S3_ENDPOINT,
      s3Region: process.env.S3_REGION,
      s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
      s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      s3FolderPrefix: process.env.S3_FOLDER_PREFIX || 'storage',
      s3ManifestFilePath: process.env.S3_MANIFEST_FILE_PATH
    }
  }
}

function getSqliteConnectionOptions(
  generatedFolder: string
): SqliteConnectionOptions {
  return {
    type: 'sqlite',
    database: process.env.DB_PATH || `${generatedFolder}/db.sqlite`,
    dropSchema: process.env.DB_DROP_SCHEMA === 'true' || false,
    synchronize: true
  }
}

function getPostgresConnectionOptions(): PostgresConnectionOptions {
  return {
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
  }
}

function getMysqlConnectionOptions(): MysqlConnectionOptions {
  return {
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
