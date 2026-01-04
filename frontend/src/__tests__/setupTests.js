import '@testing-library/jest-dom'

const noop = () => {}

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = noop
}

window.matchMedia =
  window.matchMedia ||
  (() => ({
    matches: false,
    addListener: noop,
    removeListener: noop,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => false,
  }))

HTMLCanvasElement.prototype.getContext = () => ({})

if (!globalThis.WebSocket) {
  globalThis.WebSocket = class WebSocket {
    constructor() {
      this.readyState = 1
    }
    close() {}
    send() {}
  }
}
