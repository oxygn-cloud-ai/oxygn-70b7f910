import { FileIcon } from 'lucide-react';

interface ExpandedTreeItemProps {
  item: {
    prompt_name?: string;
  };
  level: number;
}

const ExpandedTreeItem: React.FC<ExpandedTreeItemProps> = ({ item, level }) => {
  const displayName = item.prompt_name && item.prompt_name.trim() !== '' ? `${item.prompt_name} {${level}}` : `New Prompt {${level}}`;

  return (
    <div className="flex items-center py-1 px-2 rounded bg-blue-100">
      <FileIcon className="h-4 w-4 flex-shrink-0 mr-2" />
      <span className="text-sm font-semibold text-blue-600">
        {displayName}
      </span>
    </div>
  );
};

export default ExpandedTreeItem;
