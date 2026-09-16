<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';

import { href } from '../data/href';

/**
 * Landing hero. All copy comes from the `hero` block in docs/index.md so the
 * wording stays editable in markdown; this component only does layout.
 */
interface HeroAction {
  text: string;
  link: string;
  theme?: 'brand' | 'ghost';
  external?: boolean;
}

interface HeroBlock {
  kicker?: string[];
  title?: string;
  accent?: string;
  lead?: string;
  actions?: HeroAction[];
}

const { frontmatter } = useData();
const hero = computed<HeroBlock>(() => (frontmatter.value.hero ?? {}) as HeroBlock);
</script>

<template>
  <section class="bq-hero">
    <div class="bq-hero__backdrop bq-grid-bg" aria-hidden="true" />

    <div class="bq-hero__inner">
      <div class="bq-hero__copy">
        <ul v-if="hero.kicker?.length" class="bq-hero__kicker">
          <li v-for="item in hero.kicker" :key="item" class="bq-label">{{ item }}</li>
        </ul>

        <h1 class="bq-hero__title">
          {{ hero.title }}
          <span v-if="hero.accent" class="bq-hero__accent">{{ hero.accent }}</span>
        </h1>

        <p class="bq-hero__lead">{{ hero.lead }}</p>

        <div v-if="hero.actions?.length" class="bq-hero__actions">
          <a
            v-for="action in hero.actions"
            :key="action.link"
            class="bq-btn"
            :class="`bq-btn--${action.theme ?? 'ghost'}`"
            :href="href(action.link)"
            :target="action.external ? '_blank' : undefined"
            :rel="action.external ? 'noreferrer' : undefined"
          >
            {{ action.text }}
            <span class="bq-btn__mark" aria-hidden="true">{{ action.external ? '↗' : '→' }}</span>
          </a>
        </div>

        <div class="bq-hero__install">
          <slot name="install" />
        </div>
      </div>

      <div class="bq-hero__panel">
        <div class="bq-hero__panel-head">
          <span class="bq-label">three ways in, one API</span>
          <span class="bq-hero__pulse" aria-hidden="true" />
        </div>
        <div class="bq-code-frame vp-doc">
          <slot name="code" />
        </div>
      </div>
    </div>
  </section>
</template>
