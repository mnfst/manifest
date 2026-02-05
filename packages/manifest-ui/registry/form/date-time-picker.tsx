'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { ArrowLeft, ChevronLeft, ChevronRight, Globe, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { demoDateTimePickerData } from './demo/form'

/** Timezone configuration using IANA timezone identifiers for correct DST handling */
const timezones = [
  { id: 'pacific', name: 'Pacific Time - US & Canada', iana: 'America/Los_Angeles' },
  { id: 'mountain', name: 'Mountain Time - US & Canada', iana: 'America/Denver' },
  { id: 'central', name: 'Central Time - US & Canada', iana: 'America/Chicago' },
  { id: 'eastern', name: 'Eastern Time - US & Canada', iana: 'America/New_York' },
  { id: 'alaska', name: 'Alaska Time', iana: 'America/Anchorage' },
  { id: 'arizona', name: 'Arizona, Yukon Time', iana: 'America/Phoenix' },
  { id: 'newfoundland', name: 'Newfoundland Time', iana: 'America/St_Johns' },
  { id: 'atlantic', name: 'Atlantic Time - Canada', iana: 'America/Halifax' },
  { id: 'london', name: 'London, Dublin, Edinburgh', iana: 'Europe/London' },
  { id: 'paris', name: 'Paris, Berlin, Amsterdam', iana: 'Europe/Paris' },
  { id: 'athens', name: 'Athens, Helsinki, Istanbul', iana: 'Europe/Athens' },
  { id: 'moscow', name: 'Moscow, St. Petersburg', iana: 'Europe/Moscow' },
  { id: 'dubai', name: 'Dubai, Abu Dhabi', iana: 'Asia/Dubai' },
  { id: 'karachi', name: 'Karachi, Islamabad', iana: 'Asia/Karachi' },
  { id: 'dhaka', name: 'Dhaka, Almaty', iana: 'Asia/Dhaka' },
  { id: 'bangkok', name: 'Bangkok, Hanoi, Jakarta', iana: 'Asia/Bangkok' },
  { id: 'singapore', name: 'Singapore, Hong Kong, Perth', iana: 'Asia/Singapore' },
  { id: 'tokyo', name: 'Tokyo, Seoul, Osaka', iana: 'Asia/Tokyo' },
  { id: 'sydney', name: 'Sydney, Melbourne, Brisbane', iana: 'Australia/Sydney' },
  { id: 'auckland', name: 'Auckland, Wellington', iana: 'Pacific/Auckland' }
]

const getTimeForTimezone = (iana: string) => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date()).toLowerCase()
  } catch {
    return ''
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DateTimePickerProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the DateTimePicker component with calendar view, available time
 * slots, and timezone selection.
 */
export interface DateTimePickerProps {
  data?: {
    /** Title displayed at the top of the picker. */
    title?: string
    /** Array of dates that can be selected. */
    availableDates?: Date[]
    /** Array of time slot strings (e.g., '11:30am'). */
    availableTimeSlots?: string[]
    /** Default timezone name to display. */
    timezone?: string
  }
  actions?: {
    /** Called when the user clicks the Next button. */
    onNext?: (date: Date, time: string) => void
  }
  appearance?: {
    /**
     * Whether to display the title.
     * @default true
     */
    showTitle?: boolean
    /**
     * Whether to show timezone selector.
     * @default true
     */
    showTimezone?: boolean
    /**
     * First day of the week.
     * - `'sunday'` — US, Canada, Japan (default)
     * - `'monday'` — ISO 8601, Europe, most of the world
     * - `'saturday'` — Middle East
     * @default 'sunday'
     */
    weekStartsOn?: 'sunday' | 'monday' | 'saturday'
  }
  control?: {
    /** Controlled selected date value. */
    selectedDate?: Date | null
    /** Controlled selected time value. */
    selectedTime?: string | null
  }
}

const ALL_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const WEEK_START_OFFSETS: Record<'sunday' | 'monday' | 'saturday', number> = {
  sunday: 0,
  monday: 1,
  saturday: 6,
}

const getOrderedDays = (weekStartsOn: 'sunday' | 'monday' | 'saturday') => {
  const offset = WEEK_START_OFFSETS[weekStartsOn]
  return [...ALL_DAYS.slice(offset), ...ALL_DAYS.slice(0, offset)]
}
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]



const formatDateHeader = (date: Date) => {
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()]
  const monthName = MONTHS[date.getMonth()]
  return `${dayName}, ${monthName} ${date.getDate()}`
}

