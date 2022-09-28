# Send emails

## Introduction

Sending emails is only available with [Mailgun](https://www.mailgun.com/) at the moment. Make sure that you have an account and then fill the `.env` file like below:

```
MAIL_FROM=noreply@case.app
MAIL_TO=info@case.app
MAILGUN_API_KEY=XXXX
MAILGUN_DOMAIN=case.app
```

## Send an email

Simply import the **EmailService** and call the `send()` function.

```js

constructor(@Inject(EmailService) private readonly emailService: EmailService)) {}

myFunction() {

[...]
await this.emailService.send({
  to: 'no-one@test.fr',
  html: '<strong>this is it</strong>',
  subject: 'test email'
})
}
```

> [!TIP]
> If you want to send emails like reports or stats on a regular basis, have a look to the [Task scheduling documentation](features/task-scheduling.md).

## Email modes: debug, console or production

If nothing is specified, the emails are sent naturally to their recipients. However, you have 2 other options:

- redirect all emails to **a single mailbox** (debug)
- to **not send email at all** (console). Those modes are useful when dealing with non-production environments like _local_ or _staging_

All you have to do is to set the mode in your `.env` file.

```
EMAIL_MODE=CONSOLE
```

```
EMAIL_MODE=DEBUG
DEBUG_MAIL_TO=example@domain.fr
```
