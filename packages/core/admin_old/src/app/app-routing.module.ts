import { NgModule } from '@angular/core'
import { PreloadAllModules, RouterModule, Routes } from '@angular/router'

import { AuthGuard } from './modules/auth/guards/auth.guard'
import { HomeComponent } from './pages/home/home.component'

const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    canActivate: [AuthGuard]
  }
  // {
  //   path: 'auth',
  //   loadChildren: () =>
  //     import('./modules/auth/auth.module').then((m) => m.AuthModule)
  // },
  // {
  //   path: 'dynamic',
  //   loadChildren: () =>
  //     import('./modules/dynamic-entity/dynamic-entity.module').then(
  //       (m) => m.DynamicEntityModule
  //     ),
  //   canActivate: [AuthGuard]
  // },
  // {
  //   path: '404',
  //   component: Error404Component,
  //   canActivate: [AuthGuard]
  // },
  // {
  //   path: '**',
  //   redirectTo: '/404'
  // }
]

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
