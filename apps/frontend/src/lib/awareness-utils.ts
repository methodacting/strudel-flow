import type { AwarenessState } from "./awareness";

/**
 * Generate a consistent color for a user based on their user ID or name
 * Uses HSL color space for good contrast in both light and dark themes
 */
export function getUserColor(user: AwarenessState): string {
	// Use userId if available, otherwise fall back to userName or clientId
	const seed = user.userId ?? user.userName ?? user.clientId.toString();

	// Generate a hash from the seed
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = seed.charCodeAt(i) + ((hash << 5) - hash);
		hash = hash & hash; // Convert to 32bit integer
	}

	// Use HSL with:
	// - Hue: 0-360 (full spectrum, distributed by hash)
	// - Saturation: 60-80% (muted but visible)
	// - Lightness: 45-55% (good contrast in both themes)
	const hue = Math.abs(hash % 360);
	const saturation = 60 + (Math.abs(hash >> 8) % 20); // 60-80%
	const lightness = 45 + (Math.abs(hash >> 16) % 10); // 45-55%

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get user initials from name or ID
 */
export function getUserInitials(user: AwarenessState): string {
	if (user.userName) {
		// Get first letters of each word, max 2
		const parts = user.userName.trim().split(/\s+/);
		if (parts.length >= 2) {
			return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
		}
		return user.userName.slice(0, 2).toUpperCase();
	}

	if (user.userId) {
		// Use first 2 chars of userId
		return user.userId.slice(0, 2).toUpperCase();
	}

	// Fallback to client ID
	return `U${user.clientId % 100}`;
}

/**
 * Get display name for a user
 */
export function getDisplayName(user: AwarenessState): string {
	return user.userName ?? user.userId ?? `User ${user.clientId}`;
}

/**
 * Generate a CSS color string with variable support for theming
 */
export function getUserColorVar(user: AwarenessState): string {
	const color = getUserColor(user);
	return color;
}

/**
 * Cache for user-specific data to avoid recalculating
 */
const userCache = new Map<number, { color: string; initials: string; displayName: string }>();

export function getUserData(user: AwarenessState): {
	color: string;
	initials: string;
	displayName: string;
} {
	// Check cache first
	const cached = userCache.get(user.clientId);
	if (cached) {
		return cached;
	}

	// Generate and cache
	const data = {
		color: getUserColor(user),
		initials: getUserInitials(user),
		displayName: getDisplayName(user),
	};

	userCache.set(user.clientId, data);
	return data;
}

/**
 * Clear the user cache (useful for testing or when users change)
 */
export function clearUserCache(): void {
	userCache.clear();
}
