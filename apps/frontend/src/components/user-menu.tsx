import { signInWithGoogle, signInWithGithub, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/components/ui/avatar";
import {
	UserPlus,
	Settings2,
	LogOut,
	Github,
} from "lucide-react";
import { useSessionContext } from "@/contexts/session-context";

function AvatarSkeleton() {
	return (
		<div className="relative h-10 w-10 rounded-full bg-muted animate-pulse" />
	);
}

export default function UserMenu({ sessionReady }: { sessionReady: boolean }) {
	const { session } = useSessionContext();
	const user = session?.user;

	if (!sessionReady) {
		return <AvatarSkeleton />;
	}

	if (!user) {
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline">Sign In</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuLabel>Sign in to sync</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={signInWithGoogle}>
						<UserPlus className="mr-2 h-4 w-4" />
						Sign In with Google
					</DropdownMenuItem>
					<DropdownMenuItem onClick={signInWithGithub}>
						<Github className="mr-2 h-4 w-4" />
						Sign In with GitHub
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="relative h-10 w-10 rounded-full">
					<Avatar>
						{user.image ? (
							<AvatarImage src={user.image} alt={user.name || "User avatar"} />
						) : null}
						<AvatarFallback>{user.name?.charAt(0) || "?"}</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel>
					<div className="flex flex-col space-y-1">
						<p className="text-sm font-medium leading-none">{user.name || "Guest User"}</p>
						<p className="text-xs leading-none text-muted-foreground">
							{user.email}
						</p>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem>
					<Settings2 className="mr-2 h-4 w-4" />
					Settings
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={signOut}>
					<LogOut className="mr-2 h-4 w-4" />
					Sign Out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
