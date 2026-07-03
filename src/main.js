import { mount } from 'svelte';
import './index.css';
import App from './App.svelte';

const root = document.getElementById('root') || document.body;
root.innerHTML = '';
const app = mount(App, { target: root });

export default app;
