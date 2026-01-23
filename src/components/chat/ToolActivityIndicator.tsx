import { Loader2, Check, Wrench } from 'lucide-react';
import type { ToolActivity } from '@/types/chat';

interface ToolActivityIndicatorProps {
  toolActivity: ToolActivity[];
  isExecuting: boolean;
}

export const ToolActivityIndicator = ({ toolActivity, isExecuting }: ToolActivityIndicatorProps) => {
  if (!toolActivity || toolActivity.length === 0) return null;

  return (
    <div className="px-2 py-1.5 bg-surface-container rounded-m3-md mb-2">
      <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
        <Wrench className="h-3 w-3" />
        <span>Using tools:</span>
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {toolActivity.map((tool, idx) => (
          <span 
            key={idx}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${
              tool.status === 'running' 
                ? 'bg-primary/10 text-primary' 
                : 'bg-green-500/10 text-green-600'
            }`}
          >
            {tool.status === 'running' ? (
              <Loader2 className="h-2 w-2 animate-spin" />
            ) : (
              <Check className="h-2 w-2" />
            )}
            {tool.name}
          </span>
        ))}
      </div>
    </div>
  );
};
