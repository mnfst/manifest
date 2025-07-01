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

    // await manifest.login('users', 'br@test.fr', 'azerty')

    const cats = await manifest
      .from('cats')
      .findOneById('efd7a361-0c78-4d58-9951-9f49e040efa4')

    await manifest.from('projects').find()
  }
}
