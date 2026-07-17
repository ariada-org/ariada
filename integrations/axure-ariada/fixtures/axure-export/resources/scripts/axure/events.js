window.$axure = window.$axure || {};
window.$axure.eventManager = {
  events: [],
  bind(eventName) {
    this.events.push(eventName);
  }
};
