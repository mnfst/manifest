import { Routes } from '@angular/router'

import { DynamicEntityCreateEditComponent } from './components/dynamic-entity-create-edit/dynamic-entity-create-edit.component'
import { DynamicEntityDetailComponent } from './components/dynamic-entity-detail/dynamic-entity-detail.component'
import { DynamicEntityListComponent } from './components/dynamic-entity-list/dynamic-entity-list.component'

export const dynamicEntityRoutes: Routes = [
  {
    path: 'dynamic/:entityName',
    component: DynamicEntityListComponent
  },
  {
    path: 'dynamic/:entityName/create',
    component: DynamicEntityCreateEditComponent,
    data: {
      edit: false
    }
  },
  {
    path: 'dynamic/:entityName/:id',
    component: DynamicEntityDetailComponent
  },
  {
    path: 'dynamic/:entityName/:id/edit',
    component: DynamicEntityCreateEditComponent,
    data: {
      edit: true
    }
  }
]
