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
}
