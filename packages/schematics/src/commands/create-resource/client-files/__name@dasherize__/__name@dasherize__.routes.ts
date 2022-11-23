import { Route } from '@angular/router'

import { AuthGuard, PermissionGuard, ResourceMode  } from '@case-app/angular-library'

import { <%= classify(name) %>CreateEditComponent } from './<%= dasherize(name) %>-create-edit/<%= dasherize(name) %>-create-edit.component'
import { <%= classify(name) %>ListComponent } from './<%= dasherize(name) %>-list/<%= dasherize(name) %>-list.component'


export const <%= camelize(name) %>Routes: Route[] = [
  {
    path: '<%= dasherize(displayName) %>s',
    component: <%= classify(name) %>ListComponent,
    canActivate: [AuthGuard, PermissionGuard],
    data: {
      permission: 'browse<%= classify(name) %>s'
    }
  },
  {
    path: '<%= dasherize(displayName) %>s/create',
    component: <%= classify(name) %>CreateEditComponent,
    canActivate: [AuthGuard, PermissionGuard],
    data: {
      mode: ResourceMode.Create,
      permission: 'add<%= classify(name) %>s'
    },
  },
  {
    path: '<%= dasherize(displayName) %>s/:id/edit',
    component: <%= classify(name) %>CreateEditComponent,
    canActivate: [AuthGuard, PermissionGuard],
    data: {
      mode: ResourceMode.Edit,
      permission: 'edit<%= classify(name) %>s'
    },
  },
]
