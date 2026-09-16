<script setup lang="ts">
import { href, isExternal } from '../data/href';
import { ctaActions } from '../data/landing';
</script>

<template>
  <div class="bq-cta">
    <a
      v-for="action in ctaActions"
      :key="action.link"
      class="bq-btn"
      :class="`bq-btn--${action.theme ?? 'ghost'}`"
      :href="href(action.link)"
      :target="isExternal(action.link) ? '_blank' : undefined"
      :rel="isExternal(action.link) ? 'noreferrer' : undefined"
    >
      {{ action.text }}
      <span class="bq-btn__mark" aria-hidden="true">{{
        isExternal(action.link) ? '↗' : '→'
      }}</span>
    </a>
  </div>
</template>
