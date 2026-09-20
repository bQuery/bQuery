<script setup lang="ts">
/**
 * Section shell for the landing page: mono index + label in the left gutter,
 * heading and optional lead on the right, hairline rule across the top.
 */
defineProps<{
  index: string;
  label: string;
  title: string;
  lead?: string;
  wide?: boolean;
}>();
</script>

<template>
  <section class="bq-section" :class="{ 'bq-section--wide': wide }">
    <header class="bq-section__head">
      <p class="bq-section__meta">
        <span class="bq-section__index">{{ index }}</span>
        <span class="bq-label">{{ label }}</span>
      </p>
      <div class="bq-section__intro">
        <h2 class="bq-section__title">{{ title }}</h2>
        <p v-if="lead" class="bq-section__lead">{{ lead }}</p>
      </div>
    </header>
    <div class="bq-section__body">
      <slot />
    </div>
  </section>
</template>
