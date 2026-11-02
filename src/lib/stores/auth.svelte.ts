const PERMANENT_STORAGE_KEY = 'portal_permanent_user';
const PERMANENT_COOKIE_SECONDS = 315360000; // 10 years

class AuthStore {
	userName = $state<string>('Arif Rahman');

	init(initialName?: string | null) {
		if (initialName && initialName.trim()) {
			this.userName = initialName.trim();
			this.persistLocal(this.userName);
			return;
		}

		if (typeof window !== 'undefined') {
			// 1. Try reading from permanent localStorage backup
			const localSaved = localStorage.getItem(PERMANENT_STORAGE_KEY);
			if (localSaved && localSaved.trim()) {
				this.userName = localSaved.trim();
				this.writePermanentCookie(this.userName);
				this.syncServerSession(this.userName);
				return;
			}

			// 2. Try reading from cookie
			this.refresh();
		}

		if (!this.userName) {
			this.userName = 'Arif Rahman';
			this.persistLocal(this.userName);
		}
	}

	refresh() {
		if (typeof document === 'undefined') return;

		const match = document.cookie.match(/(?:^|;\s*)user_name=([^;]+)/);
		if (match) {
			try {
				const decoded = decodeURIComponent(match[1]);
				if (decoded && decoded.trim()) {
					this.userName = decoded.trim();
					this.persistLocal(this.userName);
					return;
				}
			} catch {
				if (match[1] && match[1].trim()) {
					this.userName = match[1].trim();
					this.persistLocal(this.userName);
					return;
				}
			}
		}

		// Fallback to localStorage if cookie was cleared
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem(PERMANENT_STORAGE_KEY);
			if (saved && saved.trim()) {
				this.userName = saved.trim();
				this.writePermanentCookie(this.userName);
				this.syncServerSession(this.userName);
				return;
			}
		}

		if (!this.userName) {
			this.userName = 'Arif Rahman';
			this.persistLocal(this.userName);
		}
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
