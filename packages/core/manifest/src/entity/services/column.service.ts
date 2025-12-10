import { Injectable } from '@nestjs/common'
import { DatabaseConnection, PropType } from '../../../../types/src'
import { ColumnType } from 'typeorm'
import { sqlitePropTypeColumnTypes } from '../columns/sqlite-prop-type-column-types'
import { postgresPropTypeColumnTypes } from '../columns/postgres-prop-type-column-types copy'
import { mysqlPropTypeColumnTypes } from '../columns/mysql-prop-type-column-types'

@Injectable()
export class ColumnService {
  /**
   * Get column types for all PropTypes based on the database connection.
   *
   * @param dbConnection The database connection type (mysql, postgres, sqlite).
   *
   * @returns Record<PropType, ColumnType> The columns.
   */
  static getColumnTypes(
    dbConnection: DatabaseConnection
  ): Record<PropType, ColumnType> {
    let columns: Record<PropType, ColumnType>

    switch (dbConnection) {
      case 'sqlite':
        columns = sqlitePropTypeColumnTypes
        break
      case 'postgres':
        columns = postgresPropTypeColumnTypes
        break
      case 'mysql':
        columns = mysqlPropTypeColumnTypes
        break
    }

    return columns
  }

  /**
   * Get column type for a specific PropType based on the database connection.
   *
   * @param dbConnection The database connection type (mysql, postgres, sqlite).
   * @param propType The PropType.
   *
   * @returns ColumnType The column type.
   */
  static getColumnType(
    dbConnection: DatabaseConnection,
    propType: PropType
  ): ColumnType {
    return this.getColumnTypes(dbConnection)[propType]
  }
}
