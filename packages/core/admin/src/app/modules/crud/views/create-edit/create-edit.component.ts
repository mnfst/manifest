import { Component } from '@angular/core'
import { FormArray, FormBuilder, FormControl, FormGroup } from '@angular/forms'
import { ActivatedRoute, Data, Params, Router } from '@angular/router'
import {
  BaseEntity,
  EntityManifest,
  PropType,
  PropertyManifest,
  RelationshipManifest
} from '@repo/types'
import { combineLatest } from 'rxjs'

import { getDtoPropertyNameFromRelationship } from '@repo/common'

import { HttpErrorResponse } from '@angular/common/http'
import { ValidationError } from '../../../../typescript/interfaces/validation-error.interface'
import { FlashMessageService } from '../../../shared/services/flash-message.service'
import { ManifestService } from '../../../shared/services/manifest.service'
import { CrudService } from '../../services/crud.service'
import { MetaService } from '../../../shared/services/meta.service'

@Component({
  selector: 'app-create-edit',
  templateUrl: './create-edit.component.html',
  styleUrls: ['./create-edit.component.scss']
})
export class CreateEditComponent {
  item: any
  entityManifest: EntityManifest
  nestedEntityManifests: { [relationshipName: string]: EntityManifest } = {}
  errors: { [propName: string]: string[] } = {}

  singleMode: boolean
  form: FormGroup = this.formBuilder.group({})
  edit: boolean
  loading: boolean
  PropType = PropType

  constructor(
    private crudService: CrudService,
    private manifestService: ManifestService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private formBuilder: FormBuilder,
    private metaService: MetaService,
    private flashMessageService: FlashMessageService
  ) {}

  async ngOnInit(): Promise<void> {
    combineLatest([
      this.activatedRoute.params,
      this.activatedRoute.data
    ]).subscribe(async ([params, data]: [Params, Data]) => {
      this.edit = data['edit']

      this.entityManifest = await this.manifestService.getEntityManifest({
        slug: params['entitySlug']
      })

      if (!this.entityManifest) {
        this.router.navigate(['/404'])
      }

      this.singleMode = this.activatedRoute.snapshot.data['mode'] === 'single'

      if (this.edit) {
        try {
          if (this.singleMode) {
            this.item = await this.crudService.showSingle(
              this.entityManifest.slug
            )
          } else {
            this.item = await this.crudService.show(
              this.entityManifest.slug,
              params['id'],
              {
                relations: this.entityManifest.relationships
                  .filter((r) => r.type !== 'one-to-many')
                  .filter((r) => r.type !== 'many-to-many' || r.owningSide)
                  .map((r) => r.name)
              }
            )
          }
        } catch (_err) {
          this.router.navigate(['/404'])
        }
        this.metaService.setTitle(`Edit ${this.entityManifest.nameSingular}`)
      } else {
        this.metaService.setTitle(
          `Create a new ${this.entityManifest.nameSingular}`
        )
      }

      this.entityManifest.properties.forEach((prop: PropertyManifest) => {
        let value: any = null

        if (this.item) {
          value = this.item[prop.name]
          // Special case for boolean props: we need to set the value to false if it's not set.
        } else if (prop.type === PropType.Boolean) {
          value = false
        }

        this.form.addControl(prop.name, new FormControl(value))
      })

      // Show relationships in the form for many-to-one and many-to-many (owning side only).
      this.entityManifest.relationships
        .filter((r) => r.type !== 'one-to-many' && r.type !== 'one-to-one')
        .filter((r) => r.type !== 'many-to-many' || r.owningSide)
        .forEach((relationship: RelationshipManifest) => {
          let value: number | number[] = null

          if (relationship.type === 'many-to-one') {
            value = this.item ? this.item[relationship.name]?.id : null
          } else if (relationship.type === 'many-to-many') {
            value = this.item
              ? this.item[relationship.name].map((item: any) => item.id)
              : []
          }

          this.form.addControl(
            getDtoPropertyNameFromRelationship(relationship),
            new FormControl(value)
          )
        })

      // Show nested relationships in the form.
      this.entityManifest.relationships
        .filter((r) => r.nested)
        .forEach(async (relationship: RelationshipManifest) => {
          const isMultiple: boolean = relationship.type !== 'one-to-one'

          // Get entity manifest.
          const nestedEntityManifest: EntityManifest =
            await this.manifestService.getEntityManifest({
              className: relationship.entity
            })

          this.nestedEntityManifests[relationship.name] = nestedEntityManifest

          // Generate controls for nested items.
          this.form.addControl(
            relationship.name,
            isMultiple ? this.formBuilder.array([]) : this.formBuilder.group({})
          )

          // Include existing items in "edit" mode.
          // TODO: Edit for non-multiple nested relationships.
          if (
            this.edit &&
            this.item &&
            Array.isArray(this.item[relationship.name])
          ) {
            this.item[relationship.name].forEach((item: BaseEntity) => {
              this.addNestedItem(relationship, item)
            })
          }
        })
    })
  }

  /**
   * Change event handler for form controls.
   *
   * @param params the new value and the property name
   *
   */
  onChange(params: { newValue: unknown; propName: string }): void {
    this.form.controls[params.propName].setValue(params.newValue)
  }

  /**
   * Change event handler for relationship form controls.
   *
   * @param params the new value and the relationship manifest
   *
   */
  onRelationChange(params: {
    newValue: any
    relationship: RelationshipManifest
  }): void {
    return this.onChange({
      newValue: params.newValue,
      propName: getDtoPropertyNameFromRelationship(params.relationship)
    })
  }

