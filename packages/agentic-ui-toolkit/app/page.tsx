'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChatDemo } from '@/components/chat/chat-demo'
import { InlineProductCarousel } from '@/registry/inline/inline-product-carousel'
import { InlineOrderConfirm } from '@/registry/inline/inline-order-confirm'
import { InlinePaymentMethods } from '@/registry/inline/inline-payment-methods'
import { InlinePaymentConfirmed } from '@/registry/inline/inline-payment-confirmed'
import { InlineProgressSteps } from '@/registry/inline/inline-progress-steps'
import { InlineQuickReply } from '@/registry/inline/inline-quick-reply'
import { InlineOptionList } from '@/registry/inline/inline-option-list'
import { InlineStats } from '@/registry/inline/inline-stat-card'

const useCases = [
  {
    id: 'product-selection',
    label: 'Product selection',
    messages: [
      {
        id: '1',
        role: 'user' as const,
        content: "I'm looking for new running shoes",
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: "Here are some popular running shoes that might interest you:",
        component: <InlineProductCarousel />,
      },
      {
        id: '3',
        role: 'user' as const,
        content: "I'll take the Air Force 1",
      },
      {
        id: '4',
        role: 'assistant' as const,
        content: "Great choice! Here's your order summary:",
        component: <InlineOrderConfirm />,
      },
    ],
  },
  {
    id: 'payment-workflow',
    label: 'Payment workflow',
    messages: [
      {
        id: '1',
        role: 'user' as const,
        content: "I'd like to complete my purchase",
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: "Please select your payment method:",
        component: <InlinePaymentMethods />,
      },
      {
        id: '3',
        role: 'user' as const,
        content: "Using my Visa card",
      },
      {
        id: '4',
        role: 'assistant' as const,
        content: "Payment successful!",
        component: <InlinePaymentConfirmed />,
      },
    ],
  },
  {
    id: 'book-meeting',
    label: 'Book a meeting',
    messages: [
      {
        id: '1',
        role: 'user' as const,
        content: "I need to schedule a meeting with the design team",
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: "What type of meeting would you like to book?",
        component: <InlineOptionList />,
      },
      {
        id: '3',
        role: 'user' as const,
        content: "Design review",
      },
      {
        id: '4',
        role: 'assistant' as const,
        content: "Here's the booking progress:",
        component: <InlineProgressSteps />,
      },
    ],
  },
  {
    id: 'ticket-buying',
    label: 'Ticket buying',
    messages: [
      {
        id: '1',
        role: 'user' as const,
        content: "I want to buy tickets for the concert next week",
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: "How many tickets would you like?",
        component: <InlineQuickReply />,
      },
      {
        id: '3',
        role: 'user' as const,
        content: "2 tickets please",
      },
      {
        id: '4',
        role: 'assistant' as const,
        content: "Your order is being processed:",
        component: <InlineProgressSteps />,
      },
    ],
  },
  {
    id: 'messaging',
    label: 'Messaging',
    messages: [
      {
        id: '1',
        role: 'user' as const,
        content: "What are my notification preferences?",
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: "Here are your current notification settings:",
        component: <InlineOptionList />,
      },
      {
        id: '3',
        role: 'user' as const,
        content: "Enable email notifications",
      },
      {
        id: '4',
        role: 'assistant' as const,
        content: "Settings updated! What else can I help with?",
        component: <InlineQuickReply />,
      },
    ],
  },
  {
    id: 'bank-account',
    label: 'Bank account overview',
    messages: [
      {
        id: '1',
        role: 'user' as const,
        content: "Show me my account overview",
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: "Here's your account summary:",
        component: <InlineStats />,
      },
      {
        id: '3',
        role: 'user' as const,
        content: "What quick actions can I take?",
      },
      {
        id: '4',
        role: 'assistant' as const,
        content: "Here are some quick actions:",
        component: <InlineQuickReply />,
      },
    ],
  },
]

export default function Home() {
  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">
            Agentic UI Components
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A collection of UI components designed for conversational interfaces.
            See how they work in a ChatGPT-like experience.
          </p>
        </div>

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
              <ChatDemo messages={useCase.messages} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
