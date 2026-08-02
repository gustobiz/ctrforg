'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <div className="flex min-h-screen flex-col items-center justify-center">
          <div className="max-w-md text-center space-y-4">
            <h2 className="text-2xl font-bold tracking-tight">A critical error occurred!</h2>
            <p className="text-muted-foreground text-sm">
              The application encountered a fatal error.
            </p>
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-emerald-500 text-black font-medium rounded-md hover:bg-emerald-400 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
