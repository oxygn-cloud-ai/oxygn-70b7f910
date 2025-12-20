import React, { useState, useEffect, useCallback } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSupabase } from '../hooks/useSupabase';
import { toast } from 'sonner';

// Standalone content component for use in external popovers
export const OwnerChangeContent = ({ promptRowId, currentOwnerId, onOwnerChanged, onClose }) => {
  const supabase = useSupabase();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);

  // Fetch all profiles on mount
  useEffect(() => {
    if (supabase) {
      fetchProfiles();
    }
  }, [supabase]);

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

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Transfer ownership to:</p>
      <Input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Search by name or email..."
        className="h-8 text-sm"
        autoFocus
      />
      <div className="max-h-40 overflow-auto space-y-1">
        {filteredUsers.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">
            {email ? 'No matching users' : 'No other users available'}
          </p>
        ) : (
          filteredUsers.map((user) => (
            <Button
              key={user.id}
              variant="ghost"
              size="sm"
              className="w-full justify-start h-8 text-xs gap-2"
              onClick={() => handleChangeOwner(user.id)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Avatar className="h-5 w-5">
                  <AvatarImage src={user.avatar_url} alt={user.display_name || user.email} />
                  <AvatarFallback className="text-[10px]">
                    {(user.display_name || user.email)?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <span className="truncate">
                {user.display_name || user.email?.split('@')[0]}
              </span>
              {user.display_name && (
                <span className="text-muted-foreground truncate">
                  ({user.email})
                </span>
              )}
            </Button>
          ))
        )}
      </div>
    </div>
  );
};

export default OwnerChangeContent;
