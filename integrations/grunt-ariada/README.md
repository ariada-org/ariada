# grunt-ariada

Grunt multi-task adapter for Ariada HTML scans.

```js
export default function (grunt) {
  const ariada = await import('grunt-ariada');
  ariada.default(grunt, scanner);
  grunt.initConfig({ ariada: { dist: { src: ['dist/**/*.html'] } } });
}
```

The task reads configured HTML files and delegates findings to the shared Ariada
scanner or CLI wrapper.
