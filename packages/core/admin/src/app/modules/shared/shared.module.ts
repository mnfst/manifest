import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'
import { NgModule } from '@angular/core'

import { InputComponent } from './inputs/input.component'
import { CapitalizeFirstLetterPipe } from './pipes/capitalize-first-letter.pipe'
import { TruncatePipe } from './pipes/truncate.pipe'
import { FlashMessageService } from './services/flash-message.service'

@NgModule({
  providers: [FlashMessageService],
  imports: [
    CommonModule,
    HttpClientModule,
    CapitalizeFirstLetterPipe,
    TruncatePipe,
    InputComponent
  ],
  exports: [CapitalizeFirstLetterPipe, TruncatePipe, InputComponent]
})
export class SharedModule {}
