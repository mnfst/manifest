import { Message } from './message.interface'

export interface Project {
  id: string
  name: string
  updatedAt: Date

  messages: Message[]
}
