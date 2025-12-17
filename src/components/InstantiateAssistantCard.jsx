import React, { useState } from 'react';
import { Bot, Play, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSupabase } from '@/hooks/useSupabase';
import { toast } from 'sonner';

const InstantiateAssistantCard = ({ assistant, onInstantiated }) => {
  const supabase = useSupabase();
  const [isInstantiating, setIsInstantiating] = useState(false);
  const [error, setError] = useState(null);

  const handleInstantiate = async () => {
    if (!supabase || !assistant?.assistant?.row_id) return;

    setIsInstantiating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('assistant-manager', {
        body: {
          action: 'instantiate',
          row_id: assistant.assistant.row_id,
        },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      toast.success('Assistant instantiated successfully');
      onInstantiated?.();
    } catch (err) {
      console.error('Error instantiating assistant:', err);
      setError(err.message || 'Failed to instantiate assistant');
      toast.error('Failed to instantiate assistant');
    } finally {
      setIsInstantiating(false);
    }
  };

  const assistantName = assistant?.assistant?.name || assistant?.promptName || 'Assistant';
  const instructions = assistant?.assistant?.instructions;

  return (
    <div className="h-full flex items-center justify-center p-8 bg-background/50">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{assistantName}</CardTitle>
          <CardDescription>
            This assistant needs to be instantiated before you can chat with it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {instructions && (
            <div className="bg-muted/50 rounded-md p-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Instructions Preview
              </div>
              <div className="text-sm text-foreground line-clamp-4">
                {instructions}
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleInstantiate}
            disabled={isInstantiating}
            className="w-full"
          >
            {isInstantiating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Instantiating...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Instantiate Assistant
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstantiateAssistantCard;
