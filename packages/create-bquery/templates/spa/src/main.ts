import { createApp } from './app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('index.html needs an element with id="app"');

createApp(root);
