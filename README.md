# IoT Meteo Dashboard

Dashboard temps reel pour visualiser les donnees meteo des ESP32 via MQTT.

## Structure

```
├── front/      # UI Svelte
├── bridge/     # Bridge MQTT -> WebSocket
└── contracts/  # Doc des topics MQTT
```

## Lancer le projet

### 1. Bridge (terminal 1)

```bash
cd bridge
npm install
node server.js
```

### 2. Front (terminal 2)

```bash
cd front
npm install
npm run dev
```

Ouvrir http://localhost:5173

## Pages

- `/` - Dashboard meteo (temp, humidite, batterie des stations)
- `/flipper` - Events flipper/pinball

## Config

- Broker MQTT: `captain.dev0.pandor.cloud:1884`
- WebSocket bridge: `ws://localhost:8080`
- Topics: `classroom/+/telemetry`, `flipper/+/+`

## Features

- Temps reel via WebSocket
- Theme clair / sombre / systeme
- Status online/offline des stations
- Moyennes globales
- Filtre par station
- Timeline des events flipper

## Fait par M'FOUMOUNE Gabrielle