import React, { useState, useEffect, useCallback } from 'react';
import { UserCog, Check, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSupabase } from '../hooks/useSupabase';
import { toast } from 'sonner';

const OwnerChangePopover = ({ promptRowId, currentOwnerId, onOwnerChanged }) => {
  const supabase = useSupabase();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [domainUsers, setDomainUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);

  // Fetch domain users when popover opens
  useEffect(() => {
    if (open && supabase) {
      fetchDomainUsers();
    }
  }, [open, supabase]);

  const fetchDomainUsers = async () => {
    try {
      // Get all users in allowed domains by querying prompts owners
      const { data: prompts, error } = await supabase
        .from('cyg_prompts')
        .select('owner_id')
        .not('owner_id', 'is', null);

      if (error) throw error;

      // Get unique owner IDs
      const uniqueOwnerIds = [...new Set(prompts.map(p => p.owner_id).filter(Boolean))];
      
      // Fetch emails for these users
      const emailPromises = uniqueOwnerIds.map(async (userId) => {
        const { data: email } = await supabase.rpc('get_user_email', { _user_id: userId });
        return { userId, email };
      });

      const users = await Promise.all(emailPromises);
      setDomainUsers(users.filter(u => u.email));
    } catch (error) {
      console.error('Error fetching domain users:', error);
    }
  };

  // Filter users based on input
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
      setOpen(false);
      setEmail('');
      if (onOwnerChanged) {
        onOwnerChanged();
      }
    } catch (error) {
      console.error('Error changing owner:', error);
      toast.error('Failed to change owner');
    } finally {
      setIsLoading(false);
    }
  }, [supabase, promptRowId, onOwnerChanged]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-muted"
                onClick={(e) => e.stopPropagation()}
              >
                <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent side="top" className="text-xs">
            Change Owner
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent 
        className="w-64 p-2 bg-popover" 
        onClick={(e) => e.stopPropagation()}
        align="start"
      >
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
      </PopoverContent>
    </Popover>
  );
};

export default OwnerChangePopover;
