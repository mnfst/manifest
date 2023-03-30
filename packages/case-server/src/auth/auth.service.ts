import { HttpException, Injectable, Inject } from '@nestjs/common'
import { DataSource, EntityTarget, Repository } from 'typeorm'

import * as jwt from 'jsonwebtoken'
import * as CryptoJs from 'crypto-js'
import * as Handlebars from 'handlebars'
import * as fs from 'fs'
import { SHA3 } from 'crypto-js'
import * as faker from 'faker'
import { StatusCodes } from 'http-status-codes'

import { EmailService } from '../services/email.service'
import { CaseUser } from '../resources/interfaces/case-user.interface'
import { CasePermission } from '../resources/interfaces/case-permission.interface'
import { Request, Response } from 'express'

@Injectable()
export class AuthService {
  userRepository: Repository<CaseUser>

  constructor(
    @Inject('USER') private UserEntity: EntityTarget<CaseUser>,
    private readonly emailService: EmailService,
    @Inject('DATA_SOURCE')
    private dataSource: DataSource
  ) {
    this.userRepository = this.dataSource.getRepository(this.UserEntity)
  }

  async createToken(
    email: string,
    password: string,
    res: Response
  ): Promise<
    | {
        accessToken: string
        permissions: string[]
        roleName: string
        userId: number
        homepagePath: string
      }
    | Response<HttpException>
  > {
    if (!email) {
      return res
        .status(StatusCodes.UNPROCESSABLE_ENTITY)
        .send(
          new HttpException(
            'Email is required',
            StatusCodes.UNPROCESSABLE_ENTITY
          )
        )
    }
    if (!password) {
      return res
        .status(StatusCodes.UNPROCESSABLE_ENTITY)
        .send(
          new HttpException(
            'Password is required',
            StatusCodes.UNPROCESSABLE_ENTITY
          )
        )
    }
    const user = await this.userRepository.findOne({
      where: {
        email,
        password: CryptoJs.SHA3(password).toString()
      },
      relations: {
        role: {
          permissions: true
        }
      }
    })
    if (!user || !user.isActive) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .send(
          new HttpException('Invalid credentials', StatusCodes.UNAUTHORIZED)
        )
    }
    if (
      !user.role.permissions.find((p: CasePermission) => p.name === 'canLogin')
    ) {
      throw new HttpException(
        'User not allowed to login',
        StatusCodes.UNAUTHORIZED
      )
    }

    const token = jwt.sign({ email }, process.env.TOKEN_SECRET_KEY)

    return res.send({
      accessToken: token,
      permissions: user.role.permissions.map((p: CasePermission) => p.name),
      roleName: user.role.name,
      homepagePath: user.role.homepagePath,
      userId: user.id
    })
  }

  async getUserFromToken(token: string): Promise<CaseUser> {
    return jwt.verify(
      token?.replace('Bearer ', ''),
      process.env.TOKEN_SECRET_KEY,
      async (_err, decoded) => {
        if (decoded) {
          return this.userRepository
            .createQueryBuilder('user')
            .where('user.email = :email', { email: decoded.email })
            .leftJoinAndSelect('user.role', 'role')
            .leftJoinAndSelect('role.permissions', 'permission')
            .addSelect('user.lastNotificationCheck')
            .getOne()
        } else {
          return null
        }
      }
    )
  }

  async sendResetPasswordEmail(email: string, res: Response): Promise<any> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('email = :email', { email })
      .addSelect('user.token')
      .getOne()

    if (!user) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .send(
          new HttpException(
            'This User does not exist in our database',
            StatusCodes.UNAUTHORIZED
          )
        )
    }

    const source = fs.readFileSync(
      'assets/templates/emails/reset-password-email.hbs',
      'utf8'
    )
    const template = Handlebars.compile(source)

    return this.emailService.send({
      to: user.email,
      subject: `Reset your password`,
      html: template({
        name: user.name,
        resetLink: `${process.env.FRONT_URL}/reset-password?token=${user.token}`
      })
    })
  }

  hasPermission(user: CaseUser, permission: string): boolean {
    return user?.role?.permissions?.some((p) => p.name === permission)
  }

  async resetPassword(
    newPassword: string,
    token: string,
    res: Response
  ): Promise<CaseUser | Response<HttpException>> {
    const user = await this.userRepository.findOne({
      where: {
        token
      }
    })
    if (!user) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .send(
          new HttpException(
            'This User does not exist in our database',
            StatusCodes.UNAUTHORIZED
          )
        )
    }
    user.password = SHA3(newPassword).toString()
    // Reset token
    user.token = faker.random.alphaNumeric(20)
    return this.userRepository.save(user)
  }
}
