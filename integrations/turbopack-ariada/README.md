# Ariada Turbopack / Next Integration

Turbopack does not expose a stable third-party plugin API for whole-output
scanning. This integration ships the reachable path today: run Ariada as a
post-build step over `.next` or static exported HTML.

```json
{
  "scripts": {
    "build": "next build && node ./node_modules/ariada-turbopack-integration/dist/index.js"
  }
}
```

For projects using Next's Webpack mode, use `@ariada-org/webpack-plugin`.
