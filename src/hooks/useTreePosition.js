import { useState, useCallback } from 'react';
import { calculateNewPosition, updateItemPosition } from '../services/positionService';

export const useTreePosition = (supabase) => {
  const [isMoving, setIsMoving] = useState(false);

  const moveItem = useCallback(async (itemId, targetParentId, beforeItemPosition, afterItemPosition) => {
    setIsMoving(true);
    try {
      const newPosition = calculateNewPosition(beforeItemPosition, afterItemPosition);
      
      await supabase
        .from('prompts')
        .update({ 
          parent_row_id: targetParentId,
          position: newPosition 
        })
        .eq('row_id', itemId);

    } catch (error) {
      console.error('Error moving item:', error);
      throw error;
    } finally {
      setIsMoving(false);
    }
  }, [supabase]);

  return { moveItem, isMoving };
};