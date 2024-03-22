import { Component } from '@angular/core'
import { Title } from '@angular/platform-browser'
import { BreadcrumbLink } from '../../../typescript/interfaces/breadcrumb-link.interface'
import { CapitalizeFirstLetterPipe } from '../../shared/pipes/capitalize-first-letter.pipe'
import { BreadcrumbService } from '../../shared/services/breadcrumb.service'

@Component({
  selector: 'app-top-menu',
  templateUrl: './top-menu.component.html',
  styleUrls: ['./top-menu.component.scss']
})
export class TopMenuComponent {
  breadcrumbLinks: BreadcrumbLink[]
  showUserMenu = false

  constructor(
    private breadcrumbService: BreadcrumbService,
    private title: Title
  ) {}

  ngOnInit() {
    this.breadcrumbService.breadcrumbLinks.subscribe(
      (newValue: BreadcrumbLink[]) => {
        setTimeout(() => {
          this.breadcrumbLinks = newValue

          if (this.breadcrumbLinks.length) {
            const currentLink: BreadcrumbLink =
              this.breadcrumbLinks[this.breadcrumbLinks.length - 1]

            this.title.setTitle(
              new CapitalizeFirstLetterPipe().transform(currentLink.label)
            )
          }
        }, 0)
      }
    )
  }
}
