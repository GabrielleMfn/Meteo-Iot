<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let events = $state([]);
	let buttonCounts = $state({});
	let lastEvent = $state(null);
	let wsConnected = $state(false);
	let theme = $state('system');

	const MAX_EVENTS = 20;

	onMount(() => {
		// charger le theme sauvegarde
		const savedTheme = localStorage.getItem('theme') || 'system';
		theme = savedTheme;
		applyTheme(savedTheme);

		const ws = new WebSocket('ws://localhost:8080');

		ws.onopen = () => {
			console.log('WS flipper connecte');
			wsConnected = true;
		};

		ws.onclose = () => {
			wsConnected = false;
		};

		ws.onmessage = (event) => {
			try {
				const payload = JSON.parse(event.data);
				handleMessage(payload);
			} catch (e) {
				console.error('Parse error:', e);
			}
		};

		// ecoute les changements de preference systeme
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		mediaQuery.addEventListener('change', () => {
			if (theme === 'system') applyTheme('system');
		});

		return () => ws.close();
	});

	function applyTheme(t) {
		if (!browser) return;
		let isDark = t === 'dark';
		if (t === 'system') {
			isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		}
		document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
		localStorage.setItem('theme', t);
	}

	function setTheme(t) {
		theme = t;
		applyTheme(t);
	}

	function handleMessage(payload) {
		const parts = payload.topic.split('/');
		if (parts[0] !== 'flipper') return;

		const deviceId = parts[1] || 'unknown';
		const action = parts[2] || 'unknown';

		let data;
		let displayValue;
		
		try {
			data = JSON.parse(payload.data);
			// extraire une valeur lisible du payload
			if (typeof data === 'object' && data !== null) {
				// chercher des champs communs
				displayValue = data.value ?? data.button ?? data.state ?? data.count ?? JSON.stringify(data).substring(0, 50);
			} else {
				displayValue = String(data);
			}
		} catch {
			// si c'est pas du JSON, on prend comme valeur brute
			displayValue = payload.data;
			data = { raw: payload.data };
		}

		const eventObj = {
			id: Date.now() + Math.random(),
			deviceId,
			action,
			value: displayValue,
			timestamp: payload.timestamp,
			raw: payload.data
		};

		lastEvent = eventObj;
		events = [eventObj, ...events].slice(0, MAX_EVENTS);

		const key = `${deviceId}:${action}`;
		buttonCounts[key] = (buttonCounts[key] || 0) + 1;
	}

	function formatTime(ts) {
		return new Date(ts).toLocaleTimeString('fr-FR');
	}

	function getTotalEvents() {
		return Object.values(buttonCounts).reduce((a, b) => a + b, 0);
	}
</script>

