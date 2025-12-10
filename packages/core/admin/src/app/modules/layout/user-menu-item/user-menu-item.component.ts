import { Component, ElementRef, HostListener, OnInit } from '@angular/core'
import { Admin } from '../../../typescript/interfaces/admin.interface'
import { AuthService } from '../../auth/auth.service'
import { filter } from 'rxjs'

@Component({
  selector: 'app-user-menu-item',
  templateUrl: './user-menu-item.component.html',
  styleUrls: ['./user-menu-item.component.scss']
})
export class UserMenuItemComponent implements OnInit {
  currentUser: Admin
  showUserMenu = false

  constructor(
    private authService: AuthService,
    private elementRef: ElementRef
  ) {}

  ngOnInit() {
    this.authService.currentUser$
      .pipe(filter((admin) => !!admin))
      .subscribe((admin: Admin) => {
        this.currentUser = admin
      })
  }

  @HostListener('document:click', ['$event.target'])
  onClick(target: any) {
    if (!this.elementRef.nativeElement.contains(target)) {
      this.showUserMenu = false
    }
  }
}
