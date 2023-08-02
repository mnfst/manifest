import { Component, Renderer2 } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'

@Component({
  selector: 'app-touch-menu',
  templateUrl: './touch-menu.component.html',
  styleUrls: ['./touch-menu.component.scss']
})
export class TouchMenuComponent {
  isOpen = false

  constructor(private renderer: Renderer2, router: Router) {
    router.events.subscribe((routeChanged) => {
      if (routeChanged instanceof NavigationEnd) {
        this.isOpen = false
      }
    })
  }

  toggleMenu(): void {
    if (this.isOpen) {
      this.isOpen = false
      this.renderer.removeClass(document.querySelector('html'), 'is-clipped')
    } else {
      this.isOpen = true
      this.renderer.addClass(document.querySelector('html'), 'is-clipped')
    }
  }
}
