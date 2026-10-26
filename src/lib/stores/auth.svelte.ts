class AuthStore {
	userName = $state<string | null>(null);

	init(initialName?: string | null) {
		if (initialName) {
			this.userName = initialName;
			return;
		}
		if (typeof document !== 'undefined') {
			this.refresh();
		}
		if (!this.userName && typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
			this.userName = 'Arif Rahman';
		}
	}

	refresh() {
		if (typeof document === 'undefined') return;
		const match = document.cookie.match(/(?:^|;\s*)user_name=([^;]+)/);
		if (match) {
			try {
				this.userName = decodeURIComponent(match[1]);
			} catch {
				this.userName = match[1];
			}
		} else if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
			this.userName = 'Arif Rahman';
		} else {
			this.userName = null;
		}
	}
}

export const auth = new AuthStore();
