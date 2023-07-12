import { Component } from '@angular/core'
import { FormBuilder, FormControl, FormGroup } from '@angular/forms'
import { ActivatedRoute, Data, Params, Router } from '@angular/router'
import { combineLatest, of } from 'rxjs'
import { PropType } from '~shared/enums/prop-type.enum'
import { EntityMeta } from '~shared/interfaces/entity-meta.interface'

import { BreadcrumbService } from '../../../services/breadcrumb.service'
import { FlashMessageService } from '../../../services/flash-message.service'
import { SettingsService } from '../../../services/settings.service'
import { DynamicEntityService } from '../../dynamic-entity.service'

@Component({
  selector: 'app-dynamic-entity-create-edit',
  templateUrl: './dynamic-entity-create-edit.component.html',
  styleUrls: ['./dynamic-entity-create-edit.component.scss']
})
export class DynamicEntityCreateEditComponent {
  entities: EntityMeta[] = []
  entity: EntityMeta

  item: any

  form: FormGroup = this.formBuilder.group({})
  edit: boolean

  PropType = PropType

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private dynamicEntityService: DynamicEntityService,
    private formBuilder: FormBuilder,
    private breadcrumbService: BreadcrumbService,
    private flashMessageService: FlashMessageService,
    settingsService: SettingsService
  ) {
    settingsService.loadSettings().subscribe((res) => {
      this.entities = res.entities
    })
  }

  async ngOnInit(): Promise<void> {
    of(this.entities).subscribe((_entities: EntityMeta[]) => {
      combineLatest([
        this.activatedRoute.params,
        this.activatedRoute.data
      ]).subscribe(async ([params, data]: [Params, Data]) => {
        this.edit = data['edit']

        this.entity = this.entities.find(
          (entity) => entity.definition.slug === params['entitySlug']
        )

        if (!this.entity) {
          this.router.navigate(['/404'])
        }

        if (this.edit) {
          this.item = await this.dynamicEntityService.show(
            this.entity.definition.slug,
            params['id']
          )

          this.breadcrumbService.breadcrumbLinks.next([
            {
              label: this.entity.definition.namePlural,
              path: `/dynamic/${this.entity.definition.slug}`
            },
            {
              label: this.item[this.entity.definition.propIdentifier],
              path: `/dynamic/${this.entity.definition.slug}/${this.item.id}`
            },
            {
              label: 'Edit'
            }
          ])
        } else {
          this.breadcrumbService.breadcrumbLinks.next([
            {
              label: this.entity.definition.namePlural,
              path: `/dynamic/${this.entity.definition.slug}`
            },
            {
              label: `Create a new ${this.entity.definition.nameSingular}`
            }
          ])
        }

        this.entity.props.forEach((prop) => {
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
    if (this.edit) {
      this.dynamicEntityService
        .update(this.entity.definition.slug, this.item.id, this.form.value)
        .then(() => {
          this.flashMessageService.success(
            `The ${this.entity.definition.nameSingular} has been updated`
          )
          this.router.navigate(['/dynamic', this.entity.definition.slug])
        })
    } else {
      this.dynamicEntityService
        .create(this.entity.definition.slug, this.form.value)
        .then((res: { identifiers: { id: number }[] }) => {
          this.flashMessageService.success(
            `The ${this.entity.definition.nameSingular} has been created`
          )
          this.router.navigate([
            '/dynamic',
            this.entity.definition.slug,
            res.identifiers[0].id
          ])
        })
    }
  }
}
