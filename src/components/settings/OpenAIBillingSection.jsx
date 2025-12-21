import React, { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ExternalLink, AlertCircle, CheckCircle, DollarSign, CreditCard, TrendingUp } from 'lucide-react';
import { useSupabase } from '@/hooks/useSupabase';
import { toast } from '@/components/ui/sonner';

const OpenAIBillingSection = ({ isRefreshing, onRefresh }) => {
  const supabase = useSupabase();
  const [billingData, setBillingData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchBillingData = useCallback(async () => {
    if (!supabase) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('openai-billing');
      
      if (error) {
        console.error('Billing fetch error:', error);
        toast.error('Failed to fetch billing data');
        return;
      }
      
      setBillingData(data);
      setLastChecked(new Date());
      
      if (data.error) {
        toast.warning('Limited billing data available', {
          description: data.error,
        });
      } else {
        toast.success('Billing data refreshed');
      }
    } catch (err) {
      console.error('Error fetching billing:', err);
      toast.error('Failed to connect to billing service');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      // Handle Unix timestamp (seconds)
      const date = typeof dateString === 'number' 
        ? new Date(dateString * 1000) 
        : new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const renderSubscriptionInfo = () => {
    const sub = billingData?.subscription;
    if (!sub) return null;

    return (
      <div className="space-y-3">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Subscription
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Plan:</span>
            <span className="ml-2 font-medium">{sub.plan?.title || sub.plan?.id || 'Pay-as-you-go'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Hard Limit:</span>
            <span className="ml-2 font-medium">{formatCurrency(sub.hard_limit_usd)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Soft Limit:</span>
            <span className="ml-2 font-medium">{formatCurrency(sub.soft_limit_usd)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Payment Method:</span>
            <span className="ml-2">
              {sub.has_payment_method ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" /> Active
                </Badge>
              ) : (
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                  <AlertCircle className="h-3 w-3 mr-1" /> None
                </Badge>
              )}
            </span>
          </div>
          {sub.access_until && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Access Until:</span>
              <span className="ml-2 font-medium">{formatDate(sub.access_until)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCreditsInfo = () => {
    const credits = billingData?.credits;
    if (!credits) return null;

    const totalAvailable = credits.total_available || 0;
    const totalGranted = credits.total_granted || 0;
    const totalUsed = credits.total_used || 0;
    const percentUsed = totalGranted > 0 ? (totalUsed / totalGranted) * 100 : 0;

    return (
      <div className="space-y-3">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Credits
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Available Balance:</span>
            <span className={`font-bold ${totalAvailable > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalAvailable)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Granted:</span>
            <span className="font-medium">{formatCurrency(totalGranted)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Used:</span>
            <span className="font-medium">{formatCurrency(totalUsed)}</span>
          </div>
          {totalGranted > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span>Usage</span>
                <span>{percentUsed.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${percentUsed > 80 ? 'bg-red-500' : percentUsed > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(percentUsed, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCostsInfo = () => {
    const costs = billingData?.costs;
    if (!costs) return null;

    // Calculate total spend from costs data
    let totalSpend = 0;
    if (costs.data && Array.isArray(costs.data)) {
      totalSpend = costs.data.reduce((sum, item) => sum + (item.results?.amount?.value || 0), 0);
    } else if (typeof costs.total_cost === 'number') {
      totalSpend = costs.total_cost;
    }

    return (
      <div className="space-y-3">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Recent Usage (Last 30 Days)
        </h4>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Spend:</span>
          <span className="font-bold">{formatCurrency(totalSpend)}</span>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">OpenAI Billing</CardTitle>
            <CardDescription>
              Check your OpenAI API credits and usage
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchBillingData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {billingData ? 'Refresh' : 'Check Balance'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
            >
              <a 
                href="https://platform.openai.com/usage" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                OpenAI Dashboard
              </a>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!billingData && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Check Balance" to view your OpenAI billing information</p>
            <p className="text-xs mt-2">
              Note: Some billing endpoints require an Admin API key
            </p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin" />
            <p>Fetching billing data...</p>
          </div>
        )}

        {billingData && !isLoading && (
          <div className="space-y-6">
            {billingData.error && !billingData.subscription && !billingData.credits && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Limited Access
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      {billingData.error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {renderSubscriptionInfo()}
            {renderCreditsInfo()}
            {renderCostsInfo()}

            {lastChecked && (
              <p className="text-xs text-muted-foreground text-right">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OpenAIBillingSection;
