import { useEffect, useCallback } from 'react';

/**
 * Global keyboard shortcuts hook for the Mockup page
 * 
 * @param {Object} config - Shortcut configuration
 * @param {Function} config.onSearch - Cmd+K - Open search
 * @param {Function} config.onToggleFolderPanel - Cmd+B - Toggle folder panel
 * @param {Function} config.onToggleConversationPanel - Cmd+J - Toggle conversation panel
 * @param {Function} config.onSave - Cmd+S - Save current item
 * @param {Function} config.onRun - Cmd+Enter - Run prompt
 * @param {Function} config.onEscape - Escape - Close modals/panels
 * @param {Function} config.onUndo - Cmd+Z - Undo last action
 * @param {boolean} config.enabled - Whether shortcuts are enabled
 */
export const useKeyboardShortcuts = ({
  onSearch,
  onToggleFolderPanel,
  onToggleConversationPanel,
  onSave,
  onRun,
  onEscape,
  onUndo,
  enabled = true,
}) => {
  const handleKeyDown = useCallback((e) => {
    if (!enabled) return;

    // Check if user is typing in an input/textarea
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) ||
                     e.target.isContentEditable;

    // Cmd/Ctrl + K - Search (works even when typing)
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      onSearch?.();
      return;
    }

    // Cmd/Ctrl + B - Toggle folder panel (works even when typing)
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      onToggleFolderPanel?.();
      return;
    }

    // Cmd/Ctrl + J - Toggle conversation panel (works even when typing)
    if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
      e.preventDefault();
      onToggleConversationPanel?.();
      return;
    }

    // Cmd/Ctrl + S - Save (works even when typing)
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      onSave?.();
      return;
    }

    // Cmd/Ctrl + Enter - Run prompt
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun?.();
      return;
    }

    // Escape - Close modals/panels (only when not typing)
    if (e.key === 'Escape' && !isTyping) {
      e.preventDefault();
      onEscape?.();
      return;
    }

    // Cmd/Ctrl + Z - Undo (works even when typing)
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      onUndo?.();
      return;
    }
  }, [enabled, onSearch, onToggleFolderPanel, onToggleConversationPanel, onSave, onRun, onEscape, onUndo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

export default useKeyboardShortcuts;
