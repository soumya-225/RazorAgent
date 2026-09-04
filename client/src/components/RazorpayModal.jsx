import React, { useState, useEffect } from 'react';
import { X, CheckCircle, QrCode, CreditCard, Landmark, Smartphone, Shield, ArrowRight, ExternalLink, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '../api';

export default function RazorpayModal({ isOpen, onClose, order, onSuccess }) {
  const [activeMethod, setActiveMethod] = useState('upi');
  const [processing, setProcessing] = useState(false);
  const [paidSuccess, setPaidSuccess] = useState(false);
  const [vpa, setVpa] = useState('customer@okhdfcbank');
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [isRazorpayLive, setIsRazorpayLive] = useState(false);

  useEffect(() => {
    // Fetch razorpay public config
    api.get('/api/orders/razorpay-config')
      .then(res => {
        if (res.data?.keyId) {
          setRazorpayKeyId(res.data.keyId);
          setIsRazorpayLive(res.data.isLive);
        }
      })
      .catch(() => {});

    // Ensure Razorpay SDK script is loaded
    if (!window.Razorpay && !document.getElementById('razorpay-checkout-script')) {
      const script = document.createElement('script');
      script.id = 'razorpay-checkout-script';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  if (!isOpen || !order) return null;

  const orderIdentifier = order.id || order.orderId;
  const amountDisplay = order.totalAmountInr || (order.totalAmountPaise ? order.totalAmountPaise / 100 : (order.amountInr || 0));

  // Handle Official Razorpay Checkout Modal
  const handleOpenOfficialRazorpayCheckout = () => {
    if (!window.Razorpay) {
      alert('Razorpay Checkout SDK is still loading. Please try again in a moment or use the instant simulator.');
      return;
    }

    const key = razorpayKeyId || 'rzp_test_TXaPIZEkUn6ghl';
    const razorpayOrderId = order.razorpayOrderId;

    const options = {
      key: key,
      amount: order.totalAmountPaise || (amountDisplay * 100),
      currency: order.currency || 'INR',
      name: 'RazorAgent Commerce',
      description: `Order #${order.orderNumber || order.id?.slice(0, 10)}`,
      order_id: razorpayOrderId && razorpayOrderId.startsWith('order_') && !razorpayOrderId.startsWith('order_test_') ? razorpayOrderId : undefined,
      prefill: {
        name: order.customerName || 'Demo Customer',
        email: order.customerEmail || 'shopper@razoragent.demo',
        contact: order.customerPhone || '+919876543210'
      },
      theme: {
        color: '#2563eb'
      },
      handler: async function (response) {
        setProcessing(true);
        try {
          // Verify payment signature on backend
          const verifyRes = await api.post(`/api/orders/${orderIdentifier}/verify-payment`, {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id || razorpayOrderId,
            razorpay_signature: response.razorpay_signature
          });

          setProcessing(false);
          setPaidSuccess(true);
          confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });

          if (onSuccess) {
            setTimeout(() => onSuccess(verifyRes.data), 1200);
          }
        } catch (err) {
          setProcessing(false);
          alert('Payment verification error: ' + (err.response?.data?.error || err.message));
        }
      },
      modal: {
        ondismiss: function () {
          console.log('Razorpay modal closed by user');
        }
      }
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        alert('Payment Failed: ' + (response.error?.description || 'Authorization failed.'));
      });
      rzp.open();
    } catch (err) {
      console.warn('Razorpay SDK open error, falling back to simulated pay:', err);
      handleSimulatePayment();
    }
  };

  const handleSimulatePayment = async () => {
    setProcessing(true);
    try {
      const res = await api.post(`/api/orders/${orderIdentifier}/pay-simulate`);
      
      setProcessing(false);
      setPaidSuccess(true);

      // Trigger confetti celebration
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

      if (onSuccess) {
        setTimeout(() => {
          onSuccess(res.data);
        }, 1200);
      }
    } catch (err) {
      setProcessing(false);
      alert('Payment processing error: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 relative">
        
        {/* Razorpay Branded Top Header */}
        <div className="bg-[#0c2340] p-4 flex items-center justify-between border-b border-blue-900/40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
              ₹
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white tracking-wide">Razorpay</span>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/30">
                  {isRazorpayLive ? 'Live Test Mode' : 'Sandbox Simulator'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-mono">Order #{order.orderNumber || order.id?.slice(0, 10)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {paidSuccess ? (
          /* Payment Success State */
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center animate-bounce">
              <CheckCircle className="w-9 h-9" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Payment Successful!</h3>
              <p className="text-xs text-slate-400 mt-1">₹{amountDisplay.toLocaleString('en-IN')} paid via Razorpay</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 text-left text-xs font-mono space-y-1 text-slate-300">
              <div><span className="text-slate-500">Order:</span> #{order.orderNumber || order.id}</div>
              <div><span className="text-slate-500">Status:</span> <span className="text-emerald-400 font-semibold">PAID & CAPTURED</span></div>
              <div><span className="text-slate-500">Audit Trail:</span> <span className="text-blue-400 font-semibold">Logged</span></div>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-white text-sm shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          /* Payment Methods & Actions */
          <div className="p-5 space-y-4">
            {/* Amount Summary */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <span className="text-xs text-slate-400">Total Payable Amount</span>
                <div className="text-2xl font-extrabold text-white">₹{amountDisplay.toLocaleString('en-IN')}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 justify-end">
                  <Shield className="w-3 h-3" /> 256-Bit Encrypted
                </span>
                <span className="text-[10px] text-slate-500">RazorAgent Secure Bridge</span>
              </div>
            </div>

            {/* Official Razorpay Standard Checkout Button */}
            <button
              onClick={handleOpenOfficialRazorpayCheckout}
              disabled={processing}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold text-white text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              Open Official Razorpay Checkout Popup
            </button>

            {/* Direct Hosted Payment Link option if available */}
            {order.paymentLinkUrl && (
              <a
                href={order.paymentLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                Open Hosted Razorpay Payment Link ({order.paymentLinkUrl.replace('https://', '')})
              </a>
            )}

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-2 text-[10px] uppercase text-slate-500 font-mono">or 1-click test simulation</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* Payment Method Selector for Simulator */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setActiveMethod('upi')}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition-all ${
                  activeMethod === 'upi'
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Smartphone className="w-4 h-4 text-sky-400" />
                UPI / QR
              </button>
              <button
                onClick={() => setActiveMethod('card')}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition-all ${
                  activeMethod === 'card'
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <CreditCard className="w-4 h-4 text-indigo-400" />
                Cards
              </button>
              <button
                onClick={() => setActiveMethod('netbanking')}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition-all ${
                  activeMethod === 'netbanking'
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Landmark className="w-4 h-4 text-emerald-400" />
                Netbanking
              </button>
            </div>

            {/* Method Details */}
            {activeMethod === 'upi' && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-white p-1 flex items-center justify-center shrink-0">
                    <QrCode className="w-10 h-10 text-slate-900" />
                  </div>
                  <div className="text-xs space-y-0.5">
                    <div className="font-semibold text-slate-200">Scan QR with any UPI App</div>
                    <div className="text-slate-400 text-[10px]">GPay, PhonePe, Paytm, BHIM</div>
                    <div className="text-[10px] text-blue-400 font-mono">Simulated Instant Capture</div>
                  </div>
                </div>
              </div>
            )}

            {activeMethod === 'card' && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="text-slate-400 text-[11px]">Test Card Credentials (Auto-filled)</div>
                <input
                  type="text"
                  readOnly
                  value="4111 1111 1111 1111 (Expiry: 12/28)"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-mono text-xs"
                />
              </div>
            )}

            {activeMethod === 'netbanking' && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <div className="text-slate-400 text-[11px] mb-1.5">Simulated Test Bank</div>
                <div className="p-1.5 rounded-lg bg-slate-900 border border-blue-500/40 text-blue-300 font-medium text-center">
                  HDFC Bank (Test Sandbox)
                </div>
              </div>
            )}

            {/* Instant Sandbox Pay Action Button */}
            <button
              onClick={handleSimulatePayment}
              disabled={processing}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 font-semibold text-slate-200 text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {processing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Authorizing Payment...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Instant 1-Click Sandbox Pay (₹{amountDisplay.toLocaleString('en-IN')})
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

