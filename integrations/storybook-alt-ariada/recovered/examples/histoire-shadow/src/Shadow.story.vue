<script setup lang="ts">
import { h } from 'vue'

class BadShadowCard extends HTMLElement {
  connectedCallback (): void {
    if (this.shadowRoot !== null) return
    const root = this.attachShadow({ mode: 'open' })
    root.innerHTML = [
      '<style>',
      ':host { display: block; width: 320px; padding: 24px; background: #fff; }',
      'p { margin: 0; color: #ddd; background: #fff; font: 18px/1.5 sans-serif; }',
      '</style>',
      '<p>Shadow contrast failure</p>',
    ].join('')
  }
}

if (!customElements.get('bad-shadow-card')) customElements.define('bad-shadow-card', BadShadowCard)
const ShadowCard = () => h('bad-shadow-card')
</script>

<template>
  <Story title="Shadow">
    <Variant title="Known bad">
      <ShadowCard />
    </Variant>
  </Story>
</template>
