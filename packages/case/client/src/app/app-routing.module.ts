import { NgModule } from '@angular/core'
import { PreloadAllModules, RouterModule, Routes } from '@angular/router'

import { AuthGuard } from './auth/auth.guard'
import { Error404Component } from './pages/error404/error404.component'
import { HomeComponent } from './pages/home/home.component'

const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.module').then((m) => m.AuthModule)
  },
  {
    path: 'dynamic',
    loadChildren: () =>
      import('./dynamic-entity/dynamic-entity.module').then(
        (m) => m.DynamicEntityModule
      ),
    canActivate: [AuthGuard]
  },
  {
    path: '404',
    component: Error404Component,
    canActivate: [AuthGuard]
  },
  {
    path: '**',
    redirectTo: '/404'
  }
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
