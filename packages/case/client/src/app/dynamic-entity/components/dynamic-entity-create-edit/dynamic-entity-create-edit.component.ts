import { Component } from '@angular/core'
import { FormBuilder, FormControl, FormGroup } from '@angular/forms'
import { ActivatedRoute, Data, Params, Router } from '@angular/router'
import { combineLatest, firstValueFrom, of } from 'rxjs'
import { PropType } from '~shared/enums/prop-type.enum'

import { SettingsService } from '../../../services/settings.service'
import { DynamicEntityService } from '../../dynamic-entity.service'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

@Component({
  selector: 'app-dynamic-entity-create-edit',
  templateUrl: './dynamic-entity-create-edit.component.html',
  styleUrls: ['./dynamic-entity-create-edit.component.scss']
})
export class DynamicEntityCreateEditComponent {
  entities: any[] = []
  entity: any

  item: any
  props: PropertyDescription[] = []

  form: FormGroup = this.formBuilder.group({})
  edit: boolean = false

  PropType = PropType

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private dynamicEntityService: DynamicEntityService,
    private formBuilder: FormBuilder,
    settingsService: SettingsService
  ) {
    settingsService.loadSettings().subscribe((res) => {
      this.entities = res.entities
    })
  }

  async ngOnInit(): Promise<void> {
    of(this.entities).subscribe((res) => {
      combineLatest([
        this.activatedRoute.params,
        this.activatedRoute.data
      ]).subscribe(async ([params, data]: [Params, Data]) => {
        this.edit = data['edit']

        this.entity = this.entities.find(
          (entity) => entity.definition.slug === params['entityName']
        )

        if (!this.entity) {
          this.router.navigate(['/404'])
        }

        this.props = this.entity.props

        if (this.edit) {
          this.item = this.dynamicEntityService.show(
            this.entity.definition.slug,
            params['id']
          )
        }

        this.props.forEach((prop) => {
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
    if (this.item) {
      this.dynamicEntityService
        .update(this.entity.definition.slug, this.item.id, this.form.value)
        .then((res) => {
          this.router.navigate(['/dynamic', this.entity.definition.slug])
        })
    } else {
      this.dynamicEntityService
        .create(this.entity.definition.slug, this.form.value)
        .then((res) => {
          this.router.navigate(['/dynamic', this.entity.definition.slug])
        })
    }
  }
}
