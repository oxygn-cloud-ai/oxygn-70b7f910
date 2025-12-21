import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Cpu, Hash, Download, RefreshCw, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useCostTracking } from '@/hooks/useCostTracking';
import { toast } from '@/components/ui/sonner';

const CostAnalyticsSection = () => {
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState('30d');
  const { getPlatformCosts } = useCostTracking();

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      let startDate;
      
      switch (dateRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          startDate = null;
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const data = await getPlatformCosts({
        startDate: startDate?.toISOString(),
        endDate: now.toISOString(),
      });
      
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '$0.00';
    return `$${parseFloat(value).toFixed(4)}`;
  };

  const formatNumber = (value) => {
    if (value === undefined || value === null) return '0';
    return value.toLocaleString();
  };

  const exportToCSV = () => {
    if (!analytics?.byPrompt) return;

    const headers = ['Prompt Name', 'Row ID', 'Calls', 'Tokens', 'Cost (USD)'];
    const rows = analytics.byPrompt.map(p => [
      p.name || 'Unknown',
      p.row_id,
      p.calls,
      p.tokens,
      p.cost.toFixed(6)
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Cost Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Track AI usage costs across all prompts and users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={fetchAnalytics} disabled={isLoading} className="!text-muted-foreground hover:!text-foreground hover:!bg-muted/50">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={exportToCSV} disabled={!analytics?.byPrompt?.length} className="!text-muted-foreground hover:!text-foreground hover:!bg-muted/50">
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading analytics...</div>
      ) : !analytics ? (
        <div className="text-center py-12 text-muted-foreground">No data available</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Total Spent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{formatCurrency(analytics.totalCost)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Hash className="h-4 w-4" />
                  Total Calls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatNumber(analytics.totalCalls)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Cpu className="h-4 w-4" />
                  Total Tokens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatNumber(analytics.totalTokens)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Avg Cost/Call
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {analytics.totalCalls > 0 
                    ? formatCurrency(analytics.totalCost / analytics.totalCalls) 
                    : '$0.00'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Cost Chart */}
          {analytics.byDate?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Daily Cost Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.byDate}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        fontSize={12}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis 
                        fontSize={12}
                        tickFormatter={(value) => `$${value.toFixed(4)}`}
                      />
                      <Tooltip 
                        formatter={(value) => [`$${value.toFixed(6)}`, 'Cost']}
                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="cost" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Costs by Prompt */}
          {analytics.byPrompt?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cost by Prompt</CardTitle>
                <CardDescription>Top prompts by total cost</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.byPrompt.slice(0, 10).map((prompt, index) => (
                    <div key={prompt.row_id} className="flex items-center gap-3">
                      <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                        {index + 1}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{prompt.name || 'Unknown Prompt'}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(prompt.calls)} calls · {formatNumber(prompt.tokens)} tokens
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatCurrency(prompt.cost)}</p>
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(prompt.cost / analytics.totalCost) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Costs by User */}
          {analytics.byUser?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cost by User</CardTitle>
                <CardDescription>Usage breakdown by user</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.byUser.slice(0, 5)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" fontSize={12} tickFormatter={(value) => `$${value.toFixed(4)}`} />
                      <YAxis 
                        type="category" 
                        dataKey="user_id" 
                        fontSize={10}
                        width={100}
                        tickFormatter={(value) => value === 'anonymous' ? 'Anonymous' : value.substring(0, 8)}
                      />
                      <Tooltip 
                        formatter={(value) => [`$${value.toFixed(6)}`, 'Cost']}
                      />
                      <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default CostAnalyticsSection;
