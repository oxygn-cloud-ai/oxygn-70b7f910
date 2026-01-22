/**
 * Position Utilities
 * Functions for managing item positions and building tree structures
 */

import { generatePositionBetween, generatePositionAtEnd, generatePositionAtStart } from './lexPosition';

export interface TreeItem {
  row_id: string;
  id?: string;
  parent_row_id?: string | null;
  position_lex?: string | null;
  created_at?: string;
  children?: TreeItem[];
  [key: string]: unknown;
}

export interface PositionResult {
  beforeId: string | null;
  afterId: string | null;
  newPosition: string;
}

/**
 * Calculate new positions when moving an item up or down in a list
 * @param items - Array of items with position_lex
 * @param currentIndex - Current index of the item being moved
 * @param direction - 'up' or 'down'
 * @returns Position calculation result
 */
export const calculateNewPositions = (
  items: TreeItem[],
  currentIndex: number,
  direction: 'up' | 'down'
): PositionResult => {
  const sortedItems = [...items].sort((a, b) => 
    (a.position_lex || '').localeCompare(b.position_lex || '')
  );
  
  if (direction === 'up' && currentIndex > 0) {
    const beforeItem = currentIndex > 1 ? sortedItems[currentIndex - 2] : null;
    const afterItem = sortedItems[currentIndex - 1];
    const newPosition = generatePositionBetween(
      beforeItem?.position_lex || null,
      afterItem?.position_lex || null
    );
    return {
      beforeId: beforeItem?.row_id || null,
      afterId: afterItem?.row_id || null,
      newPosition,
    };
  } else if (direction === 'down' && currentIndex < sortedItems.length - 1) {
    const beforeItem = sortedItems[currentIndex + 1];
    const afterItem = currentIndex < sortedItems.length - 2 ? sortedItems[currentIndex + 2] : null;
    const newPosition = generatePositionBetween(
      beforeItem?.position_lex || null,
      afterItem?.position_lex || null
    );
    return {
      beforeId: beforeItem?.row_id || null,
      afterId: afterItem?.row_id || null,
      newPosition,
    };
  }
  
  // No movement needed
  return {
    beforeId: null,
    afterId: null,
    newPosition: sortedItems[currentIndex]?.position_lex || 'a0',
  };
};

/**
 * @deprecated Use utilities from ./lexPosition instead
 */
export const calculatePosition = (
  prevPosition: string | null,
  nextPosition: string | null
): string => {
  return generatePositionBetween(prevPosition, nextPosition);
};

/**
 * @deprecated Use generatePositionAtEnd from ./lexPosition instead
 */
export const getInitialPosition = (): string => {
  return generatePositionAtEnd(null);
};

/**
 * Build a nested tree structure from flat data
 * @param data - Flat array of items with parent_row_id references
 * @returns Nested tree structure
 */
export const buildTree = <T extends TreeItem>(data: T[]): T[] => {
  if (!Array.isArray(data)) return [];
  
  // Create a map for quick lookup
  const itemMap = new Map<string, T & { children: T[] }>();
  const roots: (T & { children: T[] })[] = [];
  
  // First pass: create entries with children arrays
  data.forEach(item => {
    itemMap.set(item.row_id, { ...item, children: [] });
  });
  
  // Second pass: build hierarchy
  data.forEach(item => {
    const node = itemMap.get(item.row_id)!;
    if (item.parent_row_id && itemMap.has(item.parent_row_id)) {
      const parent = itemMap.get(item.parent_row_id)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  
  // Sort function for items
  const sortItems = (items: (T & { children: T[] })[]): (T & { children: T[] })[] => {
    return items.sort((a, b) => {
      // Primary sort by position_lex
      const posA = a.position_lex || '';
      const posB = b.position_lex || '';
      if (posA !== posB) {
        return posA.localeCompare(posB);
      }
      // Fallback to created_at
      const dateA = a.created_at || '';
      const dateB = b.created_at || '';
      return dateA.localeCompare(dateB);
    });
  };
  
  // Recursively sort all levels
  const sortRecursive = (items: (T & { children: T[] })[]): (T & { children: T[] })[] => {
    const sorted = sortItems(items);
    sorted.forEach(item => {
      if (item.children.length > 0) {
        item.children = sortRecursive(item.children);
      }
    });
    return sorted;
  };
  
  return sortRecursive(roots);
};

/**
 * Flatten a tree structure back to a flat array
 * @param tree - Nested tree structure
 * @returns Flat array of items
 */
export const flattenTree = <T extends TreeItem>(tree: T[]): T[] => {
  const result: T[] = [];
  
  const traverse = (items: T[], depth: number = 0): void => {
    items.forEach(item => {
      result.push({ ...item, depth } as T);
      if (item.children && item.children.length > 0) {
        traverse(item.children as T[], depth + 1);
      }
    });
  };
  
  traverse(tree);
  return result;
};

/**
 * Find an item in a tree by predicate
 * @param tree - Tree to search
 * @param predicate - Function to test each item
 * @returns Found item or null
 */
export const findInTree = <T extends TreeItem>(
  tree: T[],
  predicate: (item: T) => boolean
): T | null => {
  for (const item of tree) {
    if (predicate(item)) {
      return item;
    }
    if (item.children && item.children.length > 0) {
      const found = findInTree(item.children as T[], predicate);
      if (found) return found;
    }
  }
  return null;
};

/**
 * Find an item by row_id
 * @param tree - Tree to search
 * @param rowId - The row_id to find
 * @returns Found item or null
 */
export const findByRowId = <T extends TreeItem>(
  tree: T[],
  rowId: string
): T | null => {
  return findInTree(tree, item => item.row_id === rowId);
};

/**
 * Get all descendants of an item
 * @param item - Parent item
 * @returns Array of all descendants
 */
export const getDescendants = <T extends TreeItem>(item: T): T[] => {
  const descendants: T[] = [];
  
  const collect = (children: T[]): void => {
    children.forEach(child => {
      descendants.push(child);
      if (child.children && child.children.length > 0) {
        collect(child.children as T[]);
      }
    });
  };
  
  if (item.children) {
    collect(item.children as T[]);
  }
  
  return descendants;
};

export default {
  calculateNewPositions,
  calculatePosition,
  getInitialPosition,
  buildTree,
  flattenTree,
  findInTree,
  findByRowId,
  getDescendants,
};
