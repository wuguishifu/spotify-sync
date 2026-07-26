//@ts-check

const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js options go here
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js
  output: 'export',
  turbopack: {
    root: path.resolve(__dirname, '../..'),
    // tw-animate-css only exposes its CSS via a `style` export condition,
    // which Turbopack doesn't resolve — alias straight to the file on disk.
    resolveAlias: {
      'tw-animate-css': '../../node_modules/tw-animate-css/dist/tw-animate.css',
    },
  },
};

module.exports = nextConfig;
