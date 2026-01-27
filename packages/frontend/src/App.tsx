import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 3,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold">Subscription Recovery Analytics</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">
            Dashboard coming soon...
          </p>
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;
