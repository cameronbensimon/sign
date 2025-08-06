/* eslint-disable @typescript-eslint/no-var-requires */
const baseConfig = require('@tiquo/tailwind-config');
const path = require('path');

module.exports = {
  ...baseConfig,
  content: [
    ...baseConfig.content,
    './app/**/*.{ts,tsx}',
    `${path.join(require.resolve('@tiquo/ui'), '..')}/components/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@tiquo/ui'), '..')}/icons/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@tiquo/ui'), '..')}/lib/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@tiquo/ui'), '..')}/primitives/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@tiquo/email'), '..')}/templates/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@tiquo/email'), '..')}/template-components/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@tiquo/email'), '..')}/providers/**/*.{ts,tsx}`,
  ],
};
