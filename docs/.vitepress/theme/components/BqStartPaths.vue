<script setup lang="ts">
import { href, isExternal } from '../data/href';
import { startPaths } from '../data/landing';
</script>

<template>
  <!-- "I want to…" as a routing table rather than a wall of prose. -->
  <ul class="bq-paths">
    <li v-for="path in startPaths" :key="path.goal" class="bq-paths__row">
      <span class="bq-paths__goal">
        <span class="bq-sigil" aria-hidden="true">$</span>
        {{ path.goal }}
      </span>
      <span class="bq-paths__targets">
        <a
          v-for="target in path.targets"
          :key="target.link"
          :href="href(target.link)"
          :target="isExternal(target.link) ? '_blank' : undefined"
          :rel="isExternal(target.link) ? 'noreferrer' : undefined"
          >{{ target.text }}</a
        >
      </span>
    </li>
  </ul>
</template>
