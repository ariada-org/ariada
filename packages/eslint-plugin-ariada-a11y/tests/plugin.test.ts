import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import ariadaA11y from '../src/index.js';

function lint(code: string): ReturnType<Linter['verify']> {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, [ariadaA11y.configs.recommended], 'fixture.jsx');
}

describe('@ariada-org/eslint-plugin-a11y', () => {
  it('accepts a good JSX fixture', () => {
    const messages = lint(`
      export function Page() {
        return <html lang="en">
          <body>
            <h1>Checkout</h1>
            <h2>Delivery</h2>
            <img src="/logo.png" alt="Ariada" />
            <label htmlFor="email">Email</label>
            <input id="email" />
            <label>Search<input /></label>
          </body>
        </html>;
      }
    `);
    expect(messages).toEqual([]);
  });

  it('flags the known-bad fixture through the recommended config', () => {
    const messages = lint(`
      export function Page() {
        return <html>
          <body>
            <h1>Checkout</h1>
            <h3>Payment</h3>
            <img src="/logo.png" />
            <label>Email</label>
          </body>
        </html>;
      }
    `);
    expect(messages.map((message) => message.ruleId).sort()).toEqual([
      '@ariada-org/a11y/heading-order',
      '@ariada-org/a11y/html-has-lang',
      '@ariada-org/a11y/img-alt',
      '@ariada-org/a11y/label-has-associated-control',
    ]);
  });
});
