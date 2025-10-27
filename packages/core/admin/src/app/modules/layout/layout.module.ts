import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { RouterModule } from '@angular/router'
import { SharedModule } from '../shared/shared.module'
import { FlashMessageComponent } from './flash-message/flash-message.component'
import { FooterComponent } from './footer/footer.component'
import { SideMenuComponent } from './side-menu/side-menu.component'
import { TouchMenuComponent } from './touch-menu/touch-menu.component'
import { UserMenuItemComponent } from './user-menu-item/user-menu-item.component'
import { EntityManifestCreateEditComponent } from '../manifest/components/entity-manifest-create-edit/entity-manifest-create-edit.component'
import { ModalComponent } from './modal/modal.component'

@NgModule({
  declarations: [
    FlashMessageComponent,
    ModalComponent,
    FooterComponent,
    SideMenuComponent,
    TouchMenuComponent,
    UserMenuItemComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    SharedModule,

    EntityManifestCreateEditComponent
  ],
  exports: [
    FlashMessageComponent,
    ModalComponent,
    FooterComponent,
    SideMenuComponent,
    TouchMenuComponent,
    UserMenuItemComponent
  ]
})
export class LayoutModule {}
