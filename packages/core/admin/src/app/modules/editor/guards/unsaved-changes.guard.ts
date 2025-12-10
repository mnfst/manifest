import { Injectable } from '@angular/core'
import { EditorComponent } from '../views/editor/editor.component'

export interface CanComponentDeactivate {
  canDeactivate: () => boolean
}

@Injectable({
  providedIn: 'root'
})
export class UnsavedChangesGuard {
  canDeactivate(component: EditorComponent): boolean {
    return component.canDeactivate()
  }
}
