import { Component, ElementRef, HostListener } from '@angular/core'

@Component({
  selector: 'app-user-menu-item',
  templateUrl: './user-menu-item.component.html',
  styleUrls: ['./user-menu-item.component.scss']
})
export class UserMenuItemComponent {
  // currentUser: User
  showUserMenu = false

  constructor(
    // private authService: AuthService,
    private elementRef: ElementRef
  ) {}

  ngOnInit() {
    // this.authService.currentUser.subscribe((user: User) => {
    //   this.currentUser = user
    // })
  }

  @HostListener('document:click', ['$event.target'])
  onClick(target: any) {
    if (!this.elementRef.nativeElement.contains(target)) {
      this.showUserMenu = false
    }
  }
}
