import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { Play, Pause, Download, Home, Loader2, Check, Copy } from "lucide-react";
import { Button } from "./ui/button";

export function SharedAudioPage() {
	const { exportId } = useParams({ from: "/audio/$exportId" });
	const audioRef = useRef<HTMLAudioElement>(null);
	const audioUrlRef = useRef<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [duration, setDuration] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [levels, setLevels] = useState<number[]>([]);
	const [copied, setCopied] = useState(false);

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

				const blob = await response.blob();
				const url = URL.createObjectURL(blob);
				audioUrlRef.current = url;
				setAudioUrl(url);
				const arrayBuffer = await blob.arrayBuffer();
				const ctx = new AudioContext();
				const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
				const channelData =
					audioBuffer.numberOfChannels > 0
						? audioBuffer.getChannelData(0)
						: new Float32Array();
				const bars = 64;
				const samplesPerBar = Math.max(
					1,
					Math.floor(channelData.length / bars),
				);
				const peaks = Array.from({ length: bars }, (_, index) => {
					const start = index * samplesPerBar;
					const end = Math.min(channelData.length, start + samplesPerBar);
					let peak = 0;
					for (let i = start; i < end; i += 1) {
						const value = Math.abs(channelData[i] ?? 0);
						if (value > peak) peak = value;
					}
					return Math.min(1, peak * 3);
				});
				setLevels(peaks);
				ctx.close().catch(() => undefined);
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

	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (error) {
			console.error("Failed to copy link:", error);
		}
	};

	const formatTime = (time: number) => {
		if (!Number.isFinite(time)) return "0:00";
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
									onLoadedMetadata={() => {
										setDuration(audioRef.current?.duration ?? 0);
									}}
									onTimeUpdate={() => {
										setCurrentTime(audioRef.current?.currentTime ?? 0);
									}}
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

								<div className="rounded-md border bg-muted/30 p-3 relative overflow-hidden">
									<div
										className={`absolute top-2 bottom-2 w-0.5 bg-primary/80 shadow-[0_0_8px_rgba(59,130,246,0.6)] transition-[left] duration-150 ${
											isPlaying ? "animate-pulse" : ""
										}`}
										style={{
											left: duration
												? `${Math.min(100, (currentTime / duration) * 100)}%`
												: "0%",
										}}
									/>
									<div className="flex h-16 items-end gap-1">
										{(levels.length ? levels : new Array(64).fill(0.05)).map(
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

								<div className="space-y-2">
									<input
										type="range"
										min={0}
										max={duration || 0}
										step={0.01}
										value={Math.min(currentTime, duration || 0)}
										onChange={(event) => {
											const nextTime = Number(event.target.value);
											if (audioRef.current) {
												audioRef.current.currentTime = nextTime;
											}
											setCurrentTime(nextTime);
										}}
										className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
									/>
									<div className="flex justify-between text-xs text-muted-foreground">
										<span>{formatTime(currentTime)}</span>
										<span>{formatTime(duration)}</span>
									</div>
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
										onClick={handleCopyLink}
										className="flex-1"
									>
										{copied ? (
											<>
												<Check className="h-4 w-4 mr-2 text-green-600" />
												<span className="text-green-600">Copied!</span>
											</>
										) : (
											<>
												<Copy className="h-4 w-4 mr-2" />
												Copy Link
											</>
										)}
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
