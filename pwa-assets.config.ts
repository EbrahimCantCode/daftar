import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates the PNG icons (192, 512, maskable, apple-touch) and favicon.ico from public/icon.svg.
// Run with: npm run icons
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.2, resizeOptions: { background: '#fbf6e9' } },
    apple: { ...minimal2023Preset.apple, padding: 0.15, resizeOptions: { background: '#fbf6e9' } },
  },
  images: ['public/icon.svg'],
});
