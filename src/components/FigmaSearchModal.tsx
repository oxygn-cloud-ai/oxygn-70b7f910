/**
 * FigmaSearchModal Component
 * Browse and attach Figma files to prompts
 * Follows ConfluenceSearchModal pattern with simplified flat file list
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, Loader2, ExternalLink, Image } from 'lucide-react';
import { useFigmaFiles } from '@/hooks/useFigmaFiles';

interface FigmaSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptRowId: string | null;
  onFileAttached?: () => void;
}

interface FigmaFilePreview {
  key: string;
  name: string;
  thumbnail_url: string | null;
  last_modified: string | null;
}

const FigmaSearchModal: React.FC<FigmaSearchModalProps> = ({ 
  open, 
  onOpenChange, 
  promptRowId,
  onFileAttached
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [files, setFiles] = useState<FigmaFilePreview[]>([]);
  const [attachingFileKey, setAttachingFileKey] = useState<string | null>(null);
  
  const { 
    isLoading, 
    connectionStatus,
    attachFile,
    testConnection
  } = useFigmaFiles(promptRowId);

  // Test connection when modal opens
  useEffect(() => {
    if (open && connectionStatus === 'unknown') {
      testConnection();
    }
  }, [open, connectionStatus, testConnection]);

  // Clear state when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setFiles([]);
    }
  }, [open]);

  const handleAttach = async (fileKey: string) => {
    if (!promptRowId) return;
    
    setAttachingFileKey(fileKey);
    try {
      const success = await attachFile(fileKey, promptRowId);
      if (success) {
        onFileAttached?.();
        // Remove attached file from list
        setFiles(prev => prev.filter(f => f.key !== fileKey));
      }
    } finally {
      setAttachingFileKey(null);
    }
  };

  // Parse Figma file URL/key from search query
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    
    // Extract file key from URL or use as-is
    let fileKey = searchQuery.trim();
    
    // Match Figma URLs: figma.com/file/FILEKEY/... or figma.com/design/FILEKEY/...
    const urlMatch = searchQuery.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
    if (urlMatch) {
      fileKey = urlMatch[1];
    }
    
    // Add to files list for attachment (we'll validate when attaching)
    const newFile: FigmaFilePreview = {
      key: fileKey,
      name: `Figma File: ${fileKey}`,
      thumbnail_url: null,
      last_modified: null
    };
    
    // Avoid duplicates
    if (!files.some(f => f.key === fileKey)) {
      setFiles(prev => [newFile, ...prev]);
    }
    
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-surface">
        <DialogHeader>
          <DialogTitle className="text-title-sm text-on-surface font-medium">
            Attach Figma File
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Connection status */}
          {connectionStatus === 'disconnected' && (
            <div className="text-body-sm text-warning bg-warning/10 rounded-m3-sm px-3 py-2">
              Figma not connected. Add your access token in Settings → Integrations.
            </div>
          )}

          {connectionStatus === 'error' && (
            <div className="text-body-sm text-destructive bg-destructive/10 rounded-m3-sm px-3 py-2">
              Failed to connect to Figma. Check your access token.
            </div>
          )}

          {/* Search/paste URL */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
            <Input
              placeholder="Paste Figma file URL or key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 bg-surface-container border-outline-variant text-body-sm"
            />
          </div>

          <p className="text-[10px] text-on-surface-variant">
            Paste a Figma URL like: https://www.figma.com/file/ABC123/My-Design
          </p>

          {/* Results area */}
          <ScrollArea className="h-[350px] border border-outline-variant rounded-m3-md bg-surface-container-low">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
                <Image className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-body-sm">No files to attach</p>
                <p className="text-[10px] mt-1">Paste a Figma file URL above</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredFiles.map((file) => (
                  <div
                    key={file.key}
                    className="flex items-center justify-between py-2 px-3 rounded-m3-sm hover:bg-surface-container group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Thumbnail or placeholder */}
                      {file.thumbnail_url ? (
                        <img 
                          src={file.thumbnail_url} 
                          alt={file.name}
                          className="h-10 w-14 object-cover rounded bg-surface-container"
                        />
                      ) : (
                        <div className="h-10 w-14 flex items-center justify-center rounded bg-surface-container">
                          <Image className="h-5 w-5 text-on-surface-variant" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-body-sm text-on-surface truncate block">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-on-surface-variant truncate block">
                          {file.key}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={`https://www.figma.com/file/${file.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-surface-container-high rounded-m3-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4 text-on-surface-variant" />
                      </a>
                      <button
                        className="p-1.5 hover:bg-surface-container-high rounded-m3-full"
                        onClick={() => handleAttach(file.key)}
                        disabled={attachingFileKey === file.key}
                      >
                        {attachingFileKey === file.key ? (
                          <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
                        ) : (
                          <Plus className="h-4 w-4 text-on-surface-variant" />
                        )}
                      </button>
                    </div>
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

export default FigmaSearchModal;
