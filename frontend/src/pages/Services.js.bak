import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, FileText, Video, ArrowRight, CheckCircle, Shield } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';

const Services = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleServiceClick = (requiresAuth, path) => {
    if (requiresAuth && !user) {
      navigate('/login');
    } else {
      navigate(path);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100" data-testid="services-page">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-2 mb-4">
            <Shield className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-600">Professional Legal Services</span>
          </div>
          <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight mb-6">
            How Can We Help You?
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Choose from our comprehensive range of legal services designed to connect you with expert legal representation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <div 
            className="group bg-white rounded-2xl shadow-lg border-2 border-slate-200 hover:border-slate-900 p-10 transition-all duration-300 hover:shadow-2xl cursor-pointer" 
            data-testid="service-find-lawyer"
            onClick={() => handleServiceClick(true, '/lawyer/dashboard')}
          >
            <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Search className="w-10 h-10 text-white" />
            </div>
            <h3 className="font-heading text-2xl font-bold text-slate-900 mb-4">Find a Lawyer</h3>
            <p className="text-slate-600 leading-relaxed mb-6">
              Browse through our verified network of experienced lawyers across different specializations and locations. All lawyers are bar-certified with proven track records.
            </p>
            <div className="flex items-center text-slate-900 font-semibold group-hover:gap-3 gap-2 transition-all">
              Browse Lawyers <ArrowRight className="w-5 h-5" />
            </div>
          </div>

          <div 
            className="group bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl shadow-lg border-2 border-amber-600 p-10 transition-all duration-300 hover:shadow-2xl cursor-pointer transform hover:-translate-y-1" 
            data-testid="service-post-case"
            onClick={() => handleServiceClick(true, '/client/dashboard')}
          >
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <FileText className="w-10 h-10 text-amber-600" />
            </div>
            <h3 className="font-heading text-2xl font-bold text-white mb-4">Post a Case</h3>
            <p className="text-white/90 leading-relaxed mb-6">
              Submit your case details and get AI-powered analysis. Let qualified lawyers reach out to you with their expertise and competitive rates.
            </p>
            <div className="flex items-center text-white font-semibold group-hover:gap-3 gap-2 transition-all">
              Post Your Case <ArrowRight className="w-5 h-5" />
            </div>
          </div>

          <div 
            className="group bg-white rounded-2xl shadow-lg border-2 border-slate-200 hover:border-slate-400 p-10 transition-all duration-300 hover:shadow-2xl" 
            data-testid="service-consultation"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl flex items-center justify-center mb-6 opacity-50">
              <Video className="w-10 h-10 text-white" />
            </div>
            <h3 className="font-heading text-2xl font-bold text-slate-900 mb-4">Online Consultation</h3>
            <p className="text-slate-600 leading-relaxed mb-6">
              Get instant legal advice through video calls or chat with experienced lawyers from anywhere. Available 24/7 for urgent matters.
            </p>
            <div className="inline-block bg-slate-100 text-slate-600 font-semibold px-4 py-2 rounded-lg">
              Coming Soon
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl shadow-2xl p-12 lg:p-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h2 className="font-heading text-4xl font-bold text-white mb-6 leading-tight">
                Why Choose VakilSetu?
              </h2>
              <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                India's most trusted legal services platform with cutting-edge technology and verified professionals.
              </p>
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-lg mb-1">Verified Lawyers</h4>
                    <p className="text-slate-300">All lawyers are bar-certified and background-verified with proven track records.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-lg mb-1">Transparent Pricing</h4>
                    <p className="text-slate-300">Know the costs upfront with no hidden charges or surprise fees.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-lg mb-1">Quick Response</h4>
                    <p className="text-slate-300">Get responses from lawyers within 24 hours of case submission.</p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h2 className="font-heading text-4xl font-bold text-white mb-6 leading-tight">
                How It Works
              </h2>
              <div className="space-y-6">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center">
                      <span className="font-heading text-2xl font-bold text-white">1</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-lg mb-2">Submit Your Case</h4>
                    <p className="text-slate-300">Fill out our intelligent questionnaire and get instant AI-powered analysis.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center">
                      <span className="font-heading text-2xl font-bold text-white">2</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-lg mb-2">Get Matched</h4>
                    <p className="text-slate-300">We match you with qualified lawyers based on specialization and location.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center">
                      <span className="font-heading text-2xl font-bold text-white">3</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-lg mb-2">Connect & Resolve</h4>
                    <p className="text-slate-300">Work with your lawyer to achieve the best possible outcome for your case.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Services;
