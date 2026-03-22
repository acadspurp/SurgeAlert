import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOtp, verifyOtp, registerResident } from '../services/api.js';

export default function Register() {
    const navigate = useNavigate();

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [consent, setConsent] = useState(false);
    const [otpCode, setOtpCode] = useState('');

    // Step state
    const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'success'
    const [sending, setSending] = useState(false);

    const handlePhoneSubmit = async (e) => {
        e.preventDefault();

        try {
            setSending(true);
            const data = await sendOtp(phone);
            console.log("OTP:", data.dev_otp);
            alert(`(Dev Mode) Your OTP is: ${data.dev_otp}`);
            setStep('otp');
        } catch (err) {
            console.error(err);
            alert("Error sending OTP: " + err.message);
        } finally {
            setSending(false);
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();

        try {
            // 1. Verify OTP
            await verifyOtp(phone, otpCode);

            // 2. Register Resident (Now includes Email)
            await registerResident({
                fullName: name,
                email: email,
                phoneNumber: phone
            });

            // 3. Show Success
            setStep('success');

        } catch (error) {
            alert("Invalid OTP or Registration Failed. " + error.message);
        }
    };

    const backToPhoneStep = () => {
        setStep('phone');
        setOtpCode('');
    };

    return (
        <div id="register-view">
            <div className="max-w-md mx-auto custom-card mt-10">
                <h2 className="text-2xl font-semibold mb-2 text-center section-title">Subscribe for Alerts</h2>
                <p className="text-center text-gray-500 text-sm mb-6">Receive SMS and Email notifications during floods.</p>

                {/* PHONE STEP */}
                {step === 'phone' && (
                    <div id="phone-step">
                        <form id="phone-form" onSubmit={handlePhoneSubmit}>
                            {/* Full Name */}
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-medium mb-2">Full Name</label>
                                <input type="text" id="register-name" className="custom-input" required value={name} onChange={(e) => setName(e.target.value)} />
                            </div>

                            {/* Email */}
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-medium mb-2">Email Address <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="email" id="register-email" className="custom-input" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                            </div>

                            {/* Phone Number */}
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-medium mb-2">Phone Number</label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-r-0 border-gray-300 rounded-l-lg">+63</span>
                                    <input type="tel" id="register-phone" className="custom-input rounded-l-none" maxLength="10" placeholder="9123456789" required value={phone} onChange={(e) => setPhone(e.target.value)} />
                                </div>
                            </div>

                            {/* Consent */}
                            <div className="mb-6 flex items-center">
                                <input type="checkbox" id="privacy-consent" className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                                <label htmlFor="privacy-consent" className="ml-2 text-sm text-gray-700">I agree to Data Privacy</label>
                            </div>

                            <button
                                type="submit"
                                id="send-otp-btn"
                                className={`custom-btn btn-green w-full ${!consent ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={!consent || sending}
                            >
                                {sending ? 'Sending...' : 'Send Verification Code'}
                            </button>
                        </form>
                    </div>
                )}

                {/* OTP STEP */}
                {step === 'otp' && (
                    <div id="otp-step">
                        <form id="otp-form" onSubmit={handleOtpSubmit}>
                            <div className="mb-4">
                                <label className="block text-center mb-2">Enter OTP</label>
                                <input type="text" id="otp-code" className="custom-input text-center text-2xl tracking-widest" maxLength="6" required value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
                            </div>
                            <button type="submit" className="custom-btn btn-green w-full mb-2">Verify</button>
                            <button type="button" onClick={backToPhoneStep} className="w-full text-blue-600 py-2 text-sm text-center block">Change Phone</button>
                        </form>
                    </div>
                )}

                {/* SUCCESS STEP */}
                {step === 'success' && (
                    <div id="success-step">
                        <div className="text-center">
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">Registered!</h3>
                            <p className="text-gray-600 mb-4">You are now subscribed to alerts.</p>
                            <button onClick={() => navigate('/')} className="custom-btn btn-blue">Go to Home</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
