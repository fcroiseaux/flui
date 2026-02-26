import { describe, expect, it } from 'vitest';

import { createViewStateStore } from './view-state';

describe('createViewStateStore', () => {
  describe('getState', () => {
    it('returns empty object for unknown component', () => {
      const store = createViewStateStore();
      expect(store.getState('unknown-id')).toEqual({});
    });

    it('returns stored state for known component', () => {
      const store = createViewStateStore();
      store.setState('comp-1', { value: 'hello' });
      expect(store.getState('comp-1')).toEqual({ value: 'hello' });
    });
  });

  describe('setState', () => {
    it('stores state for a component', () => {
      const store = createViewStateStore();
      store.setState('comp-1', { text: 'hello' });
      expect(store.getState('comp-1')).toEqual({ text: 'hello' });
    });

    it('shallow-merges updates preserving unmodified fields', () => {
      const store = createViewStateStore();
      store.setState('comp-1', { firstName: 'John', lastName: 'Doe' });
      store.setState('comp-1', { firstName: 'Jane' });
      expect(store.getState('comp-1')).toEqual({ firstName: 'Jane', lastName: 'Doe' });
    });

    it('adds new fields on merge', () => {
      const store = createViewStateStore();
      store.setState('comp-1', { a: 1 });
      store.setState('comp-1', { b: 2 });
      expect(store.getState('comp-1')).toEqual({ a: 1, b: 2 });
    });
  });

  describe('reconcile', () => {
    it('preserves state for matching component IDs', () => {
      const store = createViewStateStore();
      store.setState('comp-1', { value: 'keep' });
      store.setState('comp-2', { value: 'also-keep' });

      const cleaned = store.reconcile(new Set(['comp-1', 'comp-2']));

      expect(cleaned).toBe(0);
      expect(store.getState('comp-1')).toEqual({ value: 'keep' });
      expect(store.getState('comp-2')).toEqual({ value: 'also-keep' });
    });

    it('removes orphaned state for components no longer in spec', () => {
      const store = createViewStateStore();
      store.setState('comp-1', { value: 'keep' });
      store.setState('comp-2', { value: 'remove' });
      store.setState('comp-3', { value: 'also-remove' });

      const cleaned = store.reconcile(new Set(['comp-1']));

      expect(cleaned).toBe(2);
      expect(store.getState('comp-1')).toEqual({ value: 'keep' });
      expect(store.getState('comp-2')).toEqual({});
      expect(store.getState('comp-3')).toEqual({});
    });

    it('allows new components to start with default state', () => {
      const store = createViewStateStore();
      store.setState('comp-1', { value: 'existing' });

      store.reconcile(new Set(['comp-1', 'comp-new']));

      expect(store.getState('comp-new')).toEqual({});
    });

    it('returns 0 when no orphans exist', () => {
      const store = createViewStateStore();
      const cleaned = store.reconcile(new Set(['comp-1']));
      expect(cleaned).toBe(0);
    });
  });

  describe('getSnapshot', () => {
    it('returns empty map when no state stored', () => {
      const store = createViewStateStore();
      const snapshot = store.getSnapshot();
      expect(snapshot.size).toBe(0);
    });

    it('returns copy of all stored state', () => {
      const store = createViewStateStore();
      store.setState('comp-1', { a: 1 });
      store.setState('comp-2', { b: 2 });

      const snapshot = store.getSnapshot();
      expect(snapshot.size).toBe(2);
      expect(snapshot.get('comp-1')).toEqual({ a: 1 });
      expect(snapshot.get('comp-2')).toEqual({ b: 2 });
    });

    it('returns defensive copy — mutations do not affect store', () => {
      const store = createViewStateStore();
      store.setState('comp-1', { value: 'original' });

      const snapshot = store.getSnapshot();
      const entry = snapshot.get('comp-1')!;
      entry.value = 'mutated';

      expect(store.getState('comp-1')).toEqual({ value: 'original' });
    });

    it('shows orphaned entries are gone after reconcile', () => {
      const store = createViewStateStore();
      store.setState('comp-1', { keep: true });
      store.setState('comp-2', { remove: true });

      store.reconcile(new Set(['comp-1']));

      const snapshot = store.getSnapshot();
      expect(snapshot.size).toBe(1);
      expect(snapshot.has('comp-2')).toBe(false);
    });
  });
});
