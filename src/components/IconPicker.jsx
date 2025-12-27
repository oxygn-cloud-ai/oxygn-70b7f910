import React, { useState, useMemo } from 'react';
import { icons, Search, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { M3IconButton } from '@/components/ui/m3-icon-button';
import { ICON_CATEGORIES, categorizeIcon, searchIcons } from '@/config/iconCategories';

// Get all icon names from lucide-react icons object
// Filter out non-icon exports (like createLucideIcon, etc.)
const allIconNames = Object.keys(icons)
  .filter(name => {
    const icon = icons[name];
    return typeof icon === 'object' && icon.$$typeof;
  })
  .sort();

const MAX_VISIBLE_ICONS = 150;

export const IconPicker = ({ open, onOpenChange, currentIcon, onIconSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Convert PascalCase to kebab-case for matching
  const toKebabCase = (str) => {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();
  };

  // Filter icons based on search and category
  const filteredIcons = useMemo(() => {
    let iconNames = allIconNames;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      iconNames = iconNames.filter(name => 
        name.toLowerCase().includes(query) || 
        toKebabCase(name).includes(query)
      );
    }

    // Apply category filter
    if (activeCategory !== 'all') {
      iconNames = iconNames.filter(name => {
        const kebabName = toKebabCase(name);
        return categorizeIcon(kebabName) === activeCategory;
      });
    }

    // Limit visible icons for performance
    return iconNames.slice(0, MAX_VISIBLE_ICONS);
  }, [searchQuery, activeCategory]);

  const totalMatches = useMemo(() => {
    let iconNames = allIconNames;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      iconNames = iconNames.filter(name => 
        name.toLowerCase().includes(query) || 
        toKebabCase(name).includes(query)
      );
    }
    if (activeCategory !== 'all') {
      iconNames = iconNames.filter(name => {
        const kebabName = toKebabCase(name);
        return categorizeIcon(kebabName) === activeCategory;
      });
    }
    return iconNames.length;
  }, [searchQuery, activeCategory]);

  const handleIconClick = (iconName) => {
    // Store as PascalCase (the key in icons object)
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

  // Format icon name for display (PascalCase to Title Case with spaces)
  const formatIconName = (name) => {
    return name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-surface-container-high border-outline-variant">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-headline-small text-on-surface">
            <span>Choose Icon</span>
            <M3IconButton
              size="small"
              tooltip="Reset to Default"
              onClick={handleReset}
            >
              <RotateCcw className="h-5 w-5" />
            </M3IconButton>
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-on-surface-variant" />
          <Input
            placeholder="Search icons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-surface-container border-outline-variant text-on-surface"
            autoFocus
          />
        </div>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="w-full" orientation="horizontal">
            <TabsList className="inline-flex w-max gap-1 p-1 bg-surface-container-highest">
              {Object.entries(ICON_CATEGORIES).map(([key, category]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="text-label-medium px-3 py-1.5 whitespace-nowrap data-[state=active]:bg-secondary-container data-[state=active]:text-on-secondary-container"
                >
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          <TabsContent value={activeCategory} className="flex-1 mt-3 min-h-0">
            <ScrollArea className="h-[350px]">
              {filteredIcons.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-on-surface-variant">
                  <Search className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-body-medium">No icons found</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-8 gap-1.5 p-1">
                    <TooltipProvider delayDuration={300}>
                      {filteredIcons.map((iconName) => {
                        const IconComponent = icons[iconName];
                        if (!IconComponent) return null;
                        
                        return (
                          <Tooltip key={iconName}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleIconClick(iconName)}
                                className={`
                                  flex items-center justify-center p-2.5 rounded-xl
                                  transition-all duration-medium-1 ease-standard
                                  hover:bg-primary/10 hover:text-primary
                                  ${currentIcon === iconName 
                                    ? 'bg-primary-container text-on-primary-container ring-1 ring-primary/30' 
                                    : 'bg-surface-container-highest text-on-surface'
                                  }
                                `}
                              >
                                <IconComponent className="h-5 w-5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-label-small bg-inverse-surface text-inverse-on-surface">
                              {formatIconName(iconName)}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </TooltipProvider>
                  </div>
                  {totalMatches > MAX_VISIBLE_ICONS && (
                    <p className="text-label-small text-on-surface-variant text-center mt-3 pb-2">
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
