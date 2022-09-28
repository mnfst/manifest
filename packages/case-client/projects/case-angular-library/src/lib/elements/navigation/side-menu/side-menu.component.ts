import { Component, Input } from '@angular/core'

import { MenuItem } from '../../../interfaces/menu-item.interface'

@Component({
  selector: 'case-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss']
})
export class SideMenuComponent {
  @Input() menuItems: MenuItem[]
  @Input() path: string
  @Input() isCollapsed = false

  activeAccordion: string

  toggleAccordion(accordion: string): void {
    if (this.activeAccordion === accordion) {
      this.activeAccordion = null
    } else {
      this.activeAccordion = accordion
    }
  }

  hideCollapsedAccordion() {
    if (this.isCollapsed) {
      delete this.activeAccordion
    }
  }

  showCollapsedAccordion(accordion: string): void {
    if (this.isCollapsed) {
      this.activeAccordion = accordion
    }
  }
}
