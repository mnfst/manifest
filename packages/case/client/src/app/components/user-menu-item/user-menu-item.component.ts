import { Component } from '@angular/core'

import { AuthService } from '../../auth/auth.service'
import { User } from '../../interfaces/user.interface'

@Component({
  selector: 'app-user-menu-item',
  templateUrl: './user-menu-item.component.html',
  styleUrls: ['./user-menu-item.component.scss']
})
export class UserMenuItemComponent {
  currentUser: User
  showUserMenu = false

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.authService.currentUser.subscribe((user: User) => {
      this.currentUser = user
    })
  }
}
