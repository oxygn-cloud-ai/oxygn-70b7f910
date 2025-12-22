import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { toast } from '@/components/ui/sonner';
import { Bot, Trash2, Loader2, AlertCircle, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const ConversationsSection = ({ isRefreshing, onRefresh }) => {
  const supabase = useSupabase();
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!supabase) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('conversation-manager', {
        body: { action: 'list' },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setConversations(data.assistants || []);
      setSelectedIds([]);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      toast.error('Failed to fetch conversations');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleDelete = async () => {
    if (!selectedIds.length) return;
    
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('conversation-manager', {
        body: { action: 'delete', row_ids: selectedIds },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(`Deleted ${selectedIds.length} conversation${selectedIds.length > 1 ? 's' : ''}`);
      fetchConversations();
    } catch (error) {
      console.error('Failed to delete conversations:', error);
      toast.error('Failed to delete conversations');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === conversations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(conversations.map(c => c.row_id));
    }
  };

  const toggleSelect = (rowId) => {
    setSelectedIds(prev => 
      prev.includes(rowId) 
        ? prev.filter(id => id !== rowId)
        : [...prev, rowId]
    );
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Conversation Configurations</CardTitle>
              <CardDescription>
                These are all conversation configurations. Orphaned items have no linked prompt.
              </CardDescription>
            </div>
            {selectedIds.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="p-2 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Delete {selectedIds.length} selected</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-8" />
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No conversations found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedIds.length === conversations.length && conversations.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Linked Prompt</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((conversation) => (
                  <TableRow 
                    key={conversation.row_id}
                    className={selectedIds.includes(conversation.row_id) ? 'bg-muted/50' : ''}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(conversation.row_id)}
                        onCheckedChange={() => toggleSelect(conversation.row_id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {conversation.name || 'Unnamed'}
                        {conversation.is_orphaned && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Orphaned
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                This conversation has no linked prompt in the system
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {conversation.model}
                    </TableCell>
                    <TableCell>
                      {conversation.prompt_name ? (
                        <span className="text-sm">{conversation.prompt_name}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(conversation.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} Conversation{selectedIds.length > 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected conversation configuration{selectedIds.length > 1 ? 's' : ''}. 
              Linked prompts will remain but you can re-enable the assistant later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 w-9 p-0">
              <X className="h-4 w-4" />
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-9 w-9 p-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
