# Topics MQTT - IoT Meteo

## Prefix
`classroom/<deviceId>`

Les deviceId correspondent aux 5 ESP32 qui publient les mesures meteo.

## Topics disponibles

| Topic | Description |
|-------|-------------|
| `classroom/<deviceId>/telemetry` | Donnees de telemetrie (temp, humidite, batterie) |
| `classroom/<deviceId>/events` | Evenements ponctuels |
| `classroom/<deviceId>/cmd` | Commandes envoyees au device |
| `classroom/<deviceId>/status` | Etat du device (online/offline) |

## Flipper (bonus)

Prefix: `flipper/<deviceId>/<action>`

Topics observes:
- `flipper/<deviceId>/button` - appui sur bouton
- `flipper/<deviceId>/value` - valeur numerique
