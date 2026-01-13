import { useEffect, useState } from 'react';
import { Link, Check, Copy } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateInviteMutation } from '@/hooks/api/projects';
export function ShareUrlPopover({ projectId }: { projectId: string }) {
  const [isCopied, setIsCopied] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createInvite = useCreateInviteMutation();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const fetchInvite = async () => {
      if (!isPopoverOpen || inviteUrl) return;
      setError(null);
      try {
        const data = await createInvite.mutateAsync({
          projectId,
          role: 'viewer',
          signal: controller.signal,
        });
        if (!cancelled) {
          setInviteUrl(data.inviteUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to create link.');
        }
      }
    };

    void fetchInvite();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [createInvite, inviteUrl, isPopoverOpen, projectId]);

  const handleCopyUrl = async () => {
    try {
      if (!inviteUrl) return;
      await navigator.clipboard.writeText(inviteUrl);
      setIsCopied(true);

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const displayUrl =
    inviteUrl ?? `${window.location.origin}/project/${projectId}`;

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          className="p-2 rounded bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition"
          title="Share URL"
        >
          <Link className="w-5 h-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm mb-2">Share Project</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Share a view-only link to this project.
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              value={displayUrl}
              readOnly
              className="text-xs font-mono"
              onClick={(e) => e.currentTarget.select()}
            />
            <Button
              size="sm"
              onClick={handleCopyUrl}
              className={`shrink-0 ${isCopied ? 'bg-primary' : ''}`}
              disabled={!inviteUrl || createInvite.isPending}
            >
              {createInvite.isPending ? (
                'Generating...'
              ) : isCopied ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {inviteUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="px-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={async () => {
                setInviteUrl(null);
                setIsCopied(false);
              }}
            >
              Generate a new link
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
