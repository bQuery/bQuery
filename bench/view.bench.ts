/**
 * View benchmarks: mounting a large `bq-for` list and updating it.
 */

import '../tests/setup';
import { bench, do_not_optimize, group } from 'mitata';
import { signal } from '../src/reactive/index';
import { mount } from '../src/view/index';

const ROWS = 1_000;

const rows = (count: number, offset = 0) =>
  Array.from({ length: count }, (_, i) => ({ id: i, label: `Row ${i + offset}` }));

const createRoot = (): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = `<ul><li bq-for="row in rows" :key="row.id" bq-text="row.label"></li></ul>`;
  document.body.appendChild(root);
  return root;
};

group('view', () => {
  bench(`mount bq-for over ${ROWS.toLocaleString('en')} rows`, function* () {
    yield {
      [0]() {
        return createRoot();
      },
      bench(root: HTMLElement) {
        const view = mount(root, { rows: signal(rows(ROWS)) });
        do_not_optimize(root.childElementCount);
        view.destroy();
        root.remove();
      },
    };
  });

  bench(`update every label in ${ROWS.toLocaleString('en')} rows`, function* () {
    const root = createRoot();
    const list = signal(rows(ROWS));
    const view = mount(root, { rows: list });
    let round = 0;
    yield () => {
      list.value = rows(ROWS, ++round);
    };
    view.destroy();
    root.remove();
  });

  bench('append 100 rows to 1,000', function* () {
    yield {
      [0]() {
        const root = createRoot();
        const list = signal(rows(ROWS));
        return { root, list, view: mount(root, { rows: list }) };
      },
      bench(state: {
        root: HTMLElement;
        list: ReturnType<typeof signal>;
        view: { destroy(): void };
      }) {
        state.list.value = rows(ROWS + 100);
        state.view.destroy();
        state.root.remove();
      },
    };
  });
});
