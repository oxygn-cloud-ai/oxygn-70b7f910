export const calculatePosition = (prevPosition, nextPosition) => {
  if (!prevPosition && !nextPosition) {
    // First item in the list
    return Date.now() * 1000;
  }
  
  if (!prevPosition) {
    // Moving to the start
    return nextPosition - 1000000;
  }
  
  if (!nextPosition) {
    // Moving to the end
    return prevPosition + 1000000;
  }
  
  // Insert between two positions
  return (prevPosition + nextPosition) / 2;
};

export const getInitialPosition = () => {
  return Date.now() * 1000;
};