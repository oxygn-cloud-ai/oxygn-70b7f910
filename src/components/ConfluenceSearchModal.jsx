import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Loader2, FileText, ExternalLink } from 'lucide-react';
import { useConfluencePages } from '@/hooks/useConfluencePages';

const ConfluenceSearchModal = ({ 
  open, 
  onOpenChange, 
  assistantRowId = null,
  promptRowId = null,
  onPageAttached
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpace, setSelectedSpace] = useState('all');
  const [attachingPageId, setAttachingPageId] = useState(null);
  
  const { 
    spaces, 
    searchResults, 
    isSearching, 
    listSpaces, 
    searchPages, 
    attachPage,
    clearSearch
  } = useConfluencePages(assistantRowId, promptRowId);

  // Load spaces when modal opens
  useEffect(() => {
    if (open && spaces.length === 0) {
      listSpaces();
    }
  }, [open, spaces.length, listSpaces]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchPages(searchQuery, selectedSpace === 'all' ? null : selectedSpace);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedSpace, searchPages]);

  // Clear search when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedSpace('all');
      clearSearch();
    }
  }, [open, clearSearch]);

  const handleAttach = async (pageId) => {
    setAttachingPageId(pageId);
    try {
      await attachPage(pageId);
      onPageAttached?.();
    } finally {
      setAttachingPageId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Browse Confluence</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedSpace} onValueChange={setSelectedSpace}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Spaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Spaces</SelectItem>
                {spaces.map((space) => (
                  <SelectItem key={space.key} value={space.key}>
                    {space.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results */}
          <ScrollArea className="h-[400px] border rounded-md">
            {isSearching ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-12 w-12 mb-2 opacity-50" />
                <p>{searchQuery.length < 2 ? 'Type to search pages' : 'No pages found'}</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {searchResults.map((page) => (
                  <div
                    key={page.id}
                    className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium truncate">{page.title}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="truncate">{page.spaceName || page.spaceKey}</span>
                        {page.url && (
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleAttach(page.id)}
                      disabled={attachingPageId === page.id}
                    >
                      {attachingPageId === page.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfluenceSearchModal;
