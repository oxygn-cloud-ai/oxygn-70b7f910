/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./app/**/*.{js,jsx}",
    "./src/**/*.{js,jsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        sans: ['Poppins', 'sans-serif'],
        mono: ['Poppins', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        chocolate: {
          ruby: "hsl(333 81% 51%)",
          espresso: "hsl(30 88% 30%)",
          dark: "hsl(14 56% 16%)",
          milk: "hsl(358 56% 27%)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          container: "hsl(var(--primary-container))",
          "container-foreground": "hsl(var(--on-primary-container))",
        },
        "on-primary-container": "hsl(var(--on-primary-container))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // M3 Surface containers
        surface: {
          DEFAULT: "hsl(var(--surface))",
          dim: "hsl(var(--surface-dim))",
          bright: "hsl(var(--surface-bright))",
          "container-lowest": "hsl(var(--surface-container-lowest))",
          "container-low": "hsl(var(--surface-container-low))",
          container: "hsl(var(--surface-container))",
          "container-high": "hsl(var(--surface-container-high))",
          "container-highest": "hsl(var(--surface-container-highest))",
        },
        "on-surface": {
          DEFAULT: "hsl(var(--on-surface))",
          variant: "hsl(var(--on-surface-variant))",
        },
        outline: {
          DEFAULT: "hsl(var(--outline))",
          variant: "hsl(var(--outline-variant))",
        },
        "secondary-container": {
          DEFAULT: "hsl(var(--secondary-container))",
          foreground: "hsl(var(--on-secondary-container))",
        },
        tertiary: {
          DEFAULT: "hsl(var(--tertiary))",
          container: "hsl(var(--tertiary-container))",
          foreground: "hsl(var(--on-tertiary-container))",
        },
        // M3 Inverse colors
        inverse: {
          surface: "hsl(var(--inverse-surface))",
          "on-surface": "hsl(var(--inverse-on-surface))",
          primary: "hsl(var(--inverse-primary))",
        },
        scrim: "hsl(var(--scrim))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // M3 Expressive Shape scale
        "none": "0px",
        xs: "var(--radius-xs)",
        "m3-sm": "var(--radius-sm)",
        "m3-md": "var(--radius-md)",
        "m3-lg": "var(--radius-lg)",
        "m3-xl": "var(--radius-xl)",
        "m3-2xl": "var(--radius-2xl)",
        "m3-full": "var(--radius-full)",
        // Squircle (superellipse) shapes for FABs
        "squircle": "28%",
        "squircle-sm": "24%",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "attention-flash": {
          "0%, 100%": { backgroundColor: "hsl(142 76% 36% / 0.3)" },
          "50%": { backgroundColor: "hsl(142 76% 36% / 0.6)" },
        },
        // M3 Expressive morphing animations
        "morph-squircle": {
          "0%": { borderRadius: "50%" },
          "100%": { borderRadius: "28%" },
        },
        "morph-expand": {
          "0%": { transform: "scale(1)", borderRadius: "28%" },
          "50%": { transform: "scale(1.05)", borderRadius: "24%" },
          "100%": { transform: "scale(1)", borderRadius: "28%" },
        },
        "fab-entrance": {
          "0%": { transform: "scale(0) rotate(-45deg)", opacity: "0" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        "slide-up-fade": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down-fade": {
          "0%": { transform: "translateY(-8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "drawer-slide-in": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "drawer-slide-out": {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(-100%)", opacity: "0" },
        },
        "ripple": {
          "0%": { transform: "scale(0)", opacity: "0.5" },
          "100%": { transform: "scale(4)", opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "shimmer": "shimmer 2s linear infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "attention-flash": "attention-flash 1s ease-in-out infinite",
        // M3 Expressive animations
        "morph-squircle": "morph-squircle 0.4s var(--ease-emphasized) forwards",
        "morph-expand": "morph-expand 0.5s var(--ease-emphasized) forwards",
        "fab-entrance": "fab-entrance 0.5s var(--ease-emphasized-decel) forwards",
        "slide-up": "slide-up-fade 0.3s var(--ease-emphasized-decel) forwards",
        "slide-down": "slide-down-fade 0.3s var(--ease-emphasized-decel) forwards",
        "scale-in": "scale-in 0.2s var(--ease-emphasized-decel) forwards",
        "drawer-in": "drawer-slide-in 0.4s var(--ease-emphasized-decel) forwards",
        "drawer-out": "drawer-slide-out 0.25s var(--ease-emphasized-accel) forwards",
        "ripple": "ripple 0.6s linear forwards",
      },
      boxShadow: {
        "warm": "0 4px 14px -3px hsl(14 56% 16% / 0.1)",
        "warm-lg": "0 10px 25px -5px hsl(14 56% 16% / 0.15)",
        "ruby-glow": "0 0 20px hsl(333 81% 51% / 0.3)",
        // M3 Elevation levels
        "m3-1": "0 1px 2px 0 hsl(var(--shadow-color) / 0.3), 0 1px 3px 1px hsl(var(--shadow-color) / 0.15)",
        "m3-2": "0 1px 2px 0 hsl(var(--shadow-color) / 0.3), 0 2px 6px 2px hsl(var(--shadow-color) / 0.15)",
        "m3-3": "0 1px 3px 0 hsl(var(--shadow-color) / 0.3), 0 4px 8px 3px hsl(var(--shadow-color) / 0.15)",
        "m3-4": "0 2px 3px 0 hsl(var(--shadow-color) / 0.3), 0 6px 10px 4px hsl(var(--shadow-color) / 0.15)",
        "m3-5": "0 4px 4px 0 hsl(var(--shadow-color) / 0.3), 0 8px 12px 6px hsl(var(--shadow-color) / 0.15)",
      },
      transitionTimingFunction: {
        // M3 Motion easing
        "emphasized": "var(--ease-emphasized)",
        "emphasized-decel": "var(--ease-emphasized-decel)",
        "emphasized-accel": "var(--ease-emphasized-accel)",
        "standard": "var(--ease-standard)",
        "standard-decel": "var(--ease-standard-decel)",
        "standard-accel": "var(--ease-standard-accel)",
      },
      transitionDuration: {
        // M3 Duration tokens
        "short-1": "50ms",
        "short-2": "100ms",
        "short-3": "150ms",
        "short-4": "200ms",
        "medium-1": "250ms",
        "medium-2": "300ms",
        "medium-3": "350ms",
        "medium-4": "400ms",
        "long-1": "450ms",
        "long-2": "500ms",
        "long-3": "550ms",
        "long-4": "600ms",
        "extra-long-1": "700ms",
        "extra-long-2": "800ms",
        "extra-long-3": "900ms",
        "extra-long-4": "1000ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};