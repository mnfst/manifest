import { CanActivate, Injectable } from '@nestjs/common'
import { DatabaseService } from '../../crud/services/database.service'

@Injectable()
export class IsDbEmptyGuard implements CanActivate {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Check if the database is empty (no items in any entity, even admin).
   *
   * @returns True if the database is empty, false otherwise.
   * */
  async canActivate(): Promise<boolean> {
    return this.databaseService.isDbEmpty()
  }
}
