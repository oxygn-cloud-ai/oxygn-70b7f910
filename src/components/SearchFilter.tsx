import React, { Fragment, ChangeEvent } from 'react';
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

type FilterType = 'all' | 'conversation' | 'standard';

interface FilterOption {
  value: FilterType;
  label: string;
}

interface SearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterType?: FilterType;
  onFilterChange?: (type: FilterType) => void;
  placeholder?: string;
  showFilter?: boolean;
}

const filterOptions: FilterOption[] = [
  { value: 'all', label: 'All Types' },
  { value: 'conversation', label: 'Conversations Only' },
  { value: 'standard', label: 'Standard Only' },
];

export function SearchFilter({ 
  searchQuery, 
  onSearchChange, 
  filterType = 'all', 
  onFilterChange,
  placeholder = "Search prompts...",
  showFilter = true
}: SearchFilterProps) {
  const activeFilter = filterOptions.find(f => f.value === filterType);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };

  const handleClearSearch = () => {
    onSearchChange('');
  };

  const handleFilterChange = (value: FilterType) => {
    onFilterChange?.(value);
  };

  return (
    <div className="flex items-center gap-2 p-2 border-b border-outline-variant bg-surface-container-low/30">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-on-surface-variant" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleSearchChange}
          className="h-8 pl-8 pr-8 text-body-sm bg-surface border-outline-variant focus:ring-primary focus:border-primary"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-surface-container"
            onClick={handleClearSearch}
          >
            <X className="h-3 w-3 text-on-surface-variant" />
          </Button>
        )}
      </div>

      {/* Filter Dropdown */}
      {showFilter && onFilterChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-8 gap-1.5 ${filterType !== 'all' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'} hover:bg-surface-container`}
            >
              <Filter className="h-3 w-3" />
              <span className="hidden sm:inline">{activeFilter?.label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-surface-container-high">
            {filterOptions.map((option, index) => (
              <Fragment key={option.value}>
                <DropdownMenuItem
                  onClick={() => handleFilterChange(option.value)}
                  className={`text-body-sm ${filterType === option.value ? 'bg-primary/10 text-primary' : ''}`}
                >
                  {option.label}
                </DropdownMenuItem>
                {index === 0 && <DropdownMenuSeparator />}
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default SearchFilter;
