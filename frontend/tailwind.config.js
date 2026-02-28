/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#3b82f6",
        "primary-content": "#ffffff",
        "primary-dark": "#2563eb",
        "primary-light": "#60a5fa",
        "secondary": "#0ea5e9",
        "accent": "#93c5fd",
        "background-light": "#f0f4f8",
        "surface-light": "#ffffff",
        "surface-light-alt": "#f8fafc",
        "surface-glass": "rgba(255, 255, 255, 0.7)",
        "surface-card": "#ffffff",
        "surface-glass-strong": "rgba(255, 255, 255, 0.9)",
        "card-glass": "rgba(255, 255, 255, 0.7)",
        "chart-bg": "#ffffff",
        "border-light": "#e2e8f0",
        "text-main": "#1e293b",
        "text-muted": "#64748b",
        "success": "#10b981",
        "palette-green": "#10b981",
        "palette-red": "#ef4444",
        "azure": {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        "glass": {
          "surface": "rgba(255, 255, 255, 0.65)",
          "card": "rgba(255, 255, 255, 0.55)",
          "border": "rgba(255, 255, 255, 0.65)",
          "sidebar": "rgba(255, 255, 255, 0.75)",
        },
      },
      fontFamily: {
        "display": ["Cinzel", "serif"],
        "body": ["Inter", "sans-serif"],
        "serif": ["Playfair Display", "serif"],
        "mono": ["Fira Code", "monospace"],
        "sans": ["Inter", "sans-serif"]
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.4))',
        'soft-gradient': 'linear-gradient(180deg, #e0f2fe 0%, #ffffff 100%)',
        'mesh-gradient': 'radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.15) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(236, 72, 153, 0.05) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(14, 165, 233, 0.1) 0px, transparent 50%)',
        'azure-gradient': 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)',
        'bg-gradient': 'linear-gradient(to bottom right, #e0f2fe, #f0f9ff, #ffffff)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%)',
      },
      borderRadius: { "DEFAULT": "0.5rem", "lg": "0.75rem", "xl": "1rem", "2xl": "1.5rem", "3xl": "2rem", "full": "9999px" },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'glass-sm': '0 4px 16px 0 rgba(31, 38, 135, 0.05)',
        'glass-hover': '0 12px 40px 0 rgba(31, 38, 135, 0.15)',
        'neumorph': '5px 5px 10px #d1d9e6, -5px -5px 10px #ffffff',
        'glow-blue': '0 0 20px -5px rgba(14, 165, 233, 0.4)',
        'glow-subtle': '0 0 10px -2px rgba(14, 165, 233, 0.15)',
        'soft': '0 10px 40px -10px rgba(0,0,0,0.05)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
