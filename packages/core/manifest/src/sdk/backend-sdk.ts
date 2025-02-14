import { Injectable } from '@nestjs/common'
import { CrudService } from '../crud/services/crud.service'
import { BaseEntity, Paginator } from '@repo/types'
import { DEFAULT_RESULTS_PER_PAGE } from '../constants'
import { BaseSDK } from '@repo/common'
import { UploadService } from '../upload/services/upload.service'

/**
 * The BackendSDK class is a service that provides a way to interact with the Manifest backend from the dynamic handlers.
 *
 * It extends the same class as the Frontend JavaScript SDK (https://www.npmjs.com/package/@mnfst/sdk).
 *
 * The BackendSDK does not need to log in or authenticate, as it is used in the backend. It also gets the full version of every entity by default.
 */
@Injectable()
export class BackendSDK extends BaseSDK {
  constructor(
    private crudService: CrudService,
    private uploadService: UploadService
  ) {
    super()
  }

  /**
   * Set the slug of the single entity to query.
   *
   * @param slug The slug of the single entity to query.
   *
   * @returns an object containing the methods to get and update the single entity.
   *
   * @example client.single('about').get()
   * @example client.single('home').update({ title: 'New title' })
   */
  single(slug: string): {
    get: <T>() => Promise<T>
    update: <T>(data: unknown) => Promise<T>
    patch: <T>(data: unknown) => Promise<T>
  } {
    this.slug = slug
    this.isSingleEntity = true
    this.queryParams = {}

    return {
      /**
       * Fetches a single entity by slug.
       *
       * @returns A Promise resolving to the single entity.
       */
      get: async <T>(): Promise<T> => {
        return this.crudService.findOne({
          entitySlug: this.slug,
          id: 1,
          fullVersion: true
        }) as Promise<T>
      },
      /**
       * Updates a single entity by slug doing a full replacement (PUT).
       *
       * @param data The data to update the single entity with.
       * @returns A Promise resolving to the updated single entity.
       */
      update: async <T>(data: unknown): Promise<T> => {
        return this.crudService.update({
          entitySlug: this.slug,
          id: 1,
          itemDto: data as Partial<T>
        }) as Promise<T>
      },

      /**
       * Updates a single entity by slug doing a partial replacement (PATCH).
       *
       * @param data The data to update the single entity with.
       * @returns A Promise resolving to the updated single entity.
       */
      patch: async <T>(data: unknown): Promise<T> => {
        return this.crudService.update({
          entitySlug: this.slug,
          id: 1,
          itemDto: data as Partial<T>,
          partialReplacement: true
        }) as Promise<T>
      }
    }
  }

  /**
   * Get the paginated list of items of the entity.
   *
   * @param paginationParams - Optional pagination parameters.
   *
   * @returns A Promise that resolves a Paginator object containing entities of type T, based on the input.
   */
  async find<T>(paginationParams?: {
    page?: number
    perPage?: number
  }): Promise<Paginator<T>> {
    return this.crudService.findAll({
      entitySlug: this.slug,
      queryParams: {
        ...this.queryParams,
        page: paginationParams?.page.toString() || '1',
        perPage:
          paginationParams?.perPage.toString() ||
          DEFAULT_RESULTS_PER_PAGE.toString()
      }
    }) as Promise<Paginator<T>>
  }

  /**
   * Get an item of the entity.
   *
   * @param id The id of the item to get.
   *
   * @returns The item of the entity.
   * @example client.from('cats').findOne(1);
   *
   **/
  async findOneById<T>(id: number): Promise<T> {
    return this.crudService.findOne({
      entitySlug: this.slug,
      queryParams: this.queryParams,
      id,
      fullVersion: true
    }) as Promise<T>
  }

  /**
   * Create an item of the entity.
   *
   * @param itemDto The DTO of the item to create.
   *
   * @returns The created item.
   */
  async create<T>(itemDto: unknown): Promise<T> {
    return this.crudService.store(
      this.slug,
      itemDto as Partial<BaseEntity>
    ) as Promise<T>
  }

  /**
   * Update an item of the entity doing a full replace. Leaving blank fields and relations will remove them. Use patch for partial updates.
   *
   * @param id The id of the item to update.
   * @param itemDto The DTO of the item to update.
   *
   * @returns The updated item.
   * @example client.from('cats').update(1, { name: 'updated name' });
   */
  async update<T>(id: number, itemDto: unknown): Promise<T> {
    return this.crudService.update({
      entitySlug: this.slug,
      id,
      itemDto: itemDto as Partial<BaseEntity>
    }) as Promise<T>
  }

  /**
   * Partially update an item of the entity. Leaving blank fields and relations will not remove them. Use update for full replaces.
   *
   * @param id The id of the item to update.
   * @param itemDto The DTO of the item to update.
   *
   * @returns The updated item.
   * @example client.from('cats').update(1, { name: 'updated name' });
   */
  async patch<T>(id: number, itemDto: unknown): Promise<T> {
    return this.crudService.update({
      entitySlug: this.slug,
      id,
      itemDto: itemDto as Partial<BaseEntity>,
      partialReplacement: true
    }) as Promise<T>
  }

  /**
   *
   * Delete an item of the entity.
   *
   * @param id The id of the item to delete.
   *
   * @returns The id of the deleted item.
   * @example client.from('cats').delete(1);
   */
  async delete(id: number): Promise<BaseEntity> {
    return this.crudService.delete(this.slug, id)
  }

  /**
   * Upload a file to the entity.
   *
   * @param property The property of the entity to upload the file to.
   * @param file The file to upload.
   *
   * @returns true if the upload was successful.
   */
  upload(
    property: string,
    file: { buffer: Buffer; originalname: string }
  ): Promise<string> {
    return this.uploadService.storeFile({
      file,
      property,
      entity: this.slug
    })
  }

  /**
   * Upload an image to the entity.
   *
   * @param property The property of the entity to upload the image to.
   * @param image The image to upload.
   *
   * @returns an object containing the path of the uploaded image in different sizes.
   * */
  async uploadImage(
    property: string,
    image: { buffer: Buffer; originalname: string }
  ): Promise<{ [key: string]: string }> {
    return this.uploadService.storeImage({
      image,
      entity: this.slug,
      property
    })
  }
}
