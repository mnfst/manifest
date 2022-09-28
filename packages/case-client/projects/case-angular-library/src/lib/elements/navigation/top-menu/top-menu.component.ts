import {
  Component,
  ElementRef,
  HostListener,
  Inject,
  Input,
  OnInit
} from '@angular/core'

import { CaseConfig } from '../../../interfaces/case-config.interface'
import { Notification } from '../../../interfaces/resources/notification.interface'
import { User } from '../../../interfaces/resources/user.interface'
import { TopMenuLink } from '../../../interfaces/top-menu-link.interface'
import { AuthService } from '../../../services/auth.service'
import { EventService } from '../../../services/event.service'
import { ResourceService } from '../../../services/resource.service'

@Component({
  selector: 'case-top-menu',
  templateUrl: './top-menu.component.html',
  styleUrls: ['./top-menu.component.scss']
})
export class TopMenuComponent implements OnInit {
  @Input() links: TopMenuLink[]
  @Input() isStaging: boolean

  currentUser: User
  isCollapsed = false
  notifications: Notification[]
  newNotificationCount = 0

  showUserMenu: boolean
  showLinkMenu: boolean
  showNotificationMenu: boolean

  production = !!this.config.production
  notificationFetchIntervalInSecs = 1000

  constructor(
    private authService: AuthService,
    private resourceService: ResourceService,
    private eventService: EventService,
    private elementRef: ElementRef,
    @Inject('CASE_CONFIG_TOKEN') private config: CaseConfig
  ) {}

  ngOnInit() {
    this.authService.currentUser.subscribe((userRes: User) => {
      setTimeout(() => {
        this.currentUser = userRes
        this.getNotifications()
      }, 0)
    })

    // CLose menus on changing route
    this.eventService.routeChanged.subscribe((routeChanged) => {
      this.showLinkMenu = false
      this.showUserMenu = false
      this.showNotificationMenu = false
    })

    setInterval(() => {
      this.getNotifications()
    }, this.notificationFetchIntervalInSecs * 1000)
  }

  toggleNotificationMenu(): void {
    this.showNotificationMenu = !this.showNotificationMenu
    this.showUserMenu = false
    this.showLinkMenu = false

    if (this.showNotificationMenu) {
      setTimeout(() => {
        this.newNotificationCount = 0
        this.resourceService.patch('notifications/mark-checked').then()
      }, 0)
    }
  }

  getNotifications(): void {
    this.resourceService
      .list('notifications')
      .then((notificationRes: Notification[]) => {
        this.notifications = notificationRes

        this.notifications.forEach((notification) => {
          // Separate queryParams from linkPath to use in Angular Router.
          if (notification.linkPath && notification.linkPath.includes('?')) {
            const urlArray: string[] = notification.linkPath.split('?')
            notification.linkPath = urlArray[0]
            const stringParams: string = urlArray[1]
            notification.queryParams = JSON.parse(
              '{"' +
                decodeURI(stringParams)
                  .replace(/"/g, '\\"')
                  .replace(/&/g, '","')
                  .replace(/=/g, '":"') +
                '"}'
            )
          }
        })

        this.newNotificationCount = this.notifications.filter(
          (n) => n.isHighlighted
        ).length
      })
  }

  @HostListener('document:click', ['$event.target'])
  onClick(target) {
    // We track clicks to close dropdown if open and click outside
    if (
      (this.showLinkMenu || this.showUserMenu || this.showNotificationMenu) &&
      !this.elementRef.nativeElement
        .querySelector('#create-dropdown')
        .contains(target)
    ) {
      this.showLinkMenu = false
      this.showUserMenu = false
      this.showNotificationMenu = false
    }
  }
}
