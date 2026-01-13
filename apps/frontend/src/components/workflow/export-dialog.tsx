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

interface ExportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string; // Will be used for the actual export API call
	duration: number;
	onExport: (overwrite: boolean) => Promise<void>;
	isExporting?: boolean;
	exportResult?: {
		shareUrl: string;
		audioUrl: string;
	} | null;
}

export function ExportDialog({
	open,
	onOpenChange,
	projectId: _projectId, // eslint-disable-line @typescript-eslint/no-unused-vars -- Will be used for the actual export API call
	duration,
	onExport,
	isExporting = false,
	exportResult = null,
}: ExportDialogProps) {
	const [overwrite, setOverwrite] = useState(false);

	const handleExport = async () => {
		await onExport(overwrite);
	};

	const handleCopyLink = async () => {
		if (exportResult?.shareUrl) {
			await navigator.clipboard.writeText(exportResult.shareUrl);
		}
	};

	const handleClose = () => {
		onOpenChange(false);
		setOverwrite(false);
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

					{exportResult && (
						<div className="space-y-3">
							<div className="flex items-center gap-2 text-sm text-green-600">
								✓ Export complete!
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={handleCopyLink}
									className="flex-1"
								>
									<Link2 className="h-4 w-4 mr-2" />
									Copy link
								</Button>
								<Button
									variant="outline"
									onClick={() => window.open(exportResult.audioUrl, "_blank")}
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
