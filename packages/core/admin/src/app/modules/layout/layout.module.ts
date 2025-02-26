import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { RouterModule } from '@angular/router'
import { SharedModule } from '../shared/shared.module'
import { FlashMessageComponent } from './flash-message/flash-message.component'
import { FooterComponent } from './footer/footer.component'
import { SideMenuComponent } from './side-menu/side-menu.component'
import { TouchMenuComponent } from './touch-menu/touch-menu.component'
import { UserMenuItemComponent } from './user-menu-item/user-menu-item.component'

@NgModule({
  declarations: [
    FlashMessageComponent,
    FooterComponent,
    SideMenuComponent,
    TouchMenuComponent,
    UserMenuItemComponent
  ],
  imports: [CommonModule, RouterModule, SharedModule],
  exports: [
    FlashMessageComponent,
    FooterComponent,
    SideMenuComponent,
    TouchMenuComponent,
    UserMenuItemComponent
  ]
})
export class LayoutModule {}
