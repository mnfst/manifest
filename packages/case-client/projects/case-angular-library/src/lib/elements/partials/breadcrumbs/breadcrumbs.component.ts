import { Component, OnInit } from '@angular/core'
import { BreadcrumbService } from '../../../services/breadcrumb.service'
import { BreadcrumbLink } from '../../../interfaces/breadcrumb-link.interface'
import { MetaService } from '../../../services/meta.service'

@Component({
  selector: 'case-breadcrumbs',
  templateUrl: './breadcrumbs.component.html',
  styleUrls: ['./breadcrumbs.component.scss']
})
export class BreadcrumbsComponent implements OnInit {
  breadcrumbLinks: BreadcrumbLink[]

  constructor(
    private breadcrumbService: BreadcrumbService,
    private metaService: MetaService
  ) {}

  ngOnInit() {
    this.breadcrumbService.breadcrumbLinks.subscribe(
      (newValue: BreadcrumbLink[]) => {
        setTimeout(() => {
          this.breadcrumbLinks = newValue
          if (this.breadcrumbLinks.length) {
            const currentLink: BreadcrumbLink =
              this.breadcrumbLinks[this.breadcrumbLinks.length - 1]

            this.metaService.setTags({
              title: currentLink.label,
              path: currentLink.path
            })
          }
        }, 0)
      }
    )
  }
}
