# Flash messages

- Front-end feature

A flash message is a brief message that appears over the content to pass an important message to the user.

In the desired view of the front-end, import the `FlashMessageService` into your Angular component :

```js
import { FlashMessageService } from 'case'
```

And then use it to display **info**, **success** or **error** messages. The background of the flash message will be adapted in function of your theme :

```js
export class HomeComponent implements OnInit {
  constructor(private flashMessageService: FlashMessageService) {}

  ngOnInit(): void {
    // Info message.
    this.flashMessageService.info('Welcome to CASE.')

    // Error message.
    this.flashMessageService.error('Error: Something went wrong.')

    // Success message.
    this.flashMessageService.success('The resource was created correctly.')
  }
}
```
