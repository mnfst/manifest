import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FilterComponent } from '../shared/filters/filter.component'
import { YieldComponent } from '../shared/yields/yield.component'
import { CrudRoutingModule } from './crud-routing.module'
import { ListMetaComponent } from './partials/list-meta/list-meta.component'
import { PaginationComponent } from './partials/pagination/pagination.component'
import { ListComponent } from './views/list/list.component'

@NgModule({
  declarations: [
    // CreateEditComponent,
    // DetailComponent,
    ListComponent,
    ListMetaComponent,
    PaginationComponent
  ],
  imports: [CommonModule, CrudRoutingModule, FilterComponent, YieldComponent]
})
export class CrudModule {}
