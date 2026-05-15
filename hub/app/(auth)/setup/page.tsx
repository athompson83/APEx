'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Building2, Loader2 } from 'lucide-react';
import { slugify } from '@/lib/utils';

export default function SetupPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setOrgName(val);
    if (!slugTouched) {
      setOrgSlug(slugify(val));
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugTouched(true);
    setOrgSlug(slugify(e.target.value));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName, slug: orgSlug }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to create organization.');
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/30">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Create your organization
          </h1>
          <p className="text-xs text-muted-foreground">
            Set up your workspace to get started with APEx Hub.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="orgName" className="text-sm font-medium text-foreground">
            Organization name
          </label>
          <Input
            id="orgName"
            type="text"
            placeholder="Acme Corp"
            value={orgName}
            onChange={handleNameChange}
            required
            minLength={2}
            maxLength={80}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="orgSlug" className="text-sm font-medium text-foreground">
            URL slug
          </label>
          <div className="flex items-center gap-0">
            <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-border bg-muted px-3 text-xs text-muted-foreground">
              apex.app/
            </span>
            <Input
              id="orgSlug"
              type="text"
              placeholder="acme-corp"
              value={orgSlug}
              onChange={handleSlugChange}
              required
              minLength={2}
              maxLength={48}
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              disabled={isLoading}
              className="rounded-l-none"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers, and hyphens only.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading || !orgName || !orgSlug}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            'Create Organization'
          )}
        </Button>
      </form>
    </div>
  );
}
