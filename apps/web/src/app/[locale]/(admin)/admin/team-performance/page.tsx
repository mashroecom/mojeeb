'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { RealTimeMetrics } from '@/components/analytics/RealTimeMetrics';
import { AgentComparisonChart } from '@/components/analytics/AgentComparisonChart';
import { TeamPerformanceCard } from '@/components/analytics/TeamPerformanceCard';
import { Download, FileText, Calendar, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportToCsv } from '@/lib/exportCsv';
import { useTeamPerformanceHistorical } from '@/hooks/useTeamPerformance';

export default function TeamPerformancePage() {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Get orgId from auth store
  const { organization } = useAuthStore();
  const orgId = organization?.id || '';

  // Fetch historical data for export
  const { data: historicalData } = useTeamPerformanceHistorical({
    orgId,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const agentMetrics = historicalData?.agentMetrics || [];

      if (agentMetrics.length === 0) {
        return;
      }

      // Format time in milliseconds to readable format
      const formatTime = (ms: number): string => {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
      };

      // Transform agent metrics for CSV
      const rows = agentMetrics.map((agent: {
        agentId: string;
        agentName: string;
        conversationsHandled: number;
        avgResponseTimeMs: number;
        avgResolutionTimeMs: number;
        avgCSAT: number;
        handoffCount: number;
        messageCount: number;
      }) => ({
        'Agent ID': agent.agentId,
        'Agent Name': agent.agentName || 'Unknown Agent',
        'Conversations Handled': agent.conversationsHandled ?? 0,
        'Avg Response Time': formatTime(agent.avgResponseTimeMs ?? 0),
        'Avg Resolution Time': formatTime(agent.avgResolutionTimeMs ?? 0),
        'Avg CSAT': (agent.avgCSAT ?? 0).toFixed(2),
        'Handoff Count': agent.handoffCount ?? 0,
        'Message Count': agent.messageCount ?? 0,
      }));

      // Generate filename with date range
      const dateRangeStr = startDate && endDate
        ? `${startDate}_to_${endDate}`
        : startDate
        ? `from_${startDate}`
        : endDate
        ? `until_${endDate}`
        : 'all_time';

      exportToCsv(`team_performance_${dateRangeStr}`, rows);
    } catch (error) {
      console.error('CSV export failed:', error);
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      // Use browser's print dialog which allows saving as PDF
      window.print();
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setExportingPdf(false);
    }
  };

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-destructive font-medium mb-2">No organization found</p>
        <p className="text-sm text-muted-foreground">
          Please ensure you are logged in with a valid organization.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Team Performance Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time and historical team performance metrics
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
              exportingCsv
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-background hover:bg-muted/50'
            )}
          >
            {exportingCsv ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export CSV
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
              exportingPdf
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-background hover:bg-muted/50'
            )}
          >
            {exportingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Export PDF
          </button>
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="rounded-lg border bg-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Date Range:</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="startDate" className="text-xs text-muted-foreground">
                From:
              </label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1.5 text-sm rounded border bg-background"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="endDate" className="text-xs text-muted-foreground">
                To:
              </label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1.5 text-sm rounded border bg-background"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Real-Time Metrics Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Real-Time Metrics</h2>
        <RealTimeMetrics orgId={orgId} />
      </div>

      {/* Agent Comparison Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Agent Comparison</h2>
          <div className="text-xs text-muted-foreground">
            {selectedAgentIds.length > 0
              ? `${selectedAgentIds.length} agent(s) selected`
              : 'Select agents to compare'}
          </div>
        </div>
        <AgentComparisonChart
          agentIds={selectedAgentIds}
          dateRange={{
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            orgId: orgId || undefined,
          }}
        />
        {selectedAgentIds.length === 0 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Note: Agent selection will be implemented when integrating with agent management
          </p>
        )}
      </div>

      {/* Historical Performance Table */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Historical Performance</h2>
        <TeamPerformanceCard
          orgId={orgId}
          startDate={startDate || undefined}
          endDate={endDate || undefined}
        />
      </div>
    </div>
  );
}
