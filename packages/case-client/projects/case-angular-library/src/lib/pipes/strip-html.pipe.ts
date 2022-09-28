import { Pipe, PipeTransform } from '@angular/core'

@Pipe({
  name: 'stripHtml'
})
export class StripHtmlPipe implements PipeTransform {
  transform(value: string): any {
    if (typeof value === 'string' && value.length) {
      // Remove HTML tags and "&nbsp;".
      return value.replace(/<.*?>/g, '').replace(/&nbsp;/g, ' ')
    }
    return value
  }
}
