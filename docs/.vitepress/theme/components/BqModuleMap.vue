<script setup lang="ts">
import { href } from '../data/href';
import { moduleLayers } from '../data/landing';
</script>

<template>
  <!-- Every public entry point, grouped by layer. Import path is the label. -->
  <div class="bq-map">
    <div v-for="layer in moduleLayers" :key="layer.label" class="bq-map__layer">
      <div class="bq-map__side">
        <p class="bq-map__index">{{ layer.index }}</p>
        <h3 class="bq-map__label">{{ layer.label }}</h3>
        <p class="bq-map__note">{{ layer.note }}</p>
      </div>

      <ul class="bq-map__grid">
        <li v-for="mod in layer.modules" :key="mod.name">
          <a class="bq-panel bq-mod" :href="href(mod.link)">
            <span class="bq-mod__path">
              <span class="bq-mod__scope">@bquery/bquery/</span><wbr /><span
                class="bq-mod__name"
                >{{ mod.name }}</span
              >
            </span>
            <span class="bq-mod__blurb">{{ mod.blurb }}</span>
            <span class="bq-mod__mark" aria-hidden="true">→</span>
          </a>
        </li>
      </ul>
    </div>
  </div>
</template>
