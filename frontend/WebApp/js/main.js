import { initializeAuth } from './auth.js';
import { showView, setupUIEventListeners, backToPhoneStep, showSuccessStep } from './ui.js';
import { updateAlertStatus, fetchCameraFeed } from './alert.js';
import { fetchWeather } from './api.js';
import { fetchTides } from './tides.js';
import { API_BASE_URL } from './config.js';
import { registerResident } from './api.js';

// Global scope
window.showView = showView;
window.backToPhoneStep = backToPhoneStep;

let tempRegistrationData = {};

document.addEventListener('DOMContentLoaded', () => {
    setupUIEventListeners();
    initializeAuth();

    // Initial Data
    updateAlertStatus();
    fetchWeather();
    fetchTides();
    fetchCameraFeed();

    // Polling
    setInterval(updateAlertStatus, 3000);
    setInterval(fetchCameraFeed, 3000); 
    setInterval(() => { fetchWeather(); fetchTides(); }, 3600000);

    // --- OTP & REGISTRATION LOGIC ---
    const phoneForm = document.getElementById('phone-form');
    
    if (phoneForm) {
        phoneForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('register-name').value;
            const phone = document.getElementById('register-phone').value;
            const address = document.getElementById('register-address').value;
            
            tempRegistrationData = { 
                fullName: name, 
                phoneNumber: phone, 
                address: address, 
                email: "" // Optional in ResidentRequest
            };

            try {
                const response = await fetch(`${API_BASE_URL}/residents/send-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: phone })
                });

                if (response.ok) {
                    const data = await response.json();
                    // DEV MODE: Alert OTP
                    alert(`(Dev Mode) Your OTP is: ${data.dev_otp}`);
                    
                    document.getElementById('phone-step').classList.add('hidden');
                    document.getElementById('otp-step').classList.remove('hidden');
                } else {
                    alert("Error sending OTP. Please check the number.");
                }
            } catch (err) {
                console.error(err);
                alert("Network error.");
            }
        });
    }

    const otpForm = document.getElementById('otp-form');
    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otpVal = document.getElementById('otp-code').value;

            try {
                const verifyResp = await fetch(`${API_BASE_URL}/residents/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phoneNumber: tempRegistrationData.phoneNumber,
                        code: otpVal
                    })
                });

                if (!verifyResp.ok) throw new Error("Invalid OTP");

                await registerResident(tempRegistrationData);
                showSuccessStep();
                phoneForm.reset();
                otpForm.reset();
            } catch (error) {
                alert("Invalid OTP or Registration Failed.");
            }
        });
    }
});