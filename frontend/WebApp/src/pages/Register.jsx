import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchOtpConfig, sendOtp, verifyOtp, registerResident, unsubscribeOtp } from '../services/api.js';

export default function Register() {
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [consent, setConsent] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [strictVerification, setStrictVerification] = useState(true);
    const [otpTtlMinutes, setOtpTtlMinutes] = useState(10);

    const [step, setStep] = useState('subscribe_phone');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        fetchOtpConfig()
            .then((cfg) => {
                setStrictVerification(Boolean(cfg?.strictVerification));
                if (cfg?.ttlMinutes) setOtpTtlMinutes(cfg.ttlMinutes);
            })
            .catch(() => setStrictVerification(true));
    }, []);

    const validateAndNormalizePhone = (p) => {
        if (/^9\d{9}$/.test(p)) return p;
        if (/^09\d{9}$/.test(p)) return p.substring(1);
        return null;
    };

    const isValidOtpFormat = (value) => /^\d{6}$/.test(String(value || ''));

    const handleSubPhoneSubmit = async (e) => {
        e.preventDefault();
        const normalized = validateAndNormalizePhone(phone);
        if (!normalized) {
            alert("Invalid Phone Number. Use 10 digits starting with 9 (e.g. 9123...) or 11 digits starting with 09 (e.g. 0912...).");
            return;
        }
        setSending(true);
        try {
            const data = await sendOtp(normalized);
            const via = data?.deliveryChannel ? ` via ${data.deliveryChannel}` : '';
            alert(`Verification code sent${via}. Please check your messages.`);
            setStep('subscribe_otp');
        } catch (err) {
            console.error(err);
            if (strictVerification) {
                alert("Could not send verification code. Check your number and try again, or contact support.");
            } else {
                alert("OTP delivery is temporarily unavailable. Enter any 6-digit code to continue.");
                setStep('subscribe_otp');
            }
        } finally {
            setSending(false);
        }
    };

    const handleSubOtpSubmit = async (e) => {
        e.preventDefault();
        const normalized = validateAndNormalizePhone(phone);
        if (!isValidOtpFormat(otpCode)) {
            alert(strictVerification
                ? `Please enter the 6-digit code from your SMS (valid ${otpTtlMinutes} minutes).`
                : "Please enter any 6-digit OTP code.");
            return;
        }
        try {
            if (strictVerification) {
                await verifyOtp(normalized, otpCode);
            }
            await registerResident({ fullName: name, phoneNumber: normalized });
            setStep('success_sub');
        } catch (error) {
            alert("Registration Failed. " + error.message);
        }
    };

    const handleUnsubPhoneSubmit = async (e) => {
        e.preventDefault();
        const normalized = validateAndNormalizePhone(phone);
        if (!normalized) {
            alert("Invalid Phone Number. Use 10 digits starting with 9 (e.g. 9123...) or 11 digits starting with 09 (e.g. 0912...).");
            return;
        }
        setSending(true);
        try {
            const data = await sendOtp(normalized);
            const via = data?.deliveryChannel ? ` via ${data.deliveryChannel}` : '';
            alert(`Verification code sent${via}. Please check your messages.`);
            setStep('unsubscribe_otp');
        } catch (err) {
            console.error(err);
            alert("Error sending OTP: " + err.message);
        } finally {
            setSending(false);
        }
    };

    const handleUnsubOtpSubmit = async (e) => {
        e.preventDefault();
        const normalized = validateAndNormalizePhone(phone);
        if (!isValidOtpFormat(otpCode)) {
            alert(`Please enter the 6-digit code from your SMS (valid ${otpTtlMinutes} minutes).`);
            return;
        }
        try {
            await unsubscribeOtp(normalized, otpCode);
            setStep('success_unsub');
        } catch (error) {
            alert("Unsubscribe Failed. " + error.message);
        }
    };

    const resetTo = (newStep) => {
        setStep(newStep);
        setOtpCode('');
        setPhone('');
        setConsent(false);
    };

    const subscribeOtpHint = strictVerification
        ? `Enter the code from your SMS (expires in ${otpTtlMinutes} minutes)`
        : 'Enter OTP (demo mode: any 6 digits if SMS unavailable)';

    return (
        <div id="register-view" className="py-10">
            <div className="max-w-md mx-auto custom-card">

                {step === 'subscribe_phone' && (
                    <div id="phone-step">
                        <h2 className="text-2xl font-semibold mb-2 text-center section-title">Subscribe for Alerts</h2>
                        <p className="text-center text-gray-500 text-sm mb-6">Receive SMS notifications during floods.</p>

                        <form onSubmit={handleSubPhoneSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-medium mb-2">Name <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="text" className="custom-input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key.length === 1 && !/^[a-zA-Z.\s]$/.test(e.key)) e.preventDefault(); }} />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-medium mb-2">Phone Number</label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-r-0 border-gray-300 rounded-l-lg">+63</span>
                                    <input type="tel" className="custom-input rounded-l-none" maxLength={phone.startsWith('0') ? 11 : 10} placeholder="9XXXXXXXXX" required value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => { if (e.key.length === 1 && !/^[0-9]$/.test(e.key)) e.preventDefault(); }} />
                                </div>
                            </div>

                            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 h-40 overflow-y-auto text-justify">
                                <strong>Data Privacy Agreement (Compliance with R.A. 10173)</strong><br/><br/>
                                Strictly in adherence to the Data Privacy Act of 2012 (Republic Act No. 10173), by subscribing to SurgeAlert, you explicitly consent to the collection, processing, and retention of your personal data (Name and Phone Number) by the SurgeAlert administrative body.<br/><br/>
                                <strong>1. Purpose of Collection:</strong> Your data will be exclusively utilized for the sole purpose of transmitting automated emergency flood alerts, system announcements, and disaster-response coordination.<br/>
                                <strong>2. Data Protection:</strong> We employ symmetric encryption to ensure your contact details remain strictly confidential. Your information will neither be repurposed nor disclosed to unauthorized third parties without your explicit legal consent.<br/>
                                <strong>3. Right to Withdraw:</strong> You reserve the absolute right to revoke this consent, permanently erasing your data from our active SMS database, either by using our Unsubscribe portal or by texting "STOP" directly to the system.
                            </div>

                            <div className="mb-6 flex items-center">
                                <input type="checkbox" id="privacy-consent" className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                                <label htmlFor="privacy-consent" className="ml-2 text-sm text-gray-700">I agree to the Data Privacy Agreement</label>
                            </div>

                            <button type="submit" className={`custom-btn btn-green w-full ${!consent ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!consent || sending}>
                                {sending ? 'Sending...' : 'Send Verification Code'}
                            </button>
                        </form>

                        <div className="mt-6 text-center border-t pt-4">
                            <p className="text-sm text-gray-600">Want to unsubscribe from SMS alerts?</p>
                            <button onClick={() => resetTo('unsubscribe_phone')} className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-1">Unsubscribe Here</button>
                        </div>
                    </div>
                )}

                {step === 'subscribe_otp' && (
                    <div id="otp-step">
                        <h2 className="text-2xl font-semibold mb-2 text-center section-title">Verify Number</h2>
                        <p className="text-center text-gray-500 text-sm mb-4">{subscribeOtpHint}</p>
                        <form onSubmit={handleSubOtpSubmit}>
                            <div className="mb-4">
                                <label className="block text-center mb-2">Enter OTP</label>
                                <input type="text" className="custom-input text-center text-2xl tracking-widest" maxLength="6" required value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} />
                            </div>
                            <button type="submit" className="custom-btn btn-green w-full mb-2">Verify & Subscribe</button>
                            <button type="button" onClick={() => resetTo('subscribe_phone')} className="w-full text-blue-600 py-2 text-sm text-center block">Change Phone</button>
                        </form>
                    </div>
                )}

                {step === 'success_sub' && (
                    <div className="text-center">
                        <div className="text-5xl mb-4">✅</div>
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">Registration Successful!</h3>
                        <p className="text-gray-600 mb-4">You will now receive SMS alerts from SurgeAlert.</p>
                        <p className="text-gray-500 text-sm mb-6 pb-4 border-b">If you ever wish to stop receiving messages, you can immediately unsubscribe by texting <strong>STOP</strong> to the SurgeAlert number.</p>
                        <button onClick={() => navigate('/')} className="custom-btn btn-blue w-full">Go to Home</button>
                    </div>
                )}

                {step === 'unsubscribe_phone' && (
                    <div id="unsub-phone-step">
                        <h2 className="text-2xl font-semibold mb-2 text-center section-title">Unsubscribe</h2>
                        <p className="text-center text-gray-500 text-sm mb-6">Enter your phone number to stop receiving alerts.</p>
                        <form onSubmit={handleUnsubPhoneSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-medium mb-2">Phone Number</label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-r-0 border-gray-300 rounded-l-lg">+63</span>
                                    <input type="tel" className="custom-input rounded-l-none" maxLength={phone.startsWith('0') ? 11 : 10} placeholder="9XXXXXXXXX" required value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => { if (e.key.length === 1 && !/^[0-9]$/.test(e.key)) e.preventDefault(); }} />
                                </div>
                            </div>
                            <button type="submit" className="custom-btn btn-red w-full" disabled={sending}>
                                {sending ? 'Sending...' : 'Send Verification Code'}
                            </button>
                        </form>

                        <div className="mt-6 text-center border-t pt-4">
                            <button onClick={() => resetTo('subscribe_phone')} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Back to Subscribe</button>
                        </div>
                    </div>
                )}

                {step === 'unsubscribe_otp' && (
                    <div id="unsub-otp-step">
                        <h2 className="text-2xl font-semibold mb-2 text-center section-title">Verify Unsubscribe</h2>
                        <p className="text-center text-gray-500 text-sm mb-4">{`Enter the code from your SMS (expires in ${otpTtlMinutes} minutes)`}</p>
                        <form onSubmit={handleUnsubOtpSubmit}>
                            <div className="mb-4">
                                <label className="block text-center mb-2">Enter OTP</label>
                                <input type="text" className="custom-input text-center text-2xl tracking-widest" maxLength="6" required value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} />
                            </div>
                            <button type="submit" className="custom-btn btn-red w-full mb-2">Confirm Unsubscribe</button>
                            <button type="button" onClick={() => resetTo('unsubscribe_phone')} className="w-full text-blue-600 py-2 text-sm text-center block">Cancel</button>
                        </form>
                    </div>
                )}

                {step === 'success_unsub' && (
                    <div className="text-center">
                        <div className="text-5xl mb-4">🛑</div>
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">Unsubscribed Successfully</h3>
                        <p className="text-gray-600 mb-6">You will now stop receiving SMS alerts from SurgeAlert.</p>
                        <button onClick={() => navigate('/')} className="custom-btn btn-blue w-full">Go to Home</button>
                    </div>
                )}

            </div>
        </div>
    );
}
