import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as pizZip from 'pizzip'

import { caseConstants } from '../../case.constants'

const docXTemplater = require('docxtemplater')

@Injectable()
export class DocXService {
  // Main function that generates and stores a DOC X file from a
  generateDocXFile(params: {
    templatePath: string
    outputPath: string
    data: { [key: string]: any }
  }): string {
    const content = fs.readFileSync(params.templatePath, 'binary')

    const zip = new pizZip(content)

    let doc
    try {
      doc = new docXTemplater(zip)
    } catch (error) {}

    // set the template variables.
    doc.setData(params.data)

    try {
      doc.render()
    } catch (error) {
      throw Error(error)
    }

    const buffer = doc.getZip().generate({ type: 'nodebuffer' })
    fs.writeFileSync(`${caseConstants.storagePath}${params.outputPath}`, buffer)

    return params.outputPath
  }

  // Pretty hard just for a line break but no other option : https://docxtemplater.readthedocs.io/en/v3.5.1/faq.html#inserting-new-lines
  private encodeWithLineBreaks(text: string): string {
    if (!text || !text.length) {
      return ''
    }

    const pre = '<w:p><w:r><w:t>'
    const post = '</w:t></w:r></w:p>'
    const lineBreak = '<w:br/>'

    return (
      pre +
      text
        // Remove blocking char.
        .replace(/&nbsp;/g, ' ')
        // Insert XML line breaks.
        .split('\n')
        .reduce((acc: string, curr: string) => acc + lineBreak + curr, '') +
      post
    )
  }
}
