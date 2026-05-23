import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  circleNode,
  createCanvas,
  createScene,
  groupNode,
  rectNode,
} from '../src/canvas';
import { installCanvasMock, methodNames, uninstallCanvasMock } from './canvas-test-helpers';

describe('canvas scene graph', () => {
  beforeEach(() => installCanvasMock());
  afterEach(() => uninstallCanvasMock());

  test('add/remove maintains the nodes list', () => {
    const canvas = createCanvas();
    const scene = createScene(canvas);
    const r = rectNode({ id: 'box', x: 0, y: 0, width: 10, height: 10, fill: 'red' });
    scene.add(r);
    expect(scene.nodes).toHaveLength(1);
    expect(scene.find('box')).toBe(r);
    expect(scene.remove(r)).toBe(true);
    expect(scene.nodes).toHaveLength(0);
    scene.dispose();
  });

  test('render() draws rect and circle nodes', () => {
    const canvas = createCanvas();
    const scene = createScene(canvas);
    scene.add(rectNode({ x: 0, y: 0, width: 10, height: 10, fill: 'red' }));
    scene.add(circleNode({ x: 5, y: 5, radius: 4, fill: 'blue' }));
    scene.render();
    const names = methodNames(canvas.el);
    expect(names).toContain('rect');
    expect(names).toContain('arc');
    scene.dispose();
  });

  test('hitTest finds the front-most interactive node', () => {
    const canvas = createCanvas();
    const scene = createScene(canvas);
    scene.add(
      rectNode({ id: 'bg', x: 0, y: 0, width: 100, height: 100, interactive: true, zIndex: 0 })
    );
    scene.add(rectNode({ id: 'fg', x: 10, y: 10, width: 20, height: 20, interactive: true, zIndex: 1 }));
    expect(scene.hitTest({ x: 15, y: 15 })?.id).toBe('fg');
    expect(scene.hitTest({ x: 50, y: 50 })?.id).toBe('bg');
    expect(scene.hitTest({ x: -5, y: -5 })).toBeUndefined();
    scene.dispose();
  });

  test('group transforms apply to children', () => {
    const canvas = createCanvas();
    const scene = createScene(canvas);
    scene.add(
      groupNode({
        transform: { translateX: 100, translateY: 100 },
        children: [
          rectNode({ id: 'child', x: 0, y: 0, width: 10, height: 10, interactive: true }),
        ],
      })
    );
    expect(scene.hitTest({ x: 105, y: 105 })?.id).toBe('child');
    expect(scene.hitTest({ x: 5, y: 5 })).toBeUndefined();
    scene.dispose();
  });

  test('dispose() empties nodes and stops responding', () => {
    const canvas = createCanvas();
    const scene = createScene(canvas);
    scene.add(rectNode({ x: 0, y: 0, width: 10, height: 10 }));
    scene.dispose();
    expect(scene.disposed).toBe(true);
    expect(scene.nodes).toHaveLength(0);
  });
});
