// Demo data for Miscellaneous category components
// This file contains sample data used for component previews and documentation

export const demoStats = [
  { label: 'Revenue', value: '$12,345', change: 12.5 },
  { label: 'Orders', value: '1,234', change: -3.2 },
  { label: 'Customers', value: '567', change: 8.1 },
]

export const demoHeroDefault = {
  logo1: { text: 'Acme', alt: 'Acme' },
  title: 'Build beautiful chat experiences with Manifest UI',
  subtitle:
    'Create beautiful chat experiences with our comprehensive component library designed for agentic applications.',
  primaryButton: { label: 'Get Started' },
  secondaryButton: { label: 'GitHub' },
}

export const demoHeroTwoLogos = {
  logo1: { text: 'Acme' },
  logo2: {
    url: '/logo-manifest-ui.svg',
    urlLight: '/logo-manifest-ui-light.svg',
    alt: 'Manifest',
  },
  logoSeparator: 'x',
  title: 'Acme x Manifest UI',
  subtitle:
    'Combining the best of both worlds to deliver exceptional user experiences.',
  primaryButton: { label: 'Get Started' },
  secondaryButton: { label: 'GitHub' },
}

export const demoHeroWithTechLogos = {
  logo1: { text: 'Acme' },
  title: 'Build your next project with Acme',
  subtitle:
    'Create beautiful experiences with our comprehensive platform designed for modern applications.',
  primaryButton: { label: 'Get Started' },
  secondaryButton: { label: 'GitHub' },
  techLogosLabel: 'Built with open-source technologies',
  techLogos: [
    {
      url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg',
      alt: 'Next.js',
      name: 'Next.js',
    },
    {
      url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',
      alt: 'TypeScript',
      name: 'TypeScript',
    },
    {
      url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg',
      alt: 'React',
      name: 'React',
    },
    {
      url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg',
      alt: 'Tailwind CSS',
      name: 'Tailwind CSS',
    },
    {
      url: 'https://ui.manifest.build/demo/os-tech-mnfst.svg',
      alt: 'Manifest',
      name: 'Manifest',
    },
  ],
}

export const demoHeroMinimal = {
  logo1: undefined,
  title: 'Welcome to the Future',
  subtitle: 'A simple, clean hero without logos or extra elements.',
  primaryButton: { label: 'Get Started' },
  secondaryButton: undefined,
}
