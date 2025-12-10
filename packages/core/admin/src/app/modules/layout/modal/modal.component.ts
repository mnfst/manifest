import {
  Component,
  ComponentRef,
  OnInit,
  ViewChild,
  ViewContainerRef
} from '@angular/core'
import { ModalConfig, ModalService } from '../../shared/services/modal.service'

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss'
})
export class ModalComponent implements OnInit {
  @ViewChild('dynamicComponent', { read: ViewContainerRef, static: true })
  dynamicComponent!: ViewContainerRef

  config: ModalConfig | null = null
  private componentRef?: ComponentRef<unknown>

  constructor(public modalService: ModalService) {}

  ngOnInit(): void {
    this.modalService.modalConfig.subscribe((config: ModalConfig) => {
      this.config = config
      this.loadComponent()
    })
  }

  loadComponent() {
    this.dynamicComponent.clear()
    if (this.config) {
      this.componentRef = this.dynamicComponent.createComponent(
        this.config.component
      )

      if (this.config.data) {
        Object.assign(this.componentRef.instance, this.config.data)
      }
    }
  }
}
