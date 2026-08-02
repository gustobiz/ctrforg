import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-4xl font-bold tracking-tight">404</h2>
        <p className="text-xl font-medium">Page Not Found</p>
        <p className="text-muted-foreground text-sm mb-6">
          The creator intelligence module you are looking for does not exist.
        </p>
        <Link 
          href="/"
          className="inline-flex px-4 py-2 bg-emerald-500 text-black font-medium rounded-md hover:bg-emerald-400 transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