const isSameDay = (date1: Date, date2: Date) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * A Calendly-style date and time picker with calendar view, available time slots,
 * and timezone selection. Supports both desktop and mobile layouts.
 *
 * Features:
 * - Monthly calendar navigation with available date highlighting
 * - Time slot selection with animated transitions
 * - Searchable timezone dropdown with current time display
 * - Responsive design with mobile-first time view
 * - Today indicator and selected date highlighting
 * - Controlled and uncontrolled modes
 *
 * @component
 * @example
 * ```tsx
 * <DateTimePicker
 *   data={{
 *     title: "Schedule a Meeting",
 *     availableDates: [new Date('2024-01-15'), new Date('2024-01-16')],
 *     availableTimeSlots: ['9:00am', '10:00am', '2:00pm'],
 *     timezone: "Pacific Time - US & Canada"
 *   }}
 *   actions={{
 *     onSelect: (date, time) => console.log("Selected:", date, time),
 *     onNext: (date, time) => console.log("Proceeding with:", date, time)
 *   }}
 *   appearance={{ showTitle: true, showTimezone: true }}
 * />
 * ```
 */
export function DateTimePicker({ data, actions, appearance, control }: DateTimePickerProps) {
  const resolved: NonNullable<DateTimePickerProps['data']> = data ?? demoDateTimePickerData
  const title = resolved.title
  const availableDates = resolved.availableDates ?? []
  const availableTimeSlots = resolved.availableTimeSlots ?? []
  const timezone = resolved.timezone
  const { onNext } = actions ?? {}
  const { showTitle = true, showTimezone = true, weekStartsOn = 'sunday' } = appearance ?? {}
  const orderedDays = getOrderedDays(weekStartsOn)
  const weekStartOffset = WEEK_START_OFFSETS[weekStartsOn]
  const {
    selectedDate: controlledDate,
    selectedTime: controlledTime
  } = control ?? {}

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<Date | null>(controlledDate ?? null)
  const [selectedTime, setSelectedTime] = useState<string | null>(controlledTime ?? null)
  const [selectedTimezone, setSelectedTimezone] = useState(timezones.find(tz => tz.name === timezone) || timezones[3])
  const [timezoneSearch, setTimezoneSearch] = useState('')
  const [timezoneDropdownOpen, setTimezoneDropdownOpen] = useState(false)
  const timezoneSearchRef = useRef<HTMLInputElement>(null)
  // Mobile view mode: 'calendar' or 'time'
  const [mobileView, setMobileView] = useState<'calendar' | 'time'>('calendar')

  const filteredTimezones = timezones.filter(tz =>
    tz.name.toLowerCase().includes(timezoneSearch.toLowerCase())
  )

  useEffect(() => {
    if (timezoneDropdownOpen && timezoneSearchRef.current) {
      timezoneSearchRef.current.focus()
    }
  }, [timezoneDropdownOpen])

  const handleTimezoneSelect = (tz: typeof timezones[0]) => {
    setSelectedTimezone(tz)
    setTimezoneDropdownOpen(false)
    setTimezoneSearch('')
  }

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  // Calculate calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const calendarDays: { day: number; isCurrentMonth: boolean; date: Date }[] = []

  // Previous month days (adjusted for week start)
  const leadingDays = (firstDayOfMonth - weekStartOffset + 7) % 7
  for (let i = leadingDays - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    calendarDays.push({
      day,
      isCurrentMonth: false,
      date: new Date(year, month - 1, day)
    })
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({
      day,
      isCurrentMonth: true,
      date: new Date(year, month, day)
    })
  }

  // Next month days to fill the grid (6 rows max)
  const totalCells = Math.ceil(calendarDays.length / 7) * 7
  const remainingDays = totalCells - calendarDays.length
  for (let day = 1; day <= remainingDays; day++) {
    calendarDays.push({
      day,
      isCurrentMonth: false,
      date: new Date(year, month + 1, day)
    })
  }

  const isDateAvailable = (date: Date) => {
    return availableDates.some(d => isSameDay(d, date))
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1))
  }

  const handleDateSelect = (date: Date) => {
    if (!isDateAvailable(date)) return
    setSelectedDate(date)
    setSelectedTime(null)
    // On mobile, switch to time view when date is selected
    setMobileView('time')
  }

  const handleBackToCalendar = () => {
    setMobileView('calendar')
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time)
  }

  const handleNext = () => {
    if (selectedDate && selectedTime) {
      onNext?.(selectedDate, selectedTime)
    }
  }

  const now = new Date()

  return (
    <div className="w-full bg-card rounded-xl p-6">
      {showTitle && title && (
        <h2 className="text-xl font-semibold text-foreground mb-6">{title}</h2>
      )}

      <div className="flex justify-center">
        {/* Calendar Section - Hidden on mobile when viewing time slots */}
        <div className={cn(
          "w-[304px] flex-shrink-0",
          mobileView === 'time' ? 'hidden md:block' : 'block'
        )}>
          {/* Month Navigation */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <span className="text-base font-medium text-foreground min-w-[140px] text-center">
              {MONTHS[month]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              aria-label="Next month"
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 mb-2">
            {orderedDays.map(day => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {calendarDays.map((item, index) => {
              const isAvailable = item.isCurrentMonth && isDateAvailable(item.date)
              const isSelected = selectedDate && isSameDay(item.date, selectedDate)
              const isToday = isSameDay(item.date, now)

              return (
                <button
                  key={index}
                  onClick={() => item.isCurrentMonth && handleDateSelect(item.date)}
                  disabled={!item.isCurrentMonth || !isAvailable}
                  className={cn(
                    'relative h-10 w-10 rounded-full text-sm transition-all duration-200 flex items-center justify-center mx-auto',
                    !item.isCurrentMonth && 'text-muted-foreground/30',
                    item.isCurrentMonth && !isAvailable && 'text-muted-foreground cursor-default',
                    item.isCurrentMonth && isAvailable && !isSelected && 'text-primary font-medium hover:bg-primary/10 cursor-pointer',
                    isSelected && 'bg-primary text-primary-foreground font-medium',
                    isAvailable && !isSelected && 'bg-primary/10'
                  )}
                >
                  {item.day}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-foreground" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Timezone */}
          {showTimezone && (
            <div className="mt-6">
              <p className="text-sm font-medium text-foreground mb-2">Time zone</p>
              <Popover open={timezoneDropdownOpen} onOpenChange={setTimezoneDropdownOpen}>
                <PopoverTrigger asChild>
                  <button
                    aria-label="Select timezone"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Globe className="h-4 w-4" />
                    <span>{selectedTimezone.name} ({getTimeForTimezone(selectedTimezone.iana)})</span>
                    <ChevronRight className={cn("h-3 w-3 transition-transform", timezoneDropdownOpen ? "rotate-90" : "rotate-0")} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        ref={timezoneSearchRef}
                        type="text"
                        placeholder="Search timezone..."
                        value={timezoneSearch}
                        onChange={(e) => setTimezoneSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:border-primary bg-background"
                      />
                    </div>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto">
                    {filteredTimezones.map((tz) => (
                      <button
                        key={tz.id}
                        onClick={() => handleTimezoneSelect(tz)}
                        className={cn(
                          "w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors flex items-center justify-between",
                          selectedTimezone.id === tz.id && "bg-muted"
                        )}
                      >
                        <span className="text-foreground">{tz.name}</span>
                        <span className="text-muted-foreground text-xs">{getTimeForTimezone(tz.iana)}</span>
                      </button>
                    ))}
                    {filteredTimezones.length === 0 && (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        No timezone found
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {/* Time Slots Section - Visible on mobile when viewing times, animated on desktop */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-300 ease-out',
            // Mobile: show/hide based on mobileView, full width
            mobileView === 'time' ? 'block w-full md:w-[200px]' : 'hidden md:block',
            // Desktop: animate width based on selectedDate
            selectedDate ? 'md:w-[200px] md:opacity-100 md:ml-8' : 'md:w-0 md:opacity-0 md:ml-0'
          )}
        >
          <div className="w-full md:w-[200px]">
            {/* Back button - Mobile only */}
            <button
              onClick={handleBackToCalendar}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 md:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to calendar</span>
            </button>

            <p className="text-base font-medium text-foreground mb-4 whitespace-nowrap">
              {selectedDate ? formatDateHeader(selectedDate) : ''}
            </p>

            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {availableTimeSlots.map((time) => {
                const isTimeSelected = selectedTime === time

                return (
                  <div key={time} className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleTimeSelect(time)}
                      className={cn(
                        'h-[52px] rounded-lg border text-sm font-semibold transition-all duration-200',
                        isTimeSelected
                          ? 'bg-muted-foreground text-background border-muted-foreground'
                          : 'col-span-2 border-primary text-primary hover:bg-primary/5'
                      )}
                    >
                      {time}
                    </button>
                    {isTimeSelected && (
                      <Button
                        onClick={handleNext}
                        className="h-[52px] animate-in fade-in slide-in-from-left-2 duration-200"
                      >
                        Next
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
