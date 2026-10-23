/**
 * SSR benchmarks: `renderToString()` on a representative page.
 */

import { bench, do_not_optimize, group } from 'mitata';
import { renderToString } from '../src/ssr/index';

const page = `
<main>
  <header><h1 bq-text="title"></h1><nav><a bq-for="link in nav" bq-bind:href="link.href" bq-text="link.label"></a></nav></header>
  <section bq-if="products.length">
    <article bq-for="product in products" :key="product.id" bq-class="{ sale: product.sale }">
      <h2 bq-text="product.name"></h2>
      <p bq-html="product.description"></p>
      <span bq-show="product.sale">On sale</span>
      <strong bq-text="product.price"></strong>
    </article>
  </section>
  <footer bq-text="footer"></footer>
</main>`;

const data = {
  title: 'Catalogue',
  footer: '© bQuery',
  nav: Array.from({ length: 8 }, (_, i) => ({ href: `/section/${i}`, label: `Section ${i}` })),
  products: Array.from({ length: 200 }, (_, i) => ({
    id: i,
    name: `Product ${i}`,
    description: `<em>Great</em> product number ${i} with <a href="/p/${i}">details</a>.`,
    price: `${(i * 1.5).toFixed(2)} €`,
    sale: i % 3 === 0,
  })),
};

group('ssr', () => {
  bench('renderToString: catalogue page (200 products)', () => {
    do_not_optimize(renderToString(page, data).html);
  });

  bench('renderToString: small template', () => {
    do_not_optimize(renderToString('<p bq-text="message"></p>', { message: 'Hello' }).html);
  });
});
