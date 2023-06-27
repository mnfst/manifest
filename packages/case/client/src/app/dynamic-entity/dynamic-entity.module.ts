import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'

import { AppRoutingModule } from '../app-routing.module'
import { DynamicEntityCreateEditComponent } from './components/dynamic-entity-create-edit/dynamic-entity-create-edit.component'
import { DynamicEntityDetailComponent } from './components/dynamic-entity-detail/dynamic-entity-detail.component'
import { DynamicEntityListComponent } from './components/dynamic-entity-list/dynamic-entity-list.component'
import { SelectInputComponent } from './inputs/select-input/select-input.component';
import { TextComponent } from './yields/text/text.component'
@NgModule({
  declarations: [
    DynamicEntityCreateEditComponent,
    DynamicEntityDetailComponent,
    DynamicEntityListComponent,
    SelectInputComponent,
    TextComponent
  ],
  imports: [CommonModule, AppRoutingModule, ReactiveFormsModule]
})
export class DynamicEntityModule {}
