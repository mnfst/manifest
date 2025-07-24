import { WhereOperator, whereOperatorKeySuffix } from '@repo/types'

/**
 * The base class for all SDKs.
 */
export class BaseSDK {
  /**
   * The slug of the entity to query.
   */
  slug: string = ''

  /**
   * A flag to determine if the entity is a single entity or a collection.
   */
  isSingleEntity: boolean = false

  /**
   * The query parameters of the request.
   */
  queryParams: { [key: string]: string } = {}

  /**
   * Set the slug of the entity to query.
   *
   * @param slug The slug of the entity to query.
   *
   * @returns The current instance of the client.
   * @example client.from('cats').find();
   */
  from(slug: string): this {
    this.slug = slug
    this.isSingleEntity = false
    this.queryParams = {}
    return this
  }

  /**
   *
   * Adds a where clause to the query.
   *
   * @param whereClause The where clause to add.
   *
   * @returns The current instance of the client.
   * @example client.from('cats').where('age = 10').find();
   */
  where(whereClause: string): this {
    // Check if the where clause includes one of the available operators (between spaces). We reverse array as some operators are substrings of others (ex: >= and >).
    const whereOperator: WhereOperator = Object.values(WhereOperator)
      .reverse()
      .find((operator) =>
        whereClause.includes(` ${operator} `)
      ) as WhereOperator

    if (!whereOperator) {
      throw new Error(
        `Invalid where clause. Where clause must include one of the following operators: ${Object.values(
          WhereOperator
        ).join(', ')}.`
      )
    }

    const spacedOperator = ` ${whereOperator} `
    const [propName, propValue] = whereClause
      .split(spacedOperator)
      .map((str) => str.trim())

    const suffix: string = whereOperatorKeySuffix[whereOperator]
    this.queryParams[propName + suffix] = propValue

    return this
  }

  /**
   * Adds a where clause to the query.
   *
   * @param whereClause
   * @returns The current instance of the client.
   * @example client.from('cats').andWhere('age = 10').find();
   */
  andWhere(whereClause: string): this {
    return this.where(whereClause)
  }

  /**
   * Adds an order by clause to the query.
   *
   * @param propName The property name to order by.
   * @param order The order of the property (ASC or DESC). Default ASC
   *
   * @returns The current instance of the client.
   * @example client.from('cats').orderBy('age', { desc: true }).find();
   */
  orderBy(propName: string, order?: { desc: boolean }): this {
    this.queryParams['orderBy'] = propName
    this.queryParams['order'] = order?.desc ? 'DESC' : 'ASC'

    return this
  }

  /**
   * Loads the relations of the entity.
   *
   * @param relations The relations to load.
   *
   * @returns The current instance of the client.
   * @example client.from('cats').with(['owner', 'owner.company']).find();
   */
  with(relations: string[]): this {
    this.queryParams['relations'] = relations.join(',')

    return this
  }
}
