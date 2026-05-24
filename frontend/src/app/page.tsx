'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type Metric = { metric: string; value: string; change: string };
type QA = { question: string; answer: string };
type ExecSummary = { area: string; key_finding: string; implication: string };

type AnalysisResult = {
  summary_table: Metric[];
  questions_and_answers: QA[];
  exec_summary: ExecSummary[];
  podcast_script: string;
};

type Tab = 'overview' | 'qa' | 'exec' | 'podcast';

function isNegativeChange(change: string) {
  return change.includes('↓') || change.includes('-') || change.toLowerCase().includes('decrease');
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFilename, setAudioFilename] = useState('podcast.wav');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [activeMetric, setActiveMetric] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const clearAudio = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioFilename('podcast.wav');
  };

  const handleAnalyse = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    clearAudio();
    setActiveTab('overview');
    setActiveMetric(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/analyse`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Analysis failed');
      }

      const data: AnalysisResult = await response.json();
      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred during analysis.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!result?.podcast_script) return;

    setIsAudioLoading(true);
    setError(null);
    clearAudio();

    try {
      const response = await fetch(`${API_URL}/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ podcast_script: result.podcast_script }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        const detail = errData?.detail;
        const message = typeof detail === 'string' ? detail : 'Failed to generate audio';
        throw new Error(message);
      }

      const blob = await response.blob();
      if (!blob.type.startsWith('audio/')) {
        throw new Error('Server did not return audio. Check backend logs.');
      }
      const ext = blob.type.includes('wav') ? 'wav' : 'mp3';
      setAudioFilename(`podcast.${ext}`);
      setAudioUrl(URL.createObjectURL(blob));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while generating audio.';
      setError(message);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const topMetrics = result?.summary_table?.slice(0, 3) ?? [];

  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <Image src="/speed-icon.png" alt="Speed icon" width={36} height={36} />
          <Image src="/speed-logo.png" alt="Speed" className={styles.navWordmark} width={80} height={20} />
        </div>
      </nav>

      <section className={styles.analyserSection} id="analyser">
        <div className={styles.sectionTag}>— Core Tool</div>
        <h2 className={styles.sectionTitle}>Data<br />Analyser</h2>
        <p className={styles.sectionDesc}>
          Connect your data sources and get instant, actionable intelligence. No data science degree required.
        </p>

        <div className={styles.analyserUi}>
          <aside className={styles.sidebar}>
            <div>
              <div className={styles.sidebarHead}>Data Sources</div>
              <div
                className={styles.uploadZone}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ marginBottom: 12, opacity: 0.7 }}>
                  <path d="M16 4L16 22M8 12L16 4L24 12" stroke="#E8102A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6 26H26" stroke="#E8102A" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p><strong>Drop files here</strong> or click to upload<br />CSV, XLSX supported</p>
                {file && <div className={styles.fileName}>{file.name}</div>}
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileChange}
                  className={styles.hiddenInput}
                  ref={fileInputRef}
                />
              </div>
            </div>

            {result?.summary_table && result.summary_table.length > 0 && (
              <div>
                <div className={styles.sidebarHead}>Live Metrics</div>
                <div className={styles.metricsList}>
                  {result.summary_table.map((item, idx) => (
                    <div
                      key={idx}
                      className={`${styles.metricItem} ${idx === activeMetric ? styles.metricItemActive : ''}`}
                      onClick={() => setActiveMetric(idx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setActiveMetric(idx)}
                    >
                      <span className={styles.metricName}>{item.metric}</span>
                      <span className={styles.metricVal}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.sidebarActions}>
              <button
                onClick={handleAnalyse}
                disabled={!file || isLoading}
                className={styles.btnPrimary}
              >
                {isLoading ? (
                  <>
                    <span className={styles.spinner} /> Analysing...
                  </>
                ) : (
                  'Run Analysis'
                )}
              </button>
            </div>
          </aside>

          <div className={styles.mainPanel}>
            <div className={styles.panelTabs}>
              {(['overview', 'qa', 'exec', 'podcast'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'overview' && 'Overview'}
                  {tab === 'qa' && 'Q&A'}
                  {tab === 'exec' && 'Exec Summary'}
                  {tab === 'podcast' && 'Podcast'}
                </button>
              ))}
            </div>

            <div className={styles.panelBody}>
              {error && (
                <div className={styles.error}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              {!result && !error && (
                <div className={styles.emptyState}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <rect x="8" y="12" width="32" height="28" rx="2" stroke="#E8102A" strokeWidth="1.5"/>
                    <path d="M16 22H32M16 28H28M16 34H24" stroke="#E8102A" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <p>Upload a CSV or XLSX file and run analysis to see your insights here.</p>
                </div>
              )}

              {result && activeTab === 'overview' && (
                <>
                  {topMetrics.length > 0 && (
                    <div className={styles.metricsGrid}>
                      {topMetrics.map((item, idx) => (
                        <div key={idx} className={styles.metricCard}>
                          <div className={styles.metricCardLabel}>{item.metric}</div>
                          <div className={styles.metricCardValue}>{item.value}</div>
                          <div className={`${styles.metricCardChange} ${isNegativeChange(item.change) ? styles.metricCardChangeNegative : ''}`}>
                            {item.change}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.summary_table && result.summary_table.length > 0 && (
                    <div className={styles.chartContainer}>
                      <div className={styles.chartHeader}>
                        <div>
                          <div className={styles.chartTitle}>Metrics Summary</div>
                          <div className={styles.chartSub}>All key performance indicators</div>
                        </div>
                      </div>
                      <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Metric</th>
                              <th>Value</th>
                              <th>Change</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.summary_table.map((item, idx) => (
                              <tr key={idx}>
                                <td>{item.metric}</td>
                                <td>{item.value}</td>
                                <td>{item.change}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className={styles.chartContainer}>
                    <div className={styles.chartHeader}>
                      <div>
                        <div className={styles.chartTitle}>Conversion Rate Trend</div>
                        <div className={styles.chartSub}>Visual overview — current period</div>
                      </div>
                    </div>
                    <svg viewBox="0 0 600 150" preserveAspectRatio="none" style={{ width: '100%', height: 180 }}>
                      <defs>
                        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#E8102A" stopOpacity="0.25"/>
                          <stop offset="100%" stopColor="#E8102A" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="37" x2="600" y2="37" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                      <line x1="0" y1="75" x2="600" y2="75" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                      <line x1="0" y1="112" x2="600" y2="112" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                      <path d="M0,110 C40,95 80,80 120,70 C160,60 200,65 240,50 C280,35 320,45 360,30 C400,18 440,28 480,20 C520,12 560,18 600,15 L600,150 L0,150 Z" fill="url(#lineGrad)"/>
                      <path d="M0,110 C40,95 80,80 120,70 C160,60 200,65 240,50 C280,35 320,45 360,30 C400,18 440,28 480,20 C520,12 560,18 600,15" fill="none" stroke="#E8102A" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="600" cy="15" r="4" fill="#E8102A"/>
                      <circle cx="600" cy="15" r="8" fill="rgba(232,16,42,0.2)"/>
                    </svg>
                  </div>
                </>
              )}

              {result && activeTab === 'qa' && (
                <div className={styles.chartContainer}>
                  <div className={styles.chartHeader}>
                    <div>
                      <div className={styles.chartTitle}>Questions & Answers</div>
                      <div className={styles.chartSub}>AI-generated insights from your data</div>
                    </div>
                  </div>
                  <ol className={styles.qaList}>
                    {result.questions_and_answers?.map((qa, idx) => (
                      <li key={idx} className={styles.qaItem}>
                        <div className={styles.question}>{qa.question}</div>
                        <div className={styles.answer}>{qa.answer}</div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {result && activeTab === 'exec' && (
                <div className={styles.chartContainer}>
                  <div className={styles.chartHeader}>
                    <div>
                      <div className={styles.chartTitle}>Executive Summary</div>
                      <div className={styles.chartSub}>Key findings and strategic implications</div>
                    </div>
                  </div>
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Area</th>
                          <th>Key Finding</th>
                          <th>Implication</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.exec_summary?.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.area}</td>
                            <td>{item.key_finding}</td>
                            <td>{item.implication}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result && activeTab === 'podcast' && (
                <div className={styles.chartContainer}>
                  <div className={styles.chartHeader}>
                    <div>
                      <div className={styles.chartTitle}>Podcast Script</div>
                      <div className={styles.chartSub}>AI-generated audio briefing from your data</div>
                    </div>
                  </div>
                  <div className={styles.scriptBlock}>{result.podcast_script}</div>
                  <div className={styles.audioActions}>
                    {!audioUrl ? (
                      <button
                        onClick={handleGenerateAudio}
                        disabled={isAudioLoading}
                        className={styles.btnPrimary}
                      >
                        {isAudioLoading ? (
                          <>
                            <span className={styles.spinner} /> Generating audio...
                          </>
                        ) : (
                          'Generate Podcast Audio'
                        )}
                      </button>
                    ) : (
                      <div className={styles.audioPlayerSection}>
                        <audio controls src={audioUrl} className={styles.audioPlayer}>
                          Your browser does not support audio playback.
                        </audio>
                        <div className={styles.audioButtons}>
                          <a href={audioUrl} download={audioFilename} className={styles.downloadLink}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                              <polyline points="7 10 12 15 17 10"/>
                              <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Download audio
                          </a>
                          <button
                            type="button"
                            onClick={() => { clearAudio(); handleGenerateAudio(); }}
                            disabled={isAudioLoading}
                            className={styles.btnSecondary}
                          >
                            Regenerate audio
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <Image src="/speed-icon.png" alt="Speed" width={28} height={28} />
          <span className={styles.footerCopy}>Speed Data Analyser — Demo Build</span>
        </div>
        <div className={styles.footerCopy}>© 2026 Speed Agency. All rights reserved.</div>
      </footer>
    </>
  );
}
