import { NgClass, NgFor } from '@angular/common'
import {
  Component,
  EventEmitter,
  Input,
  NgIterable,
  OnInit,
  Output
} from '@angular/core'
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms'
import {
  EntityManifest,
  PropType,
  PropertyManifest,
  RelationshipManifest,
  SelectOption
} from '@repo/types'
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
            <option value="">Select {{ label }}...</option>
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
  options: { id: string; label: string }[] | SelectOption[] | NgIterable<any>

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
    } else if (this.prop.type === PropType.Choice) {
      this.options = ((this.prop.options?.['values'] as string[]) || []).map(
        (value: string) => {
          return {
            id: value,
            label: value
          }
        }
      )
    }

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
