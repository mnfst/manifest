import { IssueReportForm } from '../components/issue-report-form'
import React from 'react'
import { mountWidget } from 'skybridge/web'
import '../index.css'

// Import components from the registry:
// npx shadcn@latest add @manifest-dev/x-post
// import { XPost } from '../components/x-post'

const MyWidget: React.FC = () => {
  return (
    <div>
      <IssueReportForm />
    </div>
  )
}

mountWidget(<MyWidget />)
