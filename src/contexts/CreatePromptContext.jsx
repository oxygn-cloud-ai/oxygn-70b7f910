import { createContext, useContext, useState, useCallback } from 'react';

const CreatePromptContext = createContext({
  createPromptHandler: null,
  setCreatePromptHandler: () => {},
  triggerCreatePrompt: () => {},
});

export const useCreatePrompt = () => useContext(CreatePromptContext);

export const CreatePromptProvider = ({ children }) => {
  const [createPromptHandler, setCreatePromptHandler] = useState(null);

  const triggerCreatePrompt = useCallback(() => {
    if (createPromptHandler) {
      createPromptHandler();
    }
  }, [createPromptHandler]);

  return (
    <CreatePromptContext.Provider value={{ 
      createPromptHandler, 
      setCreatePromptHandler, 
      triggerCreatePrompt 
    }}>
      {children}
    </CreatePromptContext.Provider>
  );
};
