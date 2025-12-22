import React, { useState } from 'react';
import { Search, BookOpen, Copy, Loader2, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePromptLibrary } from '@/hooks/usePromptLibrary';
import { toast } from '@/components/ui/sonner';

const WorkbenchLibraryTab = () => {
  const {
    items,
    categories,
    isLoading,
    searchItems
  } = usePromptLibrary();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const filteredItems = React.useMemo(() => {
    let result = items;
    
    if (searchQuery.trim()) {
      result = searchItems(searchQuery);
    }
    
    if (selectedCategory) {
      result = result.filter(item => item.category === selectedCategory);
    }
    
    return result;
  }, [items, searchQuery, selectedCategory, searchItems]);

  const handleCopyContent = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search and Filter */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search library..."
            className="h-8 text-xs pl-8"
          />
        </div>
        
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <Badge
              variant={selectedCategory === null ? "default" : "outline"}
              className="cursor-pointer text-[10px] h-5"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Badge>
            {categories.map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className="cursor-pointer text-[10px] h-5"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Library Items */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">
                {searchQuery || selectedCategory ? 'No items found' : 'Library is empty'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item) => (
                <div
                  key={item.row_id}
                  className="group flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedItem(item)}
                >
                  <BookOpen className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    {item.description && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-0.5">
                      {item.category && (
                        <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                          <FolderOpen className="h-2 w-2 mr-0.5" />
                          {item.category}
                        </Badge>
                      )}
                      {item.is_private === false && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px]">
                          Shared
                        </Badge>
                      )}
                    </div>
                  </div>

                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyContent(item.content);
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy content</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Item Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {selectedItem?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3">
            {selectedItem?.description && (
              <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
            )}
            
            <div className="flex items-center gap-2">
              {selectedItem?.category && (
                <Badge variant="secondary" className="text-xs">
                  {selectedItem.category}
                </Badge>
              )}
              {selectedItem?.is_private === false && (
                <Badge variant="outline" className="text-xs">Shared</Badge>
              )}
            </div>
            
            <div className="relative">
              <pre className="p-3 bg-muted rounded-lg text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                {selectedItem?.content}
              </pre>
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2 h-7"
                onClick={() => handleCopyContent(selectedItem?.content)}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkbenchLibraryTab;
