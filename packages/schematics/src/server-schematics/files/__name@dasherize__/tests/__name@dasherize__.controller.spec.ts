import { AuthService, SelectOption } from '@case-app/nest-library'
import { Test, TestingModule } from '@nestjs/testing'
import { UpdateResult } from 'typeorm'

import { CreateUpdate<%= classify(name) %>Dto } from '../dtos/create-update-<%= dasherize(name) %>.dto'
import { <%= classify(name) %>Controller } from '../<%= dasherize(name) %>.controller'
import { <%= classify(name) %> } from '../<%= dasherize(name) %>.entity'
import { <%= classify(name) %>Service } from '../<%= dasherize(name) %>.service'

describe('<%= classify(name) %>Controller', () => {
  let <%= camelize(name) %>Controller: <%= classify(name) %>Controller
  let <%= camelize(name) %>Service: <%= classify(name) %>Service

  const test<%= classify(name) %> = {
    id: 1,
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        <%= classify(name) %>Controller,
        {
          provide: <%= classify(name) %>Service,
          useValue: {
            show: jest.fn(),
            destroy: jest.fn(),
            store: jest.fn(),
            update: jest.fn(),
            index: jest.fn()
          }
        },
        {
          provide: AuthService,
          useValue: {
            show: () => Promise.resolve({})
          }
        }
      ]
    }).compile()
    <%= camelize(name) %>Controller = module.get<<%= classify(name) %>Controller>(<%= classify(name) %>Controller)
    <%= camelize(name) %>Service = module.get<<%= classify(name) %>Service>(<%= classify(name) %>Service)
  })

  describe('<%= classify(name) %>Controller', () => {
    it('should list <%= camelize(name) %>s', async () => {
      expect.assertions(2)
      const result: <%= classify(name) %>[] = [test<%= classify(name) %>] as any[]

      jest.spyOn(<%= camelize(name) %>Service, 'index').mockReturnValue(Promise.resolve(result))

      expect(await <%= camelize(name) %>Controller.index()).toBe(result)
      expect(<%= camelize(name) %>Service.index).toHaveBeenCalled()
    })

    it('should get a list of select options', async () => {
      expect.assertions(3)
      const result: <%= classify(name) %>[] = [test<%= classify(name) %>] as any[]

      jest.spyOn(<%= camelize(name) %>Service, 'index').mockReturnValue(Promise.resolve(result))

      const selectOptions: SelectOption[] =
        await <%= camelize(name) %>Controller.listSelectOptions()

      expect(Array.isArray(selectOptions)).toBe(true)
      expect(selectOptions[0]).toHaveProperty('label')
      expect(selectOptions[0]).toHaveProperty('value')
    })

    it('should show an <%= camelize(name) %>', async () => {
      expect.assertions(2)
      const result: <%= classify(name) %> = test<%= classify(name) %> as <%= classify(name) %>

      jest.spyOn(<%= camelize(name) %>Service, 'show').mockReturnValue(Promise.resolve(result))

      expect(await <%= camelize(name) %>Controller.show(test<%= classify(name) %>.id)).toBe(result)
      expect(<%= camelize(name) %>Service.show).toHaveBeenCalledWith(test<%= classify(name) %>.id)
    })

    it('should store an <%= camelize(name) %>', async () => {
      expect.assertions(2)

      const test<%= classify(name) %>Dto: CreateUpdate<%= classify(name) %>Dto = Object.assign(test<%= classify(name) %>, { roleId: 1 })

      jest
        .spyOn(<%= camelize(name) %>Service, 'store')
        .mockReturnValue(Promise.resolve(test<%= classify(name) %> as any))

      expect(await <%= camelize(name) %>Service.store(test<%= classify(name) %>Dto)).toBe(test<%= classify(name) %>)
      expect(<%= camelize(name) %>Service.store).toHaveBeenCalledWith(test<%= classify(name) %>)
    })

    it('should update an <%= camelize(name) %>', async () => {
      expect.assertions(2)
      const result: UpdateResult = { raw: 'dummy', generatedMaps: [] }

      const test<%= classify(name) %>Dto: CreateUpdate<%= classify(name) %>Dto = Object.assign(test<%= classify(name) %>, { roleId: 1 })

      jest.spyOn(<%= camelize(name) %>Service, 'update').mockReturnValue(Promise.resolve(result))

      expect(await <%= camelize(name) %>Service.update(test<%= classify(name) %>.id, test<%= classify(name) %>Dto)).toBe(result)
      expect(<%= camelize(name) %>Service.update).toHaveBeenCalledWith(test<%= classify(name) %>.id, test<%= classify(name) %>)
    })

    it('should delete an <%= camelize(name) %>', async () => {
      jest.spyOn(<%= camelize(name) %>Service, 'destroy')

      await <%= camelize(name) %>Controller.delete(test<%= classify(name) %>.id)

      expect(<%= camelize(name) %>Service.destroy).toBeCalledWith(test<%= classify(name) %>.id)
    })
  })
})
