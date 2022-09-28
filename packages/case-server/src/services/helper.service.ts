import { Injectable } from '@nestjs/common'

@Injectable()
export class HelperService {
  // Converts a YYYY-MM-DD date into a sqlite-compatible datetime string
  static convertIntoSqliteDatetime(
    date: string,
    endOfTheDay?: boolean
  ): string {
    const [year, month, day]: string[] = date.split('-')
    if (endOfTheDay) {
      return new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        23,
        59,
        59
      ).toISOString()
    }
    return new Date(
      Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10))
    ).toISOString()
  }

  static uniqueArrayOfObjects(array: any[], key: string): any[] {
    return [...new Map(array.map((item) => [item[key], item])).values()]
  }
}
