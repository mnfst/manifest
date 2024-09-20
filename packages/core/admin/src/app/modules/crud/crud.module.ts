import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { InputComponent } from '../shared/inputs/input.component'
import { RelationYieldComponent } from '../shared/yields/relation-yield/relation-yield.component'
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
    YieldComponent,
    InputComponent,
    RelationYieldComponent
  ]
})
export class CrudModule {}
