# gulp-ariada

Object-mode Gulp adapter that scans each HTML Vinyl file with Ariada and attaches
findings to `file.ariadaFindings`.

```js
import { src } from 'gulp';
import ariada from 'gulp-ariada';

export const audit = () => src('dist/**/*.html').pipe(ariada({ scanner }));
```

The scanner comes from the shared Ariada engine or CLI layer.
