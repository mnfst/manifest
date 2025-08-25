import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { EditorComponent } from './views/editor/editor.component'

const routes: Routes = [
  {
    path: '',
    component: EditorComponent
  }
]

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EditorRoutingModule {}
