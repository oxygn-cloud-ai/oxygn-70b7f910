import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Cpu, Hash, Calendar, TrendingUp, Info } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useCostTracking } from '@/hooks/useCostTracking';
import { trackEvent } from '@/lib/posthog';

// Type definitions
interface PromptItem {
  id: string;
  prompt_name?: string;
  position_lex?: string;
  is_assistant?: boolean;
  is_private?: boolean;
  last_ai_call_metadata?: LastCallMetadata;
}

interface LastCallMetadata {
  model?: string;
  finish_reason?: string;
  tokens_input?: number;
  tokens_output?: number;
  tokens_total?: number;
  cost_input_usd?: number;
  cost_output_usd?: number;
  cost_total_usd?: number;
  latency_ms?: number;
  timestamp?: string;
  response_id?: string;
}

interface ModelBreakdownEntry {
  calls: number;
  cost: number;
}

interface LifetimeCosts {
  totalCalls: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalTokens: number;
  totalCostUsd: number;
  modelBreakdown: Record<string, ModelBreakdownEntry>;
  firstCall: string | null;
  lastCall: string | null;
}

interface DebugInfoPopupProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  item: PromptItem | null;
  onSave: (value: string, field: string) => Promise<void>;
}

const DebugInfoPopup: React.FC<DebugInfoPopupProps> = ({ isOpen, onClose, item, onSave }) => {
  const [position, setPosition] = useState(item?.position_lex || '');
  const [lifetimeCosts, setLifetimeCosts] = useState<LifetimeCosts | null>(null);
  const [isLoadingCosts, setIsLoadingCosts] = useState(false);
  const { getLifetimeCosts } = useCostTracking();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Fetch lifetime costs when dialog opens
  useEffect(() => {
    if (isOpen && item?.id) {
      trackEvent('debug_info_viewed', { prompt_id: item.id, prompt_name: item.prompt_name });
      setIsLoadingCosts(true);
      getLifetimeCosts(item.id)
        .then((costs: LifetimeCosts | null) => {
          if (isMountedRef.current) setLifetimeCosts(costs);
        })
        .catch((err: Error) => {
          console.error('Error fetching costs:', err);
          if (isMountedRef.current) toast.error('Failed to load cost data');
        })
        .finally(() => {
          if (isMountedRef.current) setIsLoadingCosts(false);
        });
    }
  }, [isOpen, item?.id, getLifetimeCosts]);

  const handleSave = async () => {
    try {
      await onSave(position, 'position_lex');
      toast.success('Position updated successfully');
      onClose(false);
    } catch (error) {
      toast.error('Failed to update position');
    }
  };

  const formatCurrency = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '$0.00';
    return `$${parseFloat(String(value)).toFixed(6)}`;
  };

  const formatNumber = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '0';
    return value.toLocaleString();
  };

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const lastCall: LastCallMetadata = item?.last_ai_call_metadata || {};

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Prompt Information
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="w-full bg-transparent">
            <TabsTrigger value="info" className="flex-1 !text-muted-foreground hover:!text-foreground data-[state=active]:!text-primary data-[state=active]:!bg-transparent">Info</TabsTrigger>
            <TabsTrigger value="costs" className="flex-1 !text-muted-foreground hover:!text-foreground data-[state=active]:!text-primary data-[state=active]:!bg-transparent">Costs</TabsTrigger>
            <TabsTrigger value="lastCall" className="flex-1 !text-muted-foreground hover:!text-foreground data-[state=active]:!text-primary data-[state=active]:!bg-transparent">Last AI Call</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Row ID</Label>
                <Input value={item?.id || ''} readOnly disabled className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Position (Lex)</Label>
                <Input
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Prompt Name</Label>
              <Input value={item?.prompt_name || ''} readOnly disabled />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Conversation Mode</Label>
                <Badge variant={item?.is_assistant ? "default" : "secondary"}>
                  {item?.is_assistant ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Is Private</Label>
                <Badge variant={item?.is_private ? "destructive" : "secondary"}>
                  {item?.is_private ? 'Private' : 'Public'}
                </Badge>
              </div>
            </div>
          </TabsContent>

          {/* Costs Tab */}
          <TabsContent value="costs" className="space-y-4 mt-4">
            {isLoadingCosts ? (
              <div className="text-center py-8 text-muted-foreground">Loading cost data...</div>
            ) : !lifetimeCosts ? (
              <div className="text-center py-8 text-muted-foreground">No cost data available</div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Total Spent
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold text-primary">
                        {formatCurrency(lifetimeCosts.totalCostUsd)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        Total Calls
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold">{formatNumber(lifetimeCosts.totalCalls)}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Cpu className="h-3 w-3" />
                        Total Tokens
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold">{formatNumber(lifetimeCosts.totalTokens)}</p>
                      <p className="text-xs text-muted-foreground">
                        In: {formatNumber(lifetimeCosts.totalTokensInput)} / Out: {formatNumber(lifetimeCosts.totalTokensOutput)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Activity Period
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs">
                        First: {lifetimeCosts.firstCall ? new Date(lifetimeCosts.firstCall).toLocaleDateString() : 'N/A'}
                      </p>
                      <p className="text-xs">
                        Last: {lifetimeCosts.lastCall ? new Date(lifetimeCosts.lastCall).toLocaleDateString() : 'N/A'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Model Breakdown */}
                {Object.keys(lifetimeCosts.modelBreakdown || {}).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        Cost by Model
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(lifetimeCosts.modelBreakdown).map(([model, data]) => (
                          <div key={model} className="flex items-center justify-between text-sm">
                            <span className="font-mono text-xs">{model}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground text-xs">{data.calls} calls</span>
                              <span className="font-medium">{formatCurrency(data.cost)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Last AI Call Tab */}
          <TabsContent value="lastCall" className="space-y-4 mt-4">
            {Object.keys(lastCall).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No AI calls have been made yet
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Model</Label>
                    <p className="text-sm font-mono">{lastCall.model || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Finish Reason</Label>
                    <Badge variant="outline">{lastCall.finish_reason || 'N/A'}</Badge>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Input Tokens</Label>
                    <p className="text-sm font-medium">{formatNumber(lastCall.tokens_input)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Output Tokens</Label>
                    <p className="text-sm font-medium">{formatNumber(lastCall.tokens_output)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Total Tokens</Label>
                    <p className="text-sm font-medium">{formatNumber(lastCall.tokens_total)}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Input Cost</Label>
                    <p className="text-sm font-medium">{formatCurrency(lastCall.cost_input_usd)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Output Cost</Label>
                    <p className="text-sm font-medium">{formatCurrency(lastCall.cost_output_usd)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Total Cost</Label>
                    <p className="text-sm font-medium text-primary">{formatCurrency(lastCall.cost_total_usd)}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Latency</Label>
                    <p className="text-sm">{lastCall.latency_ms ? `${lastCall.latency_ms}ms` : 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Timestamp</Label>
                    <p className="text-sm">{formatDate(lastCall.timestamp)}</p>
                  </div>
                </div>

                {lastCall.response_id && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Response ID</Label>
                    <p className="text-xs font-mono text-muted-foreground break-all">{lastCall.response_id}</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onClose(false)}>Close</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DebugInfoPopup;
