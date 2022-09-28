import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { BreadcrumbLink } from '../interfaces/breadcrumb-link.interface'

@Injectable({
  providedIn: 'root'
})
export class BreadcrumbService {
  public breadcrumbLinks: BehaviorSubject<
    BreadcrumbLink[]
  > = new BehaviorSubject([])
}
