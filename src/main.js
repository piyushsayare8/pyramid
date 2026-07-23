import { mount } from 'svelte';
import './index.css';
import App from './App.svelte';

const root = document.getElementById('root') || document.body;
root.innerHTML = '';
const app = mount(App, { target: root });

import Lenis from 'lenis';

// Initialize Lenis for buttery smooth momentum scrolling
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  direction: 'vertical',
  gestureDirection: 'vertical',
  smooth: true,
  mouseMultiplier: 1,
  smoothTouch: false,
  touchMultiplier: 2,
  infinite: false,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

export default app;
