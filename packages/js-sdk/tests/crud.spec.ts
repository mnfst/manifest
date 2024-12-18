import Manifest from '../src/Manifest'
import fetchMock from 'fetch-mock'

describe('CRUD operations', () => {
  const collectionBaseUrl: string = 'http://localhost:1111/api/collections'
  const singleBaseUrl: string = 'http://localhost:1111/api/singles'
  const dummyResponse = { dummy: 'response' }
  const dummyItem = { name: 'Tom', age: 10, id: 1 }

  beforeEach(() => {
    fetchMock.restore()
  })

  describe('Get items', () => {
    it('should get the paginated list of items of the entity', async () => {
      fetchMock.mock(`${collectionBaseUrl}/cats?page=2`, dummyResponse)

      const manifest = new Manifest()
      const paginator = await manifest.from('cats').find({
        page: 2
      })

      expect(paginator).toMatchObject(dummyResponse)
    })

    it('should allow to change the items per page', async () => {
      fetchMock.mock(`${collectionBaseUrl}/cats?perPage=5`, dummyResponse)

      const manifest = new Manifest()
      const paginator = await manifest.from('cats').find({
        perPage: 5
      })

      expect(paginator).toMatchObject(dummyResponse)
    })

    it('should filter the items by query parameters', async () => {
      fetchMock.mock(
        `${collectionBaseUrl}/cats?name_eq=Tom&name_neq=Jerry&age_gt=50&wealth_gte=1000&problems_lt=5&friends_lte=10&nickName_like=tommy&eyeColor_in=brown%2Cblue%2Cgreen`,
        dummyResponse
      )

      const manifest = new Manifest()
      const paginator = await manifest
        .from('cats')
        .where('name = Tom')
        .where('name != Jerry')
        .andWhere('age > 50')
        .andWhere('wealth >= 1000')
        .andWhere('problems < 5')
        .andWhere('friends <= 10')
        .andWhere('nickName like tommy')
        .andWhere('eyeColor in brown,blue,green')
        .find()

      expect(paginator).toMatchObject(dummyResponse)
    })

    it('should fail if the where operator is not valid', async () => {
      const manifest = new Manifest()

      expect(() => manifest.from('cats').where('name !! Tom')).toThrow()
      expect(() => manifest.from('cats').where('notValid')).toThrow()
    })

    it('should order the items by query parameters', async () => {
      fetchMock.mock(
        `${collectionBaseUrl}/cats?orderBy=name&order=ASC`,
        dummyResponse
      )

      const manifest = new Manifest()
      const paginator = await manifest.from('cats').orderBy('name').find()

      expect(paginator).toMatchObject(dummyResponse)
    })

    it('should order the items by query parameters in descending order', async () => {
      fetchMock.mock(
        `${collectionBaseUrl}/cats?orderBy=name&order=DESC`,
        dummyResponse
      )

      const manifest = new Manifest()
      const paginator = await manifest
        .from('cats')
        .orderBy('name', { desc: true })
        .find()

      expect(paginator).toMatchObject(dummyResponse)
    })

    it('should load the relations of the entity', async () => {
      fetchMock.mock(
        `${collectionBaseUrl}/cats?relations=owner%2Cowner.company`,
        dummyResponse
      )

      const manifest = new Manifest()
      const paginator = await manifest
        .from('cats')
        .with(['owner', 'owner.company'])
        .find()

      expect(paginator).toMatchObject(dummyResponse)
    })

    it('should get an item by its id', async () => {
      const id: number = 1

      fetchMock.mock(`${collectionBaseUrl}/cats/${id}`, dummyResponse)

      const manifest = new Manifest()
      const item = await manifest.from('cats').findOneById(id)

      expect(item).toMatchObject(dummyResponse)
    })
  })

  describe('Manage items', () => {
    it('should create a new item', async () => {
      fetchMock.mock(
        {
          url: `${collectionBaseUrl}/cats`,
          method: 'POST',
          body: {
            name: 'Tom',
            age: 10
          }
        },
        dummyItem
      )

      const manifest = new Manifest()
      const item = await manifest.from('cats').create({
        name: 'Tom',
        age: 10
      })

      expect(item).toMatchObject(dummyItem)
    })

    it('should update an item', async () => {
      const id: number = 1

      fetchMock.mock(
        {
          url: `${collectionBaseUrl}/cats/${id}`,
          method: 'PUT',
          body: {
            name: 'Tom',
            age: 10
          }
        },
        dummyItem
      )

      const manifest = new Manifest()
      const item = await manifest.from('cats').update(id, {
        name: 'Tom',
        age: 10
      })

      expect(item).toMatchObject(dummyItem)
    })

    it('should delete an item', async () => {
      const id: number = 1

      fetchMock.mock(
        {
          url: `${collectionBaseUrl}/cats/${id}`,
          method: 'DELETE'
        },
        {}
      )

      const manifest = new Manifest()
      const deletedId = await manifest.from('cats').delete(id)

      expect(deletedId).toBe(id)
    })
  })

  describe('Single entities', () => {
    it('should get the single entity', async () => {
      fetchMock.mock(
        {
          url: `${singleBaseUrl}/about`,
          method: 'GET'
        },
        dummyItem
      )

      const manifest = new Manifest()
      const single = await manifest.single('about').get()

      expect(single).toMatchObject(dummyItem)
    })

    it('should update the single entity', async () => {
      fetchMock.mock(
        {
          url: `${singleBaseUrl}/about`,
          method: 'PUT',
          body: {
            name: 'Tom',
            age: 10
          }
        },
        dummyItem
      )

      const manifest = new Manifest()
      const single = await manifest.single('about').update({
        name: 'Tom',
        age: 10
      })

      expect(single).toMatchObject(dummyItem)
    })
  })
})
