import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'

import { AppRoutingModule } from '../app-routing.module'
import { DynamicEntityCreateEditComponent } from './components/dynamic-entity-create-edit/dynamic-entity-create-edit.component'
import { DynamicEntityDetailComponent } from './components/dynamic-entity-detail/dynamic-entity-detail.component'
import { DynamicEntityListComponent } from './components/dynamic-entity-list/dynamic-entity-list.component'

@NgModule({
  declarations: [
    DynamicEntityCreateEditComponent,
    DynamicEntityDetailComponent,
    DynamicEntityListComponent
  ],
  imports: [CommonModule, AppRoutingModule, ReactiveFormsModule]
})
export class DynamicEntityModule {}
