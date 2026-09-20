/**
 * bQuery.js documentation theme.
 *
 * Extends the VitePress default theme rather than replacing it: the layout,
 * router and search stay stock, while the visual language (see ./styles) and a
 * handful of landing/chrome components are ours.
 *
 * `theme-without-fonts` is imported deliberately — the default entry ships
 * Inter, and this site uses IBM Plex (loaded in .vitepress/config.ts).
 */
import { h } from 'vue';
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme-without-fonts';

import './styles/tokens.css';
import './styles/base.css';
import './styles/nav.css';
import './styles/sidebar.css';
import './styles/doc.css';
import './styles/code.css';
import './styles/landing.css';

import BqAsideHelp from './components/BqAsideHelp.vue';
import BqCta from './components/BqCta.vue';
import BqFeatureGrid from './components/BqFeatureGrid.vue';
import BqHero from './components/BqHero.vue';
import BqModuleMap from './components/BqModuleMap.vue';
import BqSection from './components/BqSection.vue';
import BqSignalFlow from './components/BqSignalFlow.vue';
import BqSiteFooter from './components/BqSiteFooter.vue';
import BqSpecBar from './components/BqSpecBar.vue';
import BqStartPaths from './components/BqStartPaths.vue';
import BqVersionChip from './components/BqVersionChip.vue';

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      // Which release these docs describe, one click from the notes.
      'nav-bar-content-after': () => h(BqVersionChip),
      // Where to go when the page itself did not answer the question.
      'aside-outline-after': () => h(BqAsideHelp),
    });
  },
  enhanceApp({ app }) {
    app.component('BqHero', BqHero);
    app.component('BqSection', BqSection);
    app.component('BqSpecBar', BqSpecBar);
    app.component('BqSignalFlow', BqSignalFlow);
    app.component('BqModuleMap', BqModuleMap);
    app.component('BqFeatureGrid', BqFeatureGrid);
    app.component('BqStartPaths', BqStartPaths);
    app.component('BqCta', BqCta);
    app.component('BqSiteFooter', BqSiteFooter);
  },
} satisfies Theme;
