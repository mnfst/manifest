import { NgClass, NgFor } from '@angular/common'
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms'
import {
  EntityManifest,
  PropertyManifest,
  RelationshipManifest,
  SelectOption
} from '@casejs/types'
import { CrudService } from '../../../crud/services/crud.service'
import { ManifestService } from '../../services/manifest.service'

@Component({
  selector: 'app-select-input',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, NgFor],
  template: `
    <div [formGroup]="form">
      <label [for]="label">{{ label }}</label>
      <div class="control">
        <div class="select" [ngClass]="{ 'is-danger': isError }">
          <select
            class="is-fullwidth"
            (change)="onChange($event)"
            formControlName="select"
          >
            <option value="">Select {{ label }}</option>
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
  @Input() prop: PropertyManifest
  @Input() relationship: RelationshipManifest
  @Input() value: { id: number }
  @Input() isError: boolean

  @Output() valueChanged: EventEmitter<number> = new EventEmitter()

  // We use reactive forms here because we need to set the value of the select for edit views.
  form: FormGroup = this.formBuilder.group({
    select: null
  })

  label: string
  entityManifest: EntityManifest
  options: SelectOption[]

  constructor(
    private manifestService: ManifestService,
    private crudService: CrudService,
    private formBuilder: FormBuilder
  ) {}

  async ngOnInit(): Promise<void> {
    this.label = this.prop?.name || this.relationship.name

    if (this.relationship) {
      this.entityManifest = await this.manifestService.getEntityManifest({
        className: this.relationship.entity
      })

      this.options = await this.crudService.listSelectOptions(
        this.entityManifest.slug
      )
    }

    // TODO: Enums
    // if (this.type === PropType.Enum) {
    //   let enumOptions: EnumPropertyOptions = this.prop
    //     .options as EnumPropertyOptions
    //   this.options = Object.keys(enumOptions.enum).map((key) => {
    //     return {
    //       id: enumOptions.enum[key],
    //       label: enumOptions.enum[key]
    //     }
    //   })
    // }

    if (this.value) {
      this.form.patchValue({
        select: this.relationship ? this.value.id : this.value
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
