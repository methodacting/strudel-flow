# Audio Export Feature Design

## Overview
Add audio export functionality to Strudel Flow, allowing users to export their musical creations as MP3 files stored in Cloudflare R2 with public shareable links.

## Requirements
- **Export Trigger**: Auto-export one loop of the current pattern
- **Format**: MP3 at 320kbps (high quality, reasonable file size)
- **Access**: Public with shareable links (for social media sharing)
- **Management**: User chooses per export whether to overwrite previous or create new

## Architecture

### Backend
- **R2 Bucket**: `strudel-flow-audio-exports` (configured in wrangler.jsonc, not pre-created)
- **Route**: `POST /api/projects/:id/export` - Accepts audio blob, uploads to R2, stores metadata
- **Route**: `GET /api/audio/:exportId` - Redirects to or serves the audio file
- **Database**: New `project_exports` table for metadata tracking

### Frontend
- Export button in workflow controls
- Modal dialog with overwrite checkbox
- Progress indicator during recording
- Success state with download and share link buttons
- List of previous exports

### Client Recording
- Web Audio API `MediaRecorder` on `MediaStreamDestination`
- Connect Strudel output to both speakers and recorder
- Record exactly one loop cycle
- Upload blob to backend

## Data Flow

1. User clicks "Export" → modal appears
2. User confirms export (chooses overwrite or new)
3. Frontend:
   - Creates recording stream
   - Starts pattern playback
   - Records for one loop duration
   - Stops recording
4. Upload to `/api/projects/:id/export`
5. Backend stores in R2 and database
6. Frontend displays success with share link

## Database Schema

```sql
CREATE TABLE project_exports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_key TEXT NOT NULL UNIQUE,
  format TEXT NOT NULL DEFAULT 'mp3',
  duration_seconds REAL NOT NULL,
  is_latest BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

## R2 Storage Structure
- Files stored as: `exports/{projectId}/{exportId}.mp3`
- Public access via Cloudflare R2 public URLs

## API Endpoints

### POST /api/projects/:id/export
**Request:**
- Method: POST
- Body: FormData with `audio` blob and `overwrite` boolean
- Auth: Requires project access

**Response:**
```json
{
  "audioUrl": "https://cdn.strudel-flow.audio/exports/abc123/latest.mp3",
  "exportId": "xyz-789",
  "shareUrl": "https://strudel.flow/audio/xyz-789",
  "duration": 4.5,
  "createdAt": "2025-01-13T10:30:00Z"
}
```

### GET /api/audio/:exportId
**Response:** Redirects to R2 public URL or serves file directly

## Implementation Files

### Backend
- `apps/backend/wrangler.jsonc` - Add R2 bucket binding
- `apps/backend/src/types/bindings.d.ts` - Add AUDIO_EXPORTS to CloudflareBindings
- `packages/db/src/schema.ts` - Add projectExports table
- `apps/backend/src/routes/audio.ts` - New routes for export and serving
- `apps/backend/src/index.ts` - Register audio routes

### Frontend
- `apps/frontend/src/components/workflow/export-dialog.tsx` - Export modal
- `apps/frontend/src/hooks/use-audio-export.ts` - Recording and export logic
- `apps/frontend/src/components/workflow/controls.tsx` - Add export button
- `apps/frontend/src/hooks/api/exports.ts` - React Query hooks for exports

## Error Handling
- Recording failures: Inform user, suggest trying again
- Upload failures: Retry with exponential backoff
- R2 errors: Log to backend, show user friendly message
- Project not found: Return 404 with helpful message

## Security Considerations
- Export endpoint validates project membership
- Public audio links use non-guessable IDs (UUID/nanoid)
- Rate limiting on export creation to prevent abuse
- File size limits (max ~5 minutes of audio)

## Future Enhancements
- Additional format options (WAV, AAC)
- Manual recording mode (record while user plays)
- Video export with visual recording
- Export history and management UI
- Batch export multiple projects
