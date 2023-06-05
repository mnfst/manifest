import { Component } from '@angular/core'
import { ActivatedRoute, Params, Router, Data } from '@angular/router'
import { DynamicEntityService } from '../../dynamic-entity.service'
import { SettingsService } from '../../../shared/services/settings.service'
import { combineLatest, of } from 'rxjs'
import { FormBuilder, FormGroup } from '@angular/forms'

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

  form: FormGroup = this.formBuilder.group({})

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
        this.entity = this.entities.find(
          (entity) => entity.definition.slug === params['entityName']
        )

        if (!this.entity) {
          this.router.navigate(['/404'])
        }

        if (data['edit'])
          [
            this.dynamicEntityService
              .show(this.entity.definition.slug, params['id'])
              .subscribe((res) => {
                this.item = res
              })
          ]
      })
    })
  }

  submit(): void {}
}
