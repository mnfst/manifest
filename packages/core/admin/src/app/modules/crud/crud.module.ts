import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { FilterComponent } from '../shared/filters/filter.component'
import { InputComponent } from '../shared/inputs/input.component'
import { YieldComponent } from '../shared/yields/yield.component'
import { CrudRoutingModule } from './crud-routing.module'
import { ListMetaComponent } from './partials/list-meta/list-meta.component'
import { PaginationComponent } from './partials/pagination/pagination.component'
import { CreateEditComponent } from './views/create-edit/create-edit.component'
import { DetailComponent } from './views/detail/detail.component'
import { ListComponent } from './views/list/list.component'

@NgModule({
  declarations: [
    CreateEditComponent,
    DetailComponent,
    ListComponent,
    ListMetaComponent,
    PaginationComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CrudRoutingModule,
    FilterComponent,
    YieldComponent,
    InputComponent
  ]
})
export class CrudModule {}
