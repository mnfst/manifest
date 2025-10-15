import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { fileRoutes } from './files.routes'
import { RouterModule } from '@angular/router'

@NgModule({
  imports: [RouterModule.forChild(fileRoutes)],
  exports: [RouterModule]
})
export class FileRoutingModule {}

@NgModule({
  declarations: [],
  imports: [CommonModule, FileRoutingModule]
})
export class FilesModule {}
