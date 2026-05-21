# Edge deploy helpers

## Auto-start after reboot (systemd)

1. Copy the unit file (adjust paths if your Pi user or repo path differs):

   ```bash
   sudo cp deploy/surgealert-edge.service /etc/systemd/system/
   ```

2. Edit if needed — default assumes:
   - User: `pi`
   - Repo: `/home/pi/SurgeAlert/EdgeSystem`
   - Venv: `/home/pi/SurgeAlert/EdgeSystem/venv`

   ```bash
   sudo nano /etc/systemd/system/surgealert-edge.service
   ```

3. Enable and start:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable surgealert-edge
   sudo systemctl start surgealert-edge
   ```

4. Check status and live logs:

   ```bash
   sudo systemctl status surgealert-edge
   journalctl -u surgealert-edge -f
   ```

Hardware errors appear in the journal with tags like `[Ultrasonic]`, `[Radar]`, `[Camera]`, `[GSM]`, `[MQTT]`.
