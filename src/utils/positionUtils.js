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