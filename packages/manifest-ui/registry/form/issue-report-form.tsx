'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Paperclip, Send, X } from 'lucide-react'
import { useRef, useState } from 'react'

const defaultTeams = [
  'Engineering',
  'Product',
  'Design',
  'Marketing',
  'Sales',
  'Support',
  'HR',
  'Finance',
  'Operations'
]

const defaultLocations = [
  'New York - HQ',
  'San Francisco - Office',
  'Chicago - Branch',
  'Austin - Hub',
  'Remote'
]

const defaultCategories: Record<string, string[]> = {
  Software: [
    'Business App',
    'Email',
    'Browser',
    'VPN',
    'Office Suite',
    'Other Software'
  ],
  Hardware: [
    'Computer',
    'Monitor',
    'Keyboard/Mouse',
    'Printer',
    'Phone',
    'Other Hardware'
  ],
  Network: ['Internet Connection', 'WiFi', 'Server Access', 'File Sharing'],
  Access: ['User Account', 'Permissions', 'Badge/Physical Access'],
  Other: ['General Request', 'Suggestion', 'Other']
}

const defaultImpacts = [
  { value: 'critical', label: 'Critical - Complete Blocker' },
  { value: 'high', label: 'High - Severely Degraded' },
  { value: 'medium', label: 'Medium - Partially Impacted' },
  { value: 'low', label: 'Low - Minor Inconvenience' }
]

const defaultUrgencies = [
  { value: 'immediate', label: 'Immediate' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'flexible', label: 'Flexible' }
]

const defaultFrequencies = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'frequent', label: 'Frequent (multiple times/day)' },
  { value: 'occasional', label: 'Occasional (few times/week)' },
  { value: 'rare', label: 'Rare (first time)' }
]

const defaultAttemptedActions = [
  'Restarted computer',
  'Restarted application',
  'Checked cables',
  'Tested on another machine',
  'Cleared cache',
  'Asked a colleague'
]

/**
 * Props for the IssueReportForm component.
 * @interface IssueReportFormProps
 * @property {object} [data] - Configuration data for the form
 * @property {string} [data.title] - Form title displayed at the top
 * @property {string[]} [data.teams] - List of team options for the dropdown
 * @property {string[]} [data.locations] - List of location options
 * @property {Record<string, string[]>} [data.categories] - Category to subcategory mapping
 * @property {{ value: string; label: string }[]} [data.impacts] - Impact level options
 * @property {{ value: string; label: string }[]} [data.urgencies] - Urgency level options
 * @property {{ value: string; label: string }[]} [data.frequencies] - Frequency options
 * @property {string[]} [data.attemptedActions] - Pre-defined actions user may have tried
 * @property {object} [actions] - Callback functions for form events
 * @property {function} [actions.onSubmit] - Called when the form is submitted
 * @property {object} [appearance] - Visual customization options
 * @property {boolean} [appearance.showTitle] - Whether to display the title
 * @property {boolean} [appearance.compactMode] - Use compact layout
 */
export interface IssueReportFormProps {
  data?: {
    title?: string
    teams?: string[]
    locations?: string[]
    categories?: Record<string, string[]>
    impacts?: { value: string; label: string }[]
    urgencies?: { value: string; label: string }[]
    frequencies?: { value: string; label: string }[]
    attemptedActions?: string[]
  }
  actions?: {
    onSubmit?: (formData: IssueFormData) => void
  }
  appearance?: {
    showTitle?: boolean
    compactMode?: boolean
  }
}

/**
 * Data structure representing an issue report submission.
 * @interface IssueFormData
 * @property {string} declarantName - Name of the person reporting the issue
 * @property {string} email - Contact email for follow-up
 * @property {string} team - Department or team affected
 * @property {string} location - Office location
 * @property {string} office - Specific office or area identifier
 * @property {string} workstation - Machine or workstation identifier
 * @property {string} category - Main issue category (e.g., 'Software', 'Hardware')
 * @property {string} subcategory - Specific subcategory within the main category
 * @property {string} issueTitle - Brief summary of the issue
 * @property {string} description - Detailed description of the problem
 * @property {string} impact - Impact level (critical, high, medium, low)
 * @property {string} urgency - How urgent the fix is needed
 * @property {string} frequency - How often the issue occurs
 * @property {string} startDate - When the issue first occurred
 * @property {string[]} attemptedActions - List of troubleshooting actions already tried
 * @property {File[]} attachments - Supporting files (screenshots, logs, etc.)
 * @property {string} additionalComments - Any extra information
 */
