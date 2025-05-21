import { Component } from '@angular/core'
import { FlashMessageService } from '../../shared/services/flash-message.service'

@Component({
    selector: 'app-flash-message',
    templateUrl: './flash-message.component.html',
    styleUrls: ['./flash-message.component.scss'],
    standalone: false
})
export class FlashMessageComponent {
  flashMessage: { message: string; className: string }

  constructor(private flashMessageService: FlashMessageService) {}

  ngOnInit() {
    this.flashMessageService.flashMessage.subscribe(
      (res: { message: string; className: string }) => {
        this.flashMessage = res
      }
    )
  }
}
