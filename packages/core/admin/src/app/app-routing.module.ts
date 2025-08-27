import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { AuthGuard } from './modules/auth/guards/auth.guard'
import { Error404Component } from './pages/error404/error404.component'
import { HomeComponent } from './pages/home/home.component'
import { HomeDeveloperComponent } from './pages/home-developer/home-developer.component'

const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./modules/auth/auth.module').then((m) => m.AuthModule)
  },
  {
    path: 'content/collections',
    loadChildren: () =>
      import('./modules/crud/crud-collection.module').then(
        (m) => m.CrudCollectionModule
      ),
    canActivate: [AuthGuard],
    data: {
      mode: 'collection'
    }
  },
  {
    path: 'content/singles',
    loadChildren: () =>
      import('./modules/crud/crud-single.module').then(
        (m) => m.CrudSingleModule
      ),
    canActivate: [AuthGuard]
  },
  {
    path: 'dev',
    component: HomeDeveloperComponent
  },
  {
    path: 'dev/editor',
    loadChildren: () =>
      import('./modules/editor/editor.module').then((m) => m.EditorModule)
  },
  {
    path: 'dev/collections',
    loadChildren: () =>
      import('./modules/crud/crud-collection.module').then(
        (m) => m.CrudCollectionModule
      ),
    canActivate: [AuthGuard],
    data: {
      mode: 'collection'
    }
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
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
