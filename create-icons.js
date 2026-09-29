const sharp = require('sharp');
const fs = require('fs');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#7C3AED"/>
    </linearGradient>
  </defs>
  <!-- Rounded background -->
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <!-- Receipt body -->
  <rect x="136" y="76" width="240" height="352" rx="20" fill="#FFFFFF"/>
  <!-- Receipt zigzag bottom -->
  <polygon points="136,360 136,428 156,412 176,428 196,412 216,428 236,412 256,428 276,412 296,428 316,412 336,428 356,412 376,428 376,360 136,360" fill="#FFFFFF"/>
  <!-- Fold lines -->
  <line x1="152" y1="112" x2="360" y2="112" stroke="#C7D2FE" stroke-width="10" stroke-linecap="round"/>
  <line x1="152" y1="148" x2="320" y2="148" stroke="#C7D2FE" stroke-width="10" stroke-linecap="round"/>
  <!-- Diamond logo mark -->
  <rect x="196" y="176" width="120" height="120" rx="28" fill="#4F46E5"/>
  <!-- Dollar sign -->
  <text x="256" y="270" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="bold" fill="#FFFFFF" text-anchor="middle">$</text>
  <!-- Dashed separator line -->
  <line x1="152" y1="316" x2="310" y2="316" stroke="#C7D2FE" stroke-width="10" stroke-linecap="round" stroke-dasharray="16 14"/>
  <!-- Amount lines -->
  <rect x="152" y="338" width="72" height="10" rx="5" fill="#E5E7EB"/>
  <rect x="242" y="338" width="118" height="10" rx="5" fill="#E5E7EB"/>
</svg>
`;

// Save SVG
fs.writeFileSync('icons/icon.svg', svg);
console.log('Created icons/icon.svg');

// Generate PNG icons
const sizes = [192, 512];
async function generate() {
  for (const size of sizes) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(`icons/icon-${size}x${size}.png`);
    console.log(`Created icons/icon-${size}x${size}.png`);
  }
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});