import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter({ out: 'build' }),
			alias: {
				$lib: './src/lib',
				'$lib/*': './src/lib/*'
			}
		})
	],
	server: {
		port: 5173,
		proxy: {
			'^/api/': {
				target: 'http://localhost:8088',
				changeOrigin: true
			}
		}
	}
});
