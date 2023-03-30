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

  <div class="columns" *ngIf="isOnboarding">
    <div class="column is-12 is-10-desktop is-offset-1-desktop is-8-fullhd is-offset-2-fullhd">
      <article class="message is-success has-text-left mt-4" *ngIf="isOnboarding">
        <div class="message-body has-background-light">
        <p class="has-text-dark  title is-1 ">
            Welcome to the <strong>{{ definition.nameSingular }}</strong> create-edit page 👋
        </p>
          <p class="has-text-dark mt-4">
            This page allows users to add and update {{ definition.namePlural }}.
          </p>
          <div class="buttons mt-3 mb-4">
          <a class="button is-outlined is-success" href="https://docs.case.app/#/create-edit/create-edit" target="_blank">See how "create-edit" views works</a>
          <a class="button is-outlined is-success" href="https://docs.case.app/#/create-edit/fields"  target="_blank">See available fields</a>
          </div>
          <p class="message is-warning p-3 has-text-dark is-size-5">
          ℹ️ To hide this message, set the <span class="tag is-medium is-white-ter">isOnboarding</span> property to <strong>false</strong> in your environment file.
          </p>
        </div>
        
      </article>
    </div>
  </div>

  <form [formGroup]="form" *ngIf="form">
    <div class="card p-4">
      <!-- Fields -->
      <div class="columns is-multiline is-align-items-flex-end">
        <ng-container *ngFor="let field of resolvedFields">
          <ng-container *caseHasPermission="field.permission">
            <div
              class="column is-flex is-align-items-flex-end {{ field.className || 'is-6' }}"
              [id]="field.id"
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
