import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms'
import { EntityMeta } from '~shared/interfaces/entity-meta.interface'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'
import { SelectOption } from '~shared/interfaces/select-option.interface'

import { NgClass, NgFor } from '@angular/common'
import { PropType } from '@casejs/types'
import { EnumPropertyOptions } from '../../../../../shared/interfaces/property-options/enum-property-options.interface'
import { RelationPropertyOptions } from '../../../../../shared/interfaces/property-options/relation-property-options.interface'
import { DynamicEntityService } from '../../dynamic-entity/dynamic-entity.service'

@Component({
  selector: 'app-select-input',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, NgFor],
  template: `
    <div [formGroup]="form">
      <label [for]="prop.propName">{{ prop.label }}</label>
      <div class="control">
        <div class="select" [ngClass]="{ 'is-danger': isError }">
          <select
            class="is-fullwidth"
            (change)="onChange($event)"
            formControlName="select"
          >
            <option value="">Select {{ prop.label }}</option>
            <option *ngFor="let option of options" [value]="option.id">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./select-input.component.scss']
})
export class SelectInputComponent implements OnInit {
  @Input() prop: PropertyDescription
  @Input() type: PropType
  @Input() value: { id: number }
  @Input() isError: boolean

  @Output() valueChanged: EventEmitter<number> = new EventEmitter()

  // We use reactive forms here because we need to set the value of the select for edit views.
  form: FormGroup = this.formBuilder.group({
    select: null
  })

  entityMeta: EntityMeta
  options: SelectOption[]

  constructor(
    private dynamicEntityService: DynamicEntityService,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit(): void {
    if (this.type === PropType.Relation) {
      this.dynamicEntityService
        .loadEntityMeta()
        .subscribe(async (res: EntityMeta[]) => {
          // Note: only works for PropType.Relation at this time.
          this.entityMeta = res.find(
            (entity: EntityMeta) =>
              entity.className ===
              (this.prop.options as RelationPropertyOptions).entitySlug
          )

          this.options = await this.dynamicEntityService.listSelectOptions(
            this.entityMeta.definition.slug
          )
        })
    }

    if (this.type === PropType.Enum) {
      let enumOptions: EnumPropertyOptions = this.prop
        .options as EnumPropertyOptions
      this.options = Object.keys(enumOptions.enum).map((key) => {
        return {
          id: enumOptions.enum[key],
          label: enumOptions.enum[key]
        }
      })
    }

    if (this.value) {
      this.form.patchValue({
        select: this.type === PropType.Relation ? this.value.id : this.value
      })
    }
  }

  onChange(event: any): void {
    // Note: we need to emit null if the user selects the default option.
    if (event.target.value === '') {
      this.form.patchValue({
        select: null
      })
      this.valueChanged.emit(null)
      return
    }

    this.valueChanged.emit(event.target.value)
  }
}
