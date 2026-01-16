import { useEffect, useMemo, useState } from "react";
import { Ban, Check, Copy, Link, RefreshCw } from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	useCreateInviteMutation,
	useProjectInvitesQuery,
	useRevokeInviteMutation,
	type ProjectInvite,
} from "@/hooks/api/projects";

type InviteRole = "viewer" | "editor";

const roleLabels: Record<InviteRole, string> = {
	viewer: "View-only link",
	editor: "Edit link",
};

const roleHelp: Record<InviteRole, string> = {
	viewer: "Can listen, export, and download. No edits.",
	editor: "Full editing access.",
};

export function ShareUrlPopover({ projectId }: { projectId: string }) {
	const [copiedRole, setCopiedRole] = useState<InviteRole | null>(null);
	const [isPopoverOpen, setIsPopoverOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pendingRole, setPendingRole] = useState<InviteRole | null>(null);
	const createInvite = useCreateInviteMutation();
	const revokeInvite = useRevokeInviteMutation();
	const invitesQuery = useProjectInvitesQuery(projectId, isPopoverOpen);

	const invitesByRole = useMemo(() => {
		const invites = (invitesQuery.data ?? []) as ProjectInvite[];
		const map = new Map<InviteRole, ProjectInvite>();
		for (const invite of invites) {
			if (invite.role === "viewer" || invite.role === "editor") {
				map.set(invite.role, invite);
			}
		}
		return map;
	}, [invitesQuery.data]);

	useEffect(() => {
		if (!isPopoverOpen) {
			setCopiedRole(null);
			setError(null);
		}
	}, [isPopoverOpen]);

	const handleCopyUrl = async (role: InviteRole) => {
		try {
			const invite = invitesByRole.get(role);
			if (!invite?.inviteUrl) return;
			await navigator.clipboard.writeText(invite.inviteUrl);
			setCopiedRole(role);

			setTimeout(() => {
				setCopiedRole((current) => (current === role ? null : current));
			}, 2000);
		} catch (error) {
			console.error("Failed to copy URL:", error);
		}
	};

	const handleRotate = async (role: InviteRole) => {
		setError(null);
		setPendingRole(role);
		try {
			await createInvite.mutateAsync({ projectId, role });
			await invitesQuery.refetch();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create link.");
		} finally {
			setPendingRole(null);
		}
	};

	const handleRevoke = async (role: InviteRole) => {
		setError(null);
		setPendingRole(role);
		try {
			await revokeInvite.mutateAsync({ projectId, role });
			await invitesQuery.refetch();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to revoke link.");
		} finally {
			setPendingRole(null);
		}
	};

	return (
		<Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
			<PopoverTrigger asChild>
				<Button size="sm" variant="secondary" className="min-w-[120px]">
					<Link className="mr-2 h-4 w-4" />
					Share
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-96" align="end">
				<div className="space-y-3">
					<div>
						<h4 className="font-medium text-sm mb-2">Share Project</h4>
						<p className="text-xs text-muted-foreground mb-3">
							Create view or edit links. Each link expires after 24 hours.
						</p>
					</div>

					{(["viewer", "editor"] as InviteRole[]).map((role) => {
						const invite = invitesByRole.get(role);
						const isPending = pendingRole === role;
						const isCopied = copiedRole === role;

						return (
							<div
								key={role}
								className="space-y-2 rounded-lg border bg-muted/30 p-3"
							>
								<div>
									<div className="text-xs font-medium">{roleLabels[role]}</div>
									<div className="text-xs text-muted-foreground">
										{roleHelp[role]}
									</div>
								</div>
								<div className="flex gap-2">
									<Input
										value={invite?.inviteUrl ?? "No active link"}
										readOnly
										className="text-xs font-mono"
										onClick={(e) => e.currentTarget.select()}
									/>
									<Button
										size="sm"
										onClick={() => handleCopyUrl(role)}
										className={`shrink-0 ${isCopied ? "bg-primary" : ""}`}
										disabled={!invite?.inviteUrl || isPending}
									>
										{isCopied ? (
											<>
												<Check className="w-4 h-4 mr-1" />
												Copied!
											</>
										) : (
											<>
												<Copy className="w-4 h-4 mr-1" />
												Copy
											</>
										)}
									</Button>
								</div>
								<div className="flex gap-2">
									<Button
										variant="secondary"
										size="sm"
										onClick={() => handleRotate(role)}
										disabled={isPending}
									>
										<RefreshCw className="mr-2 h-4 w-4" />
										{invite ? "Rotate link" : "Generate link"}
									</Button>
									{invite && (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleRevoke(role)}
											disabled={isPending}
										>
											<Ban className="mr-2 h-4 w-4" />
											Revoke
										</Button>
									)}
								</div>
							</div>
						);
					})}

					{error && <p className="text-xs text-destructive">{error}</p>}
				</div>
			</PopoverContent>
		</Popover>
	);
}
