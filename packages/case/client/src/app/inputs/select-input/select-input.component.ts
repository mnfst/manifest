import { CommonModule } from '@angular/common'
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms'
import { EntityMeta } from '~shared/interfaces/entity-meta.interface'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'
import { SelectOption } from '~shared/interfaces/select-option.interface'

import { RelationOptions } from '../../../../../shared/interfaces/property-options/relation-options.interface'
import { DynamicEntityService } from '../../dynamic-entity/dynamic-entity.service'
import { SettingsService } from '../../services/settings.service'

@Component({
  selector: 'app-select-input',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  template: `
    <div [formGroup]="form">
      <label [for]="prop.propName">{{ prop.label }}</label>
      <div class="control">
        <div class="select">
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
  @Input() value: { id: number }

  @Output() valueChanged: EventEmitter<number> = new EventEmitter()

  // We use reactive forms here because we need to set the value of the select for edit views.
  form: FormGroup = this.formBuilder.group({
    select: null
  })

  EntityMeta: EntityMeta
  options: SelectOption[]

  constructor(
    private settingsService: SettingsService,
    private dynamicEntityService: DynamicEntityService,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit(): void {
    this.settingsService.loadSettings().subscribe(async (res) => {
      // Note: only works for PropType.Relation at this time.
      this.EntityMeta = res.entities.find(
        (entity: EntityMeta) =>
          entity.className === (this.prop.options as RelationOptions).entitySlug
      )

      this.options = await this.dynamicEntityService.listSelectOptions(
        this.EntityMeta.definition.slug
      )

      if (this.value) {
        this.form.patchValue({
          select: this.value.id
        })
      }
    })
  }

  onChange(event: any): void {
    this.valueChanged.emit(event.target.value)
  }
}
