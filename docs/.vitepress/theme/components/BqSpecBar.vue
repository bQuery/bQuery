<script setup lang="ts">
import { specs } from '../data/landing';
</script>

<template>
  <!-- The four numbers people actually ask about, as a spec strip. -->
  <dl class="bq-specs">
    <div v-for="spec in specs" :key="spec.label" class="bq-specs__item">
      <dt class="bq-specs__value">{{ spec.value }}</dt>
      <dd class="bq-specs__label bq-label">{{ spec.label }}</dd>
    </div>
  </dl>
</template>
