<script>
	import { onMount } from 'svelte';

	// mapping deviceId -> nom de lieu
	// a adapter selon les vrais deviceId qu'on recoit
	const DEVICE_NAMES = {
		'esp32-01': 'Salle A101',
		'esp32-02': 'Salle B202',
		'esp32-03': 'Hall Principal',
		'esp32-04': 'Cafeteria',
		'esp32-05': 'Bibliotheque',
		// fallback pour les deviceId inconnus
	};

	// stockage des stations par deviceId
	let stations = $state({});
	let wsConnected = $state(false);
	let filterText = $state('');

	// seuil pour considerer une station offline (30 sec sans update)
	const OFFLINE_THRESHOLD = 30000;

	// verification periodique du status online/offline
	let now = $state(Date.now());

	onMount(() => {
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

		// update du timestamp toutes les secondes pour checker online/offline
		const interval = setInterval(() => {
			now = Date.now();
		}, 1000);

		return () => {
			ws.close();
			clearInterval(interval);
		};
	});

	function handleMessage(payload) {
		// extraire le deviceId du topic: classroom/<deviceId>/telemetry
		const parts = payload.topic.split('/');
		if (parts[0] !== 'classroom' || parts.length < 3) return;

		const deviceId = parts[1];
		const topicType = parts[2];

		if (topicType === 'telemetry') {
			let data;
			try {
				data = JSON.parse(payload.data);
			} catch {
				// parfois c'est pas du JSON, on gere
				console.warn('Data pas JSON:', payload.data);
				return;
			}

			// on met a jour la station
			stations[deviceId] = {
				deviceId,
				name: DEVICE_NAMES[deviceId] || deviceId,
				temperature: data.temperature ?? data.temp ?? null,
				humidity: data.humidity ?? data.hum ?? null,
				battery: data.battery ?? data.bat ?? null,
				lastUpdate: payload.timestamp
			};
		}
	}

	// check si une station est online
	function isOnline(lastUpdate) {
		return (now - lastUpdate) < OFFLINE_THRESHOLD;
	}

	// getter pour la liste filtree
	function getFilteredStations() {
		const list = Object.values(stations);
		if (!filterText.trim()) return list;
		const search = filterText.toLowerCase();
		return list.filter(s => 
			s.name.toLowerCase().includes(search) || 
			s.deviceId.toLowerCase().includes(search)
		);
	}

	// calcul des moyennes
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

	// formatage du temps depuis dernier update
	function timeAgo(timestamp) {
		const diff = now - timestamp;
		if (diff < 1000) return "a l'instant";
		if (diff < 60000) return Math.floor(diff / 1000) + 's';
		if (diff < 3600000) return Math.floor(diff / 60000) + 'min';
		return Math.floor(diff / 3600000) + 'h';
	}
</script>

