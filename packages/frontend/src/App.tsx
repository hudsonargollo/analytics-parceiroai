import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { queryClient } from '@/lib/queryClient';
import { RecoveryRateChart } from '@/components/RecoveryRateChart';
import { CohortAnalysisTable } from '@/components/CohortAnalysisTable';
import { DSOMetrics } from '@/components/DSOMetrics';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Handle manual refresh
  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    queryClient.invalidateQueries();
  };

  // Auto-refresh every 5 minutes
  useState(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        queryClient.invalidateQueries();
      }, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Subscription Recovery Analytics</h1>
                <p className="text-sm text-muted-foreground">
                  Track payment recovery efficiency across communication branches
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={autoRefresh ? 'bg-primary/10' : ''}
                >
                  {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Dashboard */}
        <main className="container mx-auto px-4 py-8">
          <div className="space-y-8">
            {/* DSO Metrics Section */}
            <section key={`dso-${refreshKey}`}>
              <DSOMetrics initialDateRange="30d" />
            </section>

            {/* Recovery Rate Chart Section */}
            <section key={`recovery-${refreshKey}`}>
              <RecoveryRateChart 
                initialBranch="all"
                initialDateRange="30d"
              />
            </section>

            {/* Cohort Analysis Section */}
            <section key={`cohort-${refreshKey}`}>
              <CohortAnalysisTable />
            </section>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t py-6 mt-12">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>Subscription Recovery Analytics Dashboard</p>
            <p className="mt-1">Powered by Cloudflare Workers, D1, and React</p>
          </div>
        </footer>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
