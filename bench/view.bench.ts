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

interface Fixture {
  root: HTMLElement;
  view?: { destroy(): void };
  /** Set by the timed callback once it has used the fixture. */
  used?: boolean;
}

/**
 * Fixtures created for timed runs. Used ones are torn down when the next
 * run's input is computed (mitata keeps computed parameters out of the
 * timing) and all of them once after the last run, so teardown never counts
 * towards the measurement. Unused fixtures survive, because mitata may compute
 * inputs for several runs ahead.
 */
const createFixtures = () => {
  let pending: Fixture[] = [];
  const destroy = ({ root, view }: Fixture): void => {
    view?.destroy();
    root.remove();
  };
  return {
    track<T extends Fixture>(fixture: T): T {
      pending.push(fixture);
      return fixture;
    },
    teardownUsed(): void {
      const used = pending.filter((fixture) => fixture.used);
      pending = pending.filter((fixture) => !fixture.used);
      used.forEach(destroy);
    },
    teardownAll(): void {
      pending.splice(0).forEach(destroy);
    },
  };
};

group('view', () => {
  bench(`mount bq-for over ${ROWS.toLocaleString('en')} rows`, function* () {
    const fixtures = createFixtures();
    yield {
      [0]() {
        fixtures.teardownUsed();
        return fixtures.track<Fixture>({ root: createRoot() });
      },
      bench(fixture: Fixture) {
        fixture.used = true;
        fixture.view = mount(fixture.root, { rows: signal(rows(ROWS)) });
        do_not_optimize(fixture.root.childElementCount);
      },
    };
    fixtures.teardownAll();
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
    const fixtures = createFixtures();
    yield {
      [0]() {
        fixtures.teardownUsed();
        const root = createRoot();
        const list = signal(rows(ROWS));
        return fixtures.track({ root, list, view: mount(root, { rows: list }) });
      },
      bench(fixture: Fixture & { list: ReturnType<typeof signal> }) {
        fixture.used = true;
        fixture.list.value = rows(ROWS + 100);
      },
    };
    fixtures.teardownAll();
  });
});