  onNestedItemChange(params: {
    newValue: unknown
    relationship: RelationshipManifest
    propName: string
    index?: number
  }): void {
    let nestedItem: FormGroup

    if (params.index === undefined) {
      nestedItem = this.form.get(params.relationship.name) as FormGroup
    } else {
      // If index is provided, we are dealing with a FormArray.
      // We need to get the specific item in the array.
      const nestedFormArray: FormArray = this.getMultipleRelations(
        params.relationship.name
      )

      nestedItem = nestedFormArray.at(params.index) as FormGroup
    }

    nestedItem.controls[params.propName].setValue(params.newValue)
  }

  submit(): void {
    this.loading = true
    if (this.edit) {
      const updateAction: Promise<BaseEntity> = this.singleMode
        ? this.crudService.updateSingle(
            this.entityManifest.slug,
            this.form.value
          )
        : this.crudService.update(
            this.entityManifest.slug,
            this.item.id,
            this.form.value
          )

      updateAction
        .then(() => {
          this.loading = false
          this.flashMessageService.success(
            `The ${this.entityManifest.nameSingular} has been updated`
          )
          this.router.navigate([
            this.singleMode ? '/singles' : '/collections',
            this.entityManifest.slug
          ])
        })
        .catch((err: HttpErrorResponse) => {
          if (err.status === 400) {
            this.errors = this.getErrorMessages(err.error)
          }

          this.loading = false
          this.flashMessageService.error(
            `The ${this.entityManifest.nameSingular} could not be updated`
          )
        })
    } else {
      this.crudService
        .create(this.entityManifest.slug, this.form.value)
        .then((createdItem: { id: string }) => {
          this.loading = false
          this.flashMessageService.success(
            `The ${this.entityManifest.nameSingular} has been created successfully`
          )
          this.router.navigate([
            '/collections',
            this.entityManifest.slug,
            createdItem.id
          ])
        })
        .catch((err: HttpErrorResponse) => {
          if (err.status === 400) {
            this.errors = this.getErrorMessages(err.error)
          }

          this.loading = false
          this.flashMessageService.error(
            `Error: the ${
              this.entityManifest.nameSingular
            } could not be created:
              ${Object.values(this.errors).join(', ')}
            `
          )
        })
    }
  }

  /**
   * Add a new item to a nested relationship.
   *
   * @param relationship the relationship manifest
   */
  async addNestedItem(
    relationship: RelationshipManifest,
    item?: BaseEntity
  ): Promise<void> {
    // Create a new form group for the nested item
    const newNestedItem = await this.createNestedItemFormGroup(
      relationship,
      item
    )

    // Add the id control if editing an existing item.
    if (item && item.id) {
      newNestedItem.addControl('id', new FormControl(item.id))
    }

    const isMultiple: boolean = relationship.type !== 'one-to-one'

    if (!isMultiple) {
      this.form.setControl(relationship.name, newNestedItem as FormGroup)
      return
    } else {
      const nestedFormArray: FormArray = this.form.get(
        relationship.name
      ) as FormArray

      // Add the new nested item to the form array
      nestedFormArray.push(newNestedItem)

      return
    }
  }

  /**
   * Create a new form group for a nested item.
   *
   * @param relationship the relationship manifest
   * @param item the item to populate the form group with (optional)
   *
   * @returns A promise that resolves to the new form group.
   */
  async createNestedItemFormGroup(
    relationship: RelationshipManifest,
    item?: any
  ): Promise<FormGroup> {
    const nestedEntityManifest: EntityManifest =
      await this.manifestService.getEntityManifest({
        className: relationship.entity
      })

    // Create a new form group for the nested item
    const newNestedItem = this.formBuilder.group({})

    // Add properties to the nested item form group
    nestedEntityManifest.properties.forEach((prop: PropertyManifest) => {
      newNestedItem.addControl(
        prop.name,
        new FormControl(item ? item[prop.name] : null)
      )
    })

    return newNestedItem
  }

  /**
   * Remove a nested item from the form array.
   *
   * @param relationship the relationship manifest
   * @param index the index of the item to remove
   */
  removeNestedItem(relationship: RelationshipManifest, index: number): void {
    const nestedFormArray: FormArray = this.form.get(
      relationship.name
    ) as FormArray
    nestedFormArray.removeAt(index)
  }

  removeSingleNestedItem(relationship: RelationshipManifest): void {
    this.form.setControl(relationship.name, this.formBuilder.group({}))
  }

  getMultipleRelations(relationshipName: string): FormArray {
    return this.form.get(relationshipName) as FormArray
  }

  getSingleRelation(relationshipName: string): FormGroup {
    if (JSON.stringify(this.form.get(relationshipName).value) === '{}') {
      return null
    }
    return this.form.get(relationshipName) as FormGroup
  }

  /**
   * Get error messages from validation errors.
   *
   * @param validationErrors the validation errors
   * @returns an object with property names as keys and an array of error messages as values
   */
  getErrorMessages(validationErrors: ValidationError[]): {
    [name: string]: string[]
  } {
    const errorMessages: { [name: string]: string[] } = {}

    validationErrors.forEach((validationError: ValidationError) => {
      errorMessages[validationError.property] = Object.values(
        validationError.constraints
      )

      // If the error is a nested property, add it to the error messages.
      if (validationError.property.includes('.')) {
        const nestedProperty = validationError.property.split('.')[1]
        errorMessages[nestedProperty] = [
          ...(errorMessages[nestedProperty] || []),
          ...Object.values(validationError.constraints)
        ]
      }
    })

    return errorMessages
  }
}
