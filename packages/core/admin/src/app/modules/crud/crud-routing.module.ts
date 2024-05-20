import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { CreateEditComponent } from './views/create-edit/create-edit.component'
import { DetailComponent } from './views/detail/detail.component'
import { ListComponent } from './views/list/list.component'

export const crudRoutes: Routes = [
  {
    path: ':entitySlug',
    component: ListComponent
  },
  {
    path: ':entitySlug/create',
    component: CreateEditComponent,
    data: {
      edit: false
    }
  },
  {
    path: ':entitySlug/:id',
    component: DetailComponent
  },
  {
    path: ':entitySlug/:id/edit',
    component: CreateEditComponent,
    data: {
      edit: true
    }
  }
]

@NgModule({
  imports: [RouterModule.forChild(crudRoutes)],
  exports: [RouterModule]
})
export class CrudRoutingModule {}
