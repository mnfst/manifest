import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'

import { AppRoutingModule } from '../app-routing.module'
import { SettingsService } from '../services/settings.service'
import { DynamicEntityCreateEditComponent } from './components/dynamic-entity-create-edit/dynamic-entity-create-edit.component'
import { DynamicEntityDetailComponent } from './components/dynamic-entity-detail/dynamic-entity-detail.component'
import { DynamicEntityListComponent } from './components/dynamic-entity-list/dynamic-entity-list.component'
import { SelectInputComponent } from './inputs/select-input/select-input.component'
import { NumberYieldComponent } from './yields/number-yield/number-yield.component'
import { RelationYieldComponent } from './yields/relation-yield/relation-yield.component'
import { TextYieldComponent } from './yields/text-yield/text-yield.component'
import { YieldComponent } from './yields/yield.component'

@NgModule({
  declarations: [
    DynamicEntityCreateEditComponent,
    DynamicEntityDetailComponent,
    DynamicEntityListComponent,
    SelectInputComponent,
    RelationYieldComponent,
    TextYieldComponent,
    YieldComponent,
    NumberYieldComponent
  ],
  imports: [CommonModule, AppRoutingModule, ReactiveFormsModule],
  providers: [SettingsService]
})
export class DynamicEntityModule {}
