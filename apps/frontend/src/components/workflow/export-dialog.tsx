import { useState, useEffect } from "react";
import { Download, Link2, Loader2, Check, AlertCircle } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ExportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string; // Will be used for the actual export API call
	duration: number; // Base duration for default loop count
	cpm: number; // Cycles per minute
	bpc: number; // Beats per cycle
	numLoops?: number; // Number of loops to record
	onExport: (numLoops: number) => Promise<void>;
	onReset?: () => void; // Callback to reset export result
	isExporting?: boolean;
	exportResult?: {
		shareUrl: string;
		audioUrl: string;
		exportId: string;
	} | null;
	exportError?: string | null;
	isPaused?: boolean; // Whether playback is currently paused
	levels?: number[];
}

export function ExportDialog({
	open,
	onOpenChange,
	projectId: _projectId, // eslint-disable-line @typescript-eslint/no-unused-vars -- Will be used for the actual export API call
	duration: _duration, // eslint-disable-line @typescript-eslint/no-unused-vars -- Not used directly, calculated from loops
	cpm,
	bpc,
	numLoops = 4,
	onExport,
	onReset,
	isExporting = false,
	exportResult = null,
	exportError = null,
	isPaused = false,
	levels = [],
}: ExportDialogProps) {
	const [copied, setCopied] = useState(false);
	const [loops, setLoops] = useState(numLoops);

	// Calculate duration based on selected loops
	const calculatedDuration = (60 / cpm) * bpc * loops;

	// Reset copy state when dialog opens/closes
	useEffect(() => {
		if (!open) {
			setCopied(false);
		}
		console.debug('[ExportDialog] isPaused:', isPaused, 'open:', open);
	}, [open, isPaused]);

	const handleExport = async () => {
		await onExport(loops);
	};

	const handleCopyLink = async () => {
		if (exportResult?.shareUrl) {
			await navigator.clipboard.writeText(exportResult.shareUrl);
			setCopied(true);
			// Clear after 3 seconds
			setTimeout(() => setCopied(false), 3000);
		}
	};

	const handleDownload = async () => {
		if (exportResult?.audioUrl) {
			try {
				const response = await fetch(exportResult.audioUrl);
				const blob = await response.blob();
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `strudel-export-${exportResult.exportId}.wav`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			} catch (error) {
				console.error('Download failed:', error);
			}
		}
	};

	const handleClose = () => {
		onOpenChange(false);
		// Reset export state when closing
		onReset?.();
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Export Audio</DialogTitle>
					<DialogDescription>
						Export your composition as a WAV file.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{!exportResult && !isExporting && (
						<>
							{isPaused && (
								<div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
									<AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
									<div className="text-sm text-yellow-800 dark:text-yellow-200">
										<p className="font-medium mb-1">Playback is paused</p>
										<p className="text-yellow-700 dark:text-yellow-300">Audio must be playing to record. Start playback before exporting.</p>
									</div>
								</div>
							)}

							<div className="space-y-2">
								<label className="text-sm font-medium">Number of loops</label>
								<div className="flex items-center gap-3">
									<input
										type="range"
										min="1"
										max="8"
										value={loops}
										onChange={(e) => setLoops(Number(e.target.value))}
										className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
									/>
									<span className="text-sm font-medium w-8 text-center">{loops}</span>
								</div>
								<p className="text-xs text-muted-foreground">
									{loops} loop{loops !== 1 ? 's' : ''} • {calculatedDuration.toFixed(1)}s total
								</p>
							</div>

						</>
					)}

					{isExporting && (
						<div className="space-y-4 py-4">
							<div className="flex items-center justify-center">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
								<span className="ml-2 text-sm text-muted-foreground">
									Recording and exporting...
								</span>
							</div>
							<div className="rounded-md border bg-muted/30 p-3">
								<div className="flex h-16 items-end gap-1">
									{(levels.length ? levels : new Array(32).fill(0.05)).map(
										(level, index) => (
											<div
												key={`bar-${index}`}
												className="flex-1 rounded-sm bg-primary/70 transition-[height] duration-150"
												style={{
													height: `${Math.max(6, Math.round(level * 100))}%`,
												}}
											/>
										),
									)}
								</div>
							</div>
						</div>
					)}

					{exportError && (
						<div className="space-y-3">
							<div className="flex items-center gap-2 text-sm text-red-600">
								✗ Export failed: {exportError}
							</div>
						</div>
					)}

					{exportResult && (
						<div className="space-y-3">
							<div className="flex items-center gap-2 text-sm text-green-600">
								✓ Export complete!
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={handleCopyLink}
									className="flex-1 relative overflow-hidden"
								>
									{copied ? (
										<>
											<Check className="h-4 w-4 mr-2 text-green-600" />
											<span className="text-green-600">Copied!</span>
										</>
									) : (
										<>
											<Link2 className="h-4 w-4 mr-2" />
											Copy link
										</>
									)}
								</Button>
								<Button
									variant="outline"
									onClick={handleDownload}
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
					{!exportResult && (
						<>
							<Button
								variant="outline"
								onClick={handleClose}
								disabled={isExporting}
							>
								Cancel
							</Button>
							<Button onClick={handleExport} disabled={isExporting || isPaused}>
								{isPaused ? "Resume playback first" : isExporting ? "Exporting..." : "Export"}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
