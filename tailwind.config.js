/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ui: {
          surface: "#FFFFFF",
          card: "#F8FAFC",
          border: "#9BA1A6",
          borderSoft: "#D6D8DB",
          primary: "#208AEF",
          dangerBg: "#FFDCDC",
          danger: "#B00020",
          overlay: "rgba(0,0,0,0.35)",
          text: "#11181C",
          muted: "#687076",
        },
      },
      spacing: {
        "ui-xs": "4px",
        "ui-sm": "8px",
        "ui-md": "12px",
        "ui-lg": "16px",
      },
      borderRadius: {
        "ui-sm": "8px",
        "ui-md": "10px",
        "ui-lg": "14px",
      },
      minHeight: {
        control: "44px",
        textarea: "104px",
      },
    },
  },
  plugins: [],
};
