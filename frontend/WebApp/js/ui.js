import { API_BASE_URL } from './config.js';
import { registerResident } from './api.js';

let tempRegistrationData = {}; 

// Navigation Functions
export function showView(viewName) {
    const views = ['home-view', 'maps-view', 'login-view', 'register-view', 'about-view'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    
    // Adjust viewName if it doesn't have '-view'
    const viewId = viewName.includes('-view') ? viewName : viewName + '-view';
    
    const target = document.getElementById(viewId);
    if (target) target.style.display = 'block';

    // Init map only if map view
    if (viewId === 'maps-view' && window.initMap) {
        // Small delay to ensure div is visible
        setTimeout(() => {
             // We check a global flag or handle map singleton in map.js
             import('./map.js').then(module => {
                 if (!window.mapInstance) window.mapInstance = module.initMap();
             });
        }, 100);
    }

    // Mobile menu logic
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu && mobileMenu.style.display === 'block') {
        mobileMenu.style.display = 'none';
    }
}

export function backToPhoneStep() {
    document.getElementById('otp-step').style.display = 'none';
    document.getElementById('phone-step').style.display = 'block';
}

export function showSuccessStep() {
    document.getElementById('otp-step').style.display = 'none';
    document.getElementById('phone-step').style.display = 'none';
    document.getElementById('success-step').style.display = 'block';
}

export function resendOTP() {
    alert('Please re-submit the phone form to generate a new OTP.');
    backToPhoneStep();
}

// Helper for messages
export function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if(!element) return;
    element.textContent = message;
    element.className = `mb-4 p-3 rounded-lg text-sm ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
    element.style.display = 'block';
    setTimeout(() => { element.style.display = 'none'; }, 5000);
}

export function setupUIEventListeners() {
    // Mobile Menu
    const mobileBtn = document.getElementById('mobile-menu-button');
    if (mobileBtn) {
        mobileBtn.addEventListener('click', () => {
            const mm = document.getElementById('mobile-menu');
            mm.style.display = (mm.style.display === 'block') ? 'none' : 'block';
        });
    }

    // Privacy Checkbox
    const consent = document.getElementById('privacy-consent');
    const sendBtn = document.getElementById('send-otp-btn');
    if (consent && sendBtn) {
        sendBtn.disabled = true;
        sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
        consent.addEventListener('change', function() {
            if(this.checked) {
                sendBtn.disabled = false;
                sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                sendBtn.disabled = true;
                sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        });
    }

    // STEP 1: Phone Form
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
                email: "" 
            };

            // SEND OTP REQUEST
            try {
                const response = await fetch(`${API_BASE_URL}/residents/send-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: phone })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    // DEV MODE ALERT
                    alert(`(Dev Mode) Your OTP is: ${data.dev_otp}`);

                    document.getElementById('phone-step').style.display = 'none';
                    document.getElementById('otp-step').style.display = 'block';
                    document.getElementById('display-phone').textContent = phone;
                } else {
                    alert("Error sending OTP. Please try again.");
                }
            } catch (err) {
                console.error(err);
                alert("Network error.");
            }
        });
    }

    // STEP 2: OTP Form
    const otpForm = document.getElementById('otp-form');
    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otpVal = document.getElementById('otp-code').value;
            
            try {
                // VERIFY OTP REQUEST
                const verifyResp = await fetch(`${API_BASE_URL}/residents/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        phoneNumber: tempRegistrationData.phoneNumber, 
                        code: otpVal 
                    })
                });

                if (!verifyResp.ok) throw new Error("Invalid OTP");

                // IF VALID, REGISTER
                await registerResident(tempRegistrationData);
                
                showSuccessStep();
                phoneForm.reset();
                otpForm.reset();

            } catch (error) {
                const msgBox = document.getElementById('otp-message');
                if(msgBox) {
                    msgBox.textContent = "Invalid OTP or Registration Failed.";
                    msgBox.style.display = 'block';
                    msgBox.className = 'mb-4 p-3 rounded-lg text-sm bg-red-100 text-red-700';
                }
            }
        });
    }
}