import { ZoomSlider } from '@/components/zoom-slider';
import { Panel } from '@xyflow/react';
import { useState, useEffect } from 'react';
import { NotebookText, Timer, Play, Pause, Menu, X, Download } from 'lucide-react';
import { PatternPanel } from '@/components/pattern-panel';
import { useGlobalPlayback } from '@/hooks/use-global-playback';
import { CPM } from '@/components/cpm';
import { PresetPopover } from '@/components/preset-popover';
import { AppInfoPopover } from '@/components/app-info-popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { ExportDialog } from '@/components/workflow/export-dialog';
import { UserPresence } from '@/components/workflow/user-presence';
import { useAudioExport } from '@/hooks/use-audio-export';
import { useCreateExportMutation } from '@/hooks/api/exports';
import { useStrudelStore } from '@/store/strudel-store';
import type { UseYjsSyncResult } from '@/hooks/use-yjs-sync';

function PlayPauseButton() {
  const { isGloballyPaused, toggleGlobalPlayback } = useGlobalPlayback();

  return (
    <button
      className={`p-2 rounded bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground ${
        isGloballyPaused
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted hover:bg-primary'
      }`}
      onClick={toggleGlobalPlayback}
      title={`${isGloballyPaused ? 'Resume' : 'Pause'} All (Spacebar)`}
    >
      {isGloballyPaused ? (
        <Play className="w-5 h-5" />
      ) : (
        <Pause className="w-5 h-5" />
      )}
    </button>
  );
}

function PatternPanelButton({ onToggle }: { onToggle: () => void }) {
  return (
    <button
      className="p-2 rounded bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition"
      onClick={onToggle}
      title="Toggle Pattern Panel"
    >
      <NotebookText className="w-5 h-5" />
    </button>
  );
}

function CPMPanelButton({ onToggle }: { onToggle: () => void }) {
  return (
    <button
      className="p-2 rounded bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition"
      onClick={onToggle}
      title="Toggle CPM Panel"
    >
      <Timer className="w-5 h-5" />
    </button>
  );
}

export function WorkflowControls({
  projectId,
  awareness,
}: {
  projectId: string;
  awareness?: UseYjsSyncResult;
}) {
  const [isPatternPanelVisible, setPatternPanelVisible] = useState(false);
  const [isCpmPanelVisible, setCpmPanelVisible] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    shareUrl: string;
    audioUrl: string;
    exportId: string;
  } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Audio export hooks
  const { isRecording, startRecording, levels } = useAudioExport();
  const createExport = useCreateExportMutation();
  const { isGloballyPaused } = useGlobalPlayback();

  // Debug: log pause state changes
  useEffect(() => {
    console.debug('[WorkflowControls] isGloballyPaused:', isGloballyPaused);
  }, [isGloballyPaused]);

  // Get actual CPM and BPC from Strudel store
  const cpm = useStrudelStore((state) => parseFloat(state.cpm) || 120);
  const bpc = useStrudelStore((state) => parseFloat(state.bpc) || 4);

  // Calculate default loop duration (4 loops) for initial display
  const defaultNumLoops = 4;
  const defaultLoopDuration = (60 / cpm) * bpc * defaultNumLoops;

  const handleExport = async (numLoops: number) => {
    setIsExporting(true);
    setExportResult(null);
    setExportError(null);

    try {
      // Calculate loop duration based on selected loop count
      const loopDuration = (60 / cpm) * bpc * numLoops;

      // Start recording with Strudel's audio context
      await startRecording({
        duration: loopDuration,
        cpm,
        bpc,
        syncToCycle: true, // Sync to cycle start for accurate looping
        onProgress: (remaining) => {
          console.debug(`Recording time remaining: ${remaining.toFixed(1)}s`);
        },
        onComplete: async (blob) => {
          // Upload the recorded audio to the backend
          const result = await createExport.mutateAsync({
            projectId,
            audioBlob: blob,
            overwrite: false,
            duration: loopDuration,
          });

          // Update UI with the result
          setExportResult({
            shareUrl: `${window.location.origin}/audio/${result.exportId}`,
            audioUrl: result.audioUrl,
            exportId: result.exportId,
          });
          setIsExporting(false);
        },
        onError: (error) => {
          console.error("Recording failed:", error);
          setExportError(error instanceof Error ? error.message : "Recording failed. Please try again.");
          setIsExporting(false);
        },
      });
    } catch (error) {
      console.error("Export failed:", error);
      setExportError(error instanceof Error ? error.message : "Export failed. Please try again.");
      setIsExporting(false);
    }
  };

  const handleResetExport = () => {
    setExportResult(null);
    setExportError(null);
  };

  function ExportButton() {
    return (
      <button
        className="p-2 rounded bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition"
        onClick={() => setExportDialogOpen(true)}
        disabled={isExporting || isRecording}
        title="Export audio"
      >
        <Download className="w-5 h-5" />
      </button>
    );
  }

  if (isMobile) {
    return (
      <>
        <Panel position="top-right" className="flex flex-col items-end gap-2">
          {awareness && (
            <UserPresence
              remoteUsers={awareness.remoteUsers}
              isConnected={awareness.isConnected}
            />
          )}

          <button
            className="p-2 rounded bg-card border shadow-sm hover:bg-accent transition-colors"
            onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
            title="Toggle Controls Menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          {isMobileMenuOpen && (
            <div className="bg-card border rounded-lg shadow-lg p-2 flex flex-col gap-2">
              <PlayPauseButton />

              <PatternPanelButton
                onToggle={() => setPatternPanelVisible((prev) => !prev)}
              />

              <CPMPanelButton
                onToggle={() => setCpmPanelVisible((prev) => !prev)}
              />

              <PresetPopover />

              <ExportButton />

              <AppInfoPopover />
            </div>
          )}

          {isCpmPanelVisible && <CPM />}
        </Panel>

        <Panel position="bottom-right" className="flex flex-col gap-4">
          <PatternPanel isVisible={isPatternPanelVisible} />
        </Panel>

        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          projectId={projectId}
          duration={defaultLoopDuration}
          cpm={cpm}
          bpc={bpc}
          onExport={handleExport}
          onReset={handleResetExport}
          isExporting={isExporting}
          exportResult={exportResult}
          exportError={exportError}
          isPaused={isGloballyPaused}
          levels={levels}
        />
      </>
    );
  }

  return (
    <>
      <ZoomSlider position="bottom-left" className="bg-card" />

      <Panel position="top-right" className="flex flex-col items-end gap-4">
        {awareness && (
          <UserPresence
            remoteUsers={awareness.remoteUsers}
            isConnected={awareness.isConnected}
          />
        )}

        <PlayPauseButton />

        <PatternPanelButton
          onToggle={() => setPatternPanelVisible((prev) => !prev)}
        />

        <CPMPanelButton onToggle={() => setCpmPanelVisible((prev) => !prev)} />

        <PresetPopover />

        <ExportButton />

        <AppInfoPopover />

        {isCpmPanelVisible && <CPM />}
      </Panel>

      <Panel position="bottom-right" className="flex flex-col gap-4">
        <PatternPanel isVisible={isPatternPanelVisible} />
      </Panel>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        projectId={projectId}
        duration={defaultLoopDuration}
        cpm={cpm}
        bpc={bpc}
        onExport={handleExport}
        onReset={handleResetExport}
        isExporting={isExporting}
        exportResult={exportResult}
        exportError={exportError}
        isPaused={isGloballyPaused}
        levels={levels}
      />
    </>
  );
}
