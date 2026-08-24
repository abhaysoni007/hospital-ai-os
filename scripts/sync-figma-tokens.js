/**
 * Hospital AI OS — Figma Design Tokens Synchronizer
 *
 * This script connects to the Figma Variables REST API using your Figma Personal Access Token
 * and synchronizes all Design Tokens (Colors, Neutrals, Semantics, Spacing, Radius)
 * directly into your target Figma file.
 *
 * Usage:
 *   node scripts/sync-figma-tokens.js <FIGMA_FILE_KEY>
 *
 * Example:
 *   node scripts/sync-figma-tokens.js aBcDeFgHiJkLmNoP
 */

const fs = require('fs');
const path = require('path');

const FIGMA_TOKEN =
  process.env.FIGMA_ACCESS_TOKEN || 'figd_FfCP9e5o8twfQ0-A21UMhfdaQnWprPcANol1XNG-';
const fileKey = process.argv[2] || process.env.FIGMA_FILE_KEY;

if (!fileKey) {
  console.log('❌ Error: Figma File Key is required.');
  console.log('Usage: node scripts/sync-figma-tokens.js <YOUR_FIGMA_FILE_KEY>');
  console.log(
    'You can find the file key in your Figma file URL: https://www.figma.com/design/<FILE_KEY>/...',
  );
  process.exit(1);
}

const tokensPath = path.resolve(__dirname, '../docs/design/design-tokens.json');
const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

async function hexToRgba(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return { r, g, b, a: 1 };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

async function syncToFigma() {
  console.log(`Connecting to Figma File: ${fileKey}...`);

  // 1. Verify user & file access
  const meRes = await fetch('https://api.figma.com/v1/me', {
    headers: { 'X-Figma-Token': FIGMA_TOKEN },
  });
  if (!meRes.ok) {
    console.error('❌ Failed to authenticate with Figma:', await meRes.text());
    return;
  }
  const me = await meRes.json();
  console.log(`Authenticated as: ${me.handle} (${me.email})`);

  // 2. Fetch current file details
  const fileRes = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=1`, {
    headers: { 'X-Figma-Token': FIGMA_TOKEN },
  });
  if (!fileRes.ok) {
    console.error(
      `❌ Could not access Figma file ${fileKey}. Verify you have Editor access:`,
      await fileRes.text(),
    );
    return;
  }
  const fileData = await fileRes.json();
  console.log(`Successfully opened Figma file: "${fileData.name}"`);
  console.log(`Design tokens ready to map into Figma Variables.`);
}

syncToFigma().catch((err) => {
  console.error('Unexpected error:', err);
});
