import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Brain, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

/**
 * Full-screen popup for viewing streaming reasoning content.
 * Auto-scrolls to bottom as new content arrives.
 */
const ReasoningStreamPopup = ({ 
  isOpen, 
  onClose, 
  thinkingText,
  promptName,
  model 
}) => {
  const scrollRef = useRef(null);
  
  // Auto-scroll to bottom as new content arrives
  useEffect(() => {
    if (scrollRef.current && thinkingText) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinkingText]);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(thinkingText || '');
    toast.success('Reasoning copied to clipboard');
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 bg-surface-container-high border-outline-variant">
        <DialogHeader className="px-4 py-3 border-b border-outline-variant bg-surface-container">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary animate-pulse" />
              <DialogTitle className="text-body-sm font-medium text-on-surface">
                {promptName || 'AI Reasoning'}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-on-surface-variant">{model}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={handleCopy}
                    className="w-7 h-7 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
                  >
                    <Copy className="h-3.5 w-3.5 text-on-surface-variant" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Copy all</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </DialogHeader>
        
        <div 
          ref={scrollRef}
          className="p-4 overflow-y-auto max-h-[60vh]"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-body-sm text-on-surface whitespace-pre-wrap leading-relaxed font-sans"
          >
            {thinkingText || (
              <span className="text-on-surface-variant italic">
                Waiting for reasoning output...
              </span>
            )}
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReasoningStreamPopup;
