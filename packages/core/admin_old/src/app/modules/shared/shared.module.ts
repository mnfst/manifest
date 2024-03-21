import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'

import { FlashMessageService } from './services/flash-message.service'

@NgModule({
  declarations: [],

  providers: [FlashMessageService],
  imports: [CommonModule, HttpClientModule]
})
export class SharedModule {}
