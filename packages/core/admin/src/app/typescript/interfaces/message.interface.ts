export interface Message {
  id: string
  type: 'user' | 'system'
  content: string
  code?: string
  createdAt: Date
}
