export interface AppContext {
	type: 'home' | 'docs' | 'apps' | 'api';
	title?: string;
	key?: string;
	snippet?: string;
}

class UiStore {
	isDark = $state(true);
	isSearchOpen = $state(false);
	isAiOpen = $state(false);
	currentContext = $state<AppContext>({ type: 'home', title: 'Portal Dokumentasi' });
	aiInitialPrompt = $state('');

	constructor() {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('theme');
			if (saved) {
				this.isDark = saved === 'dark';
			} else {
				this.isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			}
			this.applyTheme();
		}
	}

	toggleTheme() {
		this.isDark = !this.isDark;
		if (typeof window !== 'undefined') {
			localStorage.setItem('theme', this.isDark ? 'dark' : 'light');
			this.applyTheme();
		}
	}

	applyTheme() {
		if (typeof document !== 'undefined') {
			if (this.isDark) {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		}
	}

	openSearch() {
		this.isSearchOpen = true;
	}

	closeSearch() {
		this.isSearchOpen = false;
	}

	openAi(initialPrompt?: string, context?: AppContext) {
		if (context) {
			this.currentContext = context;
		}
		if (initialPrompt) {
			this.aiInitialPrompt = initialPrompt;
		}
		this.isAiOpen = true;
	}

	closeAi() {
		this.isAiOpen = false;
	}
}

export const ui = new UiStore();
