import { useEffect, useRef, useState } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { AwarenessState } from "@/lib/awareness";
import { getUserData } from "@/lib/awareness-utils";
import { cn } from "@/lib/utils";

interface CursorOverlayProps {
	remoteUsers: AwarenessState[];
	reactFlowInstance: ReactFlowInstance | null;
}

/**
 * Displays remote user cursors on the workflow canvas
 * Each cursor shows as a colored circle with user initials
 */
export function CursorOverlay({
	remoteUsers,
	reactFlowInstance,
}: CursorOverlayProps) {
	const canvasRef = useRef<HTMLDivElement>(null);
	const [cursors, setCursors] = useState<Array<{ user: AwarenessState; x: number; y: number }>>([]);

	// Update cursor positions when remote users change
	useEffect(() => {
		if (!reactFlowInstance) return;

		const cursorsWithData = remoteUsers
			.filter((user) => user.cursor)
			.map((user) => ({
				user,
				// Convert flow coordinates to screen coordinates
				x: (user.cursor?.x ?? 0),
				y: (user.cursor?.y ?? 0),
			}));

		setCursors(cursorsWithData);
	}, [remoteUsers, reactFlowInstance]);

	if (cursors.length === 0) {
		return null;
	}

	return (
		<div
			ref={canvasRef}
			className="absolute inset-0 pointer-events-none overflow-hidden"
			style={{ zIndex: 1000 }}
		>
			{cursors.map(({ user, x, y }) => {
				const userData = getUserData(user);
				return (
					<Cursor
						key={user.clientId}
						x={x}
						y={y}
						color={userData.color}
						initials={userData.initials}
						name={userData.displayName}
					/>
				);
			})}
		</div>
	);
}

interface CursorProps {
	x: number;
	y: number;
	color: string;
	initials: string;
	name: string;
}

/**
 * Individual cursor indicator
 */
function Cursor({ x, y, color, initials, name }: CursorProps) {
	const [showLabel, setShowLabel] = useState(false);

	return (
		<div
			className="absolute transition-transform duration-75 ease-out"
			style={{
				left: x,
				top: y,
				transform: "translate(-50%, -50%)",
			}}
			onMouseEnter={() => setShowLabel(true)}
			onMouseLeave={() => setShowLabel(false)}
		>
			{/* Label shown on hover */}
			{showLabel && (
				<div
					className={cn(
						"absolute left-4 top-0 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap",
						"text-white"
					)}
					style={{
						backgroundColor: color,
						boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
					}}
				>
					{name}
				</div>
			)}

			{/* Cursor circle */}
			<div
				className={cn(
					"rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm",
					"text-white"
				)}
				style={{
					width: 24,
					height: 24,
					backgroundColor: color,
					boxShadow: `0 2px 8px ${color}80`,
					border: "2px solid white",
				}}
			>
				{initials}
			</div>
		</div>
	);
}
