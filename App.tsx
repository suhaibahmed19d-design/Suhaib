import React, { useState, useEffect } from 'react';
import { NavigationTab, VideoJob, VideoMetadata } from './types';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomeView } from './views/HomeView';
import { EnhancerView } from './views/EnhancerView';
import { InspectorView } from './views/InspectorView';
import { JobsView } from './views/JobsView';
import { SettingsView } from './views/SettingsView';
import { AccountView } from './views/AccountView';
import { fetchJson } from './utils/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [currentJob, setCurrentJob] = useState<VideoJob | null>(null);
  const [activeJobsCount, setActiveJobsCount] = useState<number>(0);
  const [injectedMetadata, setInjectedMetadata] = useState<VideoMetadata | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  // Poll active jobs count for top bar badge
  const updateActiveCount = async () => {
    try {
      const data = await fetchJson<{ jobs?: VideoJob[] }>('/api/jobs');
      const running = (data.jobs || []).filter((j: VideoJob) => j.status === 'processing').length;
      setActiveJobsCount(running);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    updateActiveCount();
    const interval = setInterval(updateActiveCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Quick try sample action from Home hero
  const handleTrySample = async () => {
    setIsLoadingSample(true);
    try {
      const data = await fetchJson<{ success?: boolean; metadata?: VideoMetadata }>('/api/sample-video');
      if (data.success && data.metadata) {
        setInjectedMetadata(data.metadata);
        setActiveTab('enhancer');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSample(false);
    }
  };

  // From inspector: forward video to enhancer
  const handleSelectForEnhancement = (metadata: VideoMetadata) => {
    setInjectedMetadata(metadata);
    setActiveTab('enhancer');
  };

  // From jobs: select job to view in enhancer
  const handleSelectJob = (job: VideoJob) => {
    setCurrentJob(job);
    setActiveTab('enhancer');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F17] text-neutral-100 font-sans selection:bg-rose-500/30 selection:text-rose-200">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeJobsCount={activeJobsCount}
      />

      <main className="flex-1">
        {activeTab === 'home' && (
          <HomeView
            setActiveTab={setActiveTab}
            onTrySample={handleTrySample}
            isLoadingSample={isLoadingSample}
          />
        )}

        {activeTab === 'enhancer' && (
          <EnhancerView
            currentJob={currentJob}
            setCurrentJob={setCurrentJob}
            onJobStarted={() => updateActiveCount()}
            sampleMetadata={injectedMetadata}
          />
        )}

        {activeTab === 'inspector' && (
          <InspectorView
            onSelectForEnhancement={handleSelectForEnhancement}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'jobs' && (
          <JobsView
            onSelectJob={handleSelectJob}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'settings' && <SettingsView />}

        {activeTab === 'account' && <AccountView />}
      </main>

      <Footer setActiveTab={setActiveTab} />
    </div>
  );
}
