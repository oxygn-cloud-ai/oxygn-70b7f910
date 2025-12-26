import React from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Input } from "@/components/ui/input";
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
    <div className="flex items-center gap-2">
      {/* M3 Search Bar */}
      <div className="m3-search-bar flex-1 flex items-center gap-2 h-10 px-3 rounded-full bg-surface-container-high transition-all duration-medium-2 ease-standard focus-within:bg-surface-container-highest focus-within:ring-2 focus-within:ring-primary/20">
        <Search className="h-4 w-4 text-on-surface-variant flex-shrink-0" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-full flex-1 border-0 bg-transparent px-0 text-sm text-on-surface placeholder:text-on-surface-variant focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="h-6 w-6 inline-flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8 transition-colors duration-short-4 ease-standard"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* M3 Filter Icon Button */}
      {showFilter && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              type="button"
              className={`
                h-10 w-10 inline-flex items-center justify-center rounded-full
                transition-all duration-short-4 ease-standard
                ${filterType !== 'all' 
                  ? 'bg-primary/12 text-primary' 
                  : 'text-on-surface-variant hover:bg-on-surface/8 hover:text-on-surface'
                }
              `}
            >
              <Filter className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-48 rounded-2xl bg-surface-container p-1 border-outline-variant shadow-elevation-2"
          >
            {filterOptions.map((option, index) => (
              <React.Fragment key={option.value}>
                <DropdownMenuItem
                  onClick={() => onFilterChange(option.value)}
                  className={`
                    rounded-xl px-3 py-2.5 text-sm cursor-pointer
                    transition-colors duration-short-4 ease-standard
                    ${filterType === option.value 
                      ? 'bg-primary/12 text-primary font-medium' 
                      : 'text-on-surface hover:bg-on-surface/8'
                    }
                  `}
                >
                  {option.label}
                </DropdownMenuItem>
                {index === 0 && <DropdownMenuSeparator className="my-1 bg-outline-variant" />}
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default SearchFilter;
