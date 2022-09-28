import { Component, HostListener, OnInit, Renderer2 } from '@angular/core'
import { Router } from '@angular/router'

import { ResourceDefinition } from '../../../interfaces/resource-definition.interface'
import { ActionService } from '../../../services/action.service'
import { FlashMessageService } from '../../../services/flash-message.service'
import { ResourceService } from '../../../services/resource.service'

@Component({
  selector: 'case-confirm-delete-modal',
  templateUrl: './confirm-delete-modal.component.html',
  styleUrls: ['./confirm-delete-modal.component.scss']
})
export class ConfirmDeleteModalComponent implements OnInit {
  itemToDelete: any
  resourceDefinition: ResourceDefinition
  redirectTo: string
  redirectToQueryParams: { [key: string]: string }

  showModal: boolean

  constructor(
    private resourceService: ResourceService,
    private flashMessageService: FlashMessageService,
    private actionService: ActionService,
    private renderer: Renderer2,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.actionService.deleteAction.subscribe((deleteAction) => {
      this.itemToDelete = deleteAction.itemToDelete
      this.resourceDefinition = deleteAction.definition
      this.redirectTo = deleteAction.redirectTo
      this.redirectToQueryParams = deleteAction.redirectToQueryParams

      this.showModal = true
      this.renderer.addClass(document.querySelector('html'), 'is-clipped')
    })
  }

  confirmDelete() {
    this.resourceService
      .delete(this.resourceDefinition.slug, this.itemToDelete.id)
      .then(
        (res) => {
          this.close()
          // Change query params to force reload on lists.
          this.router.navigate(
            [this.redirectTo || this.router.url.split('?')[0]],
            {
              queryParams: Object.assign(this.redirectToQueryParams || {}, {
                t: new Date().getTime()
              }),
              queryParamsHandling: 'merge'
            }
          )
          this.flashMessageService.success(`La ressource a bien été supprimée`)
        },
        (err) => {
          this.close()
          this.flashMessageService.error(
            `Une erreur à lieu et l'élément n'a pas pu être effacé. Veuillez contacter votre administrateur si le problème persiste.`
          )
        }
      )
  }

  close() {
    this.showModal = false
    this.renderer.removeClass(document.querySelector('html'), 'is-clipped')
  }

  // Click outside closes modal.
  @HostListener('document:click', ['$event.target'])
  clickOut(eventTarget) {
    if (this.showModal && eventTarget.className.includes('modal-background')) {
      this.close()
    }
  }

  @HostListener('document:keydown.escape') onEnterKeydown() {
    if (this.showModal) {
      this.close()
    }
  }
}
