import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core'
import {
  FormGroup,
  FormControl,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms'
import { PropertyManifest, PropType } from '../../../../../../../types/src'
import { NgClass, NgFor, NgIf } from '@angular/common'
import { ReactiveFormsModule } from '@angular/forms'

@Component({
  selector: 'app-property-manifest-create-edit',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, ReactiveFormsModule],
  templateUrl: './property-manifest-create-edit.component.html',
  styleUrl: './property-manifest-create-edit.component.scss'
})
export class PropertyManifestCreateEditComponent implements OnChanges {
  @Input() propertyManifest: PropertyManifest
  @Output() formChange: EventEmitter<PropertyManifest> =
    new EventEmitter<PropertyManifest>()

  @ViewChild('nameInput', { static: false })
  nameInput: ElementRef<HTMLInputElement>

  extended: boolean = false
  showDropdown: boolean = false
  typeSelected: boolean = false

  propTypesArray = Object.values(PropType).map((type) => ({
    label: type,
    value: type
  }))

  form: FormGroup

  constructor(private formBuilder: FormBuilder) {}

  // Custom validator to ensure the value is a valid PropType enum
  propTypeValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value
    if (!value) {
      return null // Let the required validator handle empty values
    }

    const validPropTypes = Object.values(PropType)
    if (!validPropTypes.includes(value)) {
      return { invalidPropType: { value, validTypes: validPropTypes } }
    }

    return null
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('ngOnChanges called with changes:', changes, this.form?.value)
    if (!this.form) {
      this.form = this.formBuilder.group({
        type: new FormControl(this.propertyManifest?.type, [
          Validators.required,
          this.propTypeValidator.bind(this)
        ]),
        name: new FormControl(this.propertyManifest?.name, Validators.required),
        helpText: new FormControl(this.propertyManifest?.helpText || ''),
        default: new FormControl(this.propertyManifest?.default || '')
      })

      this.form.valueChanges.subscribe(() => {
        if (this.form.valid) {
          // console.log('Emitting form change', this.form)
          this.formChange.emit(this.form.value)
        }
      })
    }
  }

  /**
   * Set the property type and focus the name input.
   *
   * @param type The property type to set.
   */
  setType(type: PropType): void {
    this.form.get('type')?.setValue(type)
    this.typeSelected = true

    // Wait for the input to be rendered before focusing.
    setTimeout(() => {
      this.nameInput.nativeElement.focus()
    }, 0)
  }

  remove(): void {
    this.formChange.emit(null)
  }

  @HostListener('document:click', ['$event.target'])
  clickOut(eventTarget: EventTarget | null) {
    if (
      this.showDropdown &&
      eventTarget &&
      (eventTarget as HTMLElement).className &&
      !(eventTarget as HTMLElement).className.includes('dropdown')
    ) {
      this.showDropdown = false
    }
  }
}
