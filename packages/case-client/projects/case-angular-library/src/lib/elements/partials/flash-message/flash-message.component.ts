import { Component, OnInit } from '@angular/core'
import { FlashMessageService } from '../../../services/flash-message.service'

@Component({
  selector: 'case-flash-message',
  templateUrl: './flash-message.component.html',
  styleUrls: ['./flash-message.component.scss']
})
export class FlashMessageComponent implements OnInit {
  flashMessage: { message: string; className: string }

  constructor(private flashMessageService: FlashMessageService) {}

  ngOnInit() {
    this.flashMessageService.flashMessage.subscribe((res) => {
      this.flashMessage = res
    })
  }
}
