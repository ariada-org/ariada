# @ariada-org/event-bus

Publishes typed Ariada product events to memory, HTTP, multiple publishers, or a JSONL file.

```ts
import { InMemoryEventBus } from '@ariada-org/event-bus';

const bus = new InMemoryEventBus();
await bus.subscribe({
  durableName: 'reports',
  eventTypes: ['report.emitted'],
  handler: async (event) => console.log(event.id),
});
await bus.publish(event);
```
