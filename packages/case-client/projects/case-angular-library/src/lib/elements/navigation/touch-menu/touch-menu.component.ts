import {
  Component,
  ElementRef,
  Inject,
  Input,
  OnInit,
  Renderer2,
  ViewChild
} from '@angular/core'
import { gsap, Power2 } from 'gsap'

import { CaseConfig } from '../../../interfaces/case-config.interface'
import { MenuItem } from '../../../interfaces/menu-item.interface'
import { User } from '../../../interfaces/resources/user.interface'
import { AuthService } from '../../../services/auth.service'
import { EventService } from '../../../services/event.service'

@Component({
  selector: 'case-touch-menu',
  templateUrl: './touch-menu.component.html',
  styleUrls: ['./touch-menu.component.scss']
})
export class TouchMenuComponent implements OnInit {
  @Input() menuItems: MenuItem[]
  currentUser: User
  showMenu: boolean
  storagePath: string = this.config.storagePath

  activeAccordion: string

  showUserMenu: boolean
  showLinkMenu: boolean

  @ViewChild('menu', { static: false }) menuEl: ElementRef
  @ViewChild('hidingLayer', { static: false }) hidingLayerEl: ElementRef
  @ViewChild('menuItemsEl', { static: false }) menuItemsEl: ElementRef

  constructor(
    private authService: AuthService,
    private eventService: EventService,
    private renderer: Renderer2,
    @Inject('CASE_CONFIG_TOKEN') private config: CaseConfig
  ) {}

  ngOnInit() {
    this.authService.currentUser.subscribe((userRes: User) => {
      this.currentUser = userRes
    })

    // Close menus on changing route.
    this.eventService.routeChanged.subscribe(() => {
      if (this.showMenu) {
        this.closeMenu()
      }
    })
  }
  toggleMenu(): void {
    this.showMenu = !this.showMenu
    this.triggerMenuAnimation()
  }

  toggleAccordion(accordion: string): void {
    if (this.activeAccordion === accordion) {
      this.activeAccordion = null
    } else {
      this.activeAccordion = accordion
    }
  }

  closeMenu(): void {
    this.showMenu = false
    this.triggerMenuAnimation()
  }

  triggerMenuAnimation() {
    if (this.showMenu) {
      gsap.to(this.menuEl.nativeElement, {
        className: '+=is-open',
        duration: 0.01
      })

      gsap.to(this.menuItemsEl.nativeElement, {
        opacity: 1,
        left: '0',
        ease: Power2.easeInOut,
        duration: 0.5
      })
      gsap.to(this.hidingLayerEl.nativeElement, {
        autoAlpha: 0.9,
        ease: Power2.easeInOut,
        duration: 0.5
      })
      this.renderer.addClass(document.querySelector('html'), 'is-clipped')
    } else {
      gsap.to(this.menuEl.nativeElement, {
        className: '-=is-open',
        duration: 0.5
      })

      gsap.to(this.menuItemsEl.nativeElement, {
        opacity: 0.8,
        left: '-100%',
        ease: Power2.easeInOut,
        duration: 0.5,
        delay: 0.1
      })
      gsap.to(this.hidingLayerEl.nativeElement, {
        autoAlpha: 0,
        ease: Power2.easeInOut,
        duration: 0.5
      })
      this.renderer.removeClass(document.querySelector('html'), 'is-clipped')
    }
  }
}
