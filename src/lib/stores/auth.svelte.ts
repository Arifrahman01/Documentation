const PERMANENT_STORAGE_KEY = 'portal_permanent_user';
const PERMANENT_COOKIE_SECONDS = 315360000; // 10 years

class AuthStore {
	userName = $state<string | null>(null);
	isAuthenticated = $derived(Boolean(this.userName && this.userName.trim()));

	init(initialName?: string | null) {
		if (initialName && initialName.trim()) {
			this.userName = initialName.trim();
			this.persistLocal(this.userName);
			return;
		}

		// If server explicitly passed null, verify browser cookie directly
		if (typeof document !== 'undefined') {
			const cookieUser = this.readCookieUser();
			if (cookieUser) {
				this.userName = cookieUser;
				this.persistLocal(cookieUser);
				return;
			}
		}

		// No active session cookie from Helpdesk -> clear stale local state
		this.userName = null;
		if (typeof window !== 'undefined') {
			try {
				localStorage.removeItem(PERMANENT_STORAGE_KEY);
			} catch (_) {}
		}
	}

	private readCookieUser(): string | null {
		if (typeof document === 'undefined') return null;
		const match = document.cookie.match(/(?:^|;\s*)user_name=([^;]+)/);
		if (!match) return null;
		try {
			const decoded = decodeURIComponent(match[1]);
			if (decoded && decoded.trim()) {
				return decoded.trim();
			}
		} catch {
			if (match[1] && match[1].trim()) {
				return match[1].trim();
			}
		}
		return null;
	}

	refresh() {
		if (typeof document === 'undefined') return;

		const cookieUser = this.readCookieUser();
		if (cookieUser) {
			this.userName = cookieUser;
			this.persistLocal(cookieUser);
			return;
		}

		this.userName = null;
	}

	/**
	 * Permanently set or update current username across localStorage & cookies
	 */
	setPermanentUser(name: string) {
		const clean = (name || '').trim();
		if (!clean) return;

		this.userName = clean;
		this.persistLocal(clean);
		this.writePermanentCookie(clean);
		this.syncServerSession(clean);
	}

	private persistLocal(name: string) {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(PERMANENT_STORAGE_KEY, name);
		} catch (_) {}
	}

	private writePermanentCookie(name: string) {
		if (typeof document === 'undefined') return;
		try {
			const encoded = encodeURIComponent(name);
			const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
			document.cookie = `user_name=${encoded}; path=/; max-age=${PERMANENT_COOKIE_SECONDS}; SameSite=Lax${secureFlag}`;
		} catch (_) {}
	}

	private syncServerSession(name: string) {
		if (typeof fetch === 'undefined') return;
		fetch('/api/auth/session', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userName: name })
		}).catch(() => {});
	}
}

export const auth = new AuthStore();
