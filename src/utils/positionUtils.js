export const calculateNewPositions = (items, currentIndex, direction) => {
  const positions = items.map(item => item.position);
  
  if (direction === 'up' && currentIndex > 0) {
    return {
      prevId: currentIndex > 1 ? items[currentIndex - 2].id : null,
      nextId: items[currentIndex - 1].id,
      newPosition: (positions[currentIndex - 1] + (positions[currentIndex - 2] || 0)) / 2
    };
  } else if (direction === 'down' && currentIndex < items.length - 1) {
    return {
      prevId: items[currentIndex + 1].id,
      nextId: currentIndex < items.length - 2 ? items[currentIndex + 2].id : null,
      newPosition: (positions[currentIndex + 1] + (positions[currentIndex + 2] || positions[currentIndex + 1] + 1000000)) / 2
    };
  }
  return null;
};

export const calculatePosition = (prevPosition, nextPosition) => {
  if (!prevPosition && !nextPosition) {
    return getInitialPosition();
  }
  
  if (!prevPosition) {
    return nextPosition - 1000000;
  }
  
  if (!nextPosition) {
    return prevPosition + 1000000;
  }
  
  return (prevPosition + nextPosition) / 2;
};

export const getInitialPosition = () => {
  return Date.now() * 1000;
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

  // Sort items by position
  const sortByPosition = (items) => {
    items.sort((a, b) => (a.position || 0) - (b.position || 0));
    items.forEach(item => {
      if (item.children && item.children.length > 0) {
        sortByPosition(item.children);
      }
    });
  };

  sortByPosition(rootItems);
  return rootItems;
};