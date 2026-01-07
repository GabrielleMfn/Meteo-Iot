import mqtt from 'mqtt';
import { WebSocketServer } from 'ws';

// config du broker MQTT
const MQTT_BROKER = 'mqtt://captain.dev0.pandor.cloud:1884';
const TOPIC_CLASSROOM = 'classroom/+/telemetry';
const TOPIC_FLIPPER = 'flipper/+/+'; // bonus flipper

// liste des clients WS connectes
const wsClients = new Set();

// connexion au broker MQTT
const mqttClient = mqtt.connect(MQTT_BROKER);

mqttClient.on('connect', () => {
    console.log('Connecte au broker MQTT');
    
    // on s'abonne aux topics meteo et flipper
    mqttClient.subscribe(TOPIC_CLASSROOM, (err) => {
        if (err) {
            console.error('Erreur subscribe classroom:', err);
        } else {
            console.log('Abonne a', TOPIC_CLASSROOM);
        }
    });
    
    mqttClient.subscribe(TOPIC_FLIPPER, (err) => {
        if (err) {
            console.error('Erreur subscribe flipper:', err);
        } else {
            console.log('Abonne a', TOPIC_FLIPPER);
        }
    });
});

mqttClient.on('message', (topic, message) => {
    // on parse le message et on le renvoie a tous les clients WS
    const payload = {
        topic: topic,
        data: message.toString(),
        timestamp: Date.now()
    };
    
    console.log('Message MQTT:', topic, message.toString().substring(0, 100));
    
    // broadcast a tous les clients
    const jsonPayload = JSON.stringify(payload);
    wsClients.forEach(client => {
        if (client.readyState === 1) { // OPEN
            client.send(jsonPayload);
        }
    });
});

mqttClient.on('error', (err) => {
    console.error('Erreur MQTT:', err);
});

// serveur WebSocket sur port 8080
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('Nouveau client WS connecte');
    wsClients.add(ws);
    
    ws.on('close', () => {
        console.log('Client WS deconnecte');
        wsClients.delete(ws);
    });
    
    ws.on('error', (err) => {
        console.error('Erreur WS:', err);
        wsClients.delete(ws);
    });
});

console.log('WebSocket server demarre sur ws://localhost:8080');
