import { useSessionQuery } from "@/hooks/api/session";
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

function AvatarSkeleton() {
	return (
		<div className="relative h-10 w-10 rounded-full bg-muted animate-pulse" />
	);
}

export default function UserMenu({ sessionReady }: { sessionReady: boolean }) {
	const { data: sessionData, isLoading } = useSessionQuery(sessionReady);

	const user = sessionData?.user;

	if (isLoading) {
		return <AvatarSkeleton />;
	}

	if (!user) {
		return null;
	}

	const isAnonymous = user.email?.startsWith("temp-");

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
					{isAnonymous && (
						<span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
							G
						</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel>
					<div className="flex flex-col space-y-1">
						<p className="text-sm font-medium leading-none">{user.name || "Guest User"}</p>
						<p className="text-xs leading-none text-muted-foreground">
							{isAnonymous ? "Guest session" : user.email}
						</p>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{isAnonymous ? (
				<>
					<DropdownMenuItem onClick={signInWithGoogle}>
						<UserPlus className="mr-2 h-4 w-4" />
						Sign In with Google
					</DropdownMenuItem>
					<DropdownMenuItem onClick={signInWithGithub}>
						<Github className="mr-2 h-4 w-4" />
						Sign In with GitHub
					</DropdownMenuItem>
				</>
				) : (
					<DropdownMenuItem>
						<Settings2 className="mr-2 h-4 w-4" />
						Settings
					</DropdownMenuItem>
				)}
				{!isAnonymous && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={signOut}>
							<LogOut className="mr-2 h-4 w-4" />
							Sign Out
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
