import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { DynamicEntityCreateEditComponent } from './components/dynamic-entity-create-edit/dynamic-entity-create-edit.component'
import { DynamicEntityDetailComponent } from './components/dynamic-entity-detail/dynamic-entity-detail.component'
import { DynamicEntityListComponent } from './components/dynamic-entity-list/dynamic-entity-list.component'

export const dynamicEntityRoutes: Routes = [
  {
    path: ':entitySlug',
    component: DynamicEntityListComponent
  },
  {
    path: ':entitySlug/create',
    component: DynamicEntityCreateEditComponent,
    data: {
      edit: false
    }
  },
  {
    path: ':entitySlug/:id',
    component: DynamicEntityDetailComponent
  },
  {
    path: ':entitySlug/:id/edit',
    component: DynamicEntityCreateEditComponent,
    data: {
      edit: true
    }
  }
]

@NgModule({
  imports: [RouterModule.forChild(dynamicEntityRoutes)],
  exports: [RouterModule]
})
export class DynamicEntityRoutingModule {}
