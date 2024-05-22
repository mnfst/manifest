import { Component } from '@angular/core'
import { Title } from '@angular/platform-browser'
import { AppManifest } from '@mnfst/types'
import { BreadcrumbLink } from '../../../typescript/interfaces/breadcrumb-link.interface'
import { CapitalizeFirstLetterPipe } from '../../shared/pipes/capitalize-first-letter.pipe'
import { BreadcrumbService } from '../../shared/services/breadcrumb.service'
import { ManifestService } from '../../shared/services/manifest.service'

@Component({
  selector: 'app-top-menu',
  templateUrl: './top-menu.component.html',
  styleUrls: ['./top-menu.component.scss']
})
export class TopMenuComponent {
  breadcrumbLinks: BreadcrumbLink[]
  appName: string

  showUserMenu = false

  constructor(
    private breadcrumbService: BreadcrumbService,
    private manifestService: ManifestService,
    private title: Title
  ) {}

  ngOnInit() {
    this.manifestService.getManifest().then((res: AppManifest) => {
      this.appName = res.name

      this.breadcrumbService.breadcrumbLinks.subscribe(
        (newValue: BreadcrumbLink[]) => {
          setTimeout(() => {
            this.breadcrumbLinks = newValue

            const currentLink: BreadcrumbLink =
              this.breadcrumbLinks[this.breadcrumbLinks.length - 1]

            if (currentLink?.label) {
              this.title.setTitle(
                `${new CapitalizeFirstLetterPipe().transform(
                  currentLink.label
                )} | ${this.appName} | Manifest`
              )
            } else {
              this.title.setTitle(`${this.appName} | Manifest`)
            }
          }, 0)
        }
      )
    })
  }
}
