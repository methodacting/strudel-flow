# Audio Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add MP3 audio export functionality to Strudel Flow with Cloudflare R2 storage and public shareable links.

**Architecture:**
- Frontend uses Web Audio API MediaRecorder to capture one loop of Strudel playback
- Backend uploads to R2 bucket, stores metadata in D1, serves via public URLs
- Export flow: Record → Upload → Store metadata → Return public URL

**Tech Stack:**
- Web Audio API MediaRecorder (client-side recording)
- Cloudflare R2 (object storage)
- Cloudflare D1 (metadata database)
- Drizzle ORM (database operations)
- Hono (backend routes)
- React Query (frontend API hooks)

---

## Task 1: Add R2 Bucket Configuration

**Files:**
- Modify: `apps/backend/wrangler.jsonc`

**Step 1: Add R2 bucket binding to wrangler.jsonc**

Add to the bindings section (after the DB binding):

```toml
[[r2_buckets]]
binding = "AUDIO_EXPORTS"
bucket_name = "strudel-flow-audio-exports"
preview_bucket_name = "strudel-flow-audio-exports-preview"
```

**Step 2: Verify wrangler.jsonc is valid**

Run: `wrangler types --env-interface CloudflareBindings`
Expected: Success, generates updated types

**Step 3: Commit**

```bash
git add apps/backend/wrangler.jsonc
git commit -m "feat(audio-export): add R2 bucket binding for audio exports"
```

---

## Task 2: Update CloudflareBindings Type

**Files:**
- Modify: `apps/backend/src/types/bindings.d.ts`

**Step 1: Add AUDIO_EXPORTS to CloudflareBindings interface**

Add the R2Bucket property:

```typescript
export interface CloudflareBindings {
  // ... existing bindings
  ASSETS: Fetcher;

  // Add this:
  AUDIO_EXPORTS: R2Bucket;

  // Better Auth environment variables
  BETTER_AUTH_SECRET: string;
  // ... rest of bindings
}
```

**Step 2: Run type check**

Run: `cd apps/backend && pnpm build`
Expected: Types compile successfully

**Step 3: Commit**

```bash
git add apps/backend/src/types/bindings.d.ts
git commit -m "feat(audio-export): add AUDIO_EXPORTS to CloudflareBindings type"
```

---

## Task 3: Add Database Schema for Project Exports

**Files:**
- Modify: `packages/db/src/schema.ts`

**Step 1: Add projectExports table to schema**

Add this table definition after the projectMembers table:

```typescript
import { pgTable, text, real, boolean, index } from "drizzle-orm/pg-core";

// ... existing imports

export const projectExports = pgTable("project_exports", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fileKey: text("file_key").notNull().unique(),
  format: text("format").notNull().default("mp3"),
  durationSeconds: real("duration_seconds").notNull(),
  isLatest: boolean("is_latest").default(false),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  projectIdIdx: index("project_exports_project_id_idx").on(table.projectId),
  latestIdx: index("project_exports_latest_idx").on(table.projectId, table.isLatest),
}));
```

**Step 2: Generate migration**

Run: `pnpm db:migrations:generate`
Expected: Creates new migration file in `packages/db/drizzle`

