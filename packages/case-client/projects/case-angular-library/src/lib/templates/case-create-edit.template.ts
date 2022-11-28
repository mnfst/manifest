export const caseCreateEditTemplate = `
<section>
  <div class="is-flex is-justify-content-space-between is-align-items-center mb-5">
    <div class="left-part">
      <h1 class="title is-2 has-text-weight-light" *ngIf="mode === ResourceMode.Create"> 
       <span class="icon is-large">
          <i class="icon {{definition.icon}} is-size-2 has-text-link"></i>
        </span>
        Add a {{ definition.nameSingular }}
      </h1>
      <h1 class="title is-2 has-text-weight-light" *ngIf="mode === ResourceMode.Edit">
        Update a {{ definition.nameSingular }}
      </h1>
    </div>
    <div class="right-part">
      <button
        class="button is-link is-hidden-touch"
        (click)="submit()"
        [ngClass]="{ 'is-loading': loading }"
      >
        Save
      </button>
      <button
        class="button is-link is-rounded is-hidden-desktop"
        (click)="submit()"
        [ngClass]="{ 'is-loading': loading }"
      >
        <i class="icon icon-save"></i>
      </button>
    </div>
  </div>

  <!-- TODO: Create edit Onboarding -->
  <div class="columns" style="background-color: hotpink" *ngIf="isOnboarding">
  <div class="column">
    <br /><br />
    <p>Welcome to the create-edit page for {{ definition.nameSingular }}.</p>
    <p>This page will allow users to add and edit {{ definition.namePlural }}.</p>
    <p>You can customize the form below to your needs and chose among different input types (text, dates, files, select dropdowns...) See the doc (link).</p>
    <p>Remove the isOnboarding prop to hide this message :)</p>
  </div>
  </div>

  <form [formGroup]="form" *ngIf="form">
    <div class="card p-4">
      <!-- Fields -->
      <div class="columns is-multiline is-align-items-flex-end">
        <ng-container *ngFor="let field of resolvedFields">
          <ng-container *caseHasPermission="field.permission">
            <div
              class="column is-flex is-align-items-flex-end"
              [id]="field.id"
              [ngClass]="field.className"
              *ngIf="!field.hidden"
            >
              <case-input
                [type]="field.inputType"
                [label]="field.label"
                [placeholder]="field.placeholder"
                [secondPlaceholder]="field.secondPlaceholder"
                [initialValue]="field.initialValue"
                [searchResources]="field.searchResources"
                [resourceName]="definition.slug"
                [searchParams]="field.searchParams"
                [maxSelectedItems]="field.maxSelectedItems"
                [selectOptions]="field.selectOptions"
                [min]="field.min"
                [max]="field.max"
                [copyDateFromOnDateTo]="field.copyDateFromOnDateTo"
                [readonly]="field.readonly"
                [validators]="field.validators"
                [helpText]="field.helpText"
                [showErrors]="showErrors"
                (valueChanged)="onValueChanged($event, field)"
              ></case-input>
            </div>
          </ng-container>
        </ng-container>
      </div>
    </div>
  </form>
</section>
`
