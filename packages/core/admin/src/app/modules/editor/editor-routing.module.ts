import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { EditorComponent } from './views/editor/editor.component'
import { UnsavedChangesGuard } from './guards/unsaved-changes.guard'

const routes: Routes = [
  {
    path: '',
    component: EditorComponent,
    canDeactivate: [UnsavedChangesGuard]
  }
]

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EditorRoutingModule {}