**Step 3: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle
git commit -m "feat(audio-export): add projectExports table schema"
```

---

## Task 4: Create Export Route Handler

**Files:**
- Create: `apps/backend/src/routes/audio.ts`

**Step 1: Create audio export routes file**

Create new file with export and serve endpoints:

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import type { AppBindings, AppVariables } from "../types/hono";
import { nanoid } from "nanoid";

export const audioRouter = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>()
  .use("/*", authMiddleware)
  // Create audio export
  .post("/projects/:id/export", async (c) => {
    const user = c.get("user");
    const projectId = c.req.param("id");

    // Verify user has access to project
    // TODO: Add project access check

    const formData = await c.req.formData();
    const audioFile = formData.get("audio") as File;
    const overwrite = formData.get("overwrite") === "true";

    if (!audioFile) {
      return c.json({ error: "No audio file provided" }, 400);
    }

    const exportId = nanoid();
    const fileKey = `exports/${projectId}/${exportId}.mp3`;

    // If overwrite, mark previous exports as not latest
    if (overwrite) {
      await c.env.DB.prepare(`
        UPDATE project_exports
        SET is_latest = 0
        WHERE project_id = ? AND is_latest = 1
      `).bind(projectId).run();
    }

    // Upload to R2
    await c.env.AUDIO_EXPORTS.put(fileKey, await audioFile.arrayBuffer(), {
      httpMetadata: {
        contentType: "audio/mpeg",
      },
    });

    // Get duration from form or estimate
    const durationSeconds = parseFloat(formData.get("duration") as string) || 0;

    // Store metadata
    await c.env.DB.prepare(`
      INSERT INTO project_exports (id, project_id, file_key, format, duration_seconds, is_latest, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      exportId,
      projectId,
      fileKey,
      "mp3",
      durationSeconds,
      true,
      new Date().toISOString()
    ).run();

    // Return URLs
    const audioUrl = `/api/audio/${exportId}`;

    return c.json({
      audioUrl,
      exportId,
      shareUrl: `${new URL(c.req.url).origin}/audio/${exportId}`,
      duration: durationSeconds,
      createdAt: new Date().toISOString(),
    });
  })
  // Get/serve audio export
  .get("/audio/:exportId", async (c) => {
    const exportId = c.req.param("exportId");

    // Get export metadata
    const result = await c.env.DB.prepare(`
      SELECT file_key FROM project_exports WHERE id = ?
    `).bind(exportId).first();

    if (!result) {
      return c.json({ error: "Export not found" }, 404);
    }

    // Get from R2
    const object = await c.env.AUDIO_EXPORTS.get(result.file_key as string);

    if (!object) {
      return c.json({ error: "Audio file not found" }, 404);
    }

    // Stream the file
    return new Response(object.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  });
```

**Step 2: Register audio routes**

Modify `apps/backend/src/index.ts`:

Add import:
```typescript
import { audioRouter } from "./routes/audio";
```

Add route (after projectRouter):
```typescript
app.route("/api", audioRouter);
```

**Step 3: Run type check**

Run: `cd apps/backend && pnpm build`
Expected: Types compile successfully

**Step 4: Commit**

```bash
git add apps/backend/src/routes/audio.ts apps/backend/src/index.ts
git commit -m "feat(audio-export): add audio export routes"
```

---

## Task 5: Create Frontend Export Hook

**Files:**
- Create: `apps/frontend/src/hooks/use-audio-export.ts`

**Step 1: Create audio recording hook**

```typescript
import { useCallback, useRef, useState } from "react";

export interface AudioExportOptions {
  duration: number; // in seconds
  onProgress?: (remaining: number) => void;
  onComplete?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

export function useAudioExport() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamDestinationRef = useRef<MediaStreamDestination | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = useCallback(async (
    audioContext: AudioContext,
    sourceNode: AudioNode,
    options: AudioExportOptions
  ) => {
    try {
      setIsRecording(true);

      // Create stream destination
      const streamDestination = audioContext.createMediaStreamDestination();
      streamDestinationRef.current = streamDestination;

      // Connect source to stream destination
      sourceNode.connect(streamDestination);

      // Create media recorder
      const mediaRecorder = new MediaRecorder(streamDestination.stream, {
        mimeType: "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;

      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        options.onComplete?.(blob);
        setIsRecording(false);

        // Cleanup
        sourceNode.disconnect(streamDestination);
      };

      // Start recording
      mediaRecorder.start();

      // Stop after duration
      const remaining = options.duration;
      const updateProgress = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const remaining = Math.max(0, options.duration - elapsed);
        options.onProgress?.(remaining);

        if (remaining > 0) {
          requestAnimationFrame(updateProgress);
        }
      };

      const startTime = Date.now();
      requestAnimationFrame(updateProgress);

      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
      }, options.duration * 1000);

    } catch (error) {
      options.onError?.(error as Error);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
```

**Step 2: Commit**

```bash
git add apps/frontend/src/hooks/use-audio-export.ts
git commit -m "feat(audio-export): add useAudioExport hook"
```

---

## Task 6: Create Export API Hook

**Files:**
- Create: `apps/frontend/src/hooks/api/exports.ts`

**Step 1: Create export API hooks**

```typescript
import { useMutation } from "@tanstack/react-query";
import { honoClient } from "@/lib/hono-client";

export const useCreateExportMutation = () =>
  useMutation({
    mutationFn: async ({
      projectId,
      audioBlob,
      overwrite,
      duration,
    }: {
      projectId: string;
      audioBlob: Blob;
      overwrite: boolean;
      duration: number;
    }) => {
      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append("overwrite", overwrite.toString());
      formData.append("duration", duration.toString());

      const response = await honoClient.api.projects[":id"].export.$post({
        param: { id: projectId },
        // @ts-ignore - FormData handling
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create export");
      }

      return response.json();
    },
  });
```

**Step 2: Commit**

```bash
git add apps/frontend/src/hooks/api/exports.ts
git commit -m "feat(audio-export): add export API hooks"
```

---

## Task 7: Create Export Dialog Component

**Files:**
- Create: `apps/frontend/src/components/workflow/export-dialog.tsx`

**Step 1: Create export dialog component**

```typescript
import { useState } from "react";
import { Download, Link2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateExportMutation } from "@/hooks/api/exports";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  duration: number;
  onExport: (overwrite: boolean) => Promise<void>;
}

export function ExportDialog({
  open,
  onOpenChange,
  projectId,
  duration,
  onExport,
}: ExportDialogProps) {
  const [overwrite, setOverwrite] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<{
    shareUrl: string;
    audioUrl: string;
  } | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setResult(null);

    try {
      await onExport(overwrite);
      // Will be updated by parent via mutation success
    } catch (error) {
      console.error("Export failed:", error);
      setIsExporting(false);
    }
  };

  const handleCopyLink = async () => {
    if (result?.shareUrl) {
      await navigator.clipboard.writeText(result.shareUrl);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setResult(null);
    setOverwrite(false);
    setIsExporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Audio</DialogTitle>
          <DialogDescription>
            Export your composition as an MP3 file ({duration.toFixed(1)}s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!result && !isExporting && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="overwrite"
                checked={overwrite}
                onCheckedChange={(checked) => setOverwrite(checked as boolean)}
              />
              <label
                htmlFor="overwrite"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Overwrite previous export
              </label>
            </div>
          )}

          {isExporting && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Recording and exporting...
              </span>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-600">
                ✓ Export complete!
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCopyLink} className="flex-1">
                  <Link2 className="h-4 w-4 mr-2" />
                  Copy link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(result.audioUrl, "_blank")}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {!result && (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isExporting}
              >
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? "Exporting..." : "Export"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add apps/frontend/src/components/workflow/export-dialog.tsx
git commit -m "feat(audio-export): add export dialog component"
```

---

## Task 8: Integrate Export into Workflow Controls

**Files:**
- Modify: `apps/frontend/src/components/workflow/controls.tsx`

**Step 1: Add export button and dialog**

Add import:
```typescript
import { ExportDialog } from "./export-dialog";
import { useAudioExport } from "@/hooks/use-audio-export";
import { useCreateExportMutation } from "@/hooks/api/exports";
```

Add state to component:
```typescript
const [exportDialogOpen, setExportDialogOpen] = useState(false);
```

Add hooks:
```typescript
const { isRecording, startRecording } = useAudioExport();
const createExport = useCreateExportMutation();
```

Add export button to toolbar (after play/pause buttons):
```typescript
<Button
  variant="outline"
  size="icon"
  onClick={() => setExportDialogOpen(true)}
  disabled={isRecording}
  title="Export audio"
>
  <Download className="h-4 w-4" />
</Button>
```

Add export handler:
```typescript
const handleExport = async (overwrite: boolean) => {
  // Trigger recording via global playback
  // This will need integration with use-workflow-runner
  // For now, placeholder:
  console.log("Export with overwrite:", overwrite);
};
```

Add dialog to JSX:
```tsx
<ExportDialog
  open={exportDialogOpen}
  onOpenChange={setExportDialogOpen}
  projectId={projectId}
  duration={loopDuration}
  onExport={handleExport}
/>
```

**Step 2: Commit**

```bash
git add apps/frontend/src/components/workflow/controls.tsx
git commit -m "feat(audio-export): integrate export into workflow controls"
```

---

## Task 9: Connect Recording to Strudel Playback

**Files:**
- Modify: `apps/frontend/src/hooks/use-workflow-runner.tsx` or create new hook for recording

**Step 1: Add recording capability to workflow runner**

This requires connecting the Web Audio output to both speakers and MediaRecorder. The exact implementation depends on how Strudel's audio context is exposed.

Key steps:
1. Get reference to Strudel's audio context
2. Create MediaStreamDestination
3. Connect master output to both destination and speakers
4. Record for one loop duration
5. Convert webm blob to MP3 (optional, or send webm to backend)

**Step 2: Test recording manually**

Open project in browser, click export, verify audio is recorded correctly

**Step 3: Commit**

```bash
git add apps/frontend/src/hooks/use-workflow-runner.tsx
git commit -m "feat(audio-export): connect recording to Strudel playback"
```

---

## Task 10: Add Hono Client Type for Export Route

**Files:**
- Modify: `apps/frontend/src/lib/hono-client.ts` (or update backend types)

**Step 1: Ensure export endpoint is typed**

The Hono client should automatically pick up the new route types after rebuilding the backend.

Rebuild backend:
```bash
cd apps/backend && pnpm build
```

**Step 2: Test export flow**

1. Open a project
2. Click export button
3. Choose overwrite option
4. Wait for recording to complete
5. Verify share link works
6. Verify download works

**Step 3: Commit**

```bash
git add apps/frontend/src/lib/hono-client.ts
git commit -m "feat(audio-export): add type for export endpoint"
```

---

## Task 11: Apply Database Migration

**Files:**
- Migration files in `packages/db/drizzle`

**Step 1: Review generated migration**

Check the generated migration file contains the correct SQL.

**Step 2: Run migration locally**

Run: `pnpm db:push:local`
Expected: Migration applied successfully to local D1 database

**Step 3: Test export endpoint**

Try creating an export via API to verify database integration works.

**Step 4: Commit**

```bash
git add packages/db/drizzle
git commit -m "feat(audio-export): apply project_exports migration"
```

---

## Task 12: Add Export List UI (Optional Enhancement)

**Files:**
- Create: `apps/frontend/src/components/workflow/exports-list.tsx`

**Step 1: Create exports list component**

Display previous exports with download/delete options.

**Step 2: Add to project view**

Show exports in sidebar or modal.

**Step 3: Commit**

```bash
git add apps/frontend/src/components/workflow/exports-list.tsx
git commit -m "feat(audio-export): add exports list UI"
```

---

## Testing Checklist

**Manual Testing:**
- [ ] Export creates file in R2
- [ ] Export appears in database with correct metadata
- [ ] Public URL is accessible
- [ ] Share link works in new browser/session
- [ ] Overwrite option removes old exports from "latest" status
- [ ] Download button works
- [ ] Recording stops after one loop
- [ ] Progress indicator updates during recording

**Integration Testing:**
- [ ] Export works with various pattern lengths
- [ ] Export works with empty projects (should handle gracefully)
- [ ] Export works with very long loops (>60 seconds)
- [ ] Multiple exports don't conflict

**Edge Cases:**
- [ ] Export fails if user loses project access
- [ ] Export fails if R2 upload fails
- [ ] Export handles very large files (>5 minutes)
- [ ] Concurrent exports don't overwrite each other unexpectedly

---

## Rollback Plan

If critical issues arise:

1. **Revert R2 changes:** Remove R2 binding from wrangler.jsonc
2. **Revert database changes:** Drop project_exports table via rollback migration
3. **Revert frontend changes:** Remove export button and related hooks
4. **Delete files from R2:** Manually clean up any uploaded files

Command to create rollback migration:
```bash
pnpm drizzle-kit generate --custom
# Edit migration to DROP TABLE project_exports
```

---

## Future Enhancements (Out of Scope)

- [ ] Support for additional formats (WAV, AAC)
- [ ] Manual recording mode (user starts/stops)
- [ ] Video export with canvas recording
- [ ] Export progress improvements with real-time feedback
- [ ] Batch export multiple projects
- [ ] Export templates and presets
- [ ] Social media metadata for share pages
