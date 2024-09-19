import { Injectable } from '@nestjs/common'

@Injectable()
export class HelperService {
  /**
   * Get record key by its value.
   *
   * @param record
   * @param value
   * @returns key
   */
  static getRecordKeyByValue<
    T extends Record<string, any>,
    V extends T[keyof T]
  >(record: T, value: V): string {
    for (const [key, val] of Object.entries(record)) {
      if (val === value) {
        return key
      }
    }
    return undefined
  }

  /**
   * Merge 2 stings using camel case.
   */
  static camelCaseTwoStrings(str1: string, str2: string) {
    const combined = (str1 + ' ' + str2).toLowerCase().split(' ')
    return combined
      .map((word, index) =>
        index === 0 ? word : word[0].toUpperCase() + word.slice(1)
      )
      .join('')
  }

  /**
   * Get a random integer while excluding some values.
   */
  static getRandomIntExcluding(
    min: number,
    max: number,
    exclude?: number[]
  ): number {
    const randomInt = Math.floor(Math.random() * (max - min + 1)) + min
    return exclude?.length && exclude.includes(randomInt)
      ? this.getRandomIntExcluding(min, max, exclude)
      : randomInt
  }
}
