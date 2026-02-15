'use client';

import { type ReactNode } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

interface TabItem {
  key: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  value?: string;
  onChange?: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, defaultTab, value, onChange, className }: TabsProps) {
  const defaultValue = defaultTab ?? tabs[0]?.key;

  return (
    <TabsPrimitive.Root
      defaultValue={value === undefined ? defaultValue : undefined}
      value={value}
      onValueChange={onChange}
      className={cn('flex flex-col', className)}
    >
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key} disabled={tab.disabled}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.key} value={tab.key}>
          {tab.content}
        </TabsContent>
      ))}
    </TabsPrimitive.Root>
  );
}

export function TabsList({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-10 items-center gap-1 border-b bg-transparent px-1',
        className,
      )}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({
  className,
  value,
  disabled,
  children,
}: {
  className?: string;
  value: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      disabled={disabled}
      className={cn(
        'relative inline-flex items-center justify-center whitespace-nowrap px-3 pb-2.5 pt-2 text-sm font-medium transition-colors',
        'text-muted-foreground hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:text-foreground',
        // Underline active indicator
        'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:scale-x-0 after:bg-primary after:transition-transform',
        'data-[state=active]:after:scale-x-100',
        className,
      )}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({
  className,
  value,
  children,
}: {
  className?: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <TabsPrimitive.Content
      value={value}
      className={cn(
        'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      {children}
    </TabsPrimitive.Content>
  );
}
