import { Injectable } from '@nestjs/common'
import * as Handlebars from 'handlebars'
import * as moment from 'moment'
import * as puppeteer from 'puppeteer'

@Injectable()
export class PdfService {
  constructor() {
    // Register "math" helper to make operations within templates.
    Handlebars.registerHelper('math', (leftValue, operator, rightValue) => {
      leftValue = parseFloat(leftValue)
      rightValue = parseFloat(rightValue)

      return {
        '+': leftValue + rightValue,
        '-': leftValue - rightValue,
        '*': leftValue * rightValue,
        '/': leftValue / rightValue,
        '%': leftValue % rightValue,
      }[operator]
    })
    // Date helper.
    Handlebars.registerHelper('date', (value) => {
      return moment(value).format('DD/MM/YYYY')
    })
  }

  // Main function to generate PDF file using Puppeteer and a Handlebars template
  async generatePdfFromTemplate(template, path: string) {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox'],
      headless: true,
    })

    const options: puppeteer.PDFOptions = {
      format: 'a4',
      headerTemplate: '<p></p>',
      footerTemplate: '<p></p>',
      displayHeaderFooter: false,
      margin: {
        top: '40px',
        bottom: '100px',
      },
      printBackground: true,
      path,
    }

    const page = await browser.newPage()
    await page.goto(`data: text/html,${template}`, {
      waitUntil: 'networkidle0',
    })
    await page.pdf(options)
    await browser.close()
  }
}
