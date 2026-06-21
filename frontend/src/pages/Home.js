import React from 'react';
import Navbar from '../components/Navbar';
import HeroSection from '../components/home/HeroSection';
import AILegalAssistant from '../components/home/AILegalAssistant';
import SmartCaseMatching from '../components/home/SmartCaseMatching';
import AffidavitBuilder from '../components/home/AffidavitBuilder';
import VoiceAI from '../components/home/VoiceAI';
import LegalAnalytics from '../components/home/LegalAnalytics';
import Testimonials from '../components/home/Testimonials';
import FinalCTA from '../components/home/FinalCTA';

const Home = () => {
  return (
    <div className="min-h-screen bg-transparent text-foreground overflow-x-hidden" data-testid="home-page">
      <Navbar noSpacer />
      <HeroSection />
      <AILegalAssistant />
      <SmartCaseMatching />
      <AffidavitBuilder />
      <VoiceAI />
      <LegalAnalytics />
      <Testimonials />
      <FinalCTA />
    </div>
  );
};

export default Home;
