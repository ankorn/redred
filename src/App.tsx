import { useState } from "react";

import "./App.css";
import { useModel } from "./useModel";
import { fetchTopPosts } from "./fetchRedditPosts";
import type { AxiosError } from "axios";

function App() {
  const [subreddit, setSubreddit] = useState("");
  const [summaries, setSummaries] = useState<
    Record<string, { text: string; id: string }>
  >({});
  const [loading, setLoading] = useState(false);
  const [postsFetchError, setPostsFetchError] = useState<AxiosError | null>(
    null,
  );

  const { ready, progress, status, summarize, cached, downloadModel } =
    useModel();

  const handleSummarize = async () => {
    setLoading(true);

    setSummaries({});
    setPostsFetchError(null);

    const postsResult = await fetchTopPosts(subreddit || "machinelearning");
    if (!("length" in postsResult)) {
      setPostsFetchError(postsResult);

      setLoading(false);

      return;
    }

    postsResult.forEach(async ({ text, id, url }, idx) => {
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
        <details open>
          <summary>
            small multi-modal subreddit summariser that runs locally
          </summary>
          <ul>
            <li>handles posts, comments and images</li>
            <li>protects you from Reddit’s notorious toxicity</li>
            <li>zero data footprint: all processing happens on your device</li>
          </ul>
        </details>
      </header>

      <section className="model-status" aria-live="polite">
        {!ready ? (
          <>
            <div className="progress-block">
              {status === "loading" && (
                <>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <span className="progress-label">
                    {`${cached ? "loading model from cache" : "downloading model"}… ${progress}%`}
                  </span>
                </>
              )}
              {!cached && status !== "loading" && (
                <>
                  <button onClick={downloadModel} className="downloadButton">
                    Download 3.5GB model
                  </button>
                  <span className="button-subtext">
                    This will only happen once
                  </span>
                </>
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
          disabled={!ready}
        />
      </section>

      <section className="summaries">
        {loading && (
          <p className="summary-text">loading "{subreddit}" posts...</p>
        )}
        {postsFetchError && (
          <p className="summary-text">
            {postsFetchError.response?.status === 404
              ? "subreddit not found"
              : "something went wrong, reload page and repeat later"}
          </p>
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
