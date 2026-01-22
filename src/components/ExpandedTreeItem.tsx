import React from 'react';
import { FileIcon } from 'lucide-react';

interface TreeItem {
  prompt_name?: string | null;
  [key: string]: unknown;
}

interface ExpandedTreeItemProps {
  item: TreeItem;
  level: number;
}

const ExpandedTreeItem: React.FC<ExpandedTreeItemProps> = ({ item, level }) => {
  const displayName = item.prompt_name && item.prompt_name.trim() !== '' 
    ? `${item.prompt_name} {${level}}` 
    : `New Prompt {${level}}`;

  return (
    <div className="flex items-center py-1 px-2 rounded bg-primary/10">
      <FileIcon className="h-4 w-4 flex-shrink-0 mr-2 text-primary" />
      <span className="text-sm font-semibold text-primary">
        {displayName}
      </span>
    </div>
  );
};

export default ExpandedTreeItem;
