import { Component } from '@angular/core'
import { FormBuilder, FormControl, FormGroup } from '@angular/forms'
import { ActivatedRoute, Data, Params, Router } from '@angular/router'
import {
  EntityManifest,
  PropType,
  PropertyManifest,
  RelationshipManifest
} from '@casejs/types'
import { combineLatest } from 'rxjs'

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
          params['id']
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

      this.entityManifest.belongsTo.forEach(
        (relationship: RelationshipManifest) => {
          const value: number = this.item ? this.item[relationship.name] : null

          this.form.addControl(relationship.name, new FormControl(value))
        }
      )
    })
  }

  onChange(params: { newValue: any; propName: string }): void {
    this.form.controls[params.propName].setValue(params.newValue)
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
        .then((res: { identifiers: { id: number }[] }) => {
          this.loading = false
          this.flashMessageService.success(
            `The ${this.entityManifest.nameSingular} has been created successfully`
          )
          this.router.navigate([
            '/dynamic',
            this.entityManifest.slug,
            res.identifiers[0].id
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
