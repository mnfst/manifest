import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'

import { AppRoutingModule } from '../app-routing.module'
import { SettingsService } from '../services/settings.service'
import { DynamicEntityCreateEditComponent } from './components/dynamic-entity-create-edit/dynamic-entity-create-edit.component'
import { DynamicEntityDetailComponent } from './components/dynamic-entity-detail/dynamic-entity-detail.component'
import { DynamicEntityListComponent } from './components/dynamic-entity-list/dynamic-entity-list.component'
import { InputComponent } from './inputs/input.component'
import { NumberInputComponent } from './inputs/number-input/number-input.component'
import { SelectInputComponent } from './inputs/select-input/select-input.component'
import { TextAreaInputComponent } from './inputs/text-area-input/text-area-input.component'
import { NumberYieldComponent } from './yields/number-yield/number-yield.component'
import { RelationYieldComponent } from './yields/relation-yield/relation-yield.component'
import { TextYieldComponent } from './yields/text-yield/text-yield.component'
import { YieldComponent } from './yields/yield.component'
import { TextInputComponent } from './inputs/text-input/text-input.component'
import { CurrencyInputComponent } from './inputs/currency-input/currency-input.component'
import { DateInputComponent } from './inputs/date-input/date-input.component'
import { BooleanInputComponent } from './inputs/boolean-input/boolean-input.component'
import { EmailInputComponent } from './inputs/email-input/email-input.component'

@NgModule({
  declarations: [
    DynamicEntityCreateEditComponent,
    DynamicEntityDetailComponent,
    DynamicEntityListComponent,
    SelectInputComponent,
    RelationYieldComponent,
    TextYieldComponent,
    YieldComponent,
    NumberYieldComponent,
    NumberInputComponent,
    TextAreaInputComponent,
    InputComponent,
    TextInputComponent,
    CurrencyInputComponent,
    DateInputComponent,
    BooleanInputComponent,
    EmailInputComponent
  ],
  imports: [CommonModule, AppRoutingModule, ReactiveFormsModule],
  providers: [SettingsService]
})
export class DynamicEntityModule {}
