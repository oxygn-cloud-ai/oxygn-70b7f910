import { createContext, useContext, useState, useCallback, ReactNode, Dispatch, SetStateAction } from 'react';

export type CreatePromptHandler = (() => void) | null;

export interface CreatePromptContextValue {
  createPromptHandler: CreatePromptHandler;
  setCreatePromptHandler: Dispatch<SetStateAction<CreatePromptHandler>>;
  triggerCreatePrompt: () => void;
}

const CreatePromptContext = createContext<CreatePromptContextValue>({
  createPromptHandler: null,
  setCreatePromptHandler: () => {},
  triggerCreatePrompt: () => {},
});

export const useCreatePrompt = (): CreatePromptContextValue => useContext(CreatePromptContext);

interface CreatePromptProviderProps {
  children: ReactNode;
}

export const CreatePromptProvider = ({ children }: CreatePromptProviderProps) => {
  const [createPromptHandler, setCreatePromptHandler] = useState<CreatePromptHandler>(null);

  const triggerCreatePrompt = useCallback((): void => {
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
