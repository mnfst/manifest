# Entity file

The Entity file is generated when you create a new resource and it's corresponding to a new DB table.

### Technologies

CASE uses [TypeORM entities](https://typeorm.io/#/entities) as it is one of the best TypeScript ORM on the market which allow you to interact with the database with Typescript.

CASE also uses MySQL so you are free to create any of the [column types allowed for MySQL](https://typeorm.io/#/entities/column-types-for-mysql--mariadb)

### Example of an entity file :

```js
@Entity({ name: 'customers' })
export class Customer {
  // Search related fields.
  public static searchableFields: string[] = ['name']
  public static displayName: string = 'name'

  @PrimaryGeneratedColumn()
  id: number

  @Column({ nullable: true })
  name: string

 @Column()
  address: string

// Relations.
  @ManyToOne(
    type => CorporateGroup,
    corporateGroup => corporateGroup.customers
  )
  corporateGroup: CorporateGroup

  @OneToMany(
    type => Referent,
    referent => referent.customer
  )
  referents: Referent[]

  // Auto-fill.
  @CreateDateColumn({ select: false })
  createdAt: Date

  @UpdateDateColumn({ select: false })
  updatedAt: Date

// Properties value generated after load.
  @AfterLoad()
  recipient?: string

  public async afterLoad() {
    this.recipient = this.name ? this.name + ',' + this.address : this.address
  }
}
```
