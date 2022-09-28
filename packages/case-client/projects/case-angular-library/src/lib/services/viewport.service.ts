import { Injectable } from '@angular/core'
import { ReplaySubject } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class ViewportService {
  // You can subscribe to isTouchResolution and be alerted when viewport passes touch resolution.
  // The listener is on app.component.ts.
  public isTouchResolution = new ReplaySubject<boolean>(1)
}
