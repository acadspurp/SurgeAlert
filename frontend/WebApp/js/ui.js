export function showView(viewName) {
    const views = ['home-view', 'maps-view', 'login-view', 'register-view', 'about-view'];
    
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const viewId = viewName.includes('-view') ? viewName : viewName + '-view';
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');

    // === CRITICAL MAP FIX ===
    if (viewId === 'maps-view') {
        setTimeout(() => {
            if (window.mapInstance) {
                Promise.resolve(window.mapInstance).then(map => map.invalidateSize());
            } else {
                import('./map.js').then(module => {
                    if (!window.mapInstance) {
                        window.mapInstance = module.initMap().then(map => {
                            map.invalidateSize();
                            return map;
                        });
                    }
                });
            }
        }, 100);
    }
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

export function setupUIEventListeners() {
    // Mobile Menu
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
}