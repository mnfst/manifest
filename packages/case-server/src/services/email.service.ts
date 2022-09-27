import { Injectable } from '@nestjs/common'

import * as formData from 'form-data'
import Mailgun from 'mailgun.js'

@Injectable()
// This Service is for MAILGUN only.
export class EmailService {
  send({
    to,
    bcc,
    subject,
    html,
    attachments
  }: {
    to: string
    bcc?: string
    subject: string
    html: string
    attachments?: any
  }): Promise<any> {
    const mailgun = new Mailgun(formData)
    const mg = mailgun.client({
      username: 'buddyweb',
      key: process.env.MAILGUN_API_KEY
    })

    // Can be "DEBUG", "CONSOLE" or anything else (even empty) for default mode.
    const emailMode: string = process.env.EMAIL_MODE

    if (emailMode === 'CONSOLE') {
      return Promise.resolve(
        console.log(
          JSON.stringify({
            log: 'Email logged to console (not sent)',
            date: new Date().toISOString(),
            from: process.env.MAIL_FROM,
            to,
            bcc,
            subject,
            html,
            attachment: attachments
          })
        )
      )
    }

    return mg.messages.create(process.env.MAILGUN_DOMAIN, {
      from: process.env.MAIL_FROM,
      to: emailMode !== 'debug' ? to : process.env.DEBUG_MAIL_TO,
      bcc: emailMode !== 'debug' ? bcc : process.env.DEBUG_MAIL_TO,
      subject,
      html,
      attachment: attachments
    })
  }
}
