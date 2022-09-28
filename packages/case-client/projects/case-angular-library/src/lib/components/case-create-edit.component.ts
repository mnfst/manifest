import { HttpErrorResponse } from '@angular/common/http'
import { Component, EventEmitter, Output } from '@angular/core'
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  Validators
} from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'

import { ResourceMode } from '../enums/resource-mode.enum'
import { FieldSpecialRule } from '../interfaces/field-special-rule.interface'
import { Field } from '../interfaces/field.interface'
import { ResourceDefinition } from '../interfaces/resource-definition.interface'
import { BreadcrumbService } from '../services/breadcrumb.service'
import { FlashMessageService } from '../services/flash-message.service'
import { ResourceService } from '../services/resource.service'

@Component({
  template: 'NO UI TO BE FOUND HERE!'
})
export class CaseCreateEditComponent {
  item: any
  definition: ResourceDefinition
  fieldSpecialRules?: FieldSpecialRule[] = []
  editModeSpecialRules?: FieldSpecialRule[] = []

  form: FormGroup
  resolvedFields: Field[]
  fields: Field[]

  mode: ResourceMode
  loading: boolean
  showErrors: boolean
  isModal: boolean
  redirectTo: string
  redirectToQueryParams: { [key: string]: string }
  patchURL: string

  ResourceMode = ResourceMode

