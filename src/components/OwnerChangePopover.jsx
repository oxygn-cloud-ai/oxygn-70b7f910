import React, { useState, useEffect, useCallback } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSupabase } from '../hooks/useSupabase';
import { toast } from 'sonner';

// Standalone content component for use in external popovers
export const OwnerChangeContent = ({ promptRowId, currentOwnerId, onOwnerChanged, onClose }) => {
  const supabase = useSupabase();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [domainUsers, setDomainUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);

  // Fetch domain users on mount
  useEffect(() => {
    if (supabase) {
      fetchDomainUsers();
    }
  }, [supabase]);

  const fetchDomainUsers = async () => {
    try {
      // Get all unique owner IDs from prompts
      const { data: prompts, error: promptsError } = await supabase
        .from('cyg_prompts')
        .select('owner_id')
        .not('owner_id', 'is', null);

      if (promptsError) throw promptsError;

      const ownerIds = [...new Set(prompts.map(p => p.owner_id).filter(Boolean))];
      
      // Also get the current user to include them
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser && !ownerIds.includes(currentUser.id)) {
        ownerIds.push(currentUser.id);
      }

      // Get all assistants to find more user IDs
      const { data: assistants } = await supabase
        .from('cyg_assistants')
        .select('owner_id')
        .not('owner_id', 'is', null);

      if (assistants) {
        assistants.forEach(a => {
          if (a.owner_id && !ownerIds.includes(a.owner_id)) {
            ownerIds.push(a.owner_id);
          }
        });
      }

      // Get all threads to find more user IDs
      const { data: threads } = await supabase
        .from('cyg_threads')
        .select('owner_id')
        .not('owner_id', 'is', null);

      if (threads) {
        threads.forEach(t => {
          if (t.owner_id && !ownerIds.includes(t.owner_id)) {
            ownerIds.push(t.owner_id);
          }
        });
      }

      // Fetch emails for all found user IDs
      const emailPromises = ownerIds.map(async (userId) => {
        const { data: email } = await supabase.rpc('get_user_email', { _user_id: userId });
        return { userId, email };
      });

      const users = await Promise.all(emailPromises);
      setDomainUsers(users.filter(u => u.email));
    } catch (error) {
      console.error('Error fetching domain users:', error);
    }
  };

  useEffect(() => {
    if (!email.trim()) {
      setFilteredUsers(domainUsers.filter(u => u.userId !== currentOwnerId));
    } else {
      const filtered = domainUsers.filter(
        u => u.email?.toLowerCase().includes(email.toLowerCase()) && u.userId !== currentOwnerId
      );
      setFilteredUsers(filtered);
    }
  }, [email, domainUsers, currentOwnerId]);

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
        placeholder="Search by email..."
        className="h-8 text-sm"
        autoFocus
      />
      <div className="max-h-32 overflow-auto space-y-1">
        {filteredUsers.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">
            {email ? 'No matching users' : 'No other users available'}
          </p>
        ) : (
          filteredUsers.map((user) => (
            <Button
              key={user.userId}
              variant="ghost"
              size="sm"
              className="w-full justify-start h-7 text-xs"
              onClick={() => handleChangeOwner(user.userId)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              ) : (
                <Check className="h-3 w-3 mr-2 opacity-0" />
              )}
              {user.email}
            </Button>
          ))
        )}
      </div>
    </div>
  );
};

export default OwnerChangeContent;
