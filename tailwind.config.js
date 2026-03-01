/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ui: {
          surface: "#F7F9FC",
          card: "#EEF2F7",
          border: "#9AA9BE",
          borderSoft: "#C8D2E0",
          primary: "#4E7FCF",
          dangerBg: "#F7E6E8",
          danger: "#C54444",
          overlay: "rgba(0,0,0,0.35)",
          text: "#1B2330",
          muted: "#66758A",
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