  @Output() submitSuccessful: EventEmitter<void> = new EventEmitter()

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private breadcrumbService: BreadcrumbService,
    private resourceService: ResourceService,
    private flashMessageService: FlashMessageService,
    private activatedRoute?: ActivatedRoute
  ) {}

  async initCreateEditView(): Promise<FormGroup> {
    if (typeof this.activatedRoute?.snapshot?.data?.mode !== 'undefined') {
      this.mode = this.activatedRoute?.snapshot?.data?.mode
    }
    const queryParams: { [key: string]: string } =
      this.activatedRoute?.snapshot?.queryParams
    const params: { [key: string]: string } =
      this.activatedRoute?.snapshot?.params

    if (queryParams?.redirectTo) {
      this.redirectTo = queryParams?.redirectTo
    }
    if (queryParams?.redirectToQueryParams) {
      this.redirectToQueryParams =
        queryParams?.redirectToQueryParams &&
        JSON.parse(queryParams.redirectToQueryParams)
    }

    if (queryParams?.specialRules) {
      this.fieldSpecialRules =
        (queryParams?.specialRules && JSON.parse(queryParams.specialRules)) ||
        []
    }

    if (this.mode === ResourceMode.Edit && !this.item) {
      this.item = await this.resourceService
        .show(this.definition.slug, params.id)
        .then((itemRes) => itemRes)
    }
    this.resolvedFields = await this.resolveFields(this.fields)
    this.form = await this.generateForm(this.resolvedFields)

    if (!this.isModal) {
      this.setBreadcrumbs()
    }

    return this.form
  }

  // Return a promise of an array of fields with all async items retrieved.
  async resolveFields(fields: Field[]): Promise<Field[]> {
    const asyncFieldPromises: Promise<any>[] = []

    if (this.mode === ResourceMode.Edit) {
      Object.assign(this.fieldSpecialRules, this.editModeSpecialRules || {})
    }

    fields.forEach((field: Field) => {
      if (this.mode === ResourceMode.Create && field.createValidators) {
        field.validators = field.createValidators
      }
      if (this.mode === ResourceMode.Edit && field.editValidators) {
        field.validators = field.editValidators
      }
      if (!field.validators) {
        field.validators = []
      }
      if (field.required) {
        field.validators.push(Validators.required)
      }

      if (typeof field.selectOptions === 'function') {
        asyncFieldPromises.push(
          field.selectOptions().then((res) => {
            field.selectOptions = res
          })
        )
      }

      // Apply special rules.
      const specialRuleForField: FieldSpecialRule =
        field.id &&
        this.fieldSpecialRules.find((rule) => rule.fieldId === field.id)
      if (specialRuleForField) {
        field.hidden = specialRuleForField.hidden
        field.forcedValue = specialRuleForField.forcedValue
      }
    })

    return Promise.all(asyncFieldPromises).then(() => fields)
  }

  // Create ReactiveForm based on resource definition.
  async generateForm(fields: Field[]): Promise<FormGroup> {
    const form: FormGroup = this.formBuilder.group({})
    fields.forEach(async (field: Field) => {
      if (field.property) {
        form.addControl(
          field.property,
          await this.generateControl(field, field.property)
        )
      } else if (field.properties) {
        Object.keys(field.properties || []).forEach(
          async (property: string) => {
            // Get name of the property and path if different from controlName.
            const controlName: string = field.properties[property]

            form.addControl(
              controlName,
              await this.generateControl(field, property, controlName)
            )
          }
        )
      }
    })

    return form
  }

  async generateControl(
    field: Field,
    property: string,
    controlName?: string
  ): Promise<AbstractControl | FormArray> {
    if (!controlName) {
      controlName = property
    }

    const retrievedItemProp: string = field.retrievedItemProperties
      ? field.retrievedItemProperties[
          Object.keys(field.retrievedItemProperties).find(
            (key) => key === controlName
          )
        ]
      : null

    const itemValue: any = this.getItemValue(
      this.item,
      retrievedItemProp || controlName
    )

    // Set initial value of field, in order: forcedValue, itemValue (fetched), initialValue, null.
    if (field.forcedValue) {
      field.initialValue = field.forcedValue
    } else if (itemValue !== null) {
      field.initialValue = itemValue
    } else if (field.initialValue) {
      if (typeof field.initialValue === 'function') {
        field.initialValue = await field.initialValue().then((res) => res)
      }
    } else {
      field.initialValue = null
    }

    // If the field is an array, create a FormArray.
    return Array.isArray(field.initialValue)
      ? this.formBuilder.array(field.initialValue as any[], field.validators)
      : this.formBuilder.control(field.initialValue, field.validators)
  }

  setBreadcrumbs() {
    this.breadcrumbService.breadcrumbLinks.next([
      {
        path: `/${this.definition.path || this.definition.slug}`,
        label: this.definition.title
      },
      {
        label: `${this.mode === ResourceMode.Create ? 'Ajouter' : 'Modifier'} ${
          this.definition.gender === 'Masculine' ? 'un' : 'une'
        } ${this.definition.nameSingular}`
      }
    ])
  }

  onValueChanged(newValue: any, field: Field) {
    const setValueControl = (value: any, controlName: string) => {
      if (Array.isArray(value)) {
        // If newValue is array we have to reset the control by putting a new FormArray of FormControls.
        this.form.setControl(
          controlName,
          new FormArray(value.map((v) => new FormControl(v)))
        )
      } else {
        // Prevent wrong value from being set from HTML selects.
        if (value === 'null') {
          value = null
        }

        this.form.get(controlName).setValue(value)
      }
    }

    if (field.property) {
      setValueControl(newValue, field.property)
    } else if (field.properties) {
      Object.keys(field.properties || []).forEach((fieldProp: string) => {
        // Get name of the property and path if different from controlName.
        const controlName: string = field.properties[fieldProp]

        setValueControl(newValue[fieldProp], controlName)
      })
    }

    if (field.onChange) {
      field.onChange(newValue, this.resolvedFields)
    }
  }

  submit() {
    if (this.form.invalid) {
      this.showErrors = true

      this.debugFindInvalidControls()

      return this.flashMessageService.error(
        `Impossible d'envoyer le formulaire: certains champs n'ont pas été remplis correctement.`
      )
    }

    let action: Promise<any>

    switch (this.mode) {
      case ResourceMode.Create:
        action = this.resourceService.store(
          this.definition.slug,
          this.form.value
        )
        break
      case ResourceMode.Edit:
        action = this.resourceService.update(
          this.definition.slug,
          this.item.id,
          this.form.value
        )
        break
      case ResourceMode.Patch:
        action = this.resourceService.patch(this.patchURL, this.form.value)
        break
    }

    this.loading = true
    action.then(
      (res: { id: number }) => {
        this.flashMessageService.success(
          `${this.definition.gender === 'Masculine' ? 'Le' : 'La'} ${
            this.definition.nameSingular
          } a bien été ${
            this.mode === ResourceMode.Create
              ? this.definition.gender === 'Masculine'
                ? 'créé'
                : 'créée'
              : this.definition.gender === 'Masculine'
              ? 'mis à jour'
              : 'mise à jour'
          }.`
        )
        this.loading = false

        this.form.reset()
        this.submitSuccessful.emit()

        if (this.isModal) {
          this.close()
        }
        if (!this.redirectTo) {
          if (this.definition.hasDetailPage) {
            if (this.mode === ResourceMode.Create) {
              this.redirectTo = `/${
                this.definition.path || this.definition.slug
              }/${res.id}`
            } else if (this.mode === ResourceMode.Edit) {
              this.redirectTo = this.router.url.replace('/edit', '')
            } else {
              this.redirectTo = `/${
                this.definition.path || this.definition.slug
              }`
            }
          } else {
            if (this.definition.hasListPage) {
              this.redirectTo = `/${
                this.definition.path || this.definition.slug
              }`
            } else {
              this.redirectTo = '/'
            }
          }
        }

        if (!this.redirectToQueryParams) {
          this.redirectToQueryParams = {}
        }

        // Add query params in redirect URL to plug custom behavior on front (onboarding, etc.).
        if (this.mode === ResourceMode.Create) {
          this.redirectToQueryParams.resourceCreated = `${this.definition.className}-${res.id}`
        } else if (this.mode === ResourceMode.Edit) {
          this.redirectToQueryParams.resourceEdited = `${this.definition.className}-${res.id}`
        }

        // Add timeout to prevent loading resource before finishing updating it.
        setTimeout(
          () =>
            this.router.navigate([this.redirectTo], {
              queryParams: Object.assign(this.redirectToQueryParams, {
                t: new Date().getTime()
              }),
              queryParamsHandling: 'merge'
            }),
          200
        )
      },
      (err: HttpErrorResponse) => {
        this.loading = false
        this.flashMessageService.error(
          err && err.error && err.error.message
            ? err.error.message
            : `Une erreur à eu lieu. La ressource n'a pas pu être sauvegardée.`
        )
      }
    )
  }

  // Recursive getter to retrieve nested properties.
  getItemValue(item: any, propName: string): any | any[] {
    let value: any
    try {
      value = propName.split('.').reduce((prev, current) => prev[current], item)
    } catch (error) {
      value = null
    }
    return value
  }

  getFieldById(id: string): Field {
    return this.resolvedFields.find((f) => f.id === id)
  }

  // Reset Form Control from Field.
  async resetFieldFormControls(field: Field): Promise<void> {
    if (field.property) {
      this.form.setControl(
        field.property,
        await this.generateControl(field, field.property)
      )
    } else if (field.properties)
      [
        Object.keys(field.properties).forEach(async (property: string) => {
          const controlName: string = field.properties[property]

          this.form.setControl(
            controlName,
            await this.generateControl(field, property, controlName)
          )
        })
      ]
  }

  // Set custom value to Field.
  // TODO: We could write this better if we remove the "initialValue" concept.
  setFieldValue(field: Field, value: any): void {
    field.forcedValue = value
    field.initialValue = value
    this.resetFieldFormControls(field)
  }

  // Debug feature.
  private debugFindInvalidControls(): AbstractControl[] {
    const invalid = []
    const controls = this.form.controls
    for (const name in controls) {
      if (controls[name].invalid) {
        invalid.push(name)
      }
    }
    console.log('Invalid controls :', invalid)
    return invalid
  }

  close() {
    // Empty function to be override in modal.
  }
}
