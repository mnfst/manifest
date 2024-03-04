import * as fs from 'fs'
import * as yaml from 'js-yaml'

const file = fs.readFileSync(`${process.cwd()}/case/case.yml`, 'utf8')
const data: any = yaml.load(file)

console.log(data)
