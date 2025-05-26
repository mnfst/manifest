import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import Manifest from '../../../dist/js-sdk/src'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'sandbox'

  async ngOnInit(): Promise<void> {
    const manifest = new Manifest()

    await manifest.login('users', 'br@test.fr', 'azerty')

    await manifest.from('projects').find()
  }
}
