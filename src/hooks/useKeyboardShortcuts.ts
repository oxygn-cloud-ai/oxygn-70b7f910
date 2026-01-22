import { useEffect, useCallback } from 'react';
import { trackEvent } from '@/lib/posthog';

interface KeyboardShortcutsConfig {
  onToggleFolderPanel?: () => void;
  onToggleConversationPanel?: () => void;
  onSave?: () => void;
  onRun?: () => void;
  onEscape?: () => void;
  onUndo?: () => void;
  enabled?: boolean;
}

/**
 * Global keyboard shortcuts hook for the Mockup page
 * 
 * NOTE: Cmd+K search removed - replaced by LiveApiDashboard in TopBar
 */
export const useKeyboardShortcuts = ({
  onToggleFolderPanel,
  onToggleConversationPanel,
  onSave,
  onRun,
  onEscape,
  onUndo,
  enabled = true,
}: KeyboardShortcutsConfig): void => {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Check if user is typing in an input/textarea
    const target = e.target as HTMLElement;
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
                     target.isContentEditable;

    // Cmd/Ctrl + B - Toggle folder panel (works even when typing)
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      trackEvent('keyboard_shortcut_used', { shortcut: 'cmd+b', action: 'toggle_folder_panel' });
      onToggleFolderPanel?.();
      return;
    }

    // Cmd/Ctrl + J - Toggle conversation panel (works even when typing)
    if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
      e.preventDefault();
      trackEvent('keyboard_shortcut_used', { shortcut: 'cmd+j', action: 'toggle_conversation_panel' });
      onToggleConversationPanel?.();
      return;
    }

    // Cmd/Ctrl + S - Save (works even when typing)
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      trackEvent('keyboard_shortcut_used', { shortcut: 'cmd+s', action: 'save' });
      onSave?.();
      return;
    }

    // Cmd/Ctrl + Enter - Run prompt
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      trackEvent('keyboard_shortcut_used', { shortcut: 'cmd+enter', action: 'run_prompt' });
      onRun?.();
      return;
    }

    // Escape - Close modals/panels (only when not typing)
    if (e.key === 'Escape' && !isTyping) {
      e.preventDefault();
      trackEvent('keyboard_shortcut_used', { shortcut: 'escape', action: 'close_modal' });
      onEscape?.();
      return;
    }

    // Cmd/Ctrl + Z - Undo (works even when typing)
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      trackEvent('keyboard_shortcut_used', { shortcut: 'cmd+z', action: 'undo' });
      onUndo?.();
      return;
    }
  }, [enabled, onToggleFolderPanel, onToggleConversationPanel, onSave, onRun, onEscape, onUndo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

export default useKeyboardShortcuts;
