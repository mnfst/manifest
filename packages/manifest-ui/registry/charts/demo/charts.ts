import type { ChartDefinition } from '../types'

export const demoAreaChart: ChartDefinition = {
  title: 'Monthly Revenue',
  bigNumber: '$45,231',
  description: 'Total revenue over the last 6 months',
  type: 'area',
  dataKey: 'month',
  data: [
    { month: 'Jan', revenue: 4000 },
    { month: 'Feb', revenue: 3000 },
    { month: 'Mar', revenue: 5000 },
    { month: 'Apr', revenue: 4500 },
    { month: 'May', revenue: 6000 },
    { month: 'Jun', revenue: 5500 },
  ],
  config: {
    revenue: { label: 'Revenue', color: '#ec4899' },
  },
}

export const demoBarChart: ChartDefinition = {
  title: 'Browser Usage',
  bigNumber: '1,247',
  description: 'Visitor count by browser this month',
  type: 'bar',
  dataKey: 'browser',
  data: [
    { browser: 'Chrome', visitors: 275 },
    { browser: 'Safari', visitors: 200 },
    { browser: 'Firefox', visitors: 187 },
    { browser: 'Edge', visitors: 173 },
    { browser: 'Opera', visitors: 90 },
  ],
  config: {
    visitors: { label: 'Visitors', color: '#a855f7' },
  },
}

export const demoLineChart: ChartDefinition = {
  title: 'Page Views',
  bigNumber: '12,540',
  description: 'Desktop vs mobile traffic',
  type: 'line',
  dataKey: 'month',
  data: [
    { month: 'Jan', desktop: 186, mobile: 80 },
    { month: 'Feb', desktop: 305, mobile: 200 },
    { month: 'Mar', desktop: 237, mobile: 120 },
    { month: 'Apr', desktop: 273, mobile: 190 },
    { month: 'May', desktop: 209, mobile: 130 },
    { month: 'Jun', desktop: 314, mobile: 140 },
  ],
  config: {
    desktop: { label: 'Desktop', color: '#ec4899' },
    mobile: { label: 'Mobile', color: '#06b6d4' },
  },
  showLegend: true,
}

export const demoPieChart: ChartDefinition = {
  title: 'Market Share',
  description: 'Distribution by product category',
  type: 'pie',
  dataKey: 'category',
  data: [
    { category: 'Electronics', sales: 450 },
    { category: 'Clothing', sales: 300 },
    { category: 'Food', sales: 250 },
    { category: 'Books', sales: 150 },
    { category: 'Sports', sales: 100 },
  ],
  config: {
    electronics: { label: 'Electronics', color: '#ec4899' },
    clothing: { label: 'Clothing', color: '#a855f7' },
    food: { label: 'Food', color: '#06b6d4' },
    books: { label: 'Books', color: '#10b981' },
    sports: { label: 'Sports', color: '#f59e0b' },
  },
}

export const demoRadarChart: ChartDefinition = {
  title: 'Skill Assessment',
  description: 'Team capabilities across key areas',
  type: 'radar',
  dataKey: 'skill',
  data: [
    { skill: 'Frontend', level: 85 },
    { skill: 'Backend', level: 90 },
    { skill: 'Design', level: 70 },
    { skill: 'DevOps', level: 75 },
    { skill: 'Testing', level: 80 },
    { skill: 'Security', level: 65 },
  ],
  config: {
    level: { label: 'Skill Level', color: '#d946ef' },
  },
}

export const demoRadialChart: ChartDefinition = {
  title: 'Completion Rate',
  bigNumber: '78%',
  description: 'Tasks completed this quarter',
  type: 'radial',
  dataKey: 'name',
  data: [
    { name: 'Completed', value: 78, fill: '#ec4899' },
    { name: 'In Progress', value: 15, fill: '#a855f7' },
    { name: 'Pending', value: 7, fill: '#06b6d4' },
  ],
  config: {
    completed: { label: 'Completed', color: '#ec4899' },
    inProgress: { label: 'In Progress', color: '#a855f7' },
    pending: { label: 'Pending', color: '#06b6d4' },
  },
}

/** All demo charts for preview (one per chart type). */
export const demoCharts: ChartDefinition[] = [
  demoAreaChart,
  demoBarChart,
  demoLineChart,
  demoPieChart,
  demoRadarChart,
  demoRadialChart,
]
