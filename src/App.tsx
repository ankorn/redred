import { useState } from "react";

import "./App.css";
import { useModel } from "./useModel";
import { fetchTopPosts } from "./fetchRedditPosts";

function App() {
  const [subreddit, setSubreddit] = useState("");
  const [summaries, setSummaries] = useState<
    Record<string, { text: string; id: string }>
  >({});
  const [loading, setLoading] = useState(false);

  const { ready, progress, status, summarize, cached, downloadModel } =
    useModel();

  const handleSummarize = async () => {
    setLoading(true);

    setSummaries({});

    const posts = await fetchTopPosts(subreddit || "machinelearning");

    posts.forEach(async ({ text, id, url }, idx) => {
      await summarize({ text, url }, subreddit, (streamingText: string) =>
        setSummaries((state) => {
          setLoading(false);

          const newState: Record<string, { text: string; id: string }> = {
            ...state,
            [idx]: { text: (state[idx]?.text || "") + streamingText, id },
          };

          return newState;
        }),
      );
    });
  };

  return (
    <div className="redred-app">
      <header className="app-header">
        <h1>redred</h1>
        <p>
          lightweight multi-modal subreddit summariser that runs locally
          securing your privacy
        </p>
      </header>

      <section className="model-status" aria-live="polite">
        {!ready ? (
          <>
            <div className="progress-block">
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="progress-label">
                {status === "checking"
                  ? "Checking local cache…"
                  : `${cached ? "Loading model from cache" : "Downloading model"}… ${progress}%`}
              </span>
              {!cached && (
                <button
                  onClick={downloadModel}
                  className="downloadButton"
                  disabled={status !== "ready"}
                >
                  Download 3GB model. This will only happen once
                </button>
              )}
            </div>
          </>
        ) : (
          <span className="ready-badge">Model ready · running locally</span>
        )}
      </section>

      <section className="input-section">
        <label htmlFor="subreddit">r/</label>
        <input
          id="subreddit"
          type="text"
          value={subreddit}
          onChange={(e) => setSubreddit(e.target.value)}
          placeholder="machinelearning"
          onKeyDown={(e) => e.key === "Enter" && handleSummarize()}
          disabled={loading}
        />
      </section>

      <section className="summaries">
        {loading && (
          <p className="summary-text">Loading "{subreddit}" posts...</p>
        )}
        {Object.keys(summaries).map((key, idx) => (
          <article
            key={summaries[key].id}
            className="summary-card"
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            <p className="summary-text">
              {summaries[key].text || <span className="placeholder">…</span>}
            </p>
          </article>
        ))}
      </section>

      <footer className="app-footer">
        <a
          href="https://github.com/ankorn"
          target="_blank"
          rel="noopener noreferrer"
        >
          github
        </a>
        <span className="dot">·</span>
        <a
          href="https://huggingface.co/pameydorke"
          target="_blank"
          rel="noopener noreferrer"
        >
          huggingface
        </a>
      </footer>
    </div>
  );
}

export default App;
