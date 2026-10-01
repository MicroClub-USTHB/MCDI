import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-surface-base text-text-primary">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-hero tracking-tight">Welcome to MCDI</h1>
        <p className="text-body text-text-muted">
          A modern application built with Next.js 16, TypeScript, and TailwindCSS.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Button asChild size="sm">
            <Link href="/dashboard">Get Started</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="https://nextjs.org/docs" target="_blank" rel="noopener noreferrer">
              Documentation
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
