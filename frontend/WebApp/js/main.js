import { initializeAuth } from './auth.js';
import { showView, setupUIEventListeners, backToPhoneStep, resendOTP, showSuccessStep } from './ui.js';
import { updateAlertStatus } from './alert.js';
import { fetchWeather } from './api.js';
import { fetchTides } from './tides.js';

// Make UI functions globally accessible for inline HTML event handlers
window.showView = showView;
window.backToPhoneStep = backToPhoneStep;
window.resendOTP = resendOTP;
window.showSuccessStep = showSuccessStep;

// This event ensures that the HTML is fully loaded before any JavaScript runs
document.addEventListener('DOMContentLoaded', () => {
    // Set up all event listeners (mobile menu, consent checkbox, etc.)
    setupUIEventListeners();
    
    // Initialize the Firebase authentication system
    initializeAuth();
    
    // Initialize the main app features
    showView('home');
    
    // Initial Data Fetch
    updateAlertStatus();
    fetchWeather();
    fetchTides();
    fetchCameraFeed(); 

    // Set up Polling (Refresh data automatically)
    setInterval(updateAlertStatus, 30000); // Every 30 seconds
    setInterval(fetchCameraFeed, 60000);   // Every 60 seconds check camera link
});

// --- LIVE CAMERA LOGIC ---
async function fetchCameraFeed() {
    // We select the container using the classes seen in your HTML (Page 19)
    // because the iframe container didn't have a specific ID.
    const container = document.querySelector('#home-view .aspect-w-16'); 
    
    if(!container) return;

    try {
        const response = await fetch('http://localhost:8080/api/public/alerts/camera');
        const data = await response.json();
        
        if (data.url && data.url !== "") {
            // Online: Show Stream
            // Only update if the src is different to avoid flickering
            const currentIframe = container.querySelector('iframe');
            if (!currentIframe || currentIframe.src !== data.url) {
                container.innerHTML = `
                    <iframe width="100%" height="450" 
                    src="${data.url}" 
                    title="Tullahan River Live Stream" 
                    frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            }
        } else {
            // Offline: Show Placeholder Image
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center w-full bg-gray-900 text-white rounded-lg" style="height: 450px;">
                    <svg class="w-16 h-16 mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                    <p class="text-lg font-semibold">Camera Offline</p>
                    <p class="text-sm text-gray-400">Live feed currently unavailable</p>
                </div>`;
        }
    } catch (error) {
        console.error("Camera fetch failed", error);
    }
}