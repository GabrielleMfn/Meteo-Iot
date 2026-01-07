<script>
	import { onMount } from 'svelte';

	// stockage des events flipper
	let events = $state([]);
	let buttonCounts = $state({});
	let lastEvent = $state(null);
	let wsConnected = $state(false);

	const MAX_EVENTS = 20;

	onMount(() => {
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

		return () => ws.close();
	});

	function handleMessage(payload) {
		// on veut les topics flipper/<deviceId>/<action>
		const parts = payload.topic.split('/');
		if (parts[0] !== 'flipper') return;

		const deviceId = parts[1] || 'unknown';
		const action = parts[2] || 'unknown';

		let data;
		try {
			data = JSON.parse(payload.data);
		} catch {
			// si c'est pas du json, on prend comme valeur brute
			data = { value: payload.data };
		}

		const eventObj = {
			id: Date.now() + Math.random(),
			deviceId,
			action,
			value: data.value ?? data.button ?? data,
			timestamp: payload.timestamp,
			raw: payload.data
		};

		// update dernier event
		lastEvent = eventObj;

		// ajouter a la timeline (max 20)
		events = [eventObj, ...events].slice(0, MAX_EVENTS);

		// compteur par bouton/action
		const key = `${deviceId}:${action}`;
		buttonCounts[key] = (buttonCounts[key] || 0) + 1;
	}

	function formatTime(ts) {
		return new Date(ts).toLocaleTimeString('fr-FR');
	}
</script>

<main>
	<header>
		<h1>Flipper / Pinball Events</h1>
		<div class="status">
			<span class="dot" class:online={wsConnected}></span>
			{wsConnected ? 'Connecte' : 'Deconnecte'}
		</div>
	</header>

	<!-- dernier event -->
	<section class="last-event">
		<h2>Dernier Event</h2>
		{#if lastEvent}
			<div class="event-card big">
				<div class="event-action">{lastEvent.action}</div>
				<div class="event-value">{lastEvent.value}</div>
				<div class="event-meta">
					{lastEvent.deviceId} - {formatTime(lastEvent.timestamp)}
				</div>
			</div>
		{:else}
			<p class="empty">En attente d'events flipper...</p>
		{/if}
	</section>

	<!-- compteurs par bouton -->
	<section class="counters">
		<h2>Compteurs par bouton</h2>
		<div class="counter-grid">
			{#each Object.entries(buttonCounts) as [key, count]}
				<div class="counter-item">
					<span class="counter-key">{key}</span>
					<span class="counter-value">{count}</span>
				</div>
			{/each}
		</div>
		{#if Object.keys(buttonCounts).length === 0}
			<p class="empty">Aucun compteur</p>
		{/if}
	</section>

	<!-- timeline -->
	<section class="timeline">
		<h2>Timeline (20 derniers)</h2>
		<div class="timeline-list">
			{#each events as event (event.id)}
				<div class="timeline-item">
					<span class="timeline-time">{formatTime(event.timestamp)}</span>
					<span class="timeline-action">{event.action}</span>
					<span class="timeline-value">{event.value}</span>
					<span class="timeline-device">{event.deviceId}</span>
				</div>
			{/each}
		</div>
		{#if events.length === 0}
			<p class="empty">Aucun event</p>
		{/if}
	</section>

	<!-- descriptif du payload -->
	<section class="payload-info">
		<h2>Payload observe</h2>
		<div class="info-box">
			<p>Topics: <code>flipper/&lt;deviceId&gt;/&lt;action&gt;</code></p>
			<p>Actions observees: button, value, etc.</p>
			<p>Format payload: JSON ou valeur brute selon l'action</p>
			{#if lastEvent}
				<p>Exemple raw: <code>{lastEvent.raw}</code></p>
			{/if}
		</div>
	</section>
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
		max-width: 900px;
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

	h2 {
		font-size: 1.1rem;
		color: #94a3b8;
		margin: 0 0 1rem 0;
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

	section {
		background: #1e293b;
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.event-card {
		background: #334155;
		border-radius: 8px;
		padding: 1.5rem;
		text-align: center;
	}

	.event-card.big .event-action {
		font-size: 1rem;
		color: #94a3b8;
		text-transform: uppercase;
	}

	.event-card.big .event-value {
		font-size: 3rem;
		font-weight: bold;
		color: #fbbf24;
		margin: 0.5rem 0;
	}

	.event-card.big .event-meta {
		font-size: 0.85rem;
		color: #64748b;
	}

	.counter-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.counter-item {
		background: #334155;
		border-radius: 8px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		min-width: 120px;
	}

	.counter-key {
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.counter-value {
		font-size: 2rem;
		font-weight: bold;
		color: #22c55e;
	}

	.timeline-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 400px;
		overflow-y: auto;
	}

	.timeline-item {
		display: flex;
		gap: 1rem;
		padding: 0.75rem;
		background: #334155;
		border-radius: 6px;
		font-size: 0.9rem;
	}

	.timeline-time {
		color: #64748b;
		min-width: 70px;
	}

	.timeline-action {
		color: #38bdf8;
		font-weight: 500;
		min-width: 80px;
	}

	.timeline-value {
		color: #fbbf24;
		flex: 1;
	}

	.timeline-device {
		color: #94a3b8;
		font-size: 0.8rem;
	}

	.info-box {
		background: #334155;
		border-radius: 8px;
		padding: 1rem;
	}

	.info-box p {
		margin: 0.5rem 0;
		color: #94a3b8;
	}

	.info-box code {
		background: #0f172a;
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		color: #38bdf8;
	}

	.empty {
		color: #64748b;
		font-style: italic;
	}
</style>