<main>
	<header>
		<h1>IoT Meteo Dashboard</h1>
		<div class="status">
			<span class="dot" class:online={wsConnected}></span>
			{wsConnected ? 'Connecte' : 'Deconnecte'}
		</div>
	</header>

	<!-- moyenne globale -->
	{#if Object.keys(stations).length > 0}
		{@const avg = getAverages()}
		<div class="averages">
			<div class="avg-item">
				<span class="avg-label">Temp. moyenne</span>
				<span class="avg-value">{avg.temp ?? '-'}C</span>
			</div>
			<div class="avg-item">
				<span class="avg-label">Humidite moyenne</span>
				<span class="avg-value">{avg.hum ?? '-'}%</span>
			</div>
			<div class="avg-item">
				<span class="avg-label">Stations</span>
				<span class="avg-value">{Object.keys(stations).length}</span>
			</div>
		</div>
	{/if}

	<!-- filtre -->
	<div class="filter-bar">
		<input 
			type="text" 
			placeholder="Filtrer par lieu ou deviceId..." 
			bind:value={filterText}
		/>
	</div>

	<!-- grille des stations -->
	<div class="grid">
		{#each getFilteredStations() as station (station.deviceId)}
			{@const online = isOnline(station.lastUpdate)}
			<div class="card" class:offline={!online}>
				<div class="card-header">
					<h2>{station.name}</h2>
					<span class="status-badge" class:online={online}>
						{online ? 'Online' : 'Offline'}
					</span>
				</div>
				
				<div class="card-body">
					<div class="metric">
						<span class="metric-icon">T</span>
						<span class="metric-value">
							{station.temperature !== null ? station.temperature.toFixed(1) + 'C' : '-'}
						</span>
						<span class="metric-label">Temperature</span>
					</div>
					
					<div class="metric">
						<span class="metric-icon">H</span>
						<span class="metric-value">
							{station.humidity !== null ? station.humidity.toFixed(0) + '%' : '-'}
						</span>
						<span class="metric-label">Humidite</span>
					</div>
					
					<div class="metric">
						<span class="metric-icon">B</span>
						<span class="metric-value">
							{station.battery !== null ? station.battery + '%' : '-'}
						</span>
						<span class="metric-label">Batterie</span>
					</div>
				</div>
				
				<div class="card-footer">
					Mis a jour: {timeAgo(station.lastUpdate)}
				</div>
			</div>
		{/each}
	</div>

	{#if Object.keys(stations).length === 0}
		<div class="empty">
			<p>En attente des donnees...</p>
			<p class="hint">Verifie que le bridge est lance (node server.js)</p>
		</div>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #0f172a;
		color: #e2e8f0;
		min-height: 100vh;
	}

	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0;
		font-size: 1.8rem;
		color: #f1f5f9;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: #94a3b8;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #ef4444;
	}

	.dot.online {
		background: #22c55e;
	}

	.averages {
		display: flex;
		gap: 1.5rem;
		margin-bottom: 2rem;
		padding: 1rem;
		background: #1e293b;
		border-radius: 12px;
	}

	.avg-item {
		display: flex;
		flex-direction: column;
	}

	.avg-label {
		font-size: 0.75rem;
		color: #64748b;
		text-transform: uppercase;
	}

	.avg-value {
		font-size: 1.5rem;
		font-weight: 600;
		color: #38bdf8;
	}

	.filter-bar {
		margin-bottom: 1.5rem;
	}

	.filter-bar input {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 1px solid #334155;
		border-radius: 8px;
		background: #1e293b;
		color: #e2e8f0;
		font-size: 1rem;
		box-sizing: border-box;
	}

	.filter-bar input::placeholder {
		color: #64748b;
	}

	.filter-bar input:focus {
		outline: none;
		border-color: #38bdf8;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.5rem;
	}

	.card {
		background: #1e293b;
		border-radius: 16px;
		padding: 1.5rem;
		border: 1px solid #334155;
		transition: all 0.2s;
	}

	.card:hover {
		border-color: #38bdf8;
		transform: translateY(-2px);
	}

	.card.offline {
		opacity: 0.6;
		border-color: #ef4444;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
	}

	.card-header h2 {
		margin: 0;
		font-size: 1.1rem;
		color: #f1f5f9;
	}

	.status-badge {
		font-size: 0.7rem;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		background: #ef4444;
		color: white;
		text-transform: uppercase;
		font-weight: 600;
	}

	.status-badge.online {
		background: #22c55e;
	}

	.card-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.metric {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.metric-icon {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #334155;
		border-radius: 8px;
		font-weight: bold;
		color: #38bdf8;
	}

	.metric-value {
		font-size: 1.25rem;
		font-weight: 600;
		min-width: 60px;
	}

	.metric-label {
		color: #64748b;
		font-size: 0.85rem;
	}

	.card-footer {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #334155;
		font-size: 0.8rem;
		color: #64748b;
	}

	.empty {
		text-align: center;
		padding: 4rem 2rem;
		color: #64748b;
	}

	.empty p {
		margin: 0.5rem 0;
	}

	.hint {
		font-size: 0.85rem;
		font-style: italic;
	}
</style>
