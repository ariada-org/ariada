import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'VitePress Ariada Fixture',
  description: 'Fixture docs site for the Ariada VitePress integration.',

  // This was added because the build failed without it: the bundler's default
  // browser targets were older than the syntax the site generator emitted, and
  // two destructurings in its own client bundle were refused. That reason has
  // expired — remove the block from a cleaned state today and the build
  // succeeds, because the bundler now resolves three majors higher and its
  // defaults already cover the syntax.
  //
  // The setting stays anyway, and for the reason the expiry demonstrates: this
  // fixture exists to be scanned, and what it emits should be decided here
  // rather than by whichever defaults the bundler happens to carry. Those
  // defaults have already moved once underneath it. A named target is one line;
  // a fixture whose output shifts without anyone changing it is a scan result
  // nobody can compare against last week's.
  vite: {
    build: { target: 'es2022' },
  },
});
