# @ariada-org/live-room

A reusable **Svelte 5 Live Audit Room** shell — three panes (catalog left,
subject centre, streaming findings right) with a live-focus controller — for any
auditor front-end. Ported from the stroyka "Live Review Room" pattern. The shell
owns layout + streaming + focus; the host supplies the subject render (e.g. a
live website), the finding card, and the actual auditor (e.g. the Ariada
scanner). **Apache-2.0** so any project — including proprietary ones — can reuse
it without copyleft obligations.

```svelte
<LiveRoom {catalog} {progress} {focus} bind:activeId onRecheck={rescan}>
  {#snippet subject()}<iframe title="site" src={url}></iframe>{/snippet}
  {#snippet findings()}{#each rows as f}<FindingCard {f} />{/each}{/snippet}
</LiveRoom>
```
