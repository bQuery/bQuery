<script setup lang="ts">
import { href } from '../data/href';
import { version } from '../data/version';
</script>

<template>
  <!-- Nav chip: which version these docs describe, one click from the notes. -->
  <a class="bq-version" :href="href('/release-notes/')">
    <span class="bq-version__dot" aria-hidden="true" />
    <span class="bq-version__text">v{{ version }}</span>
  </a>
</template>
