'use client'

import { ChatDemo } from '@/components/chat/chat-demo'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WaveCanvas } from '@/components/ui/wave-canvas'
import { BlogPostCard, BlogPost } from '@/registry/blogging/blog-post-card'
import { BlogPostList } from '@/registry/blogging/blog-post-list'
import { OrderConfirm } from '@/registry/payment/order-confirm'
import { PaymentConfirmed } from '@/registry/payment/payment-confirmed'
import { PaymentMethods } from '@/registry/payment/payment-methods'
import { ProductList, Product } from '@/registry/list/product-list'
import Link from 'next/link'

function ChatGPTIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"
        fill="#D97757"
        fillRule="nonzero"
      />
    </svg>
  )
}

// Brand logos
function IyoLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect width="24" height="24" rx="6" fill="#000" />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fill="white"
        fontSize="10"
        fontWeight="bold"
        fontFamily="system-ui"
      >
        iyo
      </text>
    </svg>
  )
}

function StripeLogo({ className }: { className?: string }) {
  return (
    <img src="/images/Icon.jpeg" alt="Stripe" className={className} style={{ borderRadius: '4px' }} />
  )
}

function TechCrunchLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="12" fill="#0A9E01" />
      <g transform="translate(12, 12) scale(0.5) translate(-12, -6)">
        <polygon fill="white" points="12,0 12,4 8,4 8,12 4,12 4,4 0,4 0,0" />
        <rect x="16" y="0" fill="white" width="8" height="4" />
        <polygon fill="white" points="24,8 24,12 12,12 12,4 16,4 16,8" />
      </g>
    </svg>
  )
}

const techCrunchArticles = [
  {
    id: '1',
    title: 'The accelerator is on the floor for autonomous vehicles',
    excerpt:
      'Major automakers are ramping up investments in self-driving technology as regulatory frameworks become clearer.',
    coverImage:
      'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&h=450&fit=crop',
    author: {
      name: 'Kirsten Korosec',
      avatar: 'https://i.pravatar.cc/150?u=kirsten'
    },
    publishedAt: '2025-12-07',
    readTime: '5 min read',
    category: 'Transportation'
  },
  {
    id: '2',
    title: 'X deactivates European Commission ad account after €120M fine',
    excerpt:
      "The social media platform has suspended the EU institution's advertising capabilities following the recent penalty.",
    coverImage:
      'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=450&fit=crop',
    author: {
      name: 'Anthony Ha',
      avatar: 'https://i.pravatar.cc/150?u=anthony'
    },
    publishedAt: '2025-12-07',
    readTime: '4 min read',
    category: 'Social'
  },
  {
    id: '3',
    title: 'Coinbase starts onboarding users again in India',
    excerpt:
      'The crypto exchange plans to introduce fiat on-ramp capabilities in the region by next year.',
    coverImage:
      'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&h=450&fit=crop',
    author: { name: 'Ivan Mehta', avatar: 'https://i.pravatar.cc/150?u=ivan' },
    publishedAt: '2025-12-07',
    readTime: '6 min read',
    category: 'Fintech'
  }
]

const audioProducts: Product[] = [
  {
    id: '1',
    name: 'Iyo Pro',
    description: 'Premium Earbuds',
    price: 299,
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=400&fit=crop',
    rating: 4.9,
    badge: 'Best Seller',
    inStock: true
  },
  {
    id: '2',
    name: 'Iyo Air',
    description: 'Wireless Earbuds',
    price: 149,
    image: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=400&h=400&fit=crop',
    rating: 4.8,
    badge: 'New',
    inStock: true
  },
  {
    id: '3',
    name: 'Iyo Studio',
    description: 'Over-Ear Headphones',
    price: 349,
    originalPrice: 399,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
    rating: 4.7,
    badge: '-12%',
    inStock: true
  },
  {
    id: '4',
    name: 'Iyo Sport',
    description: 'Active Earbuds',
    price: 199,
    image: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=400&h=400&fit=crop',
    rating: 4.8,
    inStock: true
  },
  {
    id: '5',
    name: 'Iyo Mini',
    description: 'Compact Earbuds',
    price: 99,
    originalPrice: 129,
    image: 'https://images.unsplash.com/photo-1631867675167-90a456a90863?w=400&h=400&fit=crop',
    rating: 4.6,
    badge: '-23%',
    inStock: true
  },
  {
    id: '6',
    name: 'Iyo Max',
    description: 'Premium Headphones',
    price: 449,
    image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=400&h=400&fit=crop',
    rating: 4.9,
    inStock: true
  }
]

const featuredArticle = {
  id: '0',
  title: 'The accelerator is on the floor for autonomous vehicles',
  excerpt:
    'Major automakers are ramping up investments in self-driving technology as regulatory frameworks become clearer and consumer acceptance grows.',
  coverImage:
    'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&h=450&fit=crop',
  author: {
    name: 'Kirsten Korosec',
    avatar: 'https://i.pravatar.cc/150?u=kirsten'
  },
  publishedAt: '2025-12-07',
  readTime: '5 min read',
  category: 'Transportation',
  tags: ['Autonomous', 'EVs']
}

