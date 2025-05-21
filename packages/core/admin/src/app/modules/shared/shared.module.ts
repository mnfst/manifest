import { CommonModule } from '@angular/common'
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { NgModule } from '@angular/core'

import { InputComponent } from './inputs/input.component'
import { CapitalizeFirstLetterPipe } from './pipes/capitalize-first-letter.pipe'
import { TruncatePipe } from './pipes/truncate.pipe'
import { FlashMessageService } from './services/flash-message.service'

@NgModule({
  exports: [CapitalizeFirstLetterPipe, TruncatePipe, InputComponent],
  imports: [
    CommonModule,
    CapitalizeFirstLetterPipe,
    TruncatePipe,
    InputComponent
  ],
  providers: [FlashMessageService, provideHttpClient(withInterceptorsFromDi())]
})
export class SharedModule {}
