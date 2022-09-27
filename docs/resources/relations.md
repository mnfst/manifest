# Relations

Resources are connected with relationships, and CASE provides a workflow to create and manage those relations.

## Create a relationship between 2 entities

CASE uses TypeORM to manage the database structure, we strongly recommend to read [TypeORM Relations documentation](https://typeorm.io/#/relations) first.

Let's take the following example : We have customers that belong to corporate groups. Each **Customer** belongs exclusively to one **CorporateGroup** and a **CorporateGroup** can have several **Customer** :

```js
// customer.entity.ts (server)
@Entity({ name: 'customers' })
export class Customer {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @ManyToOne(() => CorporateGroup, (corporateGroup) => corporateGroup.customers)
  corporateGroup: CorporateGroup
}
```

```js
// corporate-group.entity.ts (server)
@Entity({ name: 'corporateGroups' })
export class CorporateGroup {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @OneToMany(() => Customer, (customer) => customer.corporateGroup)
  customers: Customer[]
}
```

## Filter by relation

Following our example, we want to filter the list of customers by corporate group.

In other words, we want to add a "customer group" select [filter](list/filters.md) on top the customer [list view](list/list.md). That select will allow users to choose exclusively a **CustomerGroup** to refine the list.

First we will create a filter in `customer-list.component.ts` that will pass the `corporateGroupId` query parameter in our GET HTTP request.

```js
// customer-list.component.ts (client)
  filters: Filter[] = [
    {
      label: 'Corporate groups',
      property: 'customerGroupId',
      inputType: InputType.Select,
      selectOptions: () =>
        this.customResourceService.listSelectOptions('corporate-groups')
    }
  ]

  // Add customResourceService to use it in filters.
  constructor(
    [...],
    private customResourceService: ResourceService
  ) {}
```

> [!TIP]
> Notice the `listSelectOptions('corporate-groups')` function ?
>
> It will generate an HTTP request to fetch resources from the server in the listSelectOptions endpoint in the `customer.controller.ts`. This function returns a list of **CorporateGroup** simple objects (label and id only) to populate the select dropdown options.
>
> All authenticated users can see that list, even those without the `browseCorporateGroups` permission.

To make that filtering effective, we have to listen to that query param in the controller (server) and select only the corresponding customers. We add the corresponding `@Query()` decorator for a new `corporateGroupId` optional param.

```js
  // customer.controller.ts (server)
  @Get()
  @Permission('browseCustomers')
  async index(
    @Query('page') page?: string,
    @Query('orderBy') orderBy?: string,
    @Query('orderByDesc') orderByDesc?: string,
    @Query('withoutPagination') withoutPagination?: string,
    @Query('corporateGroupId') corporateGroupId?: string
  ): Promise<Paginator<Customer> | Customer[]> {
    return this.customerService.index({
      page,
      orderBy,
      orderByDesc,
      withoutPagination,
      corporateGroupId
    })
  }
```

```js
// customer.service.ts (server)
  async index({
    page,
    orderBy,
    orderByDesc,
    withoutPagination,
    corporateGroupId
  }: {
    page?: string
    orderBy?: string
    orderByDesc?: string
    withoutPagination?: string
    corporateGroupId?: string
  }): Promise<Paginator<Customer> | Customer[]> {
    const query = this.repository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.corporateGroup', 'corporateGroup')

    // Get only customers where the corporate group has the same id as the query param.
    if (corporateGroupId) {
      query.andWhere('corporateGroup.id = :corporateGroupId', {
        corporateGroupId
      })
    }
    ...
```

> [!NOTE]
> CASE uses **NestJS** for the server side Typescript NodeJS app. Read more about controllers on [NestJS Controllers doc](https://docs.nestjs.com/controllers)

## Display relation values in yields

To display a property of a relation of the items you are querying, you first need to tell TypeORM to fetch the relationship data.

We do it by using the `leftJoinAndSelect()` method of TypeORM.

```js
// customer.service.ts (client)
Promise<Paginator<Customer> | Customer[]> {
    const query = this.repository
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.corporateGroup', 'corporateGroup')
```

Then in the yield you can access to the properties of that relation:

```js
// customer.yields.ts (client)
  {
    label: 'Corporate Group Name',
    property: 'corporateGroup.name'
  },
  {
    label: 'Corporate Group Id',
    property: 'corporateGroup.id'
  },
```

It works the same way for relations with several levels:

```js
// customer.service.ts (server)
const query = this.repository
  .createQueryBuilder('leaf')
  .leftJoinAndSelect('leaf.tree', 'tree')
  .leftJoinAndSelect('tree.forest', 'forest')
```

```js
// customer.yields.ts (client)
  {
    label: 'Tree',
    property: 'tree.name'
  },
    {
    label: 'Forest',
    property: 'tree.forest.name'
  },
```

## Store and update resource relations

Our app needs to allow users to create a new **Customer** and attach it to an existing **CorporateGroup**.

Let's start to add a [create-edit field](create-edit/field-types.md) for the **Customer** as each customer needs to have one corporate group.

```js
// customer-create-edit.component.ts (client)
  fields: Field[] = [
    {
      label: 'Name',
      property: 'name',
      required: true,
      inputType: InputType.Text,
    },
    {
      label: 'Corporate group',
      property: 'corporateGroupId'
      retrievedItemProperties: {
        corporateGroupId: 'corporateGroup.id',
      },
      required: true,
      inputType: InputType.Select,
      selectOptions: () =>
        this.customResourceService.listSelectOptions('corporate-groups'),
    },
  ]
```

The property `retrievedItemProperties` indicated to the client where to look for to get the initial value on "edit" mode whereas the `property` property gives the name of the property in which the value will be sent to the server.

Once we have that, we can move to the server.

We are now expecting a `corporateGroupId` in the create/update HTTP request body, let's add it to the DTO (Data Transfer Object). A 400 error will be returned if that property is empty.

```js
// create-update-customer.dto.ts (server)
import { IsNotEmpty, IsString } from 'class-validator'

export class CreateUpdateCustomerDto {
  @IsNotEmpty()
  @IsString()
  readonly name: string

  @IsNotEmpty()
  readonly corporateGroupId: number | string
}
```

To finish, we need to go to the `customer.service.ts` and update the `store()` and `update()` methods adding the corporate group to the customer. Make sur that you get the TypeORM entity manager with `getManager()`

```js
  // customer.service.ts (server)
  private entityManager: EntityManager = getManager()

  [...]

  async store(customerDto: CreateUpdateCustomerDto): Promise<Customer> {
    const customer: Customer = this.repository.create(customerDto)

    customer.corporateGroup = await this.entityManager.findOneOrFail(
      CorporateGroup,
      customerDto.corporateGroupId
    )

    return this.repository.save(customer)
  }

  async update(
    id: string,
    customerDto: CreateUpdateCustomerDto
  ): Promise<UpdateResult> {
    const customer: Customer = this.repository.create(customerDto)

    customer.corporateGroup = await this.entityManager.findOneOrFail(
      CorporateGroup,
      customerDto.corporateGroupId
    )

    return this.repository.update(id, customer)
  }
```

> [!TIP]
> The process of seeding for relationships is explained in the [database seeder page](resources/database-seeder#seeding-relationships).
