import type { ComponentRegistry } from '@flui/core';
import { z } from 'zod';

import { Button } from './Button';
import { Card } from './Card';
import { DataTable } from './DataTable';
import { Heading } from './Heading';
import { Input } from './Input';
import { MetricCard } from './MetricCard';
import { Select } from './Select';
import { StatusBadge } from './StatusBadge';
import { Text } from './Text';

export function registerComponents(registry: ComponentRegistry): void {
  registry.batchRegister([
    {
      name: 'Heading',
      category: 'display',
      description: 'Renders a heading element (h1-h6)',
      accepts: z.object({
        level: z.number().min(1).max(6),
        text: z.string(),
      }),
      component: Heading,
    },
    {
      name: 'Text',
      category: 'display',
      description: 'Renders text content with optional variants',
      accepts: z.object({
        text: z.string(),
        variant: z.enum(['body', 'caption', 'code']).optional(),
      }),
      component: Text,
    },
    {
      name: 'Button',
      category: 'input',
      description: 'Interactive button with style variants',
      accepts: z.object({
        label: z.string(),
        variant: z.enum(['primary', 'secondary', 'danger']).optional(),
      }),
      component: Button,
    },
    {
      name: 'Card',
      category: 'layout',
      description: 'Container card with title and optional subtitle',
      accepts: z.object({
        title: z.string(),
        subtitle: z.string().optional(),
      }),
      component: Card,
    },
    {
      name: 'Input',
      category: 'input',
      description: 'Text input field with label',
      accepts: z.object({
        label: z.string(),
        placeholder: z.string().optional(),
        type: z.string().optional(),
      }),
      component: Input,
    },
    {
      name: 'Select',
      category: 'input',
      description: 'Dropdown select with options',
      accepts: z.object({
        label: z.string(),
        options: z.array(z.object({ value: z.string(), label: z.string() })),
      }),
      component: Select,
    },
    {
      name: 'DataTable',
      category: 'data',
      description: 'Tabular data display with columns and rows',
      accepts: z.object({
        columns: z.array(z.string()),
        rows: z.array(z.record(z.string(), z.string())),
      }),
      component: DataTable,
    },
    {
      name: 'MetricCard',
      category: 'display',
      description: 'Displays a metric value with label and trend indicator',
      accepts: z.object({
        label: z.string(),
        value: z.string(),
        trend: z.enum(['up', 'down', 'flat']).optional(),
      }),
      component: MetricCard,
    },
    {
      name: 'StatusBadge',
      category: 'display',
      description: 'Colored status badge indicator',
      accepts: z.object({
        text: z.string(),
        status: z.enum(['success', 'warning', 'error', 'info']),
      }),
      component: StatusBadge,
    },
  ]);
}
