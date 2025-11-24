import { API_BASE_URL } from './config.js';
import { registerResident } from './api.js';


let tempRegistrationData = {};


// Navigation Functions
export function showView(viewName) {
    const views = ['home-view', 'maps-view', 'login-view', 'register-view', 'about-view'];
   
    // Hide all views using Tailwind's 'hidden' class
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });


    // Show target view
    const viewId = viewName.includes('-view') ? viewName : viewName + '-view';
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');


    // === CRITICAL MAP FIX ===
    // This forces Leaflet to redraw the map when the tab becomes visible
    if (viewId === 'maps-view') {
        setTimeout(() => {
            if (window.mapInstance) {
                // If map is already loaded, resize it
                Promise.resolve(window.mapInstance).then(map => map.invalidateSize());
            } else {
                // If not loaded, import and init
                import('./map.js').then(module => {
                    if (!window.mapInstance) {
                        window.mapInstance = module.initMap().then(map => {
                            map.invalidateSize();
                            return map;
                        });
                    }
                });
            }
        }, 100); // Small delay to allow CSS transition
    }


    // Close Mobile Menu if open
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) mobileMenu.classList.add('hidden');
}


export function backToPhoneStep() {
    document.getElementById('otp-step').classList.add('hidden');
    document.getElementById('phone-step').classList.remove('hidden');
}


export function showSuccessStep() {
    document.getElementById('otp-step').classList.add('hidden');
    document.getElementById('phone-step').classList.add('hidden');
    document.getElementById('success-step').classList.remove('hidden');
}


export function resendOTP() {
    alert('Please re-submit the phone form to generate a new OTP.');
    backToPhoneStep();
}


// Helper for displaying messages in the UI
export function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if(!element) return;
   
    element.textContent = message;
    element.className = `mb-4 p-3 rounded-lg text-sm ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
    element.classList.remove('hidden');
   
    setTimeout(() => { element.classList.add('hidden'); }, 5000);
}


// Main Event Listener Setup
export function setupUIEventListeners() {
    // Mobile Menu Toggle
    const mobileBtn = document.getElementById('mobile-menu-button');
    if (mobileBtn) {
        mobileBtn.addEventListener('click', () => {
            const mm = document.getElementById('mobile-menu');
            mm.classList.toggle('hidden');
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


    // Phone Form
    const phoneForm = document.getElementById('phone-form');
    if (phoneForm) {
        phoneForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('register-name').value;
            const phone = document.getElementById('register-phone').value;
            const address = document.getElementById('register-address').value;


            tempRegistrationData = { fullName: name, phoneNumber: phone, address: address, email: "" };


            try {
                const response = await fetch(`${API_BASE_URL}/residents/send-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: phone })
                });


                if (response.ok) {
                    const data = await response.json();
                    alert(`(Dev Mode) Your OTP is: ${data.dev_otp}`);
                    document.getElementById('phone-step').classList.add('hidden');
                    document.getElementById('otp-step').classList.remove('hidden');
                } else {
                    alert("Error sending OTP. Please try again.");
                }
            } catch (err) {
                console.error(err);
                alert("Network error.");
            }
        });
    }


    // OTP Form
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
}

