export const caseListTemplate = `
<!-- Heading -->
<div class="is-flex flex-mobile is-justify-content-space-between is-align-items-center mb-2">
  <div class="left-part">

    <h1 class="title is-2 has-text-weight-light">
       <span class="icon is-large">
          <i class="icon {{definition.icon}} is-size-2 has-text-link"></i>
        </span>
      {{ definition.title }}
    </h1>
  </div>
  <div class="right-part">
    <!-- Export button -->
    <a
      *ngIf="definition.buttons.indexOf(LinkType.EXPORT) > -1"
      class="button is-link ml-5 is-hidden-touch"
      routerLink="/{{ definition.path || definition.slug }}"
      [queryParams]="{ toXLS: 'true' }"
      queryParamsHandling="merge"
    >
      Exporter
    </a>
    <!-- Create button -->
    <ng-container *caseHasPermission="createResourcePermission">
    <a
      *ngIf="definition.buttons.indexOf(LinkType.CREATE) > -1"
      class="button is-link ml-5 is-hidden-touch"
      routerLink="/{{ definition.path || definition.slug }}/create"
    >
      Ajouter {{ definition.gender === 'Masculine' ? 'un' : 'une' }}
      {{ definition.nameSingular }}
    </a>
    <a
      *ngIf="definition.buttons.indexOf(LinkType.CREATE) > -1"
      class="button is-circle is-link ml-5 is-hidden-desktop"
      routerLink="/{{ definition.path || definition.slug }}/create"
    >
      <i class="icon icon-plus"></i>
    </a>
    </ng-container>
  </div>
</div>

<!-- Filters -->
<section *ngIf="filters?.length">
  <div class="card p-4 mb-6 mt-4">
    <div class="columns">
      <div class="column">
        <h2 class="title is-6 has-text-weight-bold is-uppercase has-text-grey">Filtres</h2>
      </div>
    </div>
    <div class="columns is-multiline is-align-items-flex-end" *ngIf="isFilterSelectOptionsFetched">
      <div
        class="column"
        [ngClass]="filter.className"
        *ngFor="let filter of filters"
      >
        <case-input
          [type]="filter.inputType"
          [properties]="filter.properties"
          [initialValue]="filter.value"
          [selectOptions]="filter.selectOptions"
          [label]="filter.label"
          [searchResources]="filter.searchResources"
          [readonly]="filter.readonly"
          [placeholder]="filter.placeholder"
          [secondPlaceholder]="filter.secondPlaceholder"
          [required]="filter.required"
          [helpText]="filter.helpText"
          (valueChanged)="onFilterValueChanged($event, filter)"
        ></case-input>
      </div>
    </div>
  </div>
</section>

<!-- List -->
<ng-container *ngIf="paginator">
<!-- Main container -->
<nav class="level mb-2">
  <!-- Left side -->
  <div class="level-left">
    <div class="level-item">
    <case-meta [paginator]="paginator"></case-meta>
    </div>
  </div>

  <!-- Right side -->
  <div class="level-right is-hidden-mobile">
  <div class="level-item tags" >
  <span class="tag" *ngFor="let keyNumber of definition.keyNumbers" [ngClass]="keyNumber.className || 'is-info'">
  <ng-container *ngIf="keyNumber.loading">Loading...</ng-container>
        <ng-container *ngIf="!keyNumber.loading"
          >{{ keyNumber.label }}: {{ keyNumber.value | euros }}</ng-container
        >
  </span>
  </div>
  </div>
</nav>
  <div class="card p-0 mb-6">
    <div class="table-container">
      <case-table
        [items]="paginator.data"
        [definition]="definition"
        [yields]="yields"
        [orderBy]="filterForm.orderBy"
        [orderByDesc]="filterForm.orderByDesc"
        (orderByChanged)="onOrderByChanged($event)"
      ></case-table>
    </div>
  </div>

  <case-pagination
    [paginator]="paginator"
    (pageChange)="onPageChanged($event)"
  ></case-pagination>
</ng-container>

<div *ngIf="loading" class="is-list-loading pt-7">
  <div></div>
  <div></div>
  <div></div>
  <div></div>
  <div></div>
  <div></div>
  <div></div>
  <div class="is-hidden-touch"></div>
  <div class="is-hidden-touch"></div>
  <div class="is-hidden-touch"></div>
  <div class="is-hidden-touch"></div>
  <div class="is-hidden-touch"></div>
  <div class="is-hidden-touch"></div>
  <div class="is-hidden-touch"></div>
</div>
`
