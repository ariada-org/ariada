import { Component, h } from '@stencil/core';

/** Deliberately invalid accessibility fixture. */
@Component({
  tag: 'bad-shadow-card',
  shadow: true,
  styles: ':host{display:block;background:#fff}p{color:#aaa;background:#fff;font-size:16px}',
})
export class BadShadowCard {
  render() {
    return <p>Shadow contrast failure</p>;
  }
}
