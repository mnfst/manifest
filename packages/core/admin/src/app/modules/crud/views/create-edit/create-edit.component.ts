import { Component } from '@angular/core'
import { FormBuilder, FormControl, FormGroup } from '@angular/forms'
import { ActivatedRoute, Data, Params, Router } from '@angular/router'
import {
  EntityManifest,
  PropType,
  PropertyManifest,
  RelationshipManifest
} from '@repo/types'
import { combineLatest } from 'rxjs'

import { getDtoPropertyNameFromRelationship } from '@repo/helpers'

import { HttpErrorResponse } from '@angular/common/http'
import { ValidationError } from '../../../../typescript/interfaces/validation-error.interface'
import { BreadcrumbService } from '../../../shared/services/breadcrumb.service'
import { FlashMessageService } from '../../../shared/services/flash-message.service'
import { ManifestService } from '../../../shared/services/manifest.service'
import { CrudService } from '../../services/crud.service'

@Component({
  selector: 'app-create-edit',
  templateUrl: './create-edit.component.html',
  styleUrls: ['./create-edit.component.scss']
})
export class CreateEditComponent {
  item: any
  entityManifest: EntityManifest
  errors: { [propName: string]: string[] } = {}

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
    private breadcrumbService: BreadcrumbService,
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

      if (this.edit) {
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

        this.breadcrumbService.breadcrumbLinks.next([
          {
            label: this.entityManifest.namePlural,
            path: `/dynamic/${this.entityManifest.slug}`
          },
          {
            label: this.item[this.entityManifest.mainProp],
            path: `/dynamic/${this.entityManifest.slug}/${this.item.id}`
          },
          {
            label: 'Edit'
          }
        ])
      } else {
        this.breadcrumbService.breadcrumbLinks.next([
          {
            label: this.entityManifest.namePlural,
            path: `/dynamic/${this.entityManifest.slug}`
          },
          {
            label: `Create a new ${this.entityManifest.nameSingular}`
          }
        ])
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

      this.entityManifest.relationships
        .filter((r) => r.type !== 'one-to-many')
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
    })
  }

  /**
   * Change event handler for form controls.
   *
   * @param params the new value and the property name
   *
   */
  onChange(params: { newValue: any; propName: string }): void {
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

  submit(): void {
    this.loading = true
    if (this.edit) {
      this.crudService
        .update(this.entityManifest.slug, this.item.id, this.form.value)
        .then(() => {
          this.loading = false
          this.flashMessageService.success(
            `The ${this.entityManifest.nameSingular} has been updated`
          )
          this.router.navigate(['/dynamic', this.entityManifest.slug])
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
        .then((createdItem: { id: number }) => {
          this.loading = false
          this.flashMessageService.success(
            `The ${this.entityManifest.nameSingular} has been created successfully`
          )
          this.router.navigate([
            '/dynamic',
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

  getErrorMessages(validationErrors: ValidationError[]): {
    [name: string]: string[]
  } {
    const errorMessages: { [name: string]: string[] } = {}

    validationErrors.forEach((validationError: ValidationError) => {
      errorMessages[validationError.property] = Object.values(
        validationError.constraints
      )
    })

    return errorMessages
  }
}
