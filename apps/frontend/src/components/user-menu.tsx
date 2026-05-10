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
					<Button variant="secondary" className="h-9 px-3">
						Sign In
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64 p-2">
					<DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Sign in to sync
					</DropdownMenuLabel>
					<div className="px-2 pb-1 text-xs text-muted-foreground">
						Keep your projects and presence in sync.
					</div>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={signInWithGoogle}
						className="mt-1 flex h-10 items-center gap-2 rounded-md px-2 text-sm font-medium"
					>
						<UserPlus className="h-4 w-4 text-muted-foreground" />
						Sign In with Google
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={signInWithGithub}
						className="flex h-10 items-center gap-2 rounded-md px-2 text-sm font-medium"
					>
						<Github className="h-4 w-4 text-muted-foreground" />
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
