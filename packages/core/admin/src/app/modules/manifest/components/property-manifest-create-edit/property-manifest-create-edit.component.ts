import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild
} from '@angular/core'
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms'
import { PropType } from '../../../../../../../types/src'
import { NgClass, NgFor, NgIf } from '@angular/common'
import { ReactiveFormsModule } from '@angular/forms'
import { currencies } from '../../content/currencies.content'
import { validators, ValidatorUI } from '../../content/validators.content'

@Component({
  selector: 'app-property-manifest-create-edit',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, ReactiveFormsModule],
  templateUrl: './property-manifest-create-edit.component.html',
  styleUrl: './property-manifest-create-edit.component.scss'
})
export class PropertyManifestCreateEditComponent {
  @Input() propertyManifestFormGroup: FormGroup
  @Output() removeProperty: EventEmitter<null> = new EventEmitter<null>()
  @Output() duplicateProperty: EventEmitter<null> = new EventEmitter<null>()

  @ViewChild('nameInput', { static: false })
  nameInput: ElementRef<HTMLInputElement>

  @ViewChild('addValidatorRuleSelect', { static: false })
  addValidatorRuleSelect: ElementRef<HTMLSelectElement>

  extended: boolean = false
  showDropdown: boolean = false
  typeSelected: boolean = false

  propTypesArray = Object.values(PropType).map((type) => ({
    label: type,
    value: type
  }))
  PropType = PropType

  validators = validators

  currencies: { id: string; label: string }[] = currencies

  ngOnInit(): void {
    // Skip type selection if type is already set (edit mode).
    this.typeSelected = !!this.propertyManifestFormGroup.get('type')?.value
  }

  /**
   * Set the property type and focus the name input.
   *
   * @param type The property type to set.
   */
  setType(type: PropType): void {
    this.propertyManifestFormGroup.get('type')?.setValue(type)
    this.typeSelected = true

    if (type === PropType.Choice) {
      this.addOptionValue()
    }

    // Wait for the input to be rendered before focusing.
    setTimeout(() => {
      this.nameInput.nativeElement.focus()
    }, 0)
  }

  remove(): void {
    this.removeProperty.emit()
  }

  duplicate(): void {
    this.duplicateProperty.emit()
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

  get optionValues(): FormArray {
    return this.propertyManifestFormGroup.get('options.values') as FormArray
  }

  addOptionValue(): void {
    this.optionValues.push(new FormControl(''))
  }

  removeOptionValue(index: number): void {
    this.optionValues.removeAt(index)
  }

  get imageSizes(): FormArray {
    return this.propertyManifestFormGroup.get('options.sizes') as FormArray
  }

  addImageSize(): void {
    this.imageSizes.push(
      new FormGroup({
        name: new FormControl(null),
        width: new FormControl(null),
        height: new FormControl(null)
      })
    )
  }

  removeImageSize(index: number): void {
    this.imageSizes.removeAt(index)
  }

  get validation(): FormGroup {
    return this.propertyManifestFormGroup.get('validation') as FormGroup
  }

  getValidatorControls(): string[] {
    return Object.keys(this.validation.controls)
  }

  addValidatorRule(ruleEvent: any): void {
    const validator: ValidatorUI = this.validators.find(
      (v) => v.id === ruleEvent.target.value
    )!

    this.validation.addControl(
      validator.id,
      new FormControl(
        validator.input ? null : true, // Validators without input are "true" values. Ex: isDefined, isJSON, etc.
        Validators.required
      )
    )

    // Reset select value
    this.addValidatorRuleSelect.nativeElement.value = ''
  }

  removeValidatorRule(validatorId: string): void {
    this.validation.removeControl(validatorId)
  }

  getValidatorFromId(validatorId: string): ValidatorUI | undefined {
    return this.validators.find((v) => v.id === validatorId)
  }
}
