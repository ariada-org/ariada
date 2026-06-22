# Ariada Storybook Addon

`@ariada-org/storybook-addon` scans the rendered Storybook canvas and exposes the
latest Ariada findings in a panel.

## Install

```bash
pnpm add -D @ariada-org/storybook-addon
```

Root workspace integration still needs a lockfile update before publish:

```bash
pnpm install
pnpm --filter @ariada-org/storybook-addon build
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
hosted API. The scanner is injectable and is the handoff point for the full
Ariada engine adapter.
