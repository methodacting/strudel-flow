import { Users, Circle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { AwarenessState } from "@/lib/awareness";
import { getUserData } from "@/lib/awareness-utils";
import { cn } from "@/lib/utils";

interface UserPresenceProps {
	remoteUsers: AwarenessState[];
	isConnected: boolean;
}

/**
 * Displays active collaborators in the workflow
 * Shows avatar list with user count
 * Shows subtle connection status when alone
 */
export function UserPresence({
	remoteUsers,
	isConnected,
}: UserPresenceProps) {
	const userCount = remoteUsers.length;

	// When alone, show subtle connection indicator
	if (userCount === 0) {
		if (!isConnected) return null;

		return (
			<div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted text-xs text-muted-foreground">
				<Circle className={cn(
					"w-2 h-2",
					isConnected ? "fill-green-500 text-green-500" : "fill-muted text-muted"
				)} />
				<span>Connected</span>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2">
			{/* User count badge */}
			<div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted text-xs font-medium">
				<Users className="w-3.5 h-3.5 text-muted-foreground" />
				<span className="text-muted-foreground">
					{userCount}
				</span>
			</div>

			{/* Avatar list - show max 3, then +N */}
			<div className="flex -space-x-2">
				{remoteUsers.slice(0, 3).map((user) => {
					const userData = getUserData(user);
					return (
						<div
							key={user.clientId}
							className="relative group"
							title={userData.displayName}
						>
							<Avatar className="h-7 w-7 border-2 border-background">
								<AvatarFallback
									className="text-xs font-medium"
									style={{ backgroundColor: userData.color }}
								>
									{userData.initials}
								</AvatarFallback>
							</Avatar>

							{/* Optional: Show user name on hover */}
							<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-popover text-xs text-popover-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
								{userData.displayName}
							</div>
						</div>
					);
				})}

				{/* Show +N if more than 3 users */}
				{userCount > 3 && (
					<div
						className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground"
						title={`${userCount - 3} more users`}
					>
						+{userCount - 3}
					</div>
				)}
			</div>
		</div>
	);
}
