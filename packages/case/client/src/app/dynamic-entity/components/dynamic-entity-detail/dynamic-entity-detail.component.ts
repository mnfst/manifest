import { Component } from '@angular/core'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { of } from 'rxjs'

import { SettingsService } from '../../../shared/services/settings.service'
import { DynamicEntityService } from '../../dynamic-entity.service'

@Component({
  selector: 'app-dynamic-entity-detail',
  templateUrl: './dynamic-entity-detail.component.html',
  styleUrls: ['./dynamic-entity-detail.component.scss']
})
export class DynamicEntityDetailComponent {
  entities: any[] = []
  entity: any
  props: string[] = []

  item: any

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private dynamicEntityService: DynamicEntityService,
    settingsService: SettingsService
  ) {
    settingsService.loadSettings().subscribe((res) => {
      this.entities = res.entities
    })
  }

  ngOnInit(): void {
    of(this.entities).subscribe((res) => {
      this.activatedRoute.params.subscribe((params: Params) => {
        this.entity = this.entities.find(
          (entity) => entity.definition.slug === params['entityName']
        )

        if (!this.entity) {
          this.router.navigate(['/404'])
        }

        this.dynamicEntityService
          .show(this.entity.definition.slug, params['id'])
          .then((res) => {
            this.item = res

            this.props = Object.keys(this.item)
          })
      })
    })
  }
}
