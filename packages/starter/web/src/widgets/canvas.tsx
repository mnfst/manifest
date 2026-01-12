import { ContactForm } from '@/components/contact-form'
import React from 'react'
import { mountWidget } from 'skybridge/web'
import '../index.css'

// Import components from the registry:
// npx shadcn@latest add @manifest-dev/x-post
// import { XPost } from '../components/x-post'

const MyWidget: React.FC = () => {
  return (
    <div>
      <ContactForm
        data={{
          title: 'Contact us',
          subtitle:
            "Fill out the form below and we'll get back to you as soon as possible.",
          submitLabel: 'Send message',
          initialValues: {
            firstName: 'John',
            lastName: 'Doe',
            countryId: 'us',
            countryCode: '+1',
            phoneNumber: '(555) 123-4567',
            email: 'john.doe@example.com',
            message: "I'm interested in learning more about your services."
          }
        }}
        appearance={{
          showTitle: true
        }}
        actions={{
          onSubmit: (formData) => console.log(formData)
        }}
      />
    </div>
  )
}

mountWidget(<MyWidget />)
