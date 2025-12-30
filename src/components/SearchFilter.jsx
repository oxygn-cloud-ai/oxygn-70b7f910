import React from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function SearchFilter({ 
  searchQuery, 
  onSearchChange, 
  filterType = 'all', 
  onFilterChange,
  placeholder = "Search prompts...",
  showFilter = true
}) {
  const filterOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'conversation', label: 'Conversations Only' },
    { value: 'standard', label: 'Standard Only' },
  ];

  const activeFilter = filterOptions.find(f => f.value === filterType);

  return (
    <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 pl-8 pr-8 text-sm bg-background border-border focus:ring-primary focus:border-primary"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
            onClick={() => onSearchChange('')}
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Filter Dropdown */}
      {showFilter && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-8 gap-1.5 text-tree ${filterType !== 'all' ? '!text-primary !bg-transparent' : '!text-muted-foreground hover:!text-foreground'} hover:!bg-muted/50`}
            >
              <Filter className="h-3 w-3" />
              <span className="hidden sm:inline">{activeFilter?.label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-popover">
            {filterOptions.map((option, index) => (
              <React.Fragment key={option.value}>
                <DropdownMenuItem
                  onClick={() => onFilterChange(option.value)}
                  className={`text-tree ${filterType === option.value ? 'bg-primary/10 text-primary' : ''}`}
                >
                  {option.label}
                </DropdownMenuItem>
                {index === 0 && <DropdownMenuSeparator />}
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default SearchFilter;
