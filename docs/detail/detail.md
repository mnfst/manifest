# Detail view

- Front-end

A detail view of a resource is a page (or component) dedicated to the display of the detail of a single item, like profile pages or a single post page.

When you [create a resource](resources/create-a-resource.md), CASE automatically generates the detail view for it.

It the detail view template, you can call your resource properties (if they exist) with the `{{ item.$propName }}` syntax.

```html
<h1>{{ item.name }}</h1>
<p>{{ item.excerpt }}</p>
```
