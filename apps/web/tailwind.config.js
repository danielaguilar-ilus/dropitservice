/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        dropit: {
          950: "#1A1A1A",
          900: "#2A2A2A",
          800: "#3A3A3A",
          700: "#5A5A5A",
          600: "#7A7A7A",
          500: "#9A9A9A",
          400: "#BABABA",
          300: "#D4D4D4",
          200: "#EBEBEB",
          100: "#F7F7F7",
          50: "#FAFAFA",
          accent: "#F97316",
          "accent-dark": "#EA6500",
          "accent-light": "#FDBA74",
          warning: "#F59E0B",
          error: "#EF4444",
          success: "#22C55E",
        },
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        base: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        md: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        lg: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        xl: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
        "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.2)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
