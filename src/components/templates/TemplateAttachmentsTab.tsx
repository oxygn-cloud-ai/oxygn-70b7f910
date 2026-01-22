import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, Search, X, ExternalLink, Loader2, Plus, Info } from 'lucide-react';
import { useConfluencePages } from '@/hooks/useConfluencePages';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ConfluencePage {
  page_id: string;
  page_title: string;
  page_url?: string;
  space_key?: string;
}

interface TemplateAttachments {
  confluencePages?: ConfluencePage[];
}

interface TemplateStructure {
  _id?: string;
  prompt_name?: string;
  attachments?: TemplateAttachments;
  children?: TemplateStructure[];
  [key: string]: unknown;
}

interface Template {
  row_id: string;
  template_name: string;
  structure?: TemplateStructure;
}

interface PageInfo {
  id?: string;
  page_id?: string;
  title?: string;
  page_title?: string;
  url?: string;
  page_url?: string;
  spaceKey?: string;
  space_key?: string;
}

interface SpaceTreeNode {
  id: string;
  title: string;
  url?: string;
  spaceKey?: string;
  isContainer?: boolean;
  children?: SpaceTreeNode[];
}

interface TemplateAttachmentsTabProps {
  template: Template;
  onChange: (structure: TemplateStructure) => void;
}

interface TemplateConfluenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPageSelected: (pageInfo: ConfluencePage) => void;
  existingPageIds?: string[];
}

interface PageRowProps {
  page: SpaceTreeNode;
  isAdded: boolean;
  isAdding: boolean;
  onAdd: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const TemplateAttachmentsTab: React.FC<TemplateAttachmentsTabProps> = ({ template, onChange }) => {
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  
  // Get current attachments from template structure
  const attachments = template?.structure?.attachments || {
    confluencePages: [],
  };

  const confluencePages = attachments.confluencePages || [];

  // Handle attaching a page from the search modal
  const handlePageAttached = (pageInfo: PageInfo) => {
    // Add to template structure
    const newPage: ConfluencePage = {
      page_id: (pageInfo.id || pageInfo.page_id)!,
      page_title: (pageInfo.title || pageInfo.page_title)!,
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

  const handleDetachPage = (pageId: string) => {
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
              <p className="text-body-sm text-on-surface-variant">
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
                <CardTitle className="text-label-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Confluence Pages ({confluencePages.length})
                </CardTitle>
                <CardDescription className="text-[10px] mt-1">
                  Pages to attach when creating prompts from this template
                </CardDescription>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => setSearchModalOpen(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Browse Confluence to add pages</TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            {confluencePages.length === 0 ? (
              <div className="text-center py-6 text-on-surface-variant">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-body-sm">No Confluence pages attached</p>
                <p className="text-[10px] mt-1">Click the search icon to add pages</p>
              </div>
            ) : (
              <div className="space-y-1">
                {confluencePages.map(page => (
                  <div 
                    key={page.page_id} 
                    className="flex items-center justify-between py-2 px-3 bg-surface-container-low rounded-m3-md group"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-on-surface-variant flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-body-sm font-medium text-on-surface truncate block">
                          {page.page_title}
                        </span>
                        {page.space_key && (
                          <span className="text-[10px] text-on-surface-variant">
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
                              className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>Open in Confluence</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button 
                            className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-red-500/10 hover:text-red-500"
                            onClick={() => handleDetachPage(page.page_id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
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

// ─────────────────────────────────────────────────────────────────────────────
// Confluence Modal
// ─────────────────────────────────────────────────────────────────────────────

const TemplateConfluenceModal: React.FC<TemplateConfluenceModalProps> = ({ 
  open, 
  onOpenChange, 
  onPageSelected, 
  existingPageIds = [] 
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSpace, setSelectedSpace] = useState<string>('');
  const [isAdding, setIsAdding] = useState<string | null>(null);
  
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

  const handleAdd = async (page: SpaceTreeNode) => {
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

  const isAlreadyAdded = (pageId: string): boolean => existingPageIds.includes(pageId);

  const showSearchResults = searchQuery.length >= 2;

  // Flatten tree for simple display
  const flattenTree = (nodes: SpaceTreeNode[] | undefined, result: SpaceTreeNode[] = []): SpaceTreeNode[] => {
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

  const treePages = flattenTree(spaceTree as SpaceTreeNode[] | undefined);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-surface border border-outline-variant rounded-m3-lg shadow-lg w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-outline-variant">
          <h3 className="text-title-sm font-medium text-on-surface">Add Confluence Pages to Template</h3>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Select pages to include when creating prompts from this template
          </p>
        </div>
        
        <div className="p-4 space-y-3 flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="flex gap-2">
            <select
              value={selectedSpace}
              onChange={(e) => setSelectedSpace(e.target.value)}
              className="px-3 py-2 border border-outline-variant rounded-m3-sm text-body-sm bg-surface-container"
            >
              <option value="">Select space...</option>
              <option value="all">All Spaces</option>
              {spaces.map((s: { key: string; name: string }) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 border border-outline-variant rounded-m3-sm text-body-sm bg-surface-container"
            />
          </div>

          {/* Results */}
          <div className="flex-1 overflow-auto border border-outline-variant rounded-m3-sm">
            {isSearching || isLoadingTree ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-5 w-5 animate-spin text-on-surface-variant" />
              </div>
            ) : showSearchResults ? (
              (searchResults as SpaceTreeNode[]).length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant text-body-sm">
                  No pages found
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {(searchResults as SpaceTreeNode[]).map(page => (
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
                  <p className="text-[10px] text-on-surface-variant text-center py-2">
                    Showing first 50 pages. Use search for more.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-on-surface-variant text-body-sm">
                Select a space or search to find pages
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-outline-variant flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Page Row
// ─────────────────────────────────────────────────────────────────────────────

const PageRow: React.FC<PageRowProps> = ({ page, isAdded, isAdding, onAdd }) => (
  <div className="flex items-center justify-between py-1.5 px-2 rounded-m3-sm hover:bg-surface-container-low">
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <FileText className="h-4 w-4 text-on-surface-variant flex-shrink-0" />
      <span className="text-body-sm text-on-surface truncate">{page.title}</span>
    </div>
    {isAdded ? (
      <Badge variant="secondary" className="text-[10px]">Added</Badge>
    ) : (
      <button 
        onClick={onAdd}
        disabled={isAdding}
        className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container hover:text-primary"
      >
        {isAdding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
      </button>
    )}
  </div>
);

export default TemplateAttachmentsTab;
