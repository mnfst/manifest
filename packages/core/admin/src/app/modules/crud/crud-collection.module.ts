import { NgModule } from '@angular/core'
import { CrudModule } from './crud.module'
import { CrudCollectionRoutingModule } from './crud-collection-routing.module'
import { CommonModule } from '@angular/common'

@NgModule({
  imports: [CrudModule, CrudCollectionRoutingModule, CommonModule]
})
export class CrudCollectionModule {}
