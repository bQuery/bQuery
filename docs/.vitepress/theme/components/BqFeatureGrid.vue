<script setup lang="ts">
import { features } from '../data/landing';
import { href } from '../data/href';

const pad = (n: number) => String(n + 1).padStart(2, '0');
</script>

<template>
  <ul class="bq-features">
    <li v-for="(feature, i) in features" :key="feature.title" class="bq-feature">
      <component :is="feature.link ? 'a' : 'div'" :href="feature.link ? href(feature.link) : undefined" class="bq-feature__body">
        <span class="bq-feature__index">{{ pad(i) }}</span>
        <h3 class="bq-feature__title">{{ feature.title }}</h3>
        <p class="bq-feature__details">{{ feature.details }}</p>
      </component>
    </li>
  </ul>
</template>
