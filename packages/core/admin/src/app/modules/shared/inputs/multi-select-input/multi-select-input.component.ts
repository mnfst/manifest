import { CommonModule } from '@angular/common'
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output
} from '@angular/core'
import {
  EntityManifest,
  PropertyManifest,
  RelationshipManifest,
  SelectOption
} from '@repo/types'
import { ManifestService } from '../../services/manifest.service'
import { CrudService } from '../../../crud/services/crud.service'

@Component({
  selector: 'app-multi-select-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './multi-select-input.component.html',
  styleUrls: ['./multi-select-input.component.scss']
})
export class MultiSelectInputComponent implements OnInit {
  @Input() prop: PropertyManifest
  @Input() relationship: RelationshipManifest
  @Input() value: { id: string }[]
  @Input() isError: boolean

  @Output() valueChanged: EventEmitter<string[]> = new EventEmitter()

  options: SelectOption[]
  selectedOptions: SelectOption[] = []

  showList: boolean
  entityManifest: EntityManifest
  label: string

  constructor(
    private manifestService: ManifestService,
    private crudService: CrudService,
    private elementRef: ElementRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.label = this.prop?.label || this.relationship.name

    if (this.relationship) {
      this.entityManifest = await this.manifestService.getEntityManifest({
        className: this.relationship.entity
      })

      this.options = await this.crudService.listSelectOptions(
        this.entityManifest.slug
      )
    }

    if (this.value) {
      this.selectedOptions = []
      this.options
        .filter((option) =>
          this.value.map((v) => v.id).find((value) => value === option.id)
        )
        .forEach((option) => {
          option.selected = true
          this.selectedOptions.push(option)
        })
    }
  }

  selectAll(): void {
    this.options.forEach((option) => (option.selected = true))
    this.selectedOptions = this.options
    this.valueChanged.emit(this.selectedOptions.map((option) => option.id))
  }

  selectNone(): void {
    this.options.forEach((option) => (option.selected = false))
    this.selectedOptions = []
    this.valueChanged.emit([])
  }

  toggleSelected(option: SelectOption): void {
    const index = this.selectedOptions.findIndex(
      (selectedOption) => selectedOption.id === option.id
    )
    if (index > -1) {
      this.selectedOptions.splice(index, 1)
    } else {
      this.selectedOptions.push(option)
    }

    option.selected = !option.selected
    this.valueChanged.emit(this.selectedOptions.map((option) => option.id))
  }

  @HostListener('document:click', ['$event.target'])
  clickOut(eventTarget: any) {
    if (
      this.showList &&
      !this.elementRef.nativeElement.contains(eventTarget) &&
      !eventTarget.className.includes('mass-selection-button')
    ) {
      this.showList = false
    }
  }
}
