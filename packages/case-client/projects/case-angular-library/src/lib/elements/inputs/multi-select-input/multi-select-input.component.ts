import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  Output,
  SimpleChange
} from '@angular/core'
import { ValidatorFn, Validators } from '@angular/forms'

import { CaseInput } from '../../../interfaces/case-input.interface'
import { SelectOption } from '../../../interfaces/select-option.interface'

@Component({
  selector: 'case-multi-select-input',
  templateUrl: './multi-select-input.component.html',
  styleUrls: ['./multi-select-input.component.scss']
})
export class MultiSelectInputComponent implements CaseInput, OnChanges {
  @Input() label: string
  @Input() initialValue: string[] = []
  @Input() selectOptions: SelectOption[]
  @Input() placeholder = 'Selectionnez un ou plusieurs éléments'
  @Input() helpText: string
  @Input() itemNameSingular = 'élément'
  @Input() itemNamePlural = 'éléments'
  @Input() readonly: boolean
  @Input() showErrors = false
  @Input() maxSelectedItems: number
  @Input() validators: ValidatorFn[] = []
  @Input() uniqueId: string

  @Output() valueChanged: EventEmitter<string[]> = new EventEmitter()

  activeOptions: string[] = []
  showList = false
  required: boolean

  constructor(private elementRef: ElementRef, private ngZone: NgZone) {}

  ngOnChanges(changes: { selectOptions?: SimpleChange }) {
    this.required = this.validators.includes(Validators.required)

    // Reset form value if we change select options.
    if (this.activeOptions.length && changes.selectOptions) {
      return this.selectNone()
    }

    this.activeOptions = this.initialValue || []

    if (Array.isArray(this.activeOptions)) {
      this.activeOptions = this.activeOptions.map((option) => String(option))
    } else {
      this.activeOptions = [String(this.activeOptions)]
    }

    if (this.selectOptions?.length) {
      this.selectOptions.forEach((selectOption: SelectOption) => {
        if (
          this.activeOptions.find(
            (activeOption) =>
              String(activeOption) === String(selectOption.value)
          )
        ) {
          selectOption.selected = true
        }
      })
    }
  }

  toggleSelected(option: SelectOption): void {
    if (this.readonly) {
      return
    }

    const clickedOption: string = String(option.value)

    this.ngZone.run(() => {
      const index = this.activeOptions.indexOf(clickedOption)
      if (index !== -1) {
        option.selected = !option.selected
        this.activeOptions.splice(index, 1)
      } else if (
        !this.maxSelectedItems ||
        this.activeOptions.length < this.maxSelectedItems
      ) {
        option.selected = !option.selected
        this.activeOptions.push(String(option.value))
      }

      this.valueChanged.emit(this.activeOptions)
    })
  }

  selectAll() {
    this.ngZone.run(() => {
      this.selectOptions.forEach((option) => (option.selected = true))
      this.activeOptions = this.selectOptions.map((option) =>
        String(option.value)
      )
      this.valueChanged.emit(this.activeOptions)
    })
  }

  selectNone() {
    this.ngZone.run(() => {
      this.selectOptions.forEach((option) => (option.selected = false))
      this.activeOptions = []
      this.valueChanged.emit(this.activeOptions)
    })
  }

  // Click outside closes list
  @HostListener('document:click', ['$event.target'])
  clickOut(eventTarget) {
    if (
      this.showList &&
      !this.elementRef.nativeElement.contains(eventTarget) &&
      !eventTarget.className.includes('mass-selection-button')
    ) {
      this.showList = false
    }
  }
}
