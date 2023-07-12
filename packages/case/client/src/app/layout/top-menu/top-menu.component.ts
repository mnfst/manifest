import { Component } from '@angular/core'
import { BreadcrumbLink } from '../../interfaces/breadcrumb-link.interface'
import { BreadcrumbService } from '../../services/breadcrumb.service'
import { Title } from '@angular/platform-browser'
import { CapitalizeFirstLetterPipe } from '../../pipes/capitalize-first-letter.pipe'

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
    private capitalizeFirstLetterPipe: CapitalizeFirstLetterPipe,
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
              this.capitalizeFirstLetterPipe.transform(currentLink.label)
            )
          }
        }, 0)
      }
    )
  }
}
