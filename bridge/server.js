import mqtt from 'mqtt';
import { WebSocketServer } from 'ws';

// config du broker MQTT
const MQTT_BROKER = 'mqtt://captain.dev0.pandor.cloud:1884';
const TOPIC_CLASSROOM = 'classroom/+/telemetry';
const TOPIC_FLIPPER = 'flipper/+/+'; 

// liste des clients WS connectes
const wsClients = new Set();

// pour eviter de spam le terminal
let msgCount = 0;
const LOG_EVERY = 50; // log 1 message sur 50 sinon ça spamme trop

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
    
    msgCount++;
    if (msgCount % LOG_EVERY === 0) {
        console.log(`[${msgCount}] ${topic} - ${message.toString().substring(0, 60)}...`);
    }
    
    // broadcast a tous les clients
    const jsonPayload = JSON.stringify(payload);
    wsClients.forEach(client => {
        if (client.readyState === 1) { 
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
