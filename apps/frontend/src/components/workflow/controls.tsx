import { ZoomSlider } from '@/components/zoom-slider';
import { Panel } from '@xyflow/react';
import { useState } from 'react';
import { NotebookText, Timer, Play, Pause, Menu, X, Download } from 'lucide-react';
import { PatternPanel } from '@/components/pattern-panel';
import { useGlobalPlayback } from '@/hooks/use-global-playback';
import { CPM } from '@/components/cpm';
import { ShareUrlPopover } from '@/components/share-url-popover';
import { PresetPopover } from '@/components/preset-popover';
import { AppInfoPopover } from '@/components/app-info-popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { ExportDialog } from '@/components/workflow/export-dialog';
import { useAudioExport } from '@/hooks/use-audio-export';

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

export function WorkflowControls({ projectId }: { projectId: string }) {
  const [isPatternPanelVisible, setPatternPanelVisible] = useState(false);
  const [isCpmPanelVisible, setCpmPanelVisible] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    shareUrl: string;
    audioUrl: string;
  } | null>(null);
  const isMobile = useIsMobile();

  // Audio export hooks
  const { isRecording } = useAudioExport();
  // Note: useCreateExportMutation will be used in Task 9 when implementing actual recording

  // TODO: Task 9 - Connect to Strudel's audio context
  // For now, we'll implement the structure but the actual recording
  // requires access to Strudel's Web Audio API context
  const handleExport = async (overwrite: boolean) => {
    setIsExporting(true);
    setExportResult(null);

    try {
      // This will be implemented in Task 9 when we connect to Strudel's audio
      // For now, this is a placeholder that logs the intent
      console.log('Export requested with overwrite:', overwrite);
      console.log('Recording will be implemented in Task 9');
      setIsExporting(false);
    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
    }
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

              <ShareUrlPopover projectId={projectId} />

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
          duration={4} // TODO: Get actual loop duration
          onExport={handleExport}
          isExporting={isExporting}
          exportResult={exportResult}
        />
      </>
    );
  }

  return (
    <>
      <ZoomSlider position="bottom-left" className="bg-card" />

      <Panel position="top-right" className="flex flex-col items-end gap-4">
        <PlayPauseButton />

        <PatternPanelButton
          onToggle={() => setPatternPanelVisible((prev) => !prev)}
        />

        <CPMPanelButton onToggle={() => setCpmPanelVisible((prev) => !prev)} />

        <PresetPopover />

        <ShareUrlPopover projectId={projectId} />

        <ExportButton />

        <AppInfoPopover />

        {isCpmPanelVisible && <CPM />}
      </Panel>

      <Panel position="bottom-right" className="flex flex-col gap-4">
        <PatternPanel isVisible={isPatternPanelVisible} />
      </Panel>
    </>
  );
}
