import { registerDefaultComponents } from '../src/component';
import { defineBqueryConfig } from '../src/platform';

defineBqueryConfig({
  components: {
    prefix: 'bq',
  },
});

export const defaultComponentTags = registerDefaultComponents();

export const wrapStory = (element: HTMLElement, width?: string): HTMLDivElement => {
  const wrapper = document.createElement('div');
  wrapper.style.display = 'grid';
  wrapper.style.gap = '1rem';

  if (width) {
    wrapper.style.width = width;
  }

  wrapper.append(element);
  return wrapper;
};
