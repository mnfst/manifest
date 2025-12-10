import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { CreateEditComponent } from './views/create-edit/create-edit.component'
import { DetailComponent } from './views/detail/detail.component'
import { ListComponent } from './views/list/list.component'
import { IsCollectionGuard } from './guards/is-collection.guard'

export const crudCollectionRoutes: Routes = [
  {
    path: ':entitySlug',
    component: ListComponent,
    canActivate: [IsCollectionGuard]
  },
  {
    path: ':entitySlug/create',
    component: CreateEditComponent,
    canActivate: [IsCollectionGuard],
    data: {
      edit: false
    }
  },
  {
    path: ':entitySlug/:id',
    component: DetailComponent,
    canActivate: [IsCollectionGuard]
  },
  {
    path: ':entitySlug/:id/edit',
    component: CreateEditComponent,
    canActivate: [IsCollectionGuard],
    data: {
      edit: true
    }
  }
]

@NgModule({
  imports: [RouterModule.forChild(crudCollectionRoutes)],
  exports: [RouterModule]
})
export class CrudCollectionRoutingModule {}