export interface IssueFormData {
  declarantName: string
  email: string
  team: string
  location: string
  office: string
  workstation: string
  category: string
  subcategory: string
  issueTitle: string
  description: string
  impact: string
  urgency: string
  frequency: string
  startDate: string
  attemptedActions: string[]
  attachments: File[]
  additionalComments: string
}

/**
 * A comprehensive issue reporting form for IT support, help desk, or internal ticketing systems.
 * Includes categorization, impact assessment, and file attachments.
 *
 * Features:
 * - Reporter information (name, email)
 * - Team and location selection
 * - Category with dynamic subcategories
 * - Impact, urgency, and frequency assessment
 * - Collapsible sections for detailed context
 * - Pre-defined troubleshooting actions checklist
 * - Multiple file attachment support
 * - Office/workstation identification
 *
 * @component
 * @example
 * ```tsx
 * <IssueReportForm
 *   data={{
 *     title: "Report a Problem",
 *     teams: ["Engineering", "Design", "Product"],
 *     categories: {
 *       "Software": ["Email", "Browser", "VPN"],
 *       "Hardware": ["Computer", "Monitor", "Keyboard"]
 *     }
 *   }}
 *   actions={{
 *     onSubmit: (data) => console.log("Issue reported:", data)
 *   }}
 *   appearance={{ showTitle: true, compactMode: true }}
 * />
 * ```
 */
