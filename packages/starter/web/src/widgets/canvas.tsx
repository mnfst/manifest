import { mountWidget } from 'skybridge/web'

// Import components from the registry:
// npx shadcn@latest add @manifest-dev/x-post
// import { XPost } from '../components/x-post'

const MyWidget: React.FC = () => {
  return (
    <div>
      <h1>Hello world</h1>
      {/* Add your components here */}
    </div>
  )
}

mountWidget(<MyWidget />)
