import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { ReplaySubject } from 'rxjs'

import { ActionType } from '../enums/action-type.enum'
import { Action } from '../interfaces/actions/action.interface'
import { DeleteActionConfig } from '../interfaces/actions/delete-action-config.interface'
import { OpenCreateEditModalActionConfig } from '../interfaces/actions/open-create-edit-modal-action-config.interface'
import { FlashMessageService } from './flash-message.service'
import { ResourceService } from './resource.service'

@Injectable({
  providedIn: 'root'
})
export class ActionService {
  public deleteAction = new ReplaySubject<DeleteActionConfig>()
  public openCreateEditModalAction =
    new ReplaySubject<OpenCreateEditModalActionConfig>()

  constructor(
    private router: Router,
    private resourceService: ResourceService,
    private flashMessageService: FlashMessageService
  ) {}

  triggerAction(action: Action): Promise<any> {
    switch (action.type) {
      case ActionType.Link:
        return this.triggerLink(action)
      case ActionType.Patch:
        return this.triggerPatch(action)
      case ActionType.Delete:
        return this.triggerDelete(action)
      case ActionType.OpenCreateEditModal:
        this.triggerOpenCreateEditModal(action)
        break
    }
  }

  private triggerLink(action: Action): Promise<boolean> {
    return this.router.navigate([action.link.path], {
      queryParams: action.link.queryParams || {}
    })
  }

  private triggerPatch(action: Action): Promise<any> {
    return this.resourceService.patch(action.patch.path).then(
      (res) => {
        this.flashMessageService.success(action.patch.successMessage)
        return Promise.resolve(res)
      },
      (err) => {
        this.flashMessageService.error(action.patch.errorMessage)
        return Promise.reject(err)
      }
    )
  }

  private triggerDelete(action: Action): Promise<void> {
    return Promise.resolve(this.deleteAction.next(action.delete))
  }

  private triggerOpenCreateEditModal(action: Action): Promise<void> {
    return Promise.resolve(
      this.openCreateEditModalAction.next(action.openCreateEditModal)
    )
  }
}
