import React from 'react';
import { cn } from '@/lib/utils';
import { 
  Loader2, 
  CheckCircle2, 
  FileText, 
  Library, 
  Play, 
  List,
  Search,
  FileStack,
  Wrench
} from 'lucide-react';

const TOOL_INFO = {
  list_prompts: { icon: List, label: 'Listing prompts', color: 'text-blue-500' },
  get_prompt_details: { icon: FileText, label: 'Reading prompt details', color: 'text-blue-500' },
  execute_prompt: { icon: Play, label: 'Executing prompt', color: 'text-green-500' },
  list_library: { icon: Library, label: 'Browsing library', color: 'text-purple-500' },
  get_library_item: { icon: FileText, label: 'Reading library item', color: 'text-purple-500' },
  confluence_list_attached: { icon: FileStack, label: 'Listing Confluence pages', color: 'text-orange-500' },
  confluence_read_attached: { icon: Search, label: 'Reading Confluence page', color: 'text-orange-500' },
  list_files: { icon: FileStack, label: 'Listing files', color: 'text-cyan-500' },
};

const ToolActivityIndicator = ({ toolCalls = [], isExecuting = false }) => {
  if (toolCalls.length === 0) return null;

  return (
    <div className="px-4 py-2 mx-3 my-1 bg-muted/50 rounded-lg border border-border/50">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Wrench className="h-3 w-3" />
        <span className="font-medium">AI is using tools</span>
      </div>
      <div className="space-y-1.5">
        {toolCalls.map((tool, index) => {
          const info = TOOL_INFO[tool.name] || { 
            icon: Wrench, 
            label: tool.name.replace(/_/g, ' '), 
            color: 'text-muted-foreground' 
          };
          const Icon = info.icon;
          const isComplete = tool.status === 'complete';
          const isRunning = tool.status === 'running';

          return (
            <div 
              key={`${tool.name}-${index}`}
              className={cn(
                "flex items-center gap-2 text-xs py-1 px-2 rounded",
                isComplete ? "bg-background/50" : "bg-background"
              )}
            >
              {isRunning ? (
                <Loader2 className={cn("h-3 w-3 animate-spin", info.color)} />
              ) : isComplete ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <Icon className={cn("h-3 w-3", info.color)} />
              )}
              <span className={cn(
                "flex-1",
                isComplete ? "text-muted-foreground" : "text-foreground"
              )}>
                {info.label}
              </span>
              {tool.args && Object.keys(tool.args).length > 0 && (
                <span className="text-muted-foreground/70 text-[10px] truncate max-w-[150px]">
                  {Object.values(tool.args)[0]}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {isExecuting && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          Processing tool results...
        </div>
      )}
    </div>
  );
};

export default ToolActivityIndicator;
