# parcel-reporter-ariada

Parcel reporter adapter that runs Ariada after successful builds and writes
findings through Parcel's reporter logger.

```json
{
  "extends": "@parcel/config-default",
  "reporters": ["...", "parcel-reporter-ariada"]
}
```

The package is a reporter because Ariada needs whole built HTML output rather
than per-asset transform hooks.
