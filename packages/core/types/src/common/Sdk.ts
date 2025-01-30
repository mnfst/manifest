import { Paginator } from '../crud'

// This SDK interface ensures that all SDKs have the same methods.
export interface SDK {
  from(slug: string): this

  // Core CRUD Operations.
  findOneById<T>(id: number): Promise<T>
  find<T>(paginationParams?: {
    page?: number
    perPage?: number
  }): Promise<Paginator<T>>
  create<T>(itemDto: unknown): Promise<T>
  update<T>(id: number, itemDto: unknown): Promise<T>
  patch<T>(id: number, itemDto: unknown): Promise<T>
  delete(id: number): Promise<number>

  single(slug: string): {
    get: <T>() => Promise<T>
    update: <T>(data: unknown) => Promise<T>
  }

  // Query Modifiers.
  where(whereClause: string): this
  andWhere(whereClause: string): this
  orderBy(propName: string, order?: { desc: boolean }): this
  with(relations: string[]): this

  // File Uploads
  upload(property: string, file: Blob): Promise<boolean>
  uploadImage(property: string, image: Blob): Promise<{ [key: string]: string }>
}
