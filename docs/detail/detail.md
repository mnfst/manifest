# Detail view

- Front-end

A detail view of a resource is a page (or component) dedicated to the display of the detail of a single item, like profile pages or a single post page.

Let's imagine that you created a **Customer** resource beforehand. Create the detail view component with Angular CLI :

```bash
cd client
ng generate component resources/customer/customer-detail
```

Add the route to the customer.route.ts :

```js
  {
    path: 'customers/:id',
    component: customerDetailComponent,
    canActivate: [AuthGuard, PermissionGuard],
    data: {
      permission: 'readCustomers',
    }
  }
```

And then extend the `CaseDetailComponent` and initialize the detail view :

```js
@Component({
  selector: 'app-customer-detail',
  templateUrl: './customer-detail.component.html',
  styleUrls: ['./customer-detail.component.scss']
})
export class CustomerDetailComponent
  extends CaseDetailComponent
  implements OnInit
{
  definition: ResourceDefinition = customerDefinition

  constructor(
    breadcrumbService: BreadcrumbService,
    resourceService: ResourceService,
    flashMessageService: FlashMessageService,
    activatedRoute: ActivatedRoute
  ) {
    super(
      breadcrumbService,
      resourceService,
      flashMessageService,
      activatedRoute
    )
  }

  ngOnInit(): void {
    this.initDetailView()
  }
}
```
