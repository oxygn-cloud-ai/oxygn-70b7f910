import React, { useState, useMemo, lazy, Suspense } from 'react';
import dynamicIconImports from 'lucide-react/dynamicIconImports';
import { Search, RotateCcw, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ICON_CATEGORIES, categorizeIcon, searchIcons } from '@/config/iconCategories';

// Cache for lazy-loaded icons
const iconCache = new Map();

const LazyIcon = ({ name, ...props }) => {
  if (!dynamicIconImports[name]) {
    return <div className="w-5 h-5 bg-muted rounded" />;
  }

  if (!iconCache.has(name)) {
    iconCache.set(name, lazy(dynamicIconImports[name]));
  }

  const IconComponent = iconCache.get(name);

  return (
    <Suspense fallback={<Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}>
      <IconComponent {...props} />
    </Suspense>
  );
};

// Get all icon names from dynamicIconImports
const allIconNames = Object.keys(dynamicIconImports).sort();

const MAX_VISIBLE_ICONS = 150;

export const IconPicker = ({ open, onOpenChange, currentIcon, onIconSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Filter icons based on search and category
  const filteredIcons = useMemo(() => {
    let icons = allIconNames;

    // Apply search filter
    if (searchQuery.trim()) {
      icons = searchIcons(icons, searchQuery);
    }

    // Apply category filter
    if (activeCategory !== 'all') {
      icons = icons.filter(name => categorizeIcon(name) === activeCategory);
    }

    // Limit visible icons for performance
    return icons.slice(0, MAX_VISIBLE_ICONS);
  }, [searchQuery, activeCategory]);

  const totalMatches = useMemo(() => {
    let icons = allIconNames;
    if (searchQuery.trim()) {
      icons = searchIcons(icons, searchQuery);
    }
    if (activeCategory !== 'all') {
      icons = icons.filter(name => categorizeIcon(name) === activeCategory);
    }
    return icons.length;
  }, [searchQuery, activeCategory]);

  const handleIconClick = (iconName) => {
    onIconSelect(iconName);
    onOpenChange(false);
    setSearchQuery('');
    setActiveCategory('all');
  };

  const handleReset = () => {
    onIconSelect(null);
    onOpenChange(false);
    setSearchQuery('');
    setActiveCategory('all');
  };

  const handleClose = (newOpen) => {
    if (!newOpen) {
      setSearchQuery('');
      setActiveCategory('all');
    }
    onOpenChange(newOpen);
  };

  // Convert kebab-case to Title Case for display
  const formatIconName = (name) => {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Choose Icon</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Reset to Default
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search icons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="w-full" orientation="horizontal">
            <TabsList className="inline-flex w-max gap-1 p-1">
              {Object.entries(ICON_CATEGORIES).map(([key, category]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="text-xs px-2.5 py-1 whitespace-nowrap"
                >
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          <TabsContent value={activeCategory} className="flex-1 mt-3 min-h-0">
            <ScrollArea className="h-[350px]">
              {filteredIcons.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Search className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No icons found</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-8 gap-1.5 p-1">
                    <TooltipProvider delayDuration={300}>
                      {filteredIcons.map((iconName) => (
                        <Tooltip key={iconName}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleIconClick(iconName)}
                              className={`
                                flex items-center justify-center p-2.5 rounded-md
                                transition-colors duration-150
                                hover:bg-primary/10 hover:text-primary
                                ${currentIcon === iconName 
                                  ? 'bg-primary/20 text-primary ring-1 ring-primary/30' 
                                  : 'bg-muted/50 text-foreground'
                                }
                              `}
                            >
                              <LazyIcon name={iconName} className="h-5 w-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {formatIconName(iconName)}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </TooltipProvider>
                  </div>
                  {totalMatches > MAX_VISIBLE_ICONS && (
                    <p className="text-xs text-muted-foreground text-center mt-3 pb-2">
                      Showing {MAX_VISIBLE_ICONS} of {totalMatches} icons. Use search to find more.
                    </p>
                  )}
                </>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default IconPicker;
