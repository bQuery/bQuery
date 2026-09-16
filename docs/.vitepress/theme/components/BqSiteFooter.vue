<script setup lang="ts">
import { href } from '../data/href';
import { footerColumns } from '../data/landing';
import { version } from '../data/version';
</script>

<template>
  <footer class="bq-footer">
    <div class="bq-footer__inner">
      <div class="bq-footer__brand">
        <p class="bq-footer__wordmark">
          <span class="bq-sigil" aria-hidden="true">$</span> bQuery.js
        </p>
        <p class="bq-footer__note">
          Batteries-included TypeScript framework for the modern web. MIT licensed, zero runtime
          dependencies.
        </p>
        <p class="bq-footer__version bq-label">v{{ version }}</p>
      </div>

      <nav class="bq-footer__columns" aria-label="Site">
        <div v-for="column in footerColumns" :key="column.label" class="bq-footer__column">
          <h2 class="bq-label">{{ column.label }}</h2>
          <ul>
            <li v-for="link in column.links" :key="link.link">
              <a
                :href="href(link.link)"
                :target="link.external ? '_blank' : undefined"
                :rel="link.external ? 'noreferrer' : undefined"
                >{{ link.text }}<span v-if="link.external" aria-hidden="true"> ↗</span></a
              >
            </li>
          </ul>
        </div>
      </nav>
    </div>

    <p class="bq-footer__base">
      <span>Released under the MIT License.</span>
      <span>Copyright © 2024–present bQuery.js contributors</span>
    </p>
  </footer>
</template>
