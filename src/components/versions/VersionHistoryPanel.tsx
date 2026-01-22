import React, { useState } from 'react';
import { GitBranch, GitCommit, RotateCcw, Tag, Pin, PinOff, Eye, Diff, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { usePromptVersions } from '@/hooks/usePromptVersions';
import { formatDistanceToNow } from 'date-fns';
import CommitDialog from './CommitDialog';
import RollbackDialog from './RollbackDialog';
import DiffViewer from './DiffViewer';
import VersionPreviewDialog from './VersionPreviewDialog';
import type { VersionInfo, DiffChange, PromptSnapshot, VersionMetadata } from './types';

interface VersionHistoryPanelProps {
  promptRowId: string;
  onClose: () => void;
}

const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({ promptRowId, onClose }) => {
  const {
    versions,
    totalVersions,
    currentVersion,
    hasUncommittedChanges,
    currentDiff,
    previewData,
    isLoading,
    isCommitting,
    isRollingBack,
    commit,
    rollback,
    tagVersion,
    togglePin,
    getDiff,
    fetchPreview,
    clearDiff,
    clearPreview
  } = usePromptVersions(promptRowId);
  
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<VersionInfo | null>(null);
  const [diffTarget, setDiffTarget] = useState<VersionInfo | null>(null);

  const handleCommit = async (message: string, tagName?: string) => {
    await commit(message, tagName);
    setCommitDialogOpen(false);
  };

  const handleRollback = async (createBackup: boolean) => {
    if (!rollbackTarget) return;
    await rollback(rollbackTarget.row_id, createBackup);
    setRollbackTarget(null);
  };

  const handleViewDiff = async (version: VersionInfo) => {
    setDiffTarget(version);
    await getDiff(null, version.row_id);
  };

  // Type cast versions from hook
  const typedVersions = versions as VersionInfo[];
  const typedDiff = currentDiff as DiffChange[] | null;
  const typedPreviewData = previewData as { snapshot: PromptSnapshot; metadata: VersionMetadata } | null;

  return (
    <TooltipProvider>
      <div className="w-96 h-full bg-surface border-l border-outline-variant flex flex-col">
        {/* Header - 56px per design system */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-outline-variant shrink-0">
          <div className="flex items-center gap-3">
            <GitBranch className="h-5 w-5 text-on-surface-variant" />
            <h2 className="text-title-sm text-on-surface font-medium">Version History</h2>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
              >
                <X className="h-4 w-4 text-on-surface-variant" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Close</TooltipContent>
          </Tooltip>
        </div>

        {/* Uncommitted Changes Section */}
        {hasUncommittedChanges && (
          <div className="p-3 border-b border-outline-variant bg-amber-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-body-sm text-on-surface">Uncommitted changes</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setCommitDialogOpen(true)}
                    disabled={isCommitting}
                    className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
                  >
                    <GitCommit className={`h-4 w-4 ${isCommitting ? 'text-on-surface-variant opacity-50' : 'text-primary'}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Commit changes</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Version List */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {isLoading ? (
              <div className="text-center py-8 text-on-surface-variant text-body-sm">
                Loading versions...
              </div>
            ) : typedVersions.length === 0 ? (
              <div className="text-center py-8 text-on-surface-variant text-body-sm">
                No versions yet. Make changes and commit to create your first version.
              </div>
            ) : (
              typedVersions.map((version) => (
                <div
                  key={version.row_id}
                  className="bg-surface-container-low rounded-m3-md p-3 space-y-2"
                >
                  {/* Version header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-body-sm font-medium text-on-surface">
                        v{version.version_number}
                      </span>
                      {version.tag_name && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                          {version.tag_name}
                        </span>
                      )}
                      {version.is_pinned && (
                        <Pin className="h-3 w-3 text-primary" />
                      )}
                    </div>
                    <span className="text-[10px] text-on-surface-variant">
                      {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Commit message */}
                  {version.commit_message && (
                    <p className="text-body-sm text-on-surface-variant line-clamp-2">
                      {version.commit_message}
                    </p>
                  )}

                  {/* Changed fields */}
                  {version.fields_changed && version.fields_changed.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {version.fields_changed.slice(0, 3).map((field) => (
                        <span
                          key={field}
                          className="text-[10px] px-1 py-0.5 bg-surface-container rounded text-on-surface-variant"
                        >
                          {field.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {version.fields_changed.length > 3 && (
                        <span className="text-[10px] text-on-surface-variant">
                          +{version.fields_changed.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions - Icon only per design system */}
                  <div className="flex items-center gap-1 pt-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleViewDiff(version)}
                          className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
                        >
                          <Diff className="h-4 w-4 text-on-surface-variant" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>View diff</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => fetchPreview(version.row_id)}
                          className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
                        >
                          <Eye className="h-4 w-4 text-on-surface-variant" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Preview</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setRollbackTarget(version)}
                          disabled={isRollingBack}
                          className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
                        >
                          <RotateCcw className="h-4 w-4 text-on-surface-variant" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Rollback</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => togglePin(version.row_id, !version.is_pinned)}
                          className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
                        >
                          {version.is_pinned ? (
                            <PinOff className="h-4 w-4 text-primary" />
                          ) : (
                            <Pin className="h-4 w-4 text-on-surface-variant" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{version.is_pinned ? 'Unpin' : 'Pin'}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {totalVersions > 0 && (
          <div className="px-4 py-2 border-t border-outline-variant text-[10px] text-on-surface-variant">
            {totalVersions} version{totalVersions !== 1 ? 's' : ''} total
          </div>
        )}

        {/* Dialogs */}
        <CommitDialog
          open={commitDialogOpen}
          onOpenChange={setCommitDialogOpen}
          onCommit={handleCommit}
          isCommitting={isCommitting}
        />

        <RollbackDialog
          open={!!rollbackTarget}
          onOpenChange={(open) => !open && setRollbackTarget(null)}
          version={rollbackTarget}
          onRollback={handleRollback}
          isRollingBack={isRollingBack}
        />

        {typedDiff && (
          <DiffViewer
            open={!!typedDiff}
            onOpenChange={(open) => !open && clearDiff()}
            changes={typedDiff}
            versionInfo={diffTarget}
          />
        )}

        {typedPreviewData && (
          <VersionPreviewDialog
            open={!!typedPreviewData}
            onOpenChange={(open) => !open && clearPreview()}
            snapshot={typedPreviewData.snapshot}
            metadata={typedPreviewData.metadata}
          />
        )}
      </div>
    </TooltipProvider>
  );
};

export default VersionHistoryPanel;
