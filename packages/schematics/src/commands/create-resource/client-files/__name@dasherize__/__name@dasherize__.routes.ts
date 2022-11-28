import { Route } from '@angular/router'

import { AuthGuard, PermissionGuard, ResourceMode  } from '@case-app/angular-library'

import { <%= classify(name) %>CreateEditComponent } from './<%= dasherize(name) %>-create-edit/<%= dasherize(name) %>-create-edit.component'
import { <%= classify(name) %>ListComponent } from './<%= dasherize(name) %>-list/<%= dasherize(name) %>-list.component'
import { <%= classify(name) %>DetailComponent } from './<%= dasherize(name) %>-detail/<%= dasherize(name) %>-detail.component'
import { <%= camelize(name) %>Definition } from './<%= dasherize(name) %>.definition'

export const <%= camelize(name) %>Routes: Route[] = [
  {
    path: '<%= dasherize(name) %>s',
    component: <%= classify(name) %>ListComponent,
    canActivate: [AuthGuard, PermissionGuard],
    data: {
      permission: 'browse<%= classify(name) %>s'
    }
  },
  {
    path: '<%= dasherize(name) %>s/create',
    component: <%= classify(name) %>CreateEditComponent,
    canActivate: [AuthGuard, PermissionGuard],
    data: {
      mode: ResourceMode.Create,
      permission: 'add<%= classify(name) %>s'
    },
  },
  {
    path: '<%= dasherize(name) %>s/:id/edit',
    component: <%= classify(name) %>CreateEditComponent,
    canActivate: [AuthGuard, PermissionGuard],
    data: {
      mode: ResourceMode.Edit,
      permission: 'edit<%= classify(name) %>s'
    },
  },
]

if(<%= camelize(name) %>Definition.hasDetailPage) {
  <%= camelize(name) %>Routes.push(
    {
      path: '<%= dasherize(name) %>s/:id',
      component: <%= classify(name) %>DetailComponent,
      canActivate: [AuthGuard, PermissionGuard],
      data: {
        permission: 'read<%= classify(name) %>s'
      }
    }
  )
}
