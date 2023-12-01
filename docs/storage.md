# Storage

CASE offers a **local storage** out-of-the-box for file and image upload.

## Upload files

File storage is pretty straightforward with the [CASE JS SDK](connect.md). Each stored file will be stored in a folder related to its entity and the month of upload. (ex `public/storage/cats/Nov23`).

```js
// Upload a file passing a File object.
const fileUrl: string = await client.from('cats').addFile(file)
```

## Upload images

When uploading an image, you need to create one or several sizes to this image.

Let's say that our `Cat` entity has an avatar that will be displayed in 2 different sizes in our app: thumb and large. We can specify those sizes directly in the property `avatar` of the entity file

```js
// entities/cat.entity.ts
[...]

@Prop({
type: PropType.Image,
validators: [IsNotEmpty()],
options: {
        sizes: [
            {
                name: 'thumb',
                height: 100,
                width: 100
            },
            {
                name: 'large',
                height: 1000,
                width: 1000
            }
        ]
    }
})
image: JSON
```

Then when using the SDK we just need to specify the entity and the property name to it:

```js
// Uploads the imageFile as the avatar of the cat.
const avatars = await client.from('cats').addImage('avatar', imageFile)

console.log(avatars)
// Output: {
//    thumb: "http://localhost:400/path-to-small-image.jpg",
//    large: "http://localhost:400/path-to-large-image.jpg"
// }
```

You can also set options like the object-fit of the resize. CASE is secretly using **Sharp** for image processing so you can pass an option param for each size following the [sharp resize options](https://sharp.pixelplumbing.com/api-resize).
