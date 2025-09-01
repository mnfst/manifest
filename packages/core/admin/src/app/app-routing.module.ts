import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { AuthGuard } from './modules/auth/guards/auth.guard'
import { Error404Component } from './pages/error404/error404.component'
import { HomeComponent } from './pages/home/home.component'
import { HomeDeveloperComponent } from './pages/home-developer/home-developer.component'
import { AdminAccessGuard } from './modules/auth/guards/admin-access.guard'
import { RestrictAdminCollectionGuard } from './modules/auth/guards/restrict-admin-collection.guard'
import { ApiDocsComponent } from './pages/api-docs/api-docs.component'

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
    canActivate: [AuthGuard, RestrictAdminCollectionGuard],
    data: {
      mode: 'collection',
      requiredAccess: 'hasContentManagerAccess'
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
    path: 'builder',
    component: HomeDeveloperComponent,
    canActivate: [AdminAccessGuard],
    data: {
      requiredAccess: 'hasBackendBuilderAccess'
    }
  },
  {
    path: 'builder/editor',
    loadChildren: () =>
      import('./modules/editor/editor.module').then((m) => m.EditorModule),
    canActivate: [AdminAccessGuard],
    data: {
      requiredAccess: 'hasBackendBuilderAccess'
    }
  },
  {
    path: 'builder/collections',
    loadChildren: () =>
      import('./modules/crud/crud-collection.module').then(
        (m) => m.CrudCollectionModule
      ),
    canActivate: [AdminAccessGuard],
    data: {
      mode: 'collection',
      isDeveloperAccess: true,
      requiredAccess: 'hasBackendBuilderAccess'
    }
  },
  {
    path: 'api-docs',
    component: ApiDocsComponent,
    canActivate: [AdminAccessGuard],
    data: {
      requiredAccess: 'hasApiDocsAccess'
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
