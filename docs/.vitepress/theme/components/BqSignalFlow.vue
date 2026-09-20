<script setup lang="ts">
import { flowNodes } from '../data/landing';
</script>

<template>
  <!--
    The reactive pipeline, in call order. The connectors are decorative and
    hidden from assistive tech; the ordered list carries the meaning.
  -->
  <ol class="bq-flow">
    <li v-for="(node, i) in flowNodes" :key="node.call" class="bq-flow__node">
      <span v-if="i > 0" class="bq-flow__wire" aria-hidden="true" />
      <span class="bq-flow__box">
        <span class="bq-flow__call">{{ node.call }}</span>
        <span class="bq-flow__role">{{ node.role }}</span>
      </span>
    </li>
  </ol>
</template>
