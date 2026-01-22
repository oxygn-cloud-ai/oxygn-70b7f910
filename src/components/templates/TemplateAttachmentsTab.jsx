import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, Search, X, ExternalLink, Loader2, Plus, Info } from 'lucide-react';
import { useConfluencePages } from '@/hooks/useConfluencePages';
import ConfluenceSearchModal from '@/components/ConfluenceSearchModal';

/**
 * Template Attachments Tab
 * Allows attaching Confluence page references to templates.
 * These references are stored in the template structure and copied when creating prompts.
 */
const TemplateAttachmentsTab = ({ template, onChange }) => {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  
  // Get current attachments from template structure
  const attachments = template?.structure?.attachments || {
    confluencePages: [],
  };

  const confluencePages = attachments.confluencePages || [];

  // Use hook just for modal functionality (not for actual attachment storage)
  const {
    spaces,
    listSpaces,
  } = useConfluencePages();

  // Handle attaching a page from the search modal
  const handlePageAttached = (pageInfo) => {
    // Add to template structure
    const newPage = {
      page_id: pageInfo.id || pageInfo.page_id,
      page_title: pageInfo.title || pageInfo.page_title,
      page_url: pageInfo.url || pageInfo.page_url,
      space_key: pageInfo.spaceKey || pageInfo.space_key,
    };

    const updatedPages = [...confluencePages, newPage];
    
    onChange({
      ...template.structure,
      attachments: {
        ...attachments,
        confluencePages: updatedPages,
      },
    });
  };

  const handleDetachPage = (pageId) => {
    const updatedPages = confluencePages.filter(p => p.page_id !== pageId);
    
    onChange({
      ...template.structure,
      attachments: {
        ...attachments,
        confluencePages: updatedPages,
      },
    });
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Info Banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Attachments defined here will be automatically added to conversations created from this template.
                The AI will only be able to access these specific pages.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Confluence Pages */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Confluence Pages ({confluencePages.length})
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Pages to attach when creating prompts from this template
                </CardDescription>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSearchModalOpen(true)}
                  >
                    <Search className="h-3 w-3 mr-1" />
                    Browse
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Browse Confluence to add pages</TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            {confluencePages.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No Confluence pages attached</p>
                <p className="text-xs mt-1">Click "Browse" to add pages</p>
              </div>
            ) : (
              <div className="space-y-1">
                {confluencePages.map(page => (
                  <div 
                    key={page.page_id} 
                    className="flex items-center justify-between py-2 px-3 bg-muted rounded-lg group"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">
                          {page.page_title}
                        </span>
                        {page.space_key && (
                          <span className="text-xs text-muted-foreground">
                            {page.space_key}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {page.page_url && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a 
                              href={page.page_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-background rounded"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>Open in Confluence</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-7 w-7 hover:text-destructive"
                            onClick={() => handleDetachPage(page.page_id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove from template</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom Search Modal that adds to template instead of database */}
        <TemplateConfluenceModal
          open={searchModalOpen}
          onOpenChange={setSearchModalOpen}
          onPageSelected={handlePageAttached}
          existingPageIds={confluencePages.map(p => p.page_id)}
        />
      </div>
    </TooltipProvider>
  );
};

/**
 * Simplified Confluence modal for templates that doesn't persist to database
 */
const TemplateConfluenceModal = ({ open, onOpenChange, onPageSelected, existingPageIds = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpace, setSelectedSpace] = useState('');
  const [isAdding, setIsAdding] = useState(null);
  
  const { 
    spaces, 
    searchResults, 
    spaceTree,
    isSearching, 
    isLoadingTree,
    listSpaces, 
    getSpaceTree,
    searchPages, 
    clearSearch,
    clearSpaceTree
  } = useConfluencePages();

  // Load spaces when modal opens
  useEffect(() => {
    if (open && spaces.length === 0) {
      listSpaces();
    }
  }, [open, spaces.length, listSpaces]);

  // Load space tree when space is selected
  useEffect(() => {
    if (selectedSpace && selectedSpace !== 'all') {
      getSpaceTree(selectedSpace);
    } else {
      clearSpaceTree();
    }
  }, [selectedSpace, getSpaceTree, clearSpaceTree]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchPages(searchQuery, selectedSpace === 'all' ? null : selectedSpace);
      } else {
        clearSearch();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedSpace, searchPages, clearSearch]);

  // Clear state when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedSpace('');
      clearSearch();
      clearSpaceTree();
    }
  }, [open, clearSearch, clearSpaceTree]);

  const handleAdd = async (page) => {
    setIsAdding(page.id);
    try {
      onPageSelected({
        page_id: page.id,
        page_title: page.title,
        page_url: page.url,
        space_key: page.spaceKey,
      });
      // Don't close modal, allow adding multiple
    } finally {
      setIsAdding(null);
    }
  };

  const isAlreadyAdded = (pageId) => existingPageIds.includes(pageId);

  const showSearchResults = searchQuery.length >= 2;

  // Flatten tree for simple display
  const flattenTree = (nodes, result = []) => {
    for (const node of nodes || []) {
      if (!node.isContainer) {
        result.push(node);
      }
      if (node.children) {
        flattenTree(node.children, result);
      }
    }
    return result;
  };

  const treePages = flattenTree(spaceTree);

  return (
    <div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Add Confluence Pages to Template</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Select pages to include when creating prompts from this template
              </p>
            </div>
            
            <div className="p-4 space-y-3 flex-1 overflow-hidden flex flex-col">
              {/* Search */}
              <div className="flex gap-2">
                <select
                  value={selectedSpace}
                  onChange={(e) => setSelectedSpace(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                >
                  <option value="">Select space...</option>
                  <option value="all">All Spaces</option>
                  {spaces.map(s => (
                    <option key={s.key} value={s.key}>{s.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Search pages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-md text-sm bg-background"
                />
              </div>

              {/* Results */}
              <div className="flex-1 overflow-auto border rounded-md">
                {isSearching || isLoadingTree ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : showSearchResults ? (
                  searchResults.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No pages found
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {searchResults.map(page => (
                        <PageRow 
                          key={page.id} 
                          page={page} 
                          isAdded={isAlreadyAdded(page.id)}
                          isAdding={isAdding === page.id}
                          onAdd={() => handleAdd(page)}
                        />
                      ))}
                    </div>
                  )
                ) : selectedSpace && treePages.length > 0 ? (
                  <div className="p-2 space-y-1">
                    {treePages.slice(0, 50).map(page => (
                      <PageRow 
                        key={page.id} 
                        page={page} 
                        isAdded={isAlreadyAdded(page.id)}
                        isAdding={isAdding === page.id}
                        onAdd={() => handleAdd(page)}
                      />
                    ))}
                    {treePages.length > 50 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Showing first 50 pages. Use search for more.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Select a space or search to find pages
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PageRow = ({ page, isAdded, isAdding, onAdd }) => (
  <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm truncate">{page.title}</span>
    </div>
    {isAdded ? (
      <Badge variant="secondary" className="text-xs">Added</Badge>
    ) : (
      <Button 
        size="sm" 
        variant="ghost"
        onClick={onAdd}
        disabled={isAdding}
        className="h-7"
      >
        {isAdding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
      </Button>
    )}
  </div>
);

export default TemplateAttachmentsTab;