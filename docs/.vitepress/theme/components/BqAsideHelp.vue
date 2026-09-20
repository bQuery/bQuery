<script setup lang="ts">
import { href } from '../data/href';

/** Small "stuck?" panel under the page outline. */
const links = [
  { text: 'Report a docs issue', link: 'https://github.com/bQuery/bQuery/issues/new/choose' },
  { text: 'Browse the source', link: 'https://github.com/bQuery/bQuery/tree/main/src' },
  { text: 'Contributing guide', link: '/contributing/' },
];
</script>

<template>
  <aside class="bq-aside-help">
    <p class="bq-label">Stuck?</p>
    <ul>
      <li v-for="link in links" :key="link.link">
        <a :href="href(link.link)">{{ link.text }}</a>
      </li>
    </ul>
  </aside>
</template>
