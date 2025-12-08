'use client'

import Link from 'next/link'
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

function ChatGPTIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#D97757" fillRule="nonzero" />
    </svg>
  )
}

// Brand logos
function IyoLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect width="24" height="24" rx="6" fill="#000" />
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="system-ui">iyo</text>
    </svg>
  )
}

function StripeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect width="24" height="24" rx="4" fill="#635BFF" />
      <path d="M11.5 8.5c0-.83.68-1.5 1.5-1.5h2c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5h-2c-.82 0-1.5-.67-1.5-1.5v-7z" fill="white" />
      <path d="M7.5 10.5c0-.83.68-1.5 1.5-1.5h2c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5H9c-.82 0-1.5-.67-1.5-1.5v-5z" fill="white" fillOpacity="0.5" />
    </svg>
  )
}

function CalendlyLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect width="24" height="24" rx="4" fill="#006BFF" />
      <path d="M7 8h10M7 12h10M7 16h6" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function TicketmasterLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect width="24" height="24" rx="4" fill="#026CDF" />
      <path d="M6 9h12v6H6z" fill="white" />
      <path d="M10 9v6M14 9v6" stroke="#026CDF" strokeWidth="1.5" strokeDasharray="2 2" />
    </svg>
  )
}

function SlackLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M6 15a2 2 0 1 1 0-4h2v2a2 2 0 0 1-2 2z" fill="#E01E5A" />
      <path d="M9 13a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0v-5z" fill="#E01E5A" />
      <path d="M18 9a2 2 0 1 1 0 4h-2v-2a2 2 0 0 1 2-2z" fill="#36C5F0" />
      <path d="M15 11a2 2 0 1 1-4 0V6a2 2 0 1 1 4 0v5z" fill="#36C5F0" />
      <path d="M9 18a2 2 0 1 1 4 0v2a2 2 0 1 1-4 0v-2z" fill="#2EB67D" />
      <path d="M11 15a2 2 0 1 1 0-4h5a2 2 0 1 1 0 4h-5z" fill="#2EB67D" />
      <path d="M15 6a2 2 0 1 1-4 0V4a2 2 0 1 1 4 0v2z" fill="#ECB22E" />
      <path d="M13 9a2 2 0 1 1 0 4H8a2 2 0 1 1 0-4h5z" fill="#ECB22E" />
    </svg>
  )
}

function ChaseLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M2 8h8v3H5v5h14v-3h-8V8h3v5h8v3H2V8z" fill="#117ACA" />
    </svg>
  )
}

const useCases = [
  {
    id: 'product-selection',
    label: 'Product selection',
    messages: [
      {
        id: '1',
        role: 'user' as const,
        content: "I'm looking for premium wireless earbuds",
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: "Here are our best-selling audio products:",
        component: <InlineProductCarousel />,
        brand: { name: 'Iyo', logo: <IyoLogo className="h-4 w-4" /> },
        contentAfter: "Browse through our selection and let me know which one catches your eye. Each model offers different features to match your lifestyle.",
      },
      {
        id: '3',
        role: 'user' as const,
        content: "I'll take the Iyo Pro",
      },
      {
        id: '4',
        role: 'assistant' as const,
        content: "Excellent choice! Here's your order summary:",
        component: <InlineOrderConfirm />,
        brand: { name: 'Iyo', logo: <IyoLogo className="h-4 w-4" /> },
        contentAfter: "Please review the details and confirm when you're ready. Free shipping is included with your order.",
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
        brand: { name: 'Stripe', logo: <StripeLogo className="h-4 w-4" /> },
        contentAfter: "Your payment information is secured with end-to-end encryption. Select your preferred method to continue.",
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
        brand: { name: 'Stripe', logo: <StripeLogo className="h-4 w-4" /> },
        contentAfter: "You'll receive a confirmation email shortly. Is there anything else I can help you with?",
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
        brand: { name: 'Calendly', logo: <CalendlyLogo className="h-4 w-4" /> },
        contentAfter: "Select an option to see available time slots. I'll find the best times when everyone is free.",
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
        brand: { name: 'Calendly', logo: <CalendlyLogo className="h-4 w-4" /> },
        contentAfter: "I'll send you a calendar invite once confirmed. All participants will receive a notification as well.",
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
        brand: { name: 'Ticketmaster', logo: <TicketmasterLogo className="h-4 w-4" /> },
        contentAfter: "Select a quantity to proceed to seat selection. Premium seats are still available for this show.",
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
        brand: { name: 'Ticketmaster', logo: <TicketmasterLogo className="h-4 w-4" /> },
        contentAfter: "You'll receive your e-tickets via email within minutes. Make sure to save them to your phone for easy entry.",
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
        brand: { name: 'Slack', logo: <SlackLogo className="h-4 w-4" /> },
        contentAfter: "You can toggle any of these preferences. Changes will take effect immediately across all your devices.",
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
        brand: { name: 'Slack', logo: <SlackLogo className="h-4 w-4" /> },
        contentAfter: "Feel free to ask if you need help with anything else. I'm here to assist.",
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
        brand: { name: 'Chase', logo: <ChaseLogo className="h-4 w-4" /> },
        contentAfter: "Your account is in good standing with all payments up to date. Your next statement will be available on December 15th.",
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
        brand: { name: 'Chase', logo: <ChaseLogo className="h-4 w-4" /> },
        contentAfter: "Just tap any option to get started. You can also ask me to transfer funds or pay bills directly.",
      },
    ],
  },
]

export default function Home() {
  return (
    <div className="py-8">
      <div className="px-4 lg:px-24 space-y-8">
        <div className="text-center space-y-4 max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight">
            Agentic UI Components
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A collection of UI components designed for conversational interfaces.
            See how they work in ChatGPT and Claude.
          </p>
          <Link
            href="/blocks"
            className="inline-flex items-center justify-center rounded-full bg-foreground text-background px-6 py-2.5 text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            Get Started
          </Link>
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
              <Tabs defaultValue="chatgpt" className="w-full">
                <TabsList className="inline-flex h-auto gap-1 bg-muted/50 p-1 rounded-lg mb-4">
                  <TabsTrigger
                    value="chatgpt"
                    className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <ChatGPTIcon className="h-4 w-4" />
                    ChatGPT
                  </TabsTrigger>
                  <TabsTrigger
                    value="claude"
                    className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <ClaudeIcon className="h-4 w-4" />
                    Claude
                  </TabsTrigger>
                </TabsList>
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
