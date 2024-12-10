import { NgModule } from '@angular/core'
import { CrudModule } from './crud.module'
import { CrudSingleRoutingModule } from './crud-single-routing.module'
import { CommonModule } from '@angular/common'

@NgModule({
  imports: [CrudModule, CrudSingleRoutingModule, CommonModule]
})
export class CrudSingleModule {}
