import React, { createContext, useContext, useState, useEffect } from 'react';

const UIPreferenceContext = createContext({
  isNewUI: false,
  toggleUI: () => {},
});

export const useUIPreference = () => useContext(UIPreferenceContext);

export const UIPreferenceProvider = ({ children }) => {
  const [isNewUI, setIsNewUI] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('useNewUiBeta');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem('useNewUiBeta', JSON.stringify(isNewUI));
  }, [isNewUI]);

  const toggleUI = () => {
    setIsNewUI(prev => !prev);
  };

  return (
    <UIPreferenceContext.Provider value={{ isNewUI, toggleUI }}>
      {children}
    </UIPreferenceContext.Provider>
  );
};
