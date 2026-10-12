/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        crm: {
          navy: '#172554',
          navyLight: '#1e3a8a',
          sidebar: '#172554',
          sidebarHover: '#1e3a8a',
          action: '#2563EB',
          actionHover: '#1d4ed8',
          bg: '#F8FAFC',
          card: '#FFFFFF',
          text: '#1E293B',
          muted: '#64748B',
          border: '#E2E8F0',
          success: '#16A34A',
          warning: '#D97706',
          error: '#DC2626'
        }
      }
    },
  },
  plugins: [],
}
