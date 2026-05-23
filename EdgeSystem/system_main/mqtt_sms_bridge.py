"""MQTT subscriber for backend → Pi outbound SMS (OTP and alerts)."""
import json

SMS_OUTBOUND_TOPIC = "surgealert/outbound/sms"


def _connect_ok(reason_code):
    if reason_code is None:
        return True
    if hasattr(reason_code, "is_failure") and reason_code.is_failure:
        return False
    if hasattr(reason_code, "value"):
        return int(reason_code.value) == 0
    try:
        return int(reason_code) == 0
    except (TypeError, ValueError):
        return str(reason_code).lower() in ("success", "ok", "0")


def attach_outbound_sms_handler(mqtt_client, gsm_worker):
    """Register connect/message handlers; subscribe on every connect/reconnect."""

    def on_connect(client, userdata, flags, reason_code, properties=None):
        if _connect_ok(reason_code):
            client.subscribe(SMS_OUTBOUND_TOPIC, qos=1)
            print(f" [MQTT] Subscribed to {SMS_OUTBOUND_TOPIC} (QoS 1)")
        else:
            print(f"\033[31m [MQTT] Connect failed — cannot receive OTP/SMS (reason={reason_code!r})\033[0m")

    def on_disconnect(client, userdata, flags, reason_code, properties=None):
        print(f"\033[33m [MQTT] Disconnected from broker (reason={reason_code!r}); will resubscribe on reconnect\033[0m")

    def on_message(client, userdata, msg):
        topic = getattr(msg, "topic", "") or ""
        if topic != SMS_OUTBOUND_TOPIC:
            return
        if not gsm_worker:
            print("\033[31m [SMS] MQTT outbound ignored — GSM module not initialized.\033[0m")
            return
        try:
            data = json.loads(msg.payload.decode())
            num = data.get("number") or data.get("phoneNumber")
            txt = data.get("message") or data.get("textMessage")
            if num and txt:
                print(f" [SMS] MQTT outbound received for {num} ({len(txt)} chars) — dispatching now")
                if str(data.get("priority", "")).lower() == "alert":
                    gsm_worker.enqueue(num, txt)
                else:
                    gsm_worker.enqueue_otp(num, txt)
            else:
                print(f"\033[31m [SMS] MQTT outbound missing number/message: {data}\033[0m")
        except Exception as e:
            print(f"\033[31m [SMS] MQTT outbound error: {e}\033[0m")

    mqtt_client.on_connect = on_connect
    mqtt_client.on_disconnect = on_disconnect
    mqtt_client.on_message = on_message