export function IssueReportForm({
  data,
  actions,
  appearance
}: IssueReportFormProps) {
  const {
    title = 'Report an Issue',
    teams = defaultTeams,
    locations = defaultLocations,
    categories = defaultCategories,
    impacts = defaultImpacts,
    urgencies = defaultUrgencies,
    frequencies = defaultFrequencies,
    attemptedActions = defaultAttemptedActions
  } = data ?? {}
  const { onSubmit } = actions ?? {}
  const { showTitle = true } = appearance ?? {}

  const [formData, setFormData] = useState<IssueFormData>({
    declarantName: '',
    email: '',
    team: '',
    location: '',
    office: '',
    workstation: '',
    category: '',
    subcategory: '',
    issueTitle: '',
    description: '',
    impact: '',
    urgency: '',
    frequency: '',
    startDate: '',
    attemptedActions: [],
    attachments: [],
    additionalComments: ''
  })

  const [expandedSection, setExpandedSection] = useState<
    'details' | 'context' | null
  >('details')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const subcategories = formData.category
    ? categories[formData.category] || []
    : []

  const updateField = <K extends keyof IssueFormData>(
    field: K,
    value: IssueFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleCategoryChange = (value: string) => {
    setFormData((prev) => ({ ...prev, category: value, subcategory: '' }))
  }

  const toggleAttemptedAction = (action: string) => {
    setFormData((prev) => ({
      ...prev,
      attemptedActions: prev.attemptedActions.includes(action)
        ? prev.attemptedActions.filter((a) => a !== action)
        : [...prev.attemptedActions, action]
    }))
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...files]
    }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = () => {
    onSubmit?.(formData)
  }

  const toggleSection = (section: 'details' | 'context') => {
    setExpandedSection((prev) => (prev === section ? null : section))
  }

  return (
    <div className="w-full bg-card rounded-xl p-4">
      {showTitle && (
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>
      )}

      <div className="space-y-3">
        {/* Declarant Info - Always visible */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Name
            </Label>
            <Input
              placeholder="Your name"
              value={formData.declarantName}
              onChange={(e) => updateField('declarantName', e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Email
            </Label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>

        {/* Team, Location, Category, Subcategory - 2 cols on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="min-w-0">
            <Label className="text-xs text-muted-foreground mb-1 block">
              Team
            </Label>
            <Select
              value={formData.team}
              onValueChange={(v) => updateField('team', v)}
            >
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team} value={team}>
                    {team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="text-xs text-muted-foreground mb-1 block">
              Location
            </Label>
            <Select
              value={formData.location}
              onValueChange={(v) => updateField('location', v)}
            >
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="text-xs text-muted-foreground mb-1 block">
              Category
            </Label>
            <Select
              value={formData.category}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(categories).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="text-xs text-muted-foreground mb-1 block">
              Subcategory
            </Label>
            <Select
              value={formData.subcategory}
              onValueChange={(v) => updateField('subcategory', v)}
              disabled={!formData.category}
            >
              <SelectTrigger className="h-9 text-sm w-full">
                <SelectValue
                  placeholder={formData.category ? 'Select' : 'Pick category'}
                />
              </SelectTrigger>
              <SelectContent>
                {subcategories.map((sub) => (
                  <SelectItem key={sub} value={sub}>
                    {sub}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Issue Title */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">
            Issue Title
          </Label>
          <Input
            placeholder="Summarize your issue in a few words"
            value={formData.issueTitle}
            onChange={(e) => updateField('issueTitle', e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        {/* Description */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">
            Description
          </Label>
          <textarea
            placeholder="Describe the issue in detail..."
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:border-primary bg-background min-h-[80px]"
          />
        </div>

        {/* Collapsible: Details Section */}
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('details')}
            className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-foreground bg-muted/50 hover:bg-muted transition-colors"
          >
            <span>Impact & Urgency</span>
            {expandedSection === 'details' ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <div
            className={cn(
              'overflow-hidden transition-all duration-200',
              expandedSection === 'details' ? 'max-h-[500px] p-3' : 'max-h-0'
            )}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="min-w-0">
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Impact
                </Label>
                <Select
                  value={formData.impact}
                  onValueChange={(v) => updateField('impact', v)}
                >
                  <SelectTrigger className="h-9 text-sm w-full">
                    <SelectValue placeholder="Impact" />
                  </SelectTrigger>
                  <SelectContent>
                    {impacts.map((imp) => (
                      <SelectItem key={imp.value} value={imp.value}>
                        {imp.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Urgency
                </Label>
                <Select
                  value={formData.urgency}
                  onValueChange={(v) => updateField('urgency', v)}
                >
                  <SelectTrigger className="h-9 text-sm w-full">
                    <SelectValue placeholder="Urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    {urgencies.map((urg) => (
                      <SelectItem key={urg.value} value={urg.value}>
                        {urg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Frequency
                </Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(v) => updateField('frequency', v)}
                >
                  <SelectTrigger className="h-9 text-sm w-full">
                    <SelectValue placeholder="Frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {frequencies.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value}>
                        {freq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Start Date
                </Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => updateField('startDate', e.target.value)}
                  className="h-9 text-sm w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible: Context Section */}
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('context')}
            className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-foreground bg-muted/50 hover:bg-muted transition-colors"
          >
            <span>Additional Context</span>
            {expandedSection === 'context' ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <div
            className={cn(
              'overflow-hidden transition-all duration-200',
              expandedSection === 'context' ? 'max-h-[500px] p-3' : 'max-h-0'
            )}
          >
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Actions Already Tried
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {attemptedActions.map((action) => (
                    <button
                      key={action}
                      onClick={() => toggleAttemptedAction(action)}
                      className={cn(
                        'px-2 py-1 text-xs rounded-md border transition-colors',
                        formData.attemptedActions.includes(action)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:border-primary'
                      )}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Left column: Office and Workstation stacked */}
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      Office / Area
                    </Label>
                    <Input
                      placeholder="E.g.: Office 3B"
                      value={formData.office}
                      onChange={(e) => updateField('office', e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      Workstation / Machine
                    </Label>
                    <Input
                      placeholder="E.g.: PC-DEV-042"
                      value={formData.workstation}
                      onChange={(e) =>
                        updateField('workstation', e.target.value)
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                {/* Right column: Comments matching height of left column */}
                <div className="flex flex-col">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Comments
                  </Label>
                  <textarea
                    placeholder="Additional information..."
                    value={formData.additionalComments}
                    onChange={(e) =>
                      updateField('additionalComments', e.target.value)
                    }
                    className="flex-1 w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:border-primary bg-background"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Attachments */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          {formData.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {formData.attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs"
                >
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[100px] truncate">{file.name}</span>
                  <button
                    onClick={() => removeFile(index)}
                    aria-label="Remove file"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-9 w-full sm:w-auto"
          >
            <Paperclip className="h-4 w-4 mr-1.5" />
            Attach a file
          </Button>
          <Button
            onClick={handleSubmit}
            size="sm"
            className="h-9 w-full sm:w-auto"
          >
            <Send className="h-4 w-4 mr-1.5" />
            Submit
          </Button>
        </div>
      </div>
    </div>
  )
}
