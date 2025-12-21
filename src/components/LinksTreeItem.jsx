import React from 'react';
import { FileIcon, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from "@/components/ui/button";

const LinksTreeItem = ({
  item,
  level,
  expandedItems,
  toggleItem,
  activeItem,
  setActiveItem,
}) => {
  const isExpanded = expandedItems.includes(item.id);
  const isActive = activeItem === item.id;

  const handleToggle = (e) => {
    e.stopPropagation();
    toggleItem(item.id);
  };

  const displayName = item.prompt_name && item.prompt_name.trim() !== '' ? `${item.prompt_name} {${level}}` : `New Prompt {${level}}`;

  return (
    <div className={`border-none ${level === 1 ? 'pt-3' : 'pt-0'} pb-0.1`}>
      <div
        className={`flex items-center hover:bg-gray-100 py-0 px-2 rounded ${isActive ? 'bg-blue-100' : ''}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={() => setActiveItem(item.id)}
      >
        <div className="flex items-center space-x-1 flex-grow">
          {item.children && item.children.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-4 w-4"
              onClick={handleToggle}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              )}
            </Button>
          ) : (
            <div className="w-4 h-4 flex-shrink-0" />
          )}
          <FileIcon className="h-4 w-4 flex-shrink-0" />
          <span 
            className={`ml-1 cursor-pointer text-sm ${isActive ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
          >
            {displayName}
          </span>
        </div>
      </div>
      {isExpanded && item.children && item.children.length > 0 && (
        <div>
          {item.children.map((child) => (
            <LinksTreeItem
              key={child.id}
              item={child}
              level={level + 1}
              expandedItems={expandedItems}
              toggleItem={toggleItem}
              activeItem={activeItem}
              setActiveItem={setActiveItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LinksTreeItem;