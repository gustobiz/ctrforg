import Link from "next/link"
import { ArrowRight, BarChart3, Mail, PenTool, Target } from "lucide-react"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 lg:px-14 h-16 flex items-center border-b border-border/40 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <Link className="flex items-center justify-center" href="#">
          <Target className="h-6 w-6 text-emerald-500" />
          <span className="ml-2 font-bold text-xl tracking-tight">CTRForge</span>
        </Link>
        <nav className="hidden md:flex ml-auto gap-6 text-sm font-medium">
          <Link className="transition-colors hover:text-emerald-500 text-foreground/80" href="/discovery">
            Discovery
          </Link>
          <Link className="transition-colors hover:text-emerald-500 text-foreground/80" href="/analyze">
            Analyze
          </Link>
          <Link className="transition-colors hover:text-emerald-500 text-foreground/80" href="/outreach">
            Outreach
          </Link>
          <Link className="transition-colors hover:text-emerald-500 text-foreground/80" href="/crm">
            CRM
          </Link>
        </nav>
        <div className="ml-6 flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium hover:text-emerald-500 transition-colors hidden sm:block">
            Sign In
          </Link>
          <Link href="/dashboard" className="inline-flex h-9 items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black shadow transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
            Dashboard
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <section className="w-full py-24 md:py-32 lg:py-48 flex items-center justify-center">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-500 mb-6">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2"></span>
                  Creator Intelligence OS
                </div>
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none max-w-4xl mx-auto bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                  Stop Guessing. <br className="hidden sm:inline" />
                  Start Dominating YouTube.
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed pt-4">
                  Analyze CTR weaknesses, dissect competitors, generate high-converting thumbnail concepts, and automate creator outreach.
                </p>
              </div>
              <div className="space-x-4 pt-8">
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-500 px-8 text-sm font-medium text-black shadow transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                  href="/analyze"
                >
                  Analyze a Video <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                  href="/outreach"
                >
                  Explore Outreach
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/40 border-t border-border/40">
          <div className="container px-4 md:px-6">
            <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-2 lg:gap-12">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">Intelligence Engine</h2>
                  <p className="max-w-[600px] text-muted-foreground md:text-lg/relaxed lg:text-base/relaxed xl:text-lg/relaxed">
                    Paste any YouTube URL. Our AI analyzes emotional hooks, visual hierarchy, and title structure to detect exactly why a video is underperforming.
                  </p>
                </div>
                <ul className="grid gap-2 py-4">
                  <li className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-emerald-500" /> Hook Analysis
                  </li>
                  <li className="flex items-center gap-2">
                    <PenTool className="h-4 w-4 text-emerald-500" /> Thumbnail Readability
                  </li>
                  <li className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-emerald-500" /> CTR Weakness Detection
                  </li>
                </ul>
              </div>
              <div className="mx-auto flex w-full max-w-[400px] flex-col justify-center space-y-4 p-6 border rounded-xl bg-card shadow-sm">
                <div className="space-y-2">
                  <h3 className="font-semibold">Analysis Results</h3>
                  <p className="text-sm text-muted-foreground">Example of video analysis.</p>
                </div>
                <div className="space-y-4">
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[45%]" />
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[70%]" />
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[20%]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t border-border/40">
        <p className="text-xs text-muted-foreground">
          © 2026 CTRForge. All rights reserved.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:text-emerald-500 transition-colors text-muted-foreground" href="/terms">
            Terms of Service
          </Link>
          <Link className="text-xs hover:text-emerald-500 transition-colors text-muted-foreground" href="/privacy">
            Privacy
          </Link>
          <Link className="text-xs hover:text-emerald-500 transition-colors text-muted-foreground" href="/contact">
            Contact
          </Link>
        </nav>
      </footer>
    </div>
  )
}
