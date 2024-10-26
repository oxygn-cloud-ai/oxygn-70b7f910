export const calculateNewPosition = (beforePosition, afterPosition) => {
  if (!beforePosition) return afterPosition ? afterPosition - 1000 : 1000;
  if (!afterPosition) return beforePosition + 1000;
  return beforePosition + (afterPosition - beforePosition) / 2;
};

export const getInitialPosition = (items) => {
  if (!items || items.length === 0) return 1000;
  const maxPosition = Math.max(...items.map(item => item.position || 0));
  return maxPosition + 1000;
};

export const updateItemPosition = async (supabase, itemId, newPosition) => {
  const { error } = await supabase
    .from('prompts')
    .update({ position: newPosition })
    .eq('row_id', itemId);

  if (error) throw error;
};