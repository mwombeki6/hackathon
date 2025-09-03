#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building BlockEngage for web deployment...');

try {
  // Build the web version
  console.log('📦 Building Expo web bundle...');
  execSync('npx expo export --platform web', { stdio: 'inherit' });

  // Create a simple index.html for deployment
  const distPath = path.join(__dirname, 'dist');
  const indexPath = path.join(distPath, 'index.html');

  if (fs.existsSync(indexPath)) {
    console.log('✅ Web build completed successfully!');
    console.log(`📁 Build output: ${distPath}`);
    console.log('🌐 Ready for deployment to Netlify, Vercel, or any static host');
  } else {
    console.log('❌ Build failed - no index.html found');
  }
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
