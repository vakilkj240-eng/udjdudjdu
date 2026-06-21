import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axios from 'axios';
import { Loader2, CheckCircle, XCircle, Video, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

import API_URL from '../lib/api';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState('checking');
  const [paymentData, setPaymentData] = useState(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (sessionId) pollStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const pollStatus = async () => {
    const maxAttempts = 5;
    let currentAttempt = 0;

    const poll = async () => {
      if (currentAttempt >= maxAttempts) {
        setStatus('timeout');
        return;
      }

      try {
        const { data } = await axios.get(`${API_URL}/api/payments/status/${sessionId}`, {  });
        setPaymentData(data);

        if (data.payment_status === 'paid') {
          setStatus('success');
          return;
        } else if (data.status === 'expired') {
          setStatus('failed');
          return;
        }

        currentAttempt++;
        setAttempts(currentAttempt);
        setTimeout(poll, 2000);
      } catch {
        currentAttempt++;
        setAttempts(currentAttempt);
        setTimeout(poll, 2000);
      }
    };

    poll();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" data-testid="payment-success-page">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center"
        >
          {status === 'checking' && (
            <div data-testid="payment-checking">
              <Loader2 className="w-16 h-16 text-amber-500 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Verifying Payment...</h2>
              <p className="text-sm text-slate-500">Attempt {attempts + 1} of 5</p>
            </div>
          )}

          {status === 'success' && (
            <div data-testid="payment-success">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h2>
              <p className="text-slate-600 mb-6">Your consultation has been booked.</p>

              {paymentData?.video_room_id && (
                <div className="bg-slate-50 rounded-xl p-5 mb-6">
                  <p className="text-sm text-slate-500 mb-2">Your Consultation Room</p>
                  <p className="font-mono text-lg font-bold text-slate-800 mb-3">{paymentData.video_room_id}</p>
                  <button
                    onClick={() => navigate(`/video/${paymentData.video_room_id}`)}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-6 rounded-lg transition-colors inline-flex items-center gap-2"
                    data-testid="join-room-btn"
                  >
                    <Video className="w-5 h-5" /> Join Video Room
                  </button>
                </div>
              )}

              <button
                onClick={() => navigate('/client/consultations')}
                className="text-sm text-slate-600 hover:text-slate-800 inline-flex items-center gap-1"
              >
                View All Consultations <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {(status === 'failed' || status === 'timeout') && (
            <div data-testid="payment-failed">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment {status === 'timeout' ? 'Pending' : 'Failed'}</h2>
              <p className="text-slate-600 mb-6">
                {status === 'timeout' ? 'Payment is still processing. Please check your consultations later.' : 'Something went wrong. Please try again.'}
              </p>
              <button
                onClick={() => navigate('/client/dashboard')}
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
