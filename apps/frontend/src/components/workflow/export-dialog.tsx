import { useState, useEffect } from "react";
import { Download, Link2, Loader2, Check } from "lucide-react";
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
	duration: number;
	onExport: (overwrite: boolean) => Promise<void>;
	onReset?: () => void; // Callback to reset export result
	isExporting?: boolean;
	exportResult?: {
		shareUrl: string;
		audioUrl: string;
		exportId: string;
	} | null;
	exportError?: string | null;
}

export function ExportDialog({
	open,
	onOpenChange,
	projectId: _projectId, // eslint-disable-line @typescript-eslint/no-unused-vars -- Will be used for the actual export API call
	duration,
	onExport,
	onReset,
	isExporting = false,
	exportResult = null,
	exportError = null,
}: ExportDialogProps) {
	const [overwrite, setOverwrite] = useState(false);
	const [copied, setCopied] = useState(false);

	// Reset copy state when dialog opens/closes
	useEffect(() => {
		if (!open) {
			setCopied(false);
		}
	}, [open]);

	const handleExport = async () => {
		await onExport(overwrite);
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
		setOverwrite(false);
		// Reset export state when closing
		onReset?.();
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Export Audio</DialogTitle>
					<DialogDescription>
						Export your composition as a WAV file ({duration.toFixed(1)}s)
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{!exportResult && !isExporting && (
						<div className="flex items-center space-x-2">
							<input
								type="checkbox"
								id="overwrite"
								checked={overwrite}
								onChange={(e) => setOverwrite(e.target.checked)}
								className="w-4 h-4 rounded border-gray-300"
							/>
							<label
								htmlFor="overwrite"
								className="text-sm font-medium leading-none cursor-pointer"
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
