import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  Renderer2,
  ViewChild
} from '@angular/core'
import { ValidatorFn, Validators } from '@angular/forms'
import * as fastLevenshtein from 'fast-levenshtein'

import { CaseInput } from '../../../interfaces/case-input.interface'
import { HTMLInputEvent } from '../../../interfaces/html-input-event.interface'
import { ResourceDefinition } from '../../../interfaces/resource-definition.interface'
import { SearchResult } from '../../../interfaces/search-result.interface'
import { ResourceService } from '../../../services/resource.service'

@Component({
  selector: 'case-multi-search-input',
  templateUrl: './multi-search-input.component.html',
  styleUrls: ['./multi-search-input.component.scss'],
  providers: [ResourceService]
})
export class MultiSearchInputComponent implements CaseInput, OnChanges {
  @Input() label: string
  @Input() initialValue: {
    [key: string]: string[]
  }
  @Input() placeholder: string
  @Input() helpText: string
  @Input() resources: ResourceDefinition[]
  @Input() params: { [key: string]: string }
  @Input() maxSelectedItems
  @Input() readonly = false
  @Input() showErrors = false
  @Input() validators: ValidatorFn[] = []
  @Input() uniqueId: string

  @Output() valueChanged: EventEmitter<{
    [key: string]: number[]
  }> = new EventEmitter()

  @ViewChild('searchInput', { static: false }) searchInputEl: ElementRef

  suggestedSearchResults: SearchResult[] = []
  selectedSearchResults: SearchResult[] = []

  terms = ''
  showList = false
  focusedItemIndex: number
  required: boolean
  defaultIcon = 'icon-grid'

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2,
    private resourceService: ResourceService
  ) {}

  async ngOnChanges(changes) {
    this.selectedSearchResults = await this.getSearchResultObjects(
      this.initialValue
    ).then((res) => res)

    this.required = this.validators.includes(Validators.required)
  }

  // Fetch full objects from API to display them. Based on initialValue (ids ony).
  getSearchResultObjects(initialValue: any): Promise<SearchResult[]> {
    if (initialValue && Object.values(this.initialValue).some((v) => !!v)) {
      return this.resourceService.list(
        'search/get-search-result-objects',
        initialValue
      )
    }
    return Promise.resolve([])
  }

  toggleItem(item: any): void {
    if (!this.readonly) {
      // Check if there already is an item with same id on selection
      if (this.selectedSearchResults.find((i: any) => i.id === item.id)) {
        this.selectedSearchResults.splice(
          this.selectedSearchResults.indexOf(item),
          1
        )
        this.renderer.setProperty(this.searchInputEl.nativeElement, 'value', '')
      } else if (
        !this.maxSelectedItems ||
        this.selectedSearchResults.length < this.maxSelectedItems
      ) {
        this.selectedSearchResults.push(item)
        this.renderer.setProperty(this.searchInputEl.nativeElement, 'value', '')
      }
      this.showList = false

      this.valueChanged.emit(this.formatToEmit(this.selectedSearchResults))
    }
  }

  onSearchInputKeyup(event: HTMLInputEvent) {
    if (!this.readonly) {
      this.terms = event.target.value
      this.showList = true

      // Navigate through results
      if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
        return this.navigateSuggestedValues(event.key)
      }

      this.resourceService
        .list('search', {
          resources: this.resources.map((rD) => rD.className),
          terms: this.terms,
          ...this.params
        })
        .then((searchResultsRes: SearchResult[]) => {
          // Sort by Levenshtein distance and limit array.
          this.suggestedSearchResults = searchResultsRes
            .sort(
              (a: SearchResult, b: SearchResult) =>
                fastLevenshtein.get(this.terms, a.label) -
                fastLevenshtein.get(this.terms, b.label)
            )
            .slice(0, 20)

          delete this.focusedItemIndex
        })
    }
  }

  // Transform an array of search results into an object of properties that have as value an array of ids.
  formatToEmit(selectedResults: SearchResult[]): { [key: string]: any } {
    const emittedValueObject: {
      [key: string]: any
    } = this.resources.reduce((acc, resourceDefinition: ResourceDefinition) => {
      acc[resourceDefinition.className] = []
      return acc
    }, {})

    selectedResults.forEach((searchResult: SearchResult) => {
      emittedValueObject[searchResult.resourceName].push(searchResult.id)
    })

    // If one item only, we return value directly instead of array.
    if (this.maxSelectedItems === 1) {
      const resourceName = Object.keys(emittedValueObject)[0]
      return {
        [this.firstLetterInLowerCase(resourceName) + 'Id']:
          emittedValueObject[resourceName][0]
      }
    }

    // Format "array-of-ids" name based on resource name. Ex: cars => carIds.
    return Object.keys(emittedValueObject).reduce((acc, resourceName) => {
      acc[this.firstLetterInLowerCase(resourceName) + 'Ids'] =
        emittedValueObject[resourceName]
      return acc
    }, {})
  }

  // Use arrowKeys and enter to select suggested themes with keyboard.
  navigateSuggestedValues(key: string): void {
    if (key === 'ArrowDown') {
      if (typeof this.focusedItemIndex === 'undefined') {
        this.showList = true
        this.focusedItemIndex = 0
      } else if (
        this.focusedItemIndex <
        this.suggestedSearchResults.length - 1
      ) {
        this.focusedItemIndex++
      }
    } else if (key === 'ArrowUp') {
      if (!this.focusedItemIndex) {
        this.showList = false
        delete this.focusedItemIndex
      } else {
        this.focusedItemIndex--
      }
    } else if (
      key === 'Enter' &&
      typeof this.focusedItemIndex !== 'undefined' &&
      this.suggestedSearchResults[this.focusedItemIndex]
    ) {
      this.toggleItem(this.suggestedSearchResults[this.focusedItemIndex])
      delete this.focusedItemIndex
    }
  }

  getResourceIcon(resourceClassName: string): string {
    const resource: ResourceDefinition = this.resources.find(
      (r) => r.className === resourceClassName
    )

    return resource ? resource.icon : this.defaultIcon
  }

  private firstLetterInLowerCase(string: string): string {
    return string.charAt(0).toLowerCase() + string.slice(1)
  }

  // Click outside closes list
  @HostListener('document:click', ['$event.target'])
  clickOut(eventTarget) {
    if (this.showList && !this.elementRef.nativeElement.contains(eventTarget)) {
      this.showList = false
    }
  }
}
