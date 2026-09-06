import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'VitePress Ariada Fixture',
  description: 'Fixture docs site for the Ariada VitePress integration.',

  // The bundler's default browser targets are older than the syntax VitePress
  // itself emits, so the fixture would not build at all: two destructurings in
  // its own client bundle are refused for a 2020 target. Naming a target the
  // output already needs is the smallest true fix; the fixture exists to be
  // scanned, not to prove anything about old browsers.
  vite: {
    build: { target: 'es2022' },
  },
});
