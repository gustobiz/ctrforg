'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Something went wrong!</h2>
        <p className="text-muted-foreground text-sm">
          An unexpected error occurred in the application runtime.
        </p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-emerald-500 text-black font-medium rounded-md hover:bg-emerald-400 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
