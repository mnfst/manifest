import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { CreateEditComponent } from './views/create-edit/create-edit.component'
import { DetailComponent } from './views/detail/detail.component'
import { IsSingleGuard } from './guards/is-single.guard'

export const crudSingleRoutes: Routes = [
  {
    path: ':entitySlug',
    component: DetailComponent,
    canActivate: [IsSingleGuard],
    data: {
      mode: 'single'
    }
  },
  {
    path: ':entitySlug/edit',
    component: CreateEditComponent,
    canActivate: [IsSingleGuard],
    data: {
      edit: true,
      mode: 'single'
    }
  }
]

@NgModule({
  imports: [RouterModule.forChild(crudSingleRoutes)],
  exports: [RouterModule]
})
export class CrudSingleRoutingModule {}
