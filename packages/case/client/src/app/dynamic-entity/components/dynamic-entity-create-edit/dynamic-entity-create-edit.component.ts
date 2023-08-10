import { Component } from '@angular/core'
import { FormBuilder, FormControl, FormGroup } from '@angular/forms'
import { ActivatedRoute, Data, Params, Router } from '@angular/router'
import { combineLatest } from 'rxjs'
import { PropType } from '~shared/enums/prop-type.enum'
import { EntityMeta } from '~shared/interfaces/entity-meta.interface'

import { PropertyDescription } from '../../../../../../shared/interfaces/property-description.interface'
import { BreadcrumbService } from '../../../services/breadcrumb.service'
import { FlashMessageService } from '../../../services/flash-message.service'
import { DynamicEntityService } from '../../dynamic-entity.service'

@Component({
  selector: 'app-dynamic-entity-create-edit',
  templateUrl: './dynamic-entity-create-edit.component.html',
  styleUrls: ['./dynamic-entity-create-edit.component.scss']
})
export class DynamicEntityCreateEditComponent {
  item: any
  entityMeta: EntityMeta
  props: PropertyDescription[]

  form: FormGroup = this.formBuilder.group({})
  edit: boolean
  loading: boolean
  PropType = PropType

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private formBuilder: FormBuilder,
    private breadcrumbService: BreadcrumbService,
    private flashMessageService: FlashMessageService,
    private dynamicEntityService: DynamicEntityService
  ) {}

  async ngOnInit(): Promise<void> {
    this.dynamicEntityService
      .loadEntityMeta()
      .subscribe((res: EntityMeta[]) => {
        if (!res.length) {
          return
        }

        combineLatest([
          this.activatedRoute.params,
          this.activatedRoute.data
        ]).subscribe(async ([params, data]: [Params, Data]) => {
          this.edit = data['edit']

          this.entityMeta = res.find(
            (entity) => entity.definition.slug === params['entitySlug']
          )

          if (!this.entityMeta) {
            this.router.navigate(['/404'])
          }

          this.props = this.entityMeta.props.filter(
            (prop) => !prop.options.isHiddenInCreateEdit
          )

          if (this.edit) {
            this.item = await this.dynamicEntityService.show(
              this.entityMeta.definition.slug,
              params['id']
            )

            this.breadcrumbService.breadcrumbLinks.next([
              {
                label: this.entityMeta.definition.namePlural,
                path: `/dynamic/${this.entityMeta.definition.slug}`
              },
              {
                label: this.item[this.entityMeta.definition.propIdentifier],
                path: `/dynamic/${this.entityMeta.definition.slug}/${this.item.id}`
              },
              {
                label: 'Edit'
              }
            ])
          } else {
            this.breadcrumbService.breadcrumbLinks.next([
              {
                label: this.entityMeta.definition.namePlural,
                path: `/dynamic/${this.entityMeta.definition.slug}`
              },
              {
                label: `Create a new ${this.entityMeta.definition.nameSingular}`
              }
            ])
          }

          this.entityMeta.props.forEach((prop) => {
            this.form.addControl(
              prop.propName,
              new FormControl(this.item ? this.item[prop.propName] : null)
            )
          })
        })
      })
  }

  onChange(params: { newValue: any; propName: string }): void {
    this.form.controls[params.propName].setValue(params.newValue)
  }

  submit(): void {
    this.loading = true
    if (this.edit) {
      this.dynamicEntityService
        .update(this.entityMeta.definition.slug, this.item.id, this.form.value)
        .then(() => {
          this.loading = false
          this.flashMessageService.success(
            `The ${this.entityMeta.definition.nameSingular} has been updated`
          )
          this.router.navigate(['/dynamic', this.entityMeta.definition.slug])
        })
        .catch(() => {
          this.loading = false
          this.flashMessageService.error(
            `The ${this.entityMeta.definition.nameSingular} could not be updated`
          )
        })
    } else {
      this.dynamicEntityService
        .create(this.entityMeta.definition.slug, this.form.value)
        .then((res: { identifiers: { id: number }[] }) => {
          this.loading = false
          this.flashMessageService.success(
            `Error: the ${this.entityMeta.definition.nameSingular} has been created`
          )
          this.router.navigate([
            '/dynamic',
            this.entityMeta.definition.slug,
            res.identifiers[0].id
          ])
        })
        .catch(() => {
          this.loading = false
          this.flashMessageService.error(
            `Error: the ${this.entityMeta.definition.nameSingular} could not be created`
          )
        })
    }
  }
}
