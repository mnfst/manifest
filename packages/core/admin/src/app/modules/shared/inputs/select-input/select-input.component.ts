import { NgClass, NgFor } from '@angular/common'
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms'
import { PropType, PropertyManifest, SelectOption } from '@casejs/types'

@Component({
  selector: 'app-select-input',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, NgFor],
  template: `
    <div [formGroup]="form">
      <label [for]="prop.name">{{ prop.name }}</label>
      <div class="control">
        <div class="select" [ngClass]="{ 'is-danger': isError }">
          <select
            class="is-fullwidth"
            (change)="onChange($event)"
            formControlName="select"
          >
            <option value="">Select {{ prop.name }}</option>
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
  @Input() type: PropType
  @Input() value: { id: number }
  @Input() isError: boolean

  @Output() valueChanged: EventEmitter<number> = new EventEmitter()

  // We use reactive forms here because we need to set the value of the select for edit views.
  form: FormGroup = this.formBuilder.group({
    select: null
  })

  // entityMeta: EntityMeta
  options: SelectOption[]

  constructor(
    // private dynamicEntityService: DynamicEntityService,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit(): void {
    // if (this.type === PropType.Relation) {
    //   this.dynamicEntityService
    //     .loadEntityMeta()
    //     .subscribe(async (res: EntityMeta[]) => {
    //       // Note: only works for PropType.Relation at this time.
    //       this.entityMeta = res.find(
    //         (entity: EntityMeta) =>
    //           entity.className ===
    //           (this.prop.options as RelationPropertyOptions).entitySlug
    //       )
    //       this.options = await this.dynamicEntityService.listSelectOptions(
    //         this.entityMeta.definition.slug
    //       )
    //     })
    // }
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
    // if (this.value) {
    //   this.form.patchValue({
    //     select: this.type === PropType.Relation ? this.value.id : this.value
    //   })
    // }
  }

  onChange(event: any): void {
    //   // Note: we need to emit null if the user selects the default option.
    //   if (event.target.value === '') {
    //     this.form.patchValue({
    //       select: null
    //     })
    //     this.valueChanged.emit(null)
    //     return
    //   }
    //   this.valueChanged.emit(event.target.value)
  }
}