const useCases = [
  {
    id: 'product-selection',
    label: 'Product selection',
    messages: [
      {
        id: '1',
        role: 'user' as const,
        content: "I'm looking for premium wireless earbuds"
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: 'Here are our best-selling audio products:',
        component: <ProductList products={audioProducts} variant="carousel" />,
        brand: { name: 'Iyo', logo: <IyoLogo className="h-4 w-4" /> },
        hasPadding: true,
        contentAfter:
          'Browse through our selection and let me know which one catches your eye. Each model offers different features to match your lifestyle.'
      },
      {
        id: '3',
        role: 'user' as const,
        content: "I'll take the Iyo Pro"
      },
      {
        id: '4',
        role: 'assistant' as const,
        content: "Excellent choice! Here's your order summary:",
        component: <OrderConfirm />,
        brand: { name: 'Iyo', logo: <IyoLogo className="h-4 w-4" /> },
        contentAfter:
          "Please review the details and confirm when you're ready. Free shipping is included with your order."
      }
    ]
  },
  {
    id: 'payment-workflow',
    label: 'Payment workflow',
    messages: [
      {
        id: '1',
        role: 'user' as const,
        content: "I'd like to complete my purchase"
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: 'Please select your payment method:',
        component: <PaymentMethods />,
        brand: { name: 'Stripe', logo: <StripeLogo className="h-4 w-4" /> },
        contentAfter:
          'Your payment information is secured with end-to-end encryption. Select your preferred method to continue.'
      },
      {
        id: '3',
        role: 'user' as const,
        content: 'Using my Visa card'
      },
      {
        id: '4',
        role: 'assistant' as const,
        content: 'Payment successful!',
        component: <PaymentConfirmed />,
        brand: { name: 'Stripe', logo: <StripeLogo className="h-4 w-4" /> },
        contentAfter:
          "You'll receive a confirmation email shortly. Is there anything else I can help you with?"
      }
    ]
  },
  {
    id: 'tech-news',
    label: 'Tech news',
    messages: [
      {
        id: '1',
        role: 'user' as const,
        content: "What's happening in tech today?"
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: "Here's the top story from TechCrunch:",
        component: <BlogPostCard post={featuredArticle} variant="covered" />,
        brand: {
          name: 'TechCrunch',
          logo: <TechCrunchLogo className="h-4 w-4" />
        },
        contentAfter:
          'This article is getting a lot of attention. Would you like to see more tech news?'
      },
      {
        id: '3',
        role: 'user' as const,
        content: 'Yes, show me more articles'
      },
      {
        id: '4',
        role: 'assistant' as const,
        content: 'Here are more trending stories:',
        component: (
          <BlogPostList posts={techCrunchArticles} variant="list" />
        ),
        brand: {
          name: 'TechCrunch',
          logo: <TechCrunchLogo className="h-4 w-4" />
        },
        hasPadding: true,
        contentAfter:
          "These are the most discussed topics right now. Let me know if you'd like a summary of any article."
      }
    ]
  }
]

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      {/* Hero Section with Wave Canvas Background */}
      <div className="relative min-h-[auto] py-16 md:min-h-[50vh] lg:min-h-[55vh] overflow-hidden flex items-center justify-center">
        <WaveCanvas
          colors={[
            '#fae7d5ff',
            '#d0fdf3ff',
            '#d3d5fbff',
            '#cffcf2ff',
            '#d3d5fbff'
          ]}
          darkColors={['#2a1f1a', '#1a2a28', '#1f1a2a', '#1a2a28', '#1a1a2a']}
          waveOpacity={0.63}
          speed="slow"
          blur={60}
          waveWidth={300}
        />
        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground">
              Build beautiful chat experiences
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              A collection of beautifully designed components for building
              ChatGPT custom apps. Open source, accessible and customizable.
            </p>
            <div className="pt-4">
              <Link
                href="/blocks"
                className="inline-flex items-center justify-center rounded-full bg-foreground text-background px-8 py-3 text-base font-medium hover:bg-foreground/90 transition-colors"
              >
                Browse blocks
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="py-12 md:pb-20 md:pt-12 px-4 lg:px-24 space-y-12 md:space-y-16 bg-white dark:bg-[#0a0a0a]">
        <Tabs defaultValue="product-selection" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0 justify-center">
            {useCases.map((useCase) => (
              <TabsTrigger
                key={useCase.id}
                value={useCase.id}
                className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-full px-4 py-1.5 text-sm"
              >
                {useCase.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {useCases.map((useCase) => (
            <TabsContent key={useCase.id} value={useCase.id} className="mt-6">
              <Tabs defaultValue="chatgpt" className="w-full">
                <div className="flex justify-center">
                  <TabsList className="inline-flex h-auto gap-1 bg-muted/50 p-1 rounded-lg mb-4">
                    <TabsTrigger
                      value="chatgpt"
                      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                    >
                      <ChatGPTIcon className="h-4 w-4" />
                      ChatGPT
                    </TabsTrigger>
                    <TabsTrigger
                      value="claude"
                      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                    >
                      <ClaudeIcon className="h-4 w-4" />
                      Claude
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="chatgpt" className="mt-0">
                  <ChatDemo messages={useCase.messages} variant="chatgpt" />
                </TabsContent>
                <TabsContent value="claude" className="mt-0">
                  <ChatDemo messages={useCase.messages} variant="claude" />
                </TabsContent>
              </Tabs>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
