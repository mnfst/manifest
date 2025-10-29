import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild
} from '@angular/core'
import { FormArray, FormControl, FormGroup } from '@angular/forms'
import { PropType } from '../../../../../../../types/src'
import { NgClass, NgFor, NgIf } from '@angular/common'
import { ReactiveFormsModule } from '@angular/forms'
import { currencies } from './currencies.content'

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

  extended: boolean = false
  showDropdown: boolean = false
  typeSelected: boolean = false

  propTypesArray = Object.values(PropType).map((type) => ({
    label: type,
    value: type
  }))
  PropType = PropType

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
      this.addValue()
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

  get values(): FormArray {
    return this.propertyManifestFormGroup.get('options.values') as FormArray
  }

  addValue(): void {
    this.values.push(new FormControl(''))
  }

  removeValue(index: number): void {
    this.values.removeAt(index)
  }
}
