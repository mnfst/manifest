import { Component } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'

@Component({
  selector: 'app-touch-menu',
  templateUrl: './touch-menu.component.html',
  styleUrls: ['./touch-menu.component.scss']
})
export class TouchMenuComponent {
  isOpen = false

  constructor(router: Router) {
    router.events.subscribe((routeChanged) => {
      if (routeChanged instanceof NavigationEnd) {
        this.isOpen = false
      }
    })
  }
}
