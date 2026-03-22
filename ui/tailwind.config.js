/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 可以在这里扩展自定义颜色
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
