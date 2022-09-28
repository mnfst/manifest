import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'

@Injectable()
export class EventService {
  public routeChanged = new BehaviorSubject({ url: '/' })
}
