"""Priority queue + worker thread for GSM SMS (one CMGS at a time with cooldown)."""
import queue
import threading

_PRIORITY_OTP = 0
_PRIORITY_ALERT = 10


class GsmOutboundWorker:
    def __init__(self, sms_manager):
        self._sms = sms_manager
        self._queue = queue.PriorityQueue()
        self._seq = 0
        self._lock = threading.Lock()
        self._thread = threading.Thread(target=self._run, name="gsm-outbound", daemon=True)
        self._thread.start()

    def enqueue(self, phone_number, message, *, priority=_PRIORITY_ALERT):
        if not phone_number or not (message or "").strip():
            return
        with self._lock:
            self._seq += 1
            seq = self._seq
        self._queue.put((priority, seq, phone_number, message.strip()))
        label = "OTP" if priority == _PRIORITY_OTP else "SMS"
        print(f" [GSM] Queued {label} for {phone_number} (priority={priority})")

    def enqueue_otp(self, phone_number, message):
        self.enqueue(phone_number, message, priority=_PRIORITY_OTP)

    def _run(self):
        while True:
            _priority, _seq, number, text = self._queue.get()
            fast = _priority == _PRIORITY_OTP
            try:
                if not self._sms:
                    print("\033[31m [GSM] Worker: no SMS manager — message dropped.\033[0m")
                    continue
                ok = self._sms.send_gsm_only(number, text, fast=fast)
                if ok:
                    print(f" [GSM] Worker delivered to {number}")
                else:
                    print(f"\033[31m [GSM] Worker FAILED for {number}\033[0m")
            except Exception as e:
                print(f"\033[31m [GSM] Worker error: {e}\033[0m")
            finally:
                if self._sms:
                    self._sms.cooldown_after_send(fast=fast)
                    if not self._sms.wait_until_ready():
                        print(
                            "\033[33m [GSM] Module still busy after cooldown — "
                            "next SMS may retry AT again.\033[0m"
                        )
                self._queue.task_done()
