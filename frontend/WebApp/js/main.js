import { initializeAuth } from './auth.js';
import { showView, setupUIEventListeners, backToPhoneStep, showSuccessStep } from './ui.js';
import { updateAlertStatus, fetchCameraFeed } from './alert.js';
import { fetchWeather } from './api.js';
import { fetchTides } from './tides.js';
import { API_BASE_URL } from './config.js';
import { registerResident } from './api.js';

// Global scope exposure for HTML onclick events
window.showView = showView;
window.backToPhoneStep = backToPhoneStep;

// Temporary storage for registration data while waiting for OTP
let tempRegistrationData = {};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup UI (Mobile menu, Checkboxes, etc.)
    setupUIEventListeners();
    
    // 2. Initialize Auth (Check if user is already logged in)
    initializeAuth();

    // 3. Initial Data Load
    updateAlertStatus();
    fetchWeather();
    fetchTides();
    fetchCameraFeed();

    // 4. Polling (Auto-refresh)
    // Alerts and Camera: Every 3 seconds
    setInterval(() => {
        updateAlertStatus();
        fetchCameraFeed();
    }, 3000);

    // Weather and Tides: Every 1 hour
    setInterval(() => { 
        fetchWeather(); 
        fetchTides(); 
    }, 3600000);

    // --- 5. REGISTRATION LOGIC (UPDATED FOR EMAIL) ---
    const phoneForm = document.getElementById('phone-form');
    
    if (phoneForm) {
        phoneForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value; // NEW: Get Email
            const phone = document.getElementById('register-phone').value;
            const address = document.getElementById('register-address').value;

            // Store data temporarily
            tempRegistrationData = {
                fullName: name,
                email: email, // NEW: Add to object
                phoneNumber: phone,
                address: address
            };

            try {
                // Disable button to prevent double clicks
                const submitBtn = document.getElementById('send-otp-btn');
                submitBtn.disabled = true;
                submitBtn.textContent = "Sending...";

                const response = await fetch(`${API_BASE_URL}/residents/send-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: phone })
                });

                if (response.ok) {
                    const data = await response.json();
                    // DEV MODE: Alert OTP for easier testing
                    console.log("OTP:", data.dev_otp);
                    alert(`(Dev Mode) Your OTP is: ${data.dev_otp}`);

                    // Switch to OTP View
                    document.getElementById('phone-step').classList.add('hidden');
                    document.getElementById('otp-step').classList.remove('hidden');
                } else {
                    const errText = await response.text();
                    alert("Error sending OTP: " + errText);
                }
            } catch (err) {
                console.error(err);
                alert("Network error. Please try again.");
            } finally {
                const submitBtn = document.getElementById('send-otp-btn');
                submitBtn.disabled = false;
                submitBtn.textContent = "Send Verification Code";
            }
        });
    }

    // --- 6. OTP VERIFICATION LOGIC ---
    const otpForm = document.getElementById('otp-form');
    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otpVal = document.getElementById('otp-code').value;

            try {
                // 1. Verify OTP
                const verifyResp = await fetch(`${API_BASE_URL}/residents/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phoneNumber: tempRegistrationData.phoneNumber,
                        code: otpVal
                    })
                });

                if (!verifyResp.ok) throw new Error("Invalid OTP");

                // 2. Register Resident (Now includes Email)
                await registerResident(tempRegistrationData);

                // 3. Show Success
                showSuccessStep();
                
                // Cleanup
                phoneForm.reset();
                otpForm.reset();
                document.getElementById('register-email').value = ''; // Clear email specifically
                
            } catch (error) {
                alert("Invalid OTP or Registration Failed. " + error.message);
            }
        });
    }
});