<div class="app">
	<!-- navbar -->
	<nav class="navbar">
		<div class="nav-brand">
			<div class="logo">
				<span class="logo-icon">IoT</span>
				<span class="logo-text">Meteo</span>
			</div>
		</div>
		
		<div class="nav-links">
			<a href="/" class="nav-link">Dashboard</a>
			<a href="/flipper" class="nav-link active">Flipper</a>
		</div>

		<div class="nav-actions">
			<div class="connection-status" class:online={wsConnected}>
				<span class="status-dot"></span>
				<span class="status-text">{wsConnected ? 'Live' : 'Offline'}</span>
			</div>
			
			<div class="theme-switcher">
				<button 
					class="theme-btn" 
					class:active={theme === 'light'} 
					onclick={() => setTheme('light')}
					title="Mode clair"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="5"/>
						<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
					</svg>
				</button>
				<button 
					class="theme-btn" 
					class:active={theme === 'dark'} 
					onclick={() => setTheme('dark')}
					title="Mode sombre"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
					</svg>
				</button>
				<button 
					class="theme-btn" 
					class:active={theme === 'system'} 
					onclick={() => setTheme('system')}
					title="Systeme"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
						<line x1="8" y1="21" x2="16" y2="21"/>
						<line x1="12" y1="17" x2="12" y2="21"/>
					</svg>
				</button>
			</div>
		</div>
	</nav>

	<main>
		<!-- hero section -->
		<section class="hero">
			<div class="hero-content">
				<h1>
					<span class="gradient-text">Flipper</span> Events
				</h1>
				<p class="hero-subtitle">Interface Pinball en temps reel</p>
			</div>
			<div class="hero-stats">
				<div class="stat-card">
					<span class="stat-value">{getTotalEvents()}</span>
					<span class="stat-label">Total Events</span>
				</div>
				<div class="stat-card">
					<span class="stat-value">{Object.keys(buttonCounts).length}</span>
					<span class="stat-label">Boutons</span>
				</div>
				<div class="stat-card highlight">
					<span class="stat-value">{events.length}</span>
					<span class="stat-label">Timeline</span>
				</div>
			</div>
		</section>

		<!-- dernier event - grosse carte -->
		<section class="last-event-section">
			<div class="section-header">
				<h2>Dernier Event</h2>
			</div>
			{#if lastEvent}
				<div class="big-event-card">
					<div class="event-glow"></div>
					<div class="event-content">
						<div class="event-action">{lastEvent.action}</div>
						<div class="event-value">{lastEvent.value}</div>
						<div class="event-meta">
							<span class="device-badge">{lastEvent.deviceId}</span>
							<span class="time-badge">{formatTime(lastEvent.timestamp)}</span>
						</div>
					</div>
				</div>
			{:else}
				<div class="empty-state small">
					<p>En attente d'events flipper...</p>
				</div>
			{/if}
		</section>

		<!-- compteurs par bouton -->
		<section class="counters-section">
			<div class="section-header">
				<h2>Compteurs par bouton</h2>
				<span class="badge">{Object.keys(buttonCounts).length} actifs</span>
			</div>
			<div class="counters-grid">
				{#each Object.entries(buttonCounts) as [key, count]}
					{@const [device, action] = key.split(':')}
					<div class="counter-card">
						<div class="counter-value">{count}</div>
						<div class="counter-action">{action}</div>
						<div class="counter-device">{device}</div>
					</div>
				{/each}
			</div>
			{#if Object.keys(buttonCounts).length === 0}
				<div class="empty-state small">
					<p>Aucun compteur</p>
				</div>
			{/if}
		</section>

		<!-- timeline -->
		<section class="timeline-section">
			<div class="section-header">
				<h2>Timeline</h2>
				<span class="badge">{events.length} / {MAX_EVENTS}</span>
			</div>
			<div class="timeline-container">
				{#each events as event (event.id)}
					<div class="timeline-item">
						<div class="timeline-dot"></div>
						<div class="timeline-content">
							<div class="timeline-header">
								<span class="timeline-action">{event.action}</span>
								<span class="timeline-time">{formatTime(event.timestamp)}</span>
							</div>
							<div class="timeline-body">
								<span class="timeline-value">{event.value}</span>
								<span class="timeline-device">{event.deviceId}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
			{#if events.length === 0}
				<div class="empty-state">
					<p>Aucun event dans la timeline</p>
				</div>
			{/if}
		</section>

		<!-- payload info -->
		<section class="info-section">
			<div class="section-header">
				<h2>Payload observe</h2>
			</div>
			<div class="info-card">
				<div class="info-row">
					<span class="info-label">Topics</span>
					<code>flipper/&lt;deviceId&gt;/&lt;action&gt;</code>
				</div>
				<div class="info-row">
					<span class="info-label">Actions</span>
					<span>button, tilt, plunger, value...</span>
				</div>
				<div class="info-row">
					<span class="info-label">Format</span>
					<span>JSON ou valeur brute</span>
				</div>
				{#if lastEvent}
					<div class="info-row">
						<span class="info-label">Exemple raw</span>
						<code class="raw-code">{lastEvent.raw.substring(0, 100)}{lastEvent.raw.length > 100 ? '...' : ''}</code>
					</div>
				{/if}
			</div>
		</section>
	</main>

	<footer>
		<p>IoT Meteo Dashboard - TP Svelte MQTT</p>
	</footer>
</div>

<style>
	:root {
		--bg-primary: #0a0a0f;
		--bg-secondary: #12121a;
		--bg-card: rgba(255, 255, 255, 0.03);
		--bg-card-hover: rgba(255, 255, 255, 0.06);
		--text-primary: #ffffff;
		--text-secondary: #a1a1aa;
		--text-muted: #52525b;
		--border-color: rgba(255, 255, 255, 0.08);
		--accent-primary: #6366f1;
		--accent-secondary: #8b5cf6;
		--accent-gradient: linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7);
		--success: #22c55e;
		--danger: #ef4444;
		--warning: #f59e0b;
		--glass-bg: rgba(255, 255, 255, 0.05);
		--glass-border: rgba(255, 255, 255, 0.1);
	}

	:global([data-theme="light"]) {
		--bg-primary: #f8fafc;
		--bg-secondary: #ffffff;
		--bg-card: rgba(0, 0, 0, 0.02);
		--bg-card-hover: rgba(0, 0, 0, 0.04);
		--text-primary: #0f172a;
		--text-secondary: #475569;
		--text-muted: #94a3b8;
		--border-color: rgba(0, 0, 0, 0.08);
		--glass-bg: rgba(255, 255, 255, 0.7);
		--glass-border: rgba(0, 0, 0, 0.1);
	}

	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:global(body) {
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: var(--bg-primary);
		color: var(--text-primary);
		min-height: 100vh;
		transition: background 0.3s, color 0.3s;
	}

	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	/* navbar - same as main page */
	.navbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 2rem;
		background: var(--glass-bg);
		backdrop-filter: blur(20px);
		border-bottom: 1px solid var(--glass-border);
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.logo-icon {
		background: var(--accent-gradient);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		font-weight: 800;
		font-size: 1.5rem;
	}

	.logo-text {
		font-weight: 600;
		font-size: 1.25rem;
	}

	.nav-links {
		display: flex;
		gap: 0.5rem;
	}

	.nav-link {
		padding: 0.5rem 1rem;
		border-radius: 8px;
		text-decoration: none;
		color: var(--text-secondary);
		font-weight: 500;
		transition: all 0.2s;
	}

	.nav-link:hover, .nav-link.active {
		color: var(--text-primary);
		background: var(--bg-card-hover);
	}

	.nav-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.connection-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 20px;
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		font-size: 0.85rem;
		color: var(--danger);
	}

	.connection-status.online {
		color: var(--success);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
		animation: pulse 2s infinite;
	}

	.theme-switcher {
		display: flex;
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: 10px;
		padding: 4px;
	}

	.theme-btn {
		padding: 0.5rem;
		border: none;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		border-radius: 6px;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.theme-btn:hover {
		color: var(--text-secondary);
	}

	.theme-btn.active {
		background: var(--accent-gradient);
		color: white;
	}

	/* main */
	main {
		flex: 1;
		max-width: 1000px;
		margin: 0 auto;
		padding: 2rem;
		width: 100%;
	}

	/* hero */
	.hero {
		text-align: center;
		padding: 3rem 0;
	}

	.hero h1 {
		font-size: 3rem;
		font-weight: 800;
		margin-bottom: 0.5rem;
	}

	.gradient-text {
		background: var(--accent-gradient);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.hero-subtitle {
		color: var(--text-secondary);
		font-size: 1.1rem;
	}

	.hero-stats {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-top: 2rem;
		flex-wrap: wrap;
	}

	.stat-card {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		padding: 1.5rem 2rem;
		min-width: 120px;
		transition: all 0.3s;
	}

	.stat-card:hover {
		transform: translateY(-2px);
		border-color: var(--accent-primary);
	}

	.stat-card.highlight {
		background: var(--accent-gradient);
		border: none;
	}

	.stat-card.highlight .stat-value,
	.stat-card.highlight .stat-label {
		color: white;
	}

	.stat-value {
		display: block;
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.stat-label {
		font-size: 0.8rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* sections */
	section {
		margin-bottom: 2rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.section-header h2 {
		font-size: 1.25rem;
		font-weight: 600;
	}

	.badge {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		padding: 0.25rem 0.75rem;
		border-radius: 20px;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	/* big event card */
	.big-event-card {
		position: relative;
		border-radius: 24px;
		overflow: hidden;
	}

	.event-glow {
		position: absolute;
		inset: 0;
		background: var(--accent-gradient);
		animation: glowPulse 3s ease-in-out infinite;
	}

	@keyframes glowPulse {
		0%, 100% { opacity: 0.8; }
		50% { opacity: 1; }
	}

	.event-content {
		position: relative;
		background: var(--bg-secondary);
		margin: 2px;
		border-radius: 22px;
		padding: 3rem;
		text-align: center;
	}

	.event-action {
		font-size: 1rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-bottom: 0.5rem;
	}

	.event-value {
		font-size: 4rem;
		font-weight: 800;
		background: var(--accent-gradient);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin-bottom: 1rem;
		word-break: break-all;
	}

	.event-meta {
		display: flex;
		justify-content: center;
		gap: 1rem;
	}

	.device-badge, .time-badge {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	/* counters grid */
	.counters-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 1rem;
	}

	.counter-card {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		padding: 1.5rem;
		text-align: center;
		transition: all 0.2s;
	}

	.counter-card:hover {
		transform: translateY(-2px);
		border-color: var(--accent-primary);
	}

	.counter-value {
		font-size: 2.5rem;
		font-weight: 800;
		color: var(--success);
	}

	.counter-action {
		font-size: 0.9rem;
		color: var(--text-primary);
		font-weight: 500;
		margin-top: 0.5rem;
	}

	.counter-device {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-family: monospace;
	}

	/* timeline */
	.timeline-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 400px;
		overflow-y: auto;
		padding-right: 0.5rem;
	}

	.timeline-item {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		transition: all 0.2s;
	}

	.timeline-item:hover {
		border-color: var(--accent-primary);
	}

	.timeline-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--accent-gradient);
		flex-shrink: 0;
		margin-top: 4px;
	}

	.timeline-content {
		flex: 1;
	}

	.timeline-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.25rem;
	}

	.timeline-action {
		font-weight: 600;
		color: var(--accent-primary);
	}

	.timeline-time {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.timeline-body {
		display: flex;
		justify-content: space-between;
	}

	.timeline-value {
		color: var(--warning);
		font-weight: 500;
	}

	.timeline-device {
		font-size: 0.8rem;
		color: var(--text-muted);
		font-family: monospace;
	}

	/* info card */
	.info-card {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: 16px;
		padding: 1.5rem;
	}

	.info-row {
		display: flex;
		gap: 1rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border-color);
		align-items: flex-start;
	}

	.info-row:last-child {
		border-bottom: none;
	}

	.info-label {
		font-weight: 500;
		color: var(--text-secondary);
		min-width: 100px;
	}

	code {
		background: var(--bg-card-hover);
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
		font-family: monospace;
		font-size: 0.9rem;
		color: var(--accent-primary);
	}

	.raw-code {
		word-break: break-all;
		display: block;
		max-width: 100%;
	}

	/* empty state */
	.empty-state {
		text-align: center;
		padding: 3rem 2rem;
		background: var(--bg-card);
		border-radius: 16px;
		border: 1px dashed var(--border-color);
		color: var(--text-muted);
	}

	.empty-state.small {
		padding: 2rem;
	}

	/* footer */
	footer {
		text-align: center;
		padding: 2rem;
		color: var(--text-muted);
		font-size: 0.9rem;
		border-top: 1px solid var(--border-color);
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	/* responsive */
	@media (max-width: 768px) {
		.navbar {
			padding: 1rem;
			flex-wrap: wrap;
			gap: 1rem;
		}

		.nav-links {
			order: 3;
			width: 100%;
			justify-content: center;
		}

		.hero h1 {
			font-size: 2rem;
		}

		.event-value {
			font-size: 2.5rem;
		}

		main {
			padding: 1rem;
		}
	}
</style>
