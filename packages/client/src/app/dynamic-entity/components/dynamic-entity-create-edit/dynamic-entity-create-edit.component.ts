import { Component } from '@angular/core'
import { ActivatedRoute, Params, Router, Data } from '@angular/router'
import { DynamicEntityService } from '../../dynamic-entity.service'
import { SettingsService } from '../../../shared/services/settings.service'
import { combineLatest, of } from 'rxjs'
import { FormBuilder, FormControl, FormGroup } from '@angular/forms'

@Component({
  selector: 'app-dynamic-entity-create-edit',
  templateUrl: './dynamic-entity-create-edit.component.html',
  styleUrls: ['./dynamic-entity-create-edit.component.scss']
})
export class DynamicEntityCreateEditComponent {
  entities: any[] = []
  entity: any
  props: string[] = []

  item: any
  fields: string[] = []

  form: FormGroup = this.formBuilder.group({})
  edit: boolean = false

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

  ngOnInit(): void {
    of(this.entities).subscribe((res) => {
      combineLatest([
        this.activatedRoute.params,
        this.activatedRoute.data
      ]).subscribe(([params, data]: [Params, Data]) => {
        this.edit = data['edit']

        this.entity = this.entities.find(
          (entity) => entity.definition.slug === params['entityName']
        )

        if (!this.entity) {
          this.router.navigate(['/404'])
        }

        if (this.edit) {
          this.dynamicEntityService
            .show(this.entity.definition.slug, params['id'])
            .subscribe((res) => {
              this.item = res

              this.entity.rules.update.fields.forEach((prop: string) => {
                this.fields.push(prop)
                this.form.addControl(prop, new FormControl(this.item[prop]))
              })
            })
        } else {
          this.entity.rules.create.fields.forEach((prop: string) => {
            this.fields.push(prop)
            this.form.addControl(prop, new FormControl(''))
          })
        }
      })
    })
  }

  submit(): void {
    if (this.item) {
      this.dynamicEntityService
        .update(this.entity.definition.slug, this.item.id, this.form.value)
        .subscribe((res) => {
          this.router.navigate(['/dynamic', this.entity.definition.slug])
        })
    } else {
      console.log(this.form.value)

      this.dynamicEntityService
        .create(this.entity.definition.slug, this.form.value)
        .subscribe((res) => {
          this.router.navigate(['/dynamic', this.entity.definition.slug])
        })
    }
  }
}
