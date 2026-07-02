# Ariada Storybook Addon

`@ariada-org/storybook-addon` scans the rendered Storybook canvas and exposes the
latest Ariada findings in a panel.

## Install

```bash
pnpm add -D @ariada-org/storybook-addon
```

## Preview

```ts
// .storybook/preview.ts
import { decorators } from '@ariada-org/storybook-addon/preview';

export { decorators };
```

## Manager

```ts
// .storybook/manager.ts
import { registerAriadaPanel } from '@ariada-org/storybook-addon/manager';
import { addons } from '@storybook/manager-api';

registerAriadaPanel(addons);
```

The package ships a small static HTML scanner so the addon works without a
hosted API. The scanner is injectable, so the built-in checks can be swapped for
a custom Ariada engine adapter.
