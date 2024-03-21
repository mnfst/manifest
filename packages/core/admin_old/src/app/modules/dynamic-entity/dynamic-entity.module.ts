import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'

import { FilterComponent } from '../shared/elements/filters/filter.component'
import { InputComponent } from '../shared/elements/inputs/input.component'
import { YieldComponent } from '../shared/elements/yields/yield.component'
import { DynamicEntityCreateEditComponent } from './components/dynamic-entity-create-edit/dynamic-entity-create-edit.component'
import { DynamicEntityDetailComponent } from './components/dynamic-entity-detail/dynamic-entity-detail.component'
import { DynamicEntityListComponent } from './components/dynamic-entity-list/dynamic-entity-list.component'
import { DynamicEntityRoutingModule } from './dynamic-entity-routing.module'
import { ListMetaComponent } from './partials/list-meta/list-meta.component'
import { PaginationComponent } from './partials/pagination/pagination.component'

@NgModule({
  declarations: [
    DynamicEntityCreateEditComponent,
    DynamicEntityDetailComponent,
    DynamicEntityListComponent,
    PaginationComponent,
    ListMetaComponent
  ],
  imports: [
    CommonModule,
    DynamicEntityRoutingModule,
    ReactiveFormsModule,
    FilterComponent,
    YieldComponent,
    InputComponent
  ]
})
export class DynamicEntityModule {}
