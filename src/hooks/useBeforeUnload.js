import { useEffect } from 'react';

export const useBeforeUnload = (message) => {
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (message) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [message]);
};