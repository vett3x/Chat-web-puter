import type { Config } from "tailwindcss";

export default {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
        'primary-light-purple': 'hsl(var(--primary-light-purple))', // New color
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))'
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))'
        },
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
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
  			},
        'user-avatar-shadow': '0 0 8px 2px hsl(var(--user-avatar-shadow))',
        'ai-avatar-shadow': '0 0 8px 2px hsl(var(--ai-avatar-shadow) / 0.5)',
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
  			},
        'pulse-glow': {
          '0%': { boxShadow: '0 0 0 0px rgba(34, 197, 94, 0.3)' }, /* Empieza con un brillo más sutil */
          '50%': { boxShadow: '0 0 8px 3px rgba(34, 197, 94, 0.5)' }, /* Pico del brillo, más sutil */
          '100%': { boxShadow: '0 0 0 0px rgba(34, 197, 94, 0)' }, /* Se desvanece completamente */
        },
        'pulse-purple': { // New animation
          '0%, 100%': {
            boxShadow: '0 0 0 0 hsl(var(--primary-light-purple) / 0.7)',
          },
          '50%': {
            boxShadow: '0 0 0 6px hsl(var(--primary-light-purple) / 0)',
          },
        },
        'pulse-red': { // New animation for AI button
          '0%, 100%': {
            boxShadow: '0 0 0 0 hsl(var(--destructive) / 0.7)',
          },
          '50%': {
            boxShadow: '0 0 0 6px hsl(var(--destructive) / 0)',
          },
        },
        'lightsaber-on': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        'lightsaber-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 6px 1px hsl(var(--primary-light-purple) / 0.7)',
            opacity: '1',
          },
          '50%': {
            boxShadow: '0 0 10px 2px hsl(var(--primary-light-purple) / 0.9)',
            opacity: '0.85',
          },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out': {
          from: { opacity: '1', transform: 'translateY(0)' },
          to: { opacity: '0', transform: 'translateY(-10px)' },
        },
        'star-movement-bottom': {
          '0%': { transform: 'translate(0%, 0%)' },
          '100%': { transform: 'translate(-100%, 0%)' },
        },
        'star-movement-top': {
          '0%': { transform: 'translate(0%, 0%)' },
          '100%': { transform: 'translate(100%, 0%)' },
        },
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.3s ease-out',
  			'accordion-up': 'accordion-up 0.3s ease-out',
        'pulse-glow': 'pulse-glow 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-purple': 'pulse-purple 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-red': 'pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite', // New animation
        'lightsaber-on': 'lightsaber-on 0.3s ease-out forwards',
        'lightsaber-pulse': 'lightsaber-pulse 2s ease-in-out infinite alternate',
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'fade-out': 'fade-out 0.3s ease-in forwards',
        'star-movement-bottom': 'star-movement-bottom linear infinite alternate',
        'star-movement-top': 'star-movement-top linear infinite alternate',
  		},
      boxShadow: {
        'avatar-user': '0 0 8px 2px hsl(var(--user-avatar-shadow))',
        'avatar-user-hover': '0 0 12px 4px hsl(var(--user-avatar-shadow) / 0.7)', // Nueva sombra para hover
        'avatar-ai': '0 0 8px 2px hsl(var(--ai-avatar-shadow) / 0.5)',
      },
  	}
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;