import { Component, Inject } from '@angular/core'
import { ActivatedRoute, Params, Router } from '@angular/router'

import { ReplaySubject, timer } from 'rxjs'
import { switchMap } from 'rxjs/operators'

import { LinkType } from '../enums/link-type.enum'
import { CaseConfig } from '../interfaces/case-config.interface'
import { Filter } from '../interfaces/filter.interface'
import { KeyNumber } from '../interfaces/key-number.interface'
import { OrderByChangedEvent } from '../interfaces/order-by-changed-event.interface'
import { Paginator } from '../interfaces/paginator.interface'
import { ResourceDefinition } from '../interfaces/resource-definition.interface'
import { AuthService } from '../services/auth.service'
import { BreadcrumbService } from '../services/breadcrumb.service'
import { FilterService } from '../services/filter.service'
import { FlashMessageService } from '../services/flash-message.service'
import { ResourceService } from '../services/resource.service'

@Component({
  template: 'NO UI TO BE FOUND HERE!'
})
export class CaseListComponent {
  definition: ResourceDefinition
  paginator: Paginator<any>
  paginator$: ReplaySubject<Paginator<any>> = new ReplaySubject()

  createResourcePermission: string
  isFilterSelectOptionsFetched: boolean

  filters: Filter[]

  filterForm: { [key: string]: any }
  loading = false

  LinkType = LinkType

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private breadcrumbService: BreadcrumbService,
    private resourceService: ResourceService,
    private flashMessageService: FlashMessageService,
    private authService: AuthService,
    private filterService: FilterService,
    @Inject('CASE_CONFIG_TOKEN') private config: CaseConfig
  ) {}

  async initListView() {
    // Resolve filter options once.
    this.filters = await this.filterService.fetchFilterSelectOptions(
      this.filters
    )
    this.isFilterSelectOptionsFetched = true

    this.activatedRoute.queryParams.subscribe(async (queryParams: Params) => {
      this.filterForm = this.filterService.getFilterForm(
        this.filters,
        this.filterService.getPersistentFilters(this.definition.slug),
        queryParams
      )

      this.updateQueryParamsIfMissing(this.filterForm, queryParams)

      this.filters = this.filterService.getFilterValues(
        this.filters,
        this.filterForm
      )

      if (this.config.enablePersistentFilters) {
        this.filterService.savePersistentFilters(
          this.definition.slug,
          this.filterForm
        )
      }

      // Get the list of resources.
      this.loading = true
      delete this.paginator
      this.resourceService
        .list(this.definition.slug, this.filterForm)
        .then((res: Paginator<any> | { filePath: string }) => {
          this.loading = false
          // If it's an export, we open a new tab to download Excel file.
          if (queryParams.toXLS) {
            return this.exportFile((res as { filePath: string }).filePath)
          } else {
            this.paginator = res as Paginator<any>
            this.paginator$.next(this.paginator)
          }

          this.getKeyNumbers(queryParams)
        })
        .catch((err) => {
          this.loading = false
          this.flashMessageService.error(
            `Une erreur a eu lieu : impossible de récupérer la liste des ${this.definition.namePlural}.`
          )
        })

      this.setBreadcrumbs()
      this.createResourcePermission =
        this.authService.getCreateResourcesPermissionName(this.definition.slug)
    })
  }

  async getKeyNumbers(queryParams: Params) {
    if (!this.definition.keyNumbers || !this.definition.keyNumbers.length) {
      return
    }

    const permissions = await this.authService.getPermissions()

    this.definition.keyNumbers = this.definition.keyNumbers.filter(
      (kN: KeyNumber) => !kN.permission || permissions.includes(kN.permission)
    )

    this.definition.keyNumbers.forEach((keyNumber: KeyNumber) => {
      if (keyNumber.subscription) {
        keyNumber.subscription.unsubscribe()
        keyNumber.value = null
      }

      keyNumber.subscription = timer(2000)
        .pipe(
          switchMap(() => {
            keyNumber.loading = true
            return this.resourceService.list(
              this.definition.slug,
              Object.assign(keyNumber.extraParams, queryParams)
            )
          })
        )
        .subscribe((res: number) => {
          keyNumber.loading = false
          keyNumber.value = res
        })
    })
  }

  updateQueryParamsIfMissing(
    filterForm: { [key: string]: any },
    queryParams: { [key: string]: string }
  ) {
    const notEmptyFilterForm: { [key: string]: any } = Object.keys(filterForm)
      .filter((key) => typeof filterForm[key] !== 'undefined')
      .reduce((a, key) => ({ ...a, [key]: String(filterForm[key]) }), {})

    if (JSON.stringify(notEmptyFilterForm) !== JSON.stringify(queryParams)) {
      return this.router.navigate(
        [`/${this.definition.path || this.definition.slug}`],
        {
          queryParams: notEmptyFilterForm
        }
      )
    }
  }

  setBreadcrumbs() {
    this.breadcrumbService.breadcrumbLinks.next([
      {
        path: `/${this.definition.path || this.definition.slug}`,
        label: this.definition.title
      }
    ])
  }

  exportFile(path: string) {
    window.open(`${this.config.storagePath}/${path}`)

    // Remove param and reload list
    const exportParams: any = {}
    exportParams.toXLS = null
    this.router.navigate([`/${this.definition.path || this.definition.slug}`], {
      queryParams: exportParams,
      queryParamsHandling: 'merge'
    })
  }

  onFilterValueChanged(value: any, filter: Filter) {
    // Return to page 1 when changing a filter. Reload to force reloading (not automatic in array queryParams).
    const queryParams: Params = { page: 1 }

    if (filter.property) {
      queryParams[filter.property] = value
    } else if (filter.properties) {
      Object.keys(filter.properties).forEach((property: string) => {
        queryParams[property] = value[property]
      })
    }

    // Set null values to 'null' string to prevent being override by previous values on merge.
    Object.keys(queryParams).forEach((key: string) => {
      if (queryParams[key] === null) {
        queryParams[key] = 'null'
      }
    })

    this.router.navigate([`/${this.definition.path || this.definition.slug}`], {
      queryParams,
      queryParamsHandling: 'merge'
    })
  }

  onPageChanged(page: number) {
    const queryParams: Params = { page: page.toString() }
    this.router.navigate([`/${this.definition.path || this.definition.slug}`], {
      queryParams,
      queryParamsHandling: 'merge'
    })
  }

  onOrderByChanged(event: OrderByChangedEvent) {
    const queryParams: Params = {
      page: '1',
      orderBy: event.orderBy,
      orderByDesc: event.orderByDesc || null
    }

    this.router.navigate([`/${this.definition.path || this.definition.slug}`], {
      queryParams,
      queryParamsHandling: 'merge'
    })
  }

  destroySubscriptions() {
    if (this.definition.keyNumbers && this.definition.keyNumbers.length) {
      this.definition.keyNumbers.forEach((keyNumber: KeyNumber) => {
        if (keyNumber.subscription) {
          keyNumber.subscription.unsubscribe()
        }
      })
    }
  }
}
