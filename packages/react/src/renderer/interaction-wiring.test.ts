import type { InteractionSpec } from '@flui/core';
import { describe, expect, it, vi } from 'vitest';

import type { InteractionIssue } from '../react.types';

import { createInteractionStore } from './interaction-wiring';

function makeInteraction(overrides: Partial<InteractionSpec> = {}): InteractionSpec {
  return {
    source: 'source-1',
    target: 'target-1',
    event: 'onChange',
    ...overrides,
  };
}

describe('createInteractionStore', () => {
  describe('basic source→target data flow', () => {
    it('source fires event and target gets updated props via dataMapping', () => {
      const interactions: InteractionSpec[] = [
        makeInteraction({
          source: 'filter',
          target: 'chart',
          event: 'onChange',
          dataMapping: { value: 'filterCategory' },
        }),
      ];
      const componentIds = new Set(['filter', 'chart']);
      const store = createInteractionStore(interactions, componentIds);

      // Initially target has no props
      expect(store.getTargetProps('chart')).toEqual({});

      // Source fires event
      const handlers = store.getSourceHandlers('filter');
      expect(handlers.onChange).toBeDefined();
      handlers.onChange!({ target: { value: 'electronics' } });

      // Target now has mapped props
      expect(store.getTargetProps('chart')).toEqual({ filterCategory: 'electronics' });
    });

    it('passes raw event data as "data" prop when no dataMapping', () => {
      const interactions: InteractionSpec[] = [
        makeInteraction({
          source: 'btn',
          target: 'display',
          event: 'onClick',
          dataMapping: undefined,
        }),
      ];
      const componentIds = new Set(['btn', 'display']);
      const store = createInteractionStore(interactions, componentIds);

      const handlers = store.getSourceHandlers('btn');
      handlers.onClick!('clicked-value');

      expect(store.getTargetProps('display')).toEqual({ data: 'clicked-value' });
    });
  });

  describe('dataMapping', () => {
    it('maps source field to correct target prop name', () => {
      const interactions: InteractionSpec[] = [
        makeInteraction({
          source: 'input',
          target: 'output',
          event: 'onSubmit',
          dataMapping: { name: 'userName', email: 'userEmail' },
        }),
      ];
      const componentIds = new Set(['input', 'output']);
      const store = createInteractionStore(interactions, componentIds);

      const handlers = store.getSourceHandlers('input');
      handlers.onSubmit!({ name: 'Alice', email: 'alice@example.com' });

      expect(store.getTargetProps('output')).toEqual({
        userName: 'Alice',
        userEmail: 'alice@example.com',
      });
    });

    it('uses primitive event data directly when dataMapping references single field', () => {
      const interactions: InteractionSpec[] = [
        makeInteraction({
          source: 'slider',
          target: 'display',
          event: 'onChange',
          dataMapping: { value: 'sliderValue' },
        }),
      ];
      const componentIds = new Set(['slider', 'display']);
      const store = createInteractionStore(interactions, componentIds);

      // When event data is a primitive, it's used directly for all mapped props
      const handlers = store.getSourceHandlers('slider');
      handlers.onChange!(42);

      expect(store.getTargetProps('display')).toEqual({ sliderValue: 42 });
    });
  });

  describe('reactive propagation', () => {
    it('source change is immediately available in target props', () => {
      const interactions: InteractionSpec[] = [
        makeInteraction({
          source: 'dropdown',
          target: 'list',
          event: 'onChange',
          dataMapping: { value: 'filter' },
        }),
      ];
      const componentIds = new Set(['dropdown', 'list']);
      const store = createInteractionStore(interactions, componentIds);

      const handlers = store.getSourceHandlers('dropdown');

      handlers.onChange!({ target: { value: 'first' } });
      expect(store.getTargetProps('list')).toEqual({ filter: 'first' });

      handlers.onChange!({ target: { value: 'second' } });
      expect(store.getTargetProps('list')).toEqual({ filter: 'second' });
    });
  });

  describe('missing component handling', () => {
    it('records issue and does not crash when source component is missing', () => {
      const onIssue = vi.fn();
      const interactions: InteractionSpec[] = [
        makeInteraction({ source: 'missing-src', target: 'target-1' }),
      ];
      const componentIds = new Set(['target-1']);
      const store = createInteractionStore(interactions, componentIds, onIssue);

      expect(store.issues).toHaveLength(1);
      expect(store.issues[0]).toEqual({
        type: 'missing-source',
        interactionIndex: 0,
        componentId: 'missing-src',
      });
      expect(onIssue).toHaveBeenCalledWith(store.issues[0]);

      // Should not have handlers for missing source
      expect(store.getSourceHandlers('missing-src')).toEqual({});
    });

    it('records issue and does not crash when target component is missing', () => {
      const onIssue = vi.fn();
      const interactions: InteractionSpec[] = [
        makeInteraction({ source: 'source-1', target: 'missing-tgt' }),
      ];
      const componentIds = new Set(['source-1']);
      const store = createInteractionStore(interactions, componentIds, onIssue);

      expect(store.issues).toHaveLength(1);
      expect(store.issues[0]).toEqual({
        type: 'missing-target',
        interactionIndex: 0,
        componentId: 'missing-tgt',
      });
      expect(onIssue).toHaveBeenCalledWith(store.issues[0]);
    });

    it('skips invalid interactions but processes valid ones', () => {
      const interactions: InteractionSpec[] = [
        makeInteraction({ source: 'missing', target: 'target-1' }),
        makeInteraction({ source: 'source-1', target: 'target-1', event: 'onClick' }),
      ];
      const componentIds = new Set(['source-1', 'target-1']);
      const store = createInteractionStore(interactions, componentIds);

      expect(store.issues).toHaveLength(1);

      // Valid interaction still works
      const handlers = store.getSourceHandlers('source-1');
      expect(handlers.onClick).toBeDefined();
    });
  });

  describe('multiple interactions', () => {
    it('supports multiple interactions from same source', () => {
      const interactions: InteractionSpec[] = [
        makeInteraction({
          source: 'form',
          target: 'chart',
          event: 'onChange',
          dataMapping: { value: 'chartFilter' },
        }),
        makeInteraction({
          source: 'form',
          target: 'table',
          event: 'onChange',
          dataMapping: { value: 'tableFilter' },
        }),
      ];
      const componentIds = new Set(['form', 'chart', 'table']);
      const store = createInteractionStore(interactions, componentIds);

      const handlers = store.getSourceHandlers('form');
      handlers.onChange!({ target: { value: 'electronics' } });

      expect(store.getTargetProps('chart')).toEqual({ chartFilter: 'electronics' });
      expect(store.getTargetProps('table')).toEqual({ tableFilter: 'electronics' });
    });

    it('supports multiple interactions to same target (props merge)', () => {
      const interactions: InteractionSpec[] = [
        makeInteraction({
          source: 'filter-a',
          target: 'display',
          event: 'onChange',
          dataMapping: { value: 'categoryFilter' },
        }),
        makeInteraction({
          source: 'filter-b',
          target: 'display',
          event: 'onChange',
          dataMapping: { value: 'dateFilter' },
        }),
      ];
      const componentIds = new Set(['filter-a', 'filter-b', 'display']);
      const store = createInteractionStore(interactions, componentIds);

      store.getSourceHandlers('filter-a').onChange!({ target: { value: 'tech' } });
      store.getSourceHandlers('filter-b').onChange!({ target: { value: '2024' } });

      expect(store.getTargetProps('display')).toEqual({
        categoryFilter: 'tech',
        dateFilter: '2024',
      });
    });
  });

  describe('event data extraction', () => {
    it('extracts value from SyntheticEvent-like objects', () => {
      const interactions: InteractionSpec[] = [
        makeInteraction({
          source: 'input',
          target: 'output',
          event: 'onChange',
          dataMapping: { value: 'inputValue' },
        }),
      ];
      const componentIds = new Set(['input', 'output']);
      const store = createInteractionStore(interactions, componentIds);

      const handlers = store.getSourceHandlers('input');
      // SyntheticEvent-like: { target: { value: ... } }
      handlers.onChange!({ target: { value: 'typed-text' } });

      expect(store.getTargetProps('output')).toEqual({ inputValue: 'typed-text' });
    });

    it('uses direct values as-is for primitives', () => {
      const interactions: InteractionSpec[] = [
        makeInteraction({
          source: 'slider',
          target: 'display',
          event: 'onChange',
        }),
      ];
      const componentIds = new Set(['slider', 'display']);
      const store = createInteractionStore(interactions, componentIds);

      const handlers = store.getSourceHandlers('slider');
      handlers.onChange!(75);

      expect(store.getTargetProps('display')).toEqual({ data: 75 });
    });

    it('uses direct object values as-is when no target.value', () => {
      const interactions: InteractionSpec[] = [
        makeInteraction({
          source: 'picker',
          target: 'display',
          event: 'onSelect',
          dataMapping: { id: 'selectedId', label: 'selectedLabel' },
        }),
      ];
      const componentIds = new Set(['picker', 'display']);
      const store = createInteractionStore(interactions, componentIds);

      const handlers = store.getSourceHandlers('picker');
      handlers.onSelect!({ id: 42, label: 'Option A' });

      expect(store.getTargetProps('display')).toEqual({
        selectedId: 42,
        selectedLabel: 'Option A',
      });
    });
  });

  describe('empty interactions', () => {
    it('handles empty interactions array', () => {
      const store = createInteractionStore([], new Set(['comp-1']));
      expect(store.issues).toHaveLength(0);
      expect(store.getSourceHandlers('comp-1')).toEqual({});
      expect(store.getTargetProps('comp-1')).toEqual({});
    });
  });

  describe('no issues for valid interactions', () => {
    it('has empty issues array when all interactions are valid', () => {
      const interactions: InteractionSpec[] = [
        makeInteraction({ source: 'a', target: 'b', event: 'onClick' }),
      ];
      const store = createInteractionStore(interactions, new Set(['a', 'b']));
      expect(store.issues).toHaveLength(0);
    });
  });
});
