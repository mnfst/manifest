import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { dynamicEntityRoutes } from './dynamic-entity/dynamic-entity.routes'

const routes: Routes = []

@NgModule({
  imports: [RouterModule.forRoot(routes.concat(dynamicEntityRoutes))],
  exports: [RouterModule]
})
export class AppRoutingModule {}
