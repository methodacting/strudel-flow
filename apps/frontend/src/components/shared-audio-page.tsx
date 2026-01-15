import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { Play, Pause, Download, Home, Loader2 } from "lucide-react";
import { Button } from "./ui/button";

export function SharedAudioPage() {
	const { exportId } = useParams({ from: "/audio/$exportId" });
	const audioRef = useRef<HTMLAudioElement>(null);
	const audioUrlRef = useRef<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);

	useEffect(() => {
		const fetchAudio = async () => {
			setIsLoading(true);
			setError(null);
			try {
				// Fetch the audio file from the API
				const response = await fetch(`/api/audio/${exportId}`);
				if (!response.ok) {
					if (response.status === 404) {
						throw new Error("Audio not found");
					}
					throw new Error("Failed to load audio");
				}

				// Create a blob URL for the audio
				const blob = await response.blob();
				const url = URL.createObjectURL(blob);
				audioUrlRef.current = url;
				setAudioUrl(url);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load audio");
			} finally {
				setIsLoading(false);
			}
		};

		fetchAudio();

		// Cleanup blob URL on unmount
		return () => {
			if (audioUrlRef.current) {
				URL.revokeObjectURL(audioUrlRef.current);
			}
		};
	}, [exportId]);

	const togglePlayPause = () => {
		if (audioRef.current) {
			if (isPlaying) {
				audioRef.current.pause();
			} else {
				audioRef.current.play();
			}
			setIsPlaying(!isPlaying);
		}
	};

	const handleDownload = () => {
		if (audioUrl) {
			const a = document.createElement("a");
			a.href = audioUrl;
			a.download = `strudel-export-${exportId}.wav`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6">
			<div className="w-full max-w-lg">
				{/* Back button */}
				<div className="mb-6">
					<Link to="/">
						<Button variant="ghost" className="gap-2">
							<Home className="h-4 w-4" />
							Back to Strudel Flow
						</Button>
					</Link>
				</div>

				{/* Main card */}
				<div className="bg-card rounded-2xl border shadow-xl overflow-hidden">
					{/* Header */}
					<div className="bg-gradient-to-r from-primary/10 to-primary/5 p-8 border-b">
						<div className="text-center">
							<div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4">
								<span className="text-3xl">🎵</span>
							</div>
							<h1 className="text-2xl font-bold mb-2">Shared Audio</h1>
							<p className="text-sm text-muted-foreground">
								Export ID: {exportId}
							</p>
						</div>
					</div>

					{/* Content */}
					<div className="p-8">
						{isLoading && (
							<div className="flex items-center justify-center py-12">
								<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								<span className="ml-3 text-muted-foreground">Loading audio...</span>
							</div>
						)}

						{error && (
							<div className="text-center py-12">
								<div className="text-red-500 mb-2">⚠️</div>
								<p className="text-red-600 font-medium mb-4">{error}</p>
								<Link to="/">
									<Button variant="outline">Go Home</Button>
								</Link>
							</div>
						)}

						{audioUrl && !isLoading && (
							<div className="space-y-6">
								{/* Audio element (hidden) */}
								<audio
									ref={audioRef}
									src={audioUrl}
									onPlay={() => setIsPlaying(true)}
									onPause={() => setIsPlaying(false)}
									onEnded={() => setIsPlaying(false)}
								/>

								{/* Play/Pause button */}
								<div className="flex justify-center">
									<Button
										size="lg"
										onClick={togglePlayPause}
										className="w-20 h-20 rounded-full"
									>
										{isPlaying ? (
											<Pause className="h-8 w-8" />
										) : (
											<Play className="h-8 w-8 ml-1" />
										)}
									</Button>
								</div>

								{/* Action buttons */}
								<div className="flex gap-3">
									<Button
										variant="outline"
										onClick={handleDownload}
										className="flex-1"
									>
										<Download className="h-4 w-4 mr-2" />
										Download
									</Button>
									<Button
										variant="outline"
										onClick={() => {
											navigator.clipboard.writeText(window.location.href);
										}}
										className="flex-1"
									>
										Copy Link
									</Button>
								</div>

								{/* Info text */}
								<p className="text-xs text-center text-muted-foreground">
									Shared from Strudel Flow - a live coding music environment
								</p>
							</div>
						)}
					</div>
				</div>

				{/* Footer */}
				<div className="text-center mt-6 text-sm text-muted-foreground">
					Made with{" "}
					<Link to="/" className="text-primary hover:underline">
						Strudel Flow
					</Link>
				</div>
			</div>
		</div>
	);
}
