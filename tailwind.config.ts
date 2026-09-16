import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        easy: "#7C9E74",
        medium: "#A98245",
        hard: "#B85C4A",
        warning: "#B42318",
        recall: "#247A78",
        orange: {
          50: "hsl(var(--orange-50))",
          100: "hsl(var(--orange-100))",
          200: "hsl(var(--orange-200))",
          300: "hsl(var(--orange-300))",
          400: "hsl(var(--orange-400))",
          500: "hsl(var(--orange-500))",
          600: "hsl(var(--orange-600))",
          700: "hsl(var(--orange-700))",
          800: "hsl(var(--orange-800))",
          900: "hsl(var(--orange-900))",
        },
        retrieval: {
          100: "#F2E7D8",
          200: "#E7D3B4",
          300: "#D5B083",
          400: "#B67C4C",
          500: "#7E553C",
        },
      },
      fontFamily: {
        mono: ["var(--font-ibm-plex-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
        sans: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
