import { CommonModule } from '@angular/common'
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output
} from '@angular/core'
import { PropertyManifest, SelectOption } from '@repo/types'

@Component({
  selector: 'app-multi-select-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './multi-select-input.component.html',
  styleUrls: ['./multi-select-input.component.scss']
})
export class MultiSelectInputComponent {
  @Input() prop: PropertyManifest
  @Input() value: number[] | string[] | number | string

  @Output() valueChanged: EventEmitter<number[]> = new EventEmitter()

  // entityMeta: EntityMeta
  options: SelectOption[]
  selectedOptions: SelectOption[] = []

  showList: boolean

  constructor(
    // private dynamicEntityService: DynamicEntityService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    // this.dynamicEntityService
    //   .loadEntityMeta()
    //   .subscribe(async (res: EntityMeta[]) => {
    //     // Note: only works for PropType.Relation at this time.
    //     this.entityMeta = res.find(
    //       (entity: EntityMeta) =>
    //         entity.className ===
    //         (this.prop.options as RelationPropertyOptions).entitySlug
    //     )
    //     this.options = await this.dynamicEntityService.listSelectOptions(
    //       this.entityMeta.definition.slug
    //     )
    //     if (this.value) {
    //       this.value = this.forceNumberArray(this.value)
    //       this.selectedOptions = []
    //       this.options
    //         .filter((option) =>
    //           this.forceNumberArray(this.value).find(
    //             (value) => value === option.id
    //           )
    //         )
    //         .forEach((option) => {
    //           option.selected = true
    //           this.selectedOptions.push(option)
    //         })
    //     }
    //   })
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

  forceNumberArray(value: string | number | number[] | string[]): number[] {
    if (typeof value === 'number') {
      return [value]
    } else if (typeof value === 'string') {
      return [parseInt(value)]
    }
    return value.map((v) => (typeof v === 'string' ? parseInt(v) : v))
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
