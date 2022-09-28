import { Inject, Injectable } from '@nestjs/common'
import * as moment from 'moment'
import { DataSource, EntityTarget, getRepository, Repository } from 'typeorm'

import { CaseNotification } from '../interfaces/case-notification.interface'
import { CaseUser } from '../interfaces/case-user.interface'

@Injectable()
export class NotificationService {
  notificationRepository: Repository<CaseNotification>

  constructor(
    @Inject('NOTIFICATION')
    notificationEntity: EntityTarget<CaseNotification>,
    @Inject('USER')
    private userEntity: EntityTarget<CaseUser>,
    @Inject('DATA_SOURCE')
    private dataSource: DataSource
  ) {
    this.notificationRepository =
      this.dataSource.getRepository(notificationEntity)
  }

  async index(user: CaseUser) {
    const notifications: CaseNotification[] = await this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.user', 'user')
      .where('user.id = :userId', { userId: user.id })
      .orderBy('notification.date', 'DESC')
      .take(5)
      .getMany()

    notifications.forEach((notification: CaseNotification) => {
      notification.isHighlighted = user.lastNotificationCheck
        ? moment(user.lastNotificationCheck).isBefore(moment(notification.date))
        : true

      // Clean response.
      delete notification.user
    })

    return notifications
  }

  async markChecked(user: CaseUser): Promise<Date> {
    user.lastNotificationCheck = moment().toDate()

    await this.dataSource.getRepository(this.userEntity).save(user)

    return user.lastNotificationCheck
  }

  async notify(
    user: CaseUser,
    description: string,
    linkPath?: string
  ): Promise<CaseNotification> {
    const notification: CaseNotification = this.notificationRepository.create({
      description,
      user,
      linkPath: linkPath || null,
      date: moment().toDate()
    })
    return this.notificationRepository.save(notification)
  }
}
