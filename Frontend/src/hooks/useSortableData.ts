import { useState, useMemo } from 'react';

export type SortDirection = 'ascending' | 'descending' | null;

export interface SortConfig {
  key: string | null;
  direction: SortDirection;
}

export function useSortableData<T>(items: T[], config: SortConfig | null = null) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(config);

  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig !== null && sortConfig.key !== null && sortConfig.direction !== null) {
      sortableItems.sort((a, b) => {
        // Handle nested keys like "contact.name"
        const keys = sortConfig.key!.split('.');
        let aValue: any = a;
        let bValue: any = b;
        
        for (const k of keys) {
          aValue = aValue ? aValue[k as keyof typeof aValue] : undefined;
          bValue = bValue ? bValue[k as keyof typeof bValue] : undefined;
        }

        // Handle string comparison (case-insensitive)
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const aLower = aValue.toLowerCase();
          const bLower = bValue.toLowerCase();
          if (aLower < bLower) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (aLower > bLower) return sortConfig.direction === 'ascending' ? 1 : -1;
          return 0;
        }

        // Handle numbers and other comparable types
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key: string) => {
    let direction: SortDirection = 'ascending';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'ascending'
    ) {
      direction = 'descending';
    } else if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'descending'
    ) {
      direction = null; // Toggle off
      key = '';
    }
    
    setSortConfig({ key: key || null, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
}
