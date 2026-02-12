// @ts-nocheck
import { generatePositionBetween, generatePositionAtEnd } from './lexPosition';

/**
 * Calculate new position for moving an item up or down in a list
 * Uses lexicographic positioning for stable ordering
 */
export const calculateNewPositions = (items, currentIndex, direction) => {
  if (direction === 'up' && currentIndex > 0) {
    const prevItem = items[currentIndex - 1];
    const beforeItem = currentIndex > 1 ? items[currentIndex - 2] : null;
    const beforeKey = beforeItem?.position_lex || null;
    const afterKey = prevItem?.position_lex || null;
    
    return {
      prevId: beforeItem?.id || null,
      nextId: prevItem.id,
      newPositionLex: generatePositionBetween(beforeKey, afterKey)
    };
  } else if (direction === 'down' && currentIndex < items.length - 1) {
    const nextItem = items[currentIndex + 1];
    const afterItem = currentIndex < items.length - 2 ? items[currentIndex + 2] : null;
    const beforeKey = nextItem?.position_lex || null;
    const afterKey = afterItem?.position_lex || null;
    
    return {
      prevId: nextItem.id,
      nextId: afterItem?.id || null,
      newPositionLex: generatePositionBetween(beforeKey, afterKey)
    };
  }
  return null;
};

/**
 * @deprecated Use generatePositionBetween from lexPosition.js instead
 */
export const calculatePosition = (prevPosition, nextPosition) => {
  console.warn('calculatePosition is deprecated. Use lexPosition utilities instead.');
  if (!prevPosition && !nextPosition) {
    return 'a0';
  }
  if (!prevPosition) {
    return generatePositionBetween(null, nextPosition);
  }
  if (!nextPosition) {
    return generatePositionAtEnd(prevPosition);
  }
  return generatePositionBetween(prevPosition, nextPosition);
};

/**
 * @deprecated Use generatePositionAtEnd from lexPosition.js instead
 */
export const getInitialPosition = () => {
  console.warn('getInitialPosition is deprecated. Use lexPosition utilities instead.');
  return 'a0';
};

export const buildTree = (data) => {
  // First, create a map of all items with their children
  const itemMap = new Map();
  data.forEach(item => {
    itemMap.set(item.row_id, {
      ...item,
      id: item.row_id,
      name: item.prompt_name || 'Untitled',
      children: []
    });
  });

  // Build the tree structure
  const rootItems = [];
  data.forEach(item => {
    const mappedItem = itemMap.get(item.row_id);
    if (item.parent_row_id) {
      const parent = itemMap.get(item.parent_row_id);
      if (parent) {
        parent.children.push(mappedItem);
      } else {
        rootItems.push(mappedItem);
      }
    } else {
      rootItems.push(mappedItem);
    }
  });

  // Sort items by position_lex (lexicographic), with created_at as tie-breaker
  const sortByPosition = (items) => {
    items.sort((a, b) => {
      // Use position_lex for lexicographic sorting
      const posA = a.position_lex ?? '';
      const posB = b.position_lex ?? '';
      
      // Lexicographic string comparison
      if (posA < posB) return -1;
      if (posA > posB) return 1;
      
      // Tie-breaker: created_at (older first)
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateA - dateB;
    });
    
    items.forEach(item => {
      if (item.children && item.children.length > 0) {
        sortByPosition(item.children);
      }
    });
  };

  sortByPosition(rootItems);
  return rootItems;
};
