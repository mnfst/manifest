// Demo data for Form category components
// This file contains sample data used for component previews and documentation

/**
 * Generate available dates dynamically so the DateTimePicker preview
 * always has clickable dates regardless of when it is viewed.
 */
function generateAvailableDates(): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  // Walk through current and next month, only keeping weekdays (Mon-Fri)
  for (let m = 0; m <= 1; m++) {
    for (let d = 1; d <= 28; d += 2) {
      const date = new Date(now.getFullYear(), now.getMonth() + m, d);
      const day = date.getDay();
      if (day !== 0 && day !== 6) {
        dates.push(date);
      }
    }
  }
  return dates;
}

export const demoContactFormData = {
  title: 'Get in Touch',
  subtitle: "We'd love to hear from you. Fill out the form below.",
  submitLabel: 'Send Message',
}

export const demoIssueReportFormData = {
  title: 'Report an Issue',
  teams: ['Engineering', 'Product', 'Design', 'Marketing', 'Operations'],
  locations: ['New York - HQ', 'San Francisco', 'London', 'Remote'],
  categories: {
    Software: ['Business App', 'Email', 'VPN', 'Browser', 'OS'],
    Hardware: ['Computer', 'Monitor', 'Keyboard', 'Mouse', 'Printer'],
    Network: ['Wi-Fi', 'Ethernet', 'VPN Access'],
    Access: ['Account', 'Permissions', 'Password Reset'],
  } as Record<string, string[]>,
  impacts: [
    { value: 'critical', label: 'Critical - Work stopped' },
    { value: 'high', label: 'High - Major feature broken' },
    { value: 'medium', label: 'Medium - Workaround available' },
    { value: 'low', label: 'Low - Minor inconvenience' },
  ],
  urgencies: [
    { value: 'immediate', label: 'Immediate' },
    { value: 'today', label: 'Today' },
    { value: 'this-week', label: 'This week' },
    { value: 'no-rush', label: 'No rush' },
  ],
  frequencies: [
    { value: 'constant', label: 'Constant' },
    { value: 'frequent', label: 'Frequent' },
    { value: 'occasional', label: 'Occasional' },
    { value: 'once', label: 'Happened once' },
  ],
  attemptedActions: [
    'Restarted the application',
    'Cleared browser cache',
    'Restarted computer',
    'Checked internet connection',
    'Contacted a colleague',
  ],
}

export const demoDateTimePickerData = {
  title: 'Select a Date & Time',
  availableDates: generateAvailableDates(),
  availableTimeSlots: [
    '9:00am',
    '10:00am',
    '11:30am',
    '1:00pm',
    '2:30pm',
    '4:00pm',
  ],
  timezone: 'Eastern Time - US & Canada',
};
