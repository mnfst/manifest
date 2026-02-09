/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', 'class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // Include registry component source files so their Tailwind classes
    // are present when components are compiled at runtime via Sucrase
    '../../manifest-ui/registry/**/*.{ts,tsx}',
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'Inter',
  				'system-ui',
  				'sans-serif'
  			],
  			mono: [
  				'Inconsolata',
  				'Hack',
  				'SF Mono',
  				'Roboto Mono',
  				'Source Code Pro',
  				'Ubuntu Mono',
  				'monospace'
  			]
  		},
  		letterSpacing: {
  			tighter: '-0.03em',
  			tight: '-0.02em',
  			normal: '0',
  			wide: '0.05em'
  		},
  		lineHeight: {
  			tight: '1.05',
  			snug: '1.25',
  			normal: '1.5',
  			relaxed: '1.6'
  		},
  		fontSize: {
  			'display-1': [
  				'4.768rem',
  				{
  					lineHeight: '1.05',
  					letterSpacing: '-0.03em'
  				}
  			],
  			'display-2': [
  				'2.986rem',
  				{
  					lineHeight: '1.05',
  					letterSpacing: '-0.03em'
  				}
  			],
  			'display-3': [
  				'2.488rem',
  				{
  					lineHeight: '1.05',
  					letterSpacing: '-0.03em'
  				}
  			],
  			'display-4': [
  				'2.074rem',
  				{
  					lineHeight: '1.05',
  					letterSpacing: '-0.03em'
  				}
  			],
  			'display-5': [
  				'1.728rem',
  				{
  					lineHeight: '1.05',
  					letterSpacing: '-0.03em'
  				}
  			],
  			'display-6': [
  				'1.44rem',
  				{
  					lineHeight: '1.05',
  					letterSpacing: '-0.03em'
  				}
  			]
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			nav: {
  				DEFAULT: 'hsl(var(--nav-bg))',
  				hover: 'hsl(var(--nav-hover))',
  				active: 'hsl(var(--nav-active))',
  				foreground: 'hsl(var(--nav-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))'
  			},
  			info: {
  				DEFAULT: 'hsl(var(--info))',
  				foreground: 'hsl(var(--info-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [],
};
