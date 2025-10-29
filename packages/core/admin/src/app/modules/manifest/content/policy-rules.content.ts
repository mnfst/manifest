import { Rule } from '../../../../../../types/src'

export const policyRules: {
  id: Rule
  label: string
  description: string
  hidden?: boolean
}[] = [
  {
    id: 'signup',
    label: 'Signup',
    description: 'Allow new user registrations',
    hidden: true
  },
  {
    id: 'create',
    label: 'Create',
    description: 'Add new records'
  },
  {
    id: 'read',
    label: 'Read',
    description: 'View records'
  },
  {
    id: 'update',
    label: 'Update',
    description: 'Modify existing records'
  },
  {
    id: 'delete',
    label: 'Delete',
    description: 'Remove records'
  }
]
