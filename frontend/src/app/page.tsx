'use client';

import { useState, useRef, useEffect } from 'react';
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

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFilename, setAudioFilename] = useState('podcast.wav');

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
        headers: {
          'Content-Type': 'application/json',
        },
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
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while generating audio.';
      setError(message);
    } finally {
      setIsAudioLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Data Analyzer</h1>
          <p className={styles.subtitle}>Upload your Analytics data and get AI-powered insights</p>
        </div>

        <div className={styles.uploadSection}>
          <input
            type="file"
            accept=".csv, .xlsx"
            onChange={handleFileChange}
            className={styles.fileInput}
            ref={fileInputRef}
          />
          <button
            onClick={handleAnalyse}
            disabled={!file || isLoading}
            className={styles.button}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner}></span> Analyzing...
              </>
            ) : (
              'Analyse Data'
            )}
          </button>
        </div>

        {error && (
          <div className={styles.error}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            {error}
          </div>
        )}

        {result && (
          <div className={styles.results}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Metrics Summary</h2>
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
                    {result.summary_table?.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.metric}</td>
                        <td>{item.value}</td>
                        <td>{item.change}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Questions & Answers</h2>
              <ol className={styles.qaList}>
                {result.questions_and_answers?.map((qa, idx) => (
                  <li key={idx} className={styles.qaItem}>
                    <div className={styles.question}>{qa.question}</div>
                    <div className={styles.answer}>{qa.answer}</div>
                  </li>
                ))}
              </ol>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Executive Summary</h2>
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
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Podcast Script</h2>
              <div className={styles.scriptBlock}>
                {result.podcast_script}
              </div>

              <div className={styles.audioActions}>
                {!audioUrl ? (
                  <button
                    onClick={handleGenerateAudio}
                    disabled={isAudioLoading}
                    className={styles.button}
                  >
                    {isAudioLoading ? (
                      <>
                        <span className={styles.spinner}></span> Generating audio...
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
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download audio
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          clearAudio();
                          handleGenerateAudio();
                        }}
                        disabled={isAudioLoading}
                        className={styles.secondaryButton}
                      >
                        Regenerate audio
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
