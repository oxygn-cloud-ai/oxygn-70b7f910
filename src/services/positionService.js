export const calculateNewPosition = (beforePosition, afterPosition) => {
  if (!beforePosition) return afterPosition ? afterPosition - 1000 : 1000;
  if (!afterPosition) return beforePosition + 1000;
  return beforePosition + (afterPosition - beforePosition) / 2;
};