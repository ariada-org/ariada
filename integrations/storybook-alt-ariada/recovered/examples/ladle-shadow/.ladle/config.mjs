/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: 'src/**/*.stories.tsx',
  outDir: 'build',
  defaultStory: 'shadow--known-bad',
  addons: {
    a11y: { enabled: false },
  },
};
