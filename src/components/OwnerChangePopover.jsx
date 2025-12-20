import React, { useState, useEffect, useCallback } from 'react';
import { Check, Loader2, Lock, Globe, UserPlus, Trash2, Users } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupabase } from '../hooks/useSupabase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// Standalone content component for use in external popovers
export const OwnerChangeContent = ({ promptRowId, currentOwnerId, onOwnerChanged, onClose, isPrivate: initialIsPrivate }) => {
  const supabase = useSupabase();
  const { user, isAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate ?? false);
  const [shares, setShares] = useState([]);
  const [sharesLoading, setSharesLoading] = useState(true);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('read');
  const [isAddingShare, setIsAddingShare] = useState(false);

  const isOwner = user?.id === currentOwnerId;
  const canManage = isAdmin || isOwner;

  // Fetch all profiles on mount
  useEffect(() => {
    if (supabase) {
      fetchProfiles();
      fetchShares();
      fetchPrivacyStatus();
    }
  }, [supabase, promptRowId]);

  const fetchPrivacyStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('cyg_prompts')
        .select('is_private')
        .eq('row_id', promptRowId)
        .single();

      if (error) throw error;
      setIsPrivate(data?.is_private ?? false);
    } catch (error) {
      console.error('Error fetching privacy status:', error);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name, avatar_url');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const fetchShares = async () => {
    setSharesLoading(true);
    try {
      const { data, error } = await supabase
        .from('resource_shares')
        .select('id, shared_with_user_id, permission, created_at')
        .eq('resource_type', 'prompt')
        .eq('resource_id', promptRowId);

      if (error) throw error;
      setShares(data || []);
    } catch (error) {
      console.error('Error fetching shares:', error);
    } finally {
      setSharesLoading(false);
    }
  };

  useEffect(() => {
    const filtered = profiles.filter(p => {
      if (p.id === currentOwnerId) return false;
      if (!email.trim()) return true;
      const searchLower = email.toLowerCase();
      return (
        p.email?.toLowerCase().includes(searchLower) ||
        p.display_name?.toLowerCase().includes(searchLower)
      );
    });
    setFilteredUsers(filtered);
  }, [email, profiles, currentOwnerId]);

  const handleChangeOwner = useCallback(async (newOwnerId) => {
    if (!supabase || !promptRowId) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('cyg_prompts')
        .update({ owner_id: newOwnerId })
        .eq('row_id', promptRowId);

      if (error) throw error;

      toast.success('Owner changed successfully');
      setEmail('');
      if (onClose) onClose();
      if (onOwnerChanged) onOwnerChanged();
    } catch (error) {
      console.error('Error changing owner:', error);
      toast.error('Failed to change owner');
    } finally {
      setIsLoading(false);
    }
  }, [supabase, promptRowId, onOwnerChanged, onClose]);

  const handlePrivacyToggle = async (newValue) => {
    if (!supabase || !promptRowId) return;

    setIsPrivate(newValue);
    try {
      const { error } = await supabase
        .from('cyg_prompts')
        .update({ is_private: newValue })
        .eq('row_id', promptRowId);

      if (error) throw error;

      toast.success(newValue ? 'Prompt is now private' : 'Prompt is now visible to team');
      if (onOwnerChanged) onOwnerChanged();
    } catch (error) {
      console.error('Error updating privacy:', error);
      toast.error('Failed to update privacy setting');
      setIsPrivate(!newValue); // Revert on error
    }
  };

  const handleAddShare = async () => {
    if (!supabase || !promptRowId || !shareEmail.trim()) return;

    const targetUser = profiles.find(
      p => p.email?.toLowerCase() === shareEmail.toLowerCase() ||
           p.display_name?.toLowerCase() === shareEmail.toLowerCase()
    );

    if (!targetUser) {
      toast.error('User not found');
      return;
    }

    if (targetUser.id === currentOwnerId) {
      toast.error('Cannot share with the owner');
      return;
    }

    // Check if already shared
    if (shares.some(s => s.shared_with_user_id === targetUser.id)) {
      toast.error('Already shared with this user');
      return;
    }

    setIsAddingShare(true);
    try {
      const { error } = await supabase
        .from('resource_shares')
        .insert({
          resource_type: 'prompt',
          resource_id: promptRowId,
          shared_with_user_id: targetUser.id,
          permission: sharePermission,
          shared_by_user_id: user?.id
        });

      if (error) throw error;

      toast.success(`Shared with ${targetUser.display_name || targetUser.email}`);
      setShareEmail('');
      fetchShares();
    } catch (error) {
      console.error('Error adding share:', error);
      toast.error('Failed to share');
    } finally {
      setIsAddingShare(false);
    }
  };

  const handleRemoveShare = async (shareId) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('resource_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;

      toast.success('Share removed');
      fetchShares();
    } catch (error) {
      console.error('Error removing share:', error);
      toast.error('Failed to remove share');
    }
  };

  const handleUpdateSharePermission = async (shareId, newPermission) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('resource_shares')
        .update({ permission: newPermission })
        .eq('id', shareId);

      if (error) throw error;

      toast.success('Permission updated');
      fetchShares();
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error('Failed to update permission');
    }
  };

  const getSharedUserInfo = (userId) => {
    return profiles.find(p => p.id === userId);
  };

  const shareFilteredUsers = profiles.filter(p => {
    if (p.id === currentOwnerId) return false;
    if (shares.some(s => s.shared_with_user_id === p.id)) return false;
    if (!shareEmail.trim()) return false;
    const searchLower = shareEmail.toLowerCase();
    return (
      p.email?.toLowerCase().includes(searchLower) ||
      p.display_name?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Tabs defaultValue="sharing" className="w-full">
      <TabsList className="grid w-full grid-cols-2 h-8">
        <TabsTrigger value="sharing" className="text-xs">
          <Users className="h-3 w-3 mr-1" />
          Sharing
        </TabsTrigger>
        <TabsTrigger value="transfer" className="text-xs">
          <UserPlus className="h-3 w-3 mr-1" />
          Transfer
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sharing" className="mt-3 space-y-4">
        {/* Privacy Toggle */}
        <div className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/50">
          <div className="flex items-center gap-2">
            {isPrivate ? (
              <Lock className="h-4 w-4 text-amber-500" />
            ) : (
              <Globe className="h-4 w-4 text-green-500" />
            )}
            <div>
              <Label className="text-xs font-medium">
                {isPrivate ? 'Private' : 'Visible to team'}
              </Label>
              <p className="text-[10px] text-muted-foreground">
                {isPrivate 
                  ? 'Only you and shared users can access' 
                  : 'All team members can view'}
              </p>
            </div>
          </div>
          <Switch
            checked={isPrivate}
            onCheckedChange={handlePrivacyToggle}
            disabled={!canManage}
          />
        </div>

        <Separator />

        {/* Share with users */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Share with specific users</Label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="Search by name or email..."
                className="h-8 text-xs pr-20"
                disabled={!canManage}
              />
              {shareFilteredUsers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-32 overflow-auto">
                  {shareFilteredUsers.map((u) => (
                    <button
                      key={u.id}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted text-left"
                      onClick={() => setShareEmail(u.email)}
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={u.avatar_url} alt={u.display_name || u.email} />
                        <AvatarFallback className="text-[10px]">
                          {(u.display_name || u.email)?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{u.display_name || u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Select value={sharePermission} onValueChange={setSharePermission} disabled={!canManage}>
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read" className="text-xs">View</SelectItem>
                <SelectItem value="edit" className="text-xs">Edit</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              size="sm" 
              className="h-8 px-2"
              onClick={handleAddShare}
              disabled={!shareEmail.trim() || isAddingShare || !canManage}
            >
              {isAddingShare ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {/* Current shares */}
        {shares.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Shared with</Label>
            <div className="space-y-1 max-h-32 overflow-auto">
              {shares.map((share) => {
                const sharedUser = getSharedUserInfo(share.shared_with_user_id);
                return (
                  <div key={share.id} className="flex items-center justify-between gap-2 p-1.5 rounded-md bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={sharedUser?.avatar_url} alt={sharedUser?.display_name || sharedUser?.email} />
                        <AvatarFallback className="text-[10px]">
                          {(sharedUser?.display_name || sharedUser?.email)?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs truncate">
                        {sharedUser?.display_name || sharedUser?.email || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Select 
                        value={share.permission} 
                        onValueChange={(val) => handleUpdateSharePermission(share.id, val)}
                        disabled={!canManage}
                      >
                        <SelectTrigger className="w-16 h-6 text-[10px] border-0 bg-transparent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="read" className="text-xs">View</SelectItem>
                          <SelectItem value="edit" className="text-xs">Edit</SelectItem>
                        </SelectContent>
                      </Select>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveShare(share.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {shares.length === 0 && !sharesLoading && (
          <p className="text-[10px] text-muted-foreground text-center py-2">
            Not shared with anyone yet
          </p>
        )}
      </TabsContent>

      <TabsContent value="transfer" className="mt-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Transfer ownership to:</p>
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Search by name or email..."
          className="h-8 text-sm"
          disabled={!canManage}
        />
        <div className="max-h-40 overflow-auto space-y-1">
          {!canManage ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              Only the owner or admin can transfer ownership
            </p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              {email ? 'No matching users' : 'No other users available'}
            </p>
          ) : (
            filteredUsers.map((u) => (
              <Button
                key={u.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 text-xs gap-2"
                onClick={() => handleChangeOwner(u.id)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={u.avatar_url} alt={u.display_name || u.email} />
                    <AvatarFallback className="text-[10px]">
                      {(u.display_name || u.email)?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <span className="truncate">
                  {u.display_name || u.email?.split('@')[0]}
                </span>
                {u.display_name && (
                  <span className="text-muted-foreground truncate">
                    ({u.email})
                  </span>
                )}
              </Button>
            ))
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default OwnerChangeContent;
