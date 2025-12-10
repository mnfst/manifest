import { Injectable } from '@angular/core'
import { Subject } from 'rxjs'

export interface ModalConfig {
  component: any
  data?: any
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  public modalConfig: Subject<ModalConfig | null> = new Subject()

  constructor() {}

  open(config: ModalConfig) {
    this.modalConfig.next(config)
  }

  close() {
    this.modalConfig.next(null)
  }
}
