<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	// mapping deviceId -> nom de lieu
	const DEVICE_NAMES = {
		'esp32-01': 'Salle A101',
		'esp32-02': 'Salle B202',
		'esp32-03': 'Hall Principal',
		'esp32-04': 'Cafeteria',
		'esp32-05': 'Bibliotheque',
	};

	// stockage des stations par deviceId
	let stations = $state({});
	let wsConnected = $state(false);
	let filterText = $state('');
	let theme = $state('system');

	// seuil pour considerer une station offline (30 sec sans update)
	const OFFLINE_THRESHOLD = 30000;
	let now = $state(Date.now());

	onMount(() => {
		// charger le theme sauvegarde
		const savedTheme = localStorage.getItem('theme') || 'system';
		theme = savedTheme;
		applyTheme(savedTheme);

		// connexion WebSocket au bridge
		const ws = new WebSocket('ws://localhost:8080');

		ws.onopen = () => {
			console.log('WS connecte');
			wsConnected = true;
		};

		ws.onclose = () => {
			console.log('WS deconnecte');
			wsConnected = false;
		};

		ws.onerror = (err) => {
			console.error('Erreur WS:', err);
		};

		ws.onmessage = (event) => {
			try {
				const payload = JSON.parse(event.data);
				handleMessage(payload);
			} catch (e) {
				console.error('Parse error:', e);
			}
		};

		// update du timestamp toutes les secondes
		const interval = setInterval(() => {
			now = Date.now();
		}, 1000);

		// ecouter les changements de preference systeme
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		mediaQuery.addEventListener('change', () => {
			if (theme === 'system') applyTheme('system');
		});

		return () => {
			ws.close();
			clearInterval(interval);
		};
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
		if (parts[0] !== 'classroom' || parts.length < 3) return;

		const deviceId = parts[1];
		const topicType = parts[2];

		if (topicType === 'telemetry') {
			let data;
			try {
				data = JSON.parse(payload.data);
			} catch {
				console.warn('Data pas JSON:', payload.data);
				return;
			}

			stations[deviceId] = {
				deviceId,
				name: DEVICE_NAMES[deviceId] || deviceId,
				temperature: data.tempC ?? data.temperature ?? data.temp ?? null,
				humidity: data.humPct ?? data.humidity ?? data.hum ?? null,
				battery: data.batteryPct ?? data.battery ?? data.bat ?? null,
				lastUpdate: payload.timestamp
			};
		}
	}

	function isOnline(lastUpdate) {
		return (now - lastUpdate) < OFFLINE_THRESHOLD;
	}

	function getFilteredStations() {
		const list = Object.values(stations);
		if (!filterText.trim()) return list;
		const search = filterText.toLowerCase();
		return list.filter(s => 
			s.name.toLowerCase().includes(search) || 
			s.deviceId.toLowerCase().includes(search)
		);
	}

	function getAverages() {
		const list = Object.values(stations);
		if (list.length === 0) return { temp: null, hum: null };
		
		let tempSum = 0, tempCount = 0;
		let humSum = 0, humCount = 0;
		
		list.forEach(s => {
			if (s.temperature !== null) { tempSum += s.temperature; tempCount++; }
			if (s.humidity !== null) { humSum += s.humidity; humCount++; }
		});
		
		return {
			temp: tempCount > 0 ? (tempSum / tempCount).toFixed(1) : null,
			hum: humCount > 0 ? (humSum / humCount).toFixed(0) : null
		};
	}

	function timeAgo(timestamp) {
		const diff = now - timestamp;
		if (diff < 1000) return "a l'instant";
		if (diff < 60000) return Math.floor(diff / 1000) + 's';
		if (diff < 3600000) return Math.floor(diff / 60000) + 'min';
		return Math.floor(diff / 3600000) + 'h';
	}

	function getOnlineCount() {
		return Object.values(stations).filter(s => isOnline(s.lastUpdate)).length;
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
			<a href="/" class="nav-link active">Dashboard</a>
			<a href="/flipper" class="nav-link">Flipper</a>
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
					<span class="gradient-text">Dashboard</span> Meteo
				</h1>
				<p class="hero-subtitle">Surveillance en temps reel des stations IoT</p>
			</div>
			<div class="hero-stats">
				<div class="stat-card">
					<span class="stat-value">{Object.keys(stations).length}</span>
					<span class="stat-label">Stations</span>
				</div>
				<div class="stat-card">
					<span class="stat-value">{getOnlineCount()}</span>
					<span class="stat-label">En ligne</span>
				</div>
				{#if Object.keys(stations).length > 0}
					{@const avg = getAverages()}
					<div class="stat-card highlight">
						<span class="stat-value">{avg.temp ?? '-'}C</span>
						<span class="stat-label">Temp. moy.</span>
					</div>
					<div class="stat-card">
						<span class="stat-value">{avg.hum ?? '-'}%</span>
						<span class="stat-label">Hum. moy.</span>
					</div>
				{/if}
			</div>
		</section>

		<!-- search bar -->
		<div class="search-section">
			<div class="search-wrapper">
				<svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="11" cy="11" r="8"/>
					<path d="m21 21-4.35-4.35"/>
				</svg>
				<input 
					type="text" 
					placeholder="Rechercher une station..." 
					bind:value={filterText}
					class="search-input"
				/>
			</div>
		</div>

		<!-- stations grid -->
		<section class="stations-section">
			<div class="section-header">
				<h2>Stations Actives</h2>
				<span class="badge">{getFilteredStations().length} resultats</span>
			</div>
			
			<div class="grid">
				{#each getFilteredStations() as station (station.deviceId)}
					{@const online = isOnline(station.lastUpdate)}
					<div class="station-card" class:offline={!online}>
						<div class="card-glow"></div>
						<div class="card-content">
							<div class="card-header">
								<div class="station-info">
									<h3>{station.name}</h3>
									<span class="device-id">{station.deviceId}</span>
								</div>
								<div class="status-indicator" class:online={online}>
									<span class="pulse"></span>
									{online ? 'Online' : 'Offline'}
								</div>
							</div>
							
							<div class="metrics">
								<div class="metric temperature">
									<div class="metric-header">
										<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
										</svg>
										<span>Temperature</span>
									</div>
									<div class="metric-value">
										{station.temperature !== null ? station.temperature.toFixed(1) : '-'}
										<span class="unit">C</span>
									</div>
								</div>
								
								<div class="metric humidity">
									<div class="metric-header">
										<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
										</svg>
										<span>Humidite</span>
									</div>
									<div class="metric-value">
										{station.humidity !== null ? station.humidity.toFixed(0) : '-'}
										<span class="unit">%</span>
									</div>
								</div>
								
								<div class="metric battery">
									<div class="metric-header">
										<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<rect x="1" y="6" width="18" height="12" rx="2" ry="2"/>
											<line x1="23" y1="13" x2="23" y2="11"/>
										</svg>
										<span>Batterie</span>
									</div>
									<div class="metric-value">
										{station.battery !== null ? station.battery : '-'}
										<span class="unit">%</span>
									</div>
								</div>
							</div>
							
							<div class="card-footer">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"/>
									<polyline points="12 6 12 12 16 14"/>
								</svg>
								Mis a jour {timeAgo(station.lastUpdate)}
							</div>
						</div>
					</div>
				{/each}
			</div>

			{#if Object.keys(stations).length === 0}
				<div class="empty-state">
					<div class="empty-icon">
						<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
						</svg>
					</div>
					<h3>En attente des donnees...</h3>
					<p>Verifie que le bridge est lance avec <code>node server.js</code></p>
				</div>
			{/if}
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

	/* navbar */
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

	/* main content */
	main {
		flex: 1;
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
		width: 100%;
	}

	/* hero section */
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

	/* search section */
	.search-section {
		margin: 2rem 0;
	}

	.search-wrapper {
		position: relative;
		max-width: 500px;
		margin: 0 auto;
	}

	.search-icon {
		position: absolute;
		left: 1rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
	}

	.search-input {
		width: 100%;
		padding: 1rem 1rem 1rem 3rem;
		border: 1px solid var(--border-color);
		border-radius: 12px;
		background: var(--bg-card);
		color: var(--text-primary);
		font-size: 1rem;
		transition: all 0.2s;
	}

	.search-input::placeholder {
		color: var(--text-muted);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
	}

	/* stations section */
	.stations-section {
		margin-top: 2rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.section-header h2 {
		font-size: 1.5rem;
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

	/* grid */
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.5rem;
	}

	/* station card */
	.station-card {
		position: relative;
		border-radius: 20px;
		overflow: hidden;
		transition: all 0.3s;
	}

	.station-card:hover {
		transform: translateY(-4px);
	}

	.station-card:hover .card-glow {
		opacity: 1;
	}

	.card-glow {
		position: absolute;
		inset: 0;
		background: var(--accent-gradient);
		opacity: 0;
		transition: opacity 0.3s;
		z-index: 0;
	}

	.card-content {
		position: relative;
		z-index: 1;
		background: var(--bg-secondary);
		margin: 1px;
		border-radius: 19px;
		padding: 1.5rem;
	}

	.station-card.offline {
		opacity: 0.6;
	}

	.station-card.offline .card-glow {
		background: linear-gradient(135deg, var(--danger), #991b1b);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
	}

	.station-info h3 {
		font-size: 1.1rem;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.device-id {
		font-size: 0.8rem;
		color: var(--text-muted);
		font-family: monospace;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--danger);
		background: rgba(239, 68, 68, 0.1);
		padding: 0.35rem 0.75rem;
		border-radius: 20px;
	}

	.status-indicator.online {
		color: var(--success);
		background: rgba(34, 197, 94, 0.1);
	}

	.pulse {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
	}

	.status-indicator.online .pulse {
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	/* metrics */
	.metrics {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.metric {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: var(--bg-card);
		border-radius: 12px;
		border: 1px solid var(--border-color);
	}

	.metric-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.metric-header svg {
		opacity: 0.7;
	}

	.metric.temperature .metric-header svg { color: #f59e0b; }
	.metric.humidity .metric-header svg { color: #3b82f6; }
	.metric.battery .metric-header svg { color: #22c55e; }

	.metric-value {
		font-size: 1.5rem;
		font-weight: 700;
	}

	.unit {
		font-size: 0.9rem;
		font-weight: 400;
		color: var(--text-muted);
	}

	/* card footer */
	.card-footer {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	/* empty state */
	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: var(--bg-card);
		border-radius: 20px;
		border: 1px dashed var(--border-color);
	}

	.empty-icon {
		color: var(--text-muted);
		margin-bottom: 1rem;
	}

	.empty-state h3 {
		font-size: 1.25rem;
		margin-bottom: 0.5rem;
	}

	.empty-state p {
		color: var(--text-muted);
	}

	.empty-state code {
		background: var(--bg-card-hover);
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
		font-size: 0.9rem;
	}

	/* footer */
	footer {
		text-align: center;
		padding: 2rem;
		color: var(--text-muted);
		font-size: 0.9rem;
		border-top: 1px solid var(--border-color);
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

		.hero-stats {
			gap: 0.75rem;
		}

		.stat-card {
			padding: 1rem 1.5rem;
		}

		main {
			padding: 1rem;
		}

		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
