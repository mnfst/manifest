import { Pipe, PipeTransform } from '@angular/core'

@Pipe({
  name: 'capitalizeFirstLetter',
  standalone: true
})
export class CapitalizeFirstLetterPipe implements PipeTransform {
  transform(value?: string): string {
    if (typeof value === 'undefined' || value === null || value === '') {
      return ''
    }
    return value[0].toUpperCase() + value.substr(1).toLowerCase()
  }
}
