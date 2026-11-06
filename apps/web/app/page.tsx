export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">ALTAIR</h1>
        <p className="text-muted-foreground text-lg">
          Supply Chain Intelligence Platform
        </p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Ready for development. Run <code className="bg-muted px-1.5 py-0.5 rounded font-mono">pnpm dev</code> to start.
        </p>
      </div>
    </main>
  )
}