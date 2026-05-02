# SurgeAlert: MQTT with SSL (MQTTS/WSS) Setup Guide

Heto ang dokumentasyon ng architecture transformation na ginawa natin upang ma-meet ang "MQTT with SSL" requirement ng inyong professor.

### 🟢 Ano ang mga Nabago Na Natin? (Complete Code Transformations)

1. **Python Edge System** 
   - **Dati:** Nagpapadala ng JSON sa pamamagitan ng mabagal na HTTP POST (`requests.post`).
   - **Ngayon:** Pinalitan ang library gamit ang `paho.mqtt.client`. Kumokonekta ito gamit ang SSL Protocol (MQTTS tcp:// port 8883) kaya encrypted at hindi mananakawan ang data na pinapasa ng hardware sensors.
2. **Java Backend** 
   - **Dati:** Nakadepende lang sa `SensorDataController` HTTP endpoint.
   - **Ngayon:** Nag-install ng `org.eclipse.paho` at ginawan ng `MqttSubscriberService`. Naka-subscribe na ito secure MQTT stream at the background. Lahat ng napapasok doon, i-save papuntang mySQL at auto-trigger sa Email alerts.
3. **React Frontend** 
   - **Dati:** Naka-HTTP polling (may `setInterval()`) na tinatadtad ng GET Request ang Spring Boot every 3 seconds, dahilan para tumaas ang CPU load.
   - **Ngayon:** Inalis yung interval at nilagyan ng modern na `useSensorMqtt` hook. Nakikinig ito sa system gamit ang Secure WebSockets (`wss://` port 8884). Kapag nag-broadcast si Edge, subsecond update ang makikita sa screen!


---

### 🟡 Ang Kailangan Mong Gawin Bago Mag-Execute:

Dahil ikaw ang may kailangan ng "Private" broker bilang requirements mo para sa secured data, ikaw ang gagawa ng Cloud Serverless (Mabilis lang to!). Ito na lang ang papalit sa code para gumana.

#### Step 1: Gumawa ng Libreng Account
Pumunta sa [HiveMQ Cloud](https://console.hivemq.cloud) at gumawa ng libreng account. Kapag nagtanong ng setup, piliin ang "Severless/Free" (hindi humihingi ng credit card).

#### Step 2: Kunin ang Iyong Connection Details
Pag naka-login ka na sa UI ng HiveMQ, pakihanap ang sumusunod:
1. **Cluster URL** (Makikita sa Overview tab, mukhang ganito: `xyz123.s1.eu.hivemq.cloud`)
2. Sa tab ng "Access Management", gumawa ng Username and Password para magkaroon ng permission maka-connect ang mga devices natin. Piliin lang na bigyan ng publish at subscribe access sa lahat (`#`) na topic.

#### Step 3: Papalitan Ang Placeholders sa Ating Code 
Buksan ang mga sumusunod na File sa project mo at hanapin ang salitang `YOUR_HIVEMQ_URL`, `YOUR_HIVEMQ_USERNAME`, at `YOUR_HIVEMQ_PASSWORD` at palitan ito nung totoong details mula sa ginawa mo.

**1. `EdgeSystem/config/settings.py` (Makikita bandang Line 24-28)**
```python
# --- SECURE MQTT SETTINGS (HiveMQ Cloud Serverless) ---
MQTT_BROKER = os.getenv("MQTT_BROKER", "ILAGAY-ANG-CLUSTER-URL-DITOH") 
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "ILAGAY-ANG-USERNAME-DITO")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "ILAGAY-ANG-PASSWORD-DITO")
```

**2. `backend/src/main/resources/application.properties` (Makikita bandang Line 48-52)**
```properties
# --- SECURE MQTT SETTINGS (HiveMQ Cloud Serverless) ---
mqtt.broker.url=ssl://ILAGAY-ANG-CLUSTER-URL-DITO:8883
mqtt.broker.username=ILAGAY-ANG-USERNAME-DITO
mqtt.broker.password=ILAGAY-ANG-PASSWORD-DITO
```

**3. `frontend/WebApp/src/config.js` (Makikita bandang Line 7-9)**
*Pansinin na hindi tatanggalin yung 'wss://' at ':8884/mqtt'. Base domain URL lang ang babaguhin mo.*
```javascript
export const MQTT_BROKER_URL = "wss://ILAGAY-ANG-CLUSTER-URL-DITO:8884/mqtt";
export const MQTT_USERNAME = "ILAGAY-ANG-USERNAME-DITO";
export const MQTT_PASSWORD = "ILAGAY-ANG-PASSWORD-DITO";
```

### 🚀 Launch instructions
Pagkagawa at replace niyan, maaari niyo nang i-run sabay-sabay ang Frontend, Backend, at Edgesystem terminal at mapapatunayan niyo sa prof niyo na "Real-time full-stack MQTT architecture with SSL enabled" ang gamit niyo! Good luck!
