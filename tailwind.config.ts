import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f2",
          100: "#d6ecdf",
          500: "#2f9e6e",
          600: "#278a5f",
          700: "#1f6f4d",
        },
      },
    },
  },
  plugins: [],
};
export default config;
