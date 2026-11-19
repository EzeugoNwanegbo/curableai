import { useState } from "react";
import { Link } from "@tanstack/react-router";
import "./demo/demo.css";

const prompts = [
  ["Main concern", "What do you most want to discuss?"],
  ["Timeline", "When did it start, and what has changed?"],
  ["Medicines and allergies", "What do you take, and are there any allergies you want to mention?"],
  ["Questions for your clinician", "What would you like to ask before you leave?"],
] as const;

export function VisitPrep() {
  const [answers, setAnswers] = useState<string[]>(["", "", "", ""]);
  const summary = prompts
    .map(([label], index) => (answers[index].trim() ? label + "\n" + answers[index].trim() : ""))
    .filter(Boolean)
    .join("\n\n");

  function downloadNote() {
    if (!summary) return;
    const url = URL.createObjectURL(
      new Blob(["My clinic visit\n\n", summary], { type: "text/plain" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "my-clinic-visit.txt";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="cd cd-welcome">
      <header className="cd-welcome-nav">
        <Link className="cd-brand" to="/">
          curable<span>.</span>
        </Link>
        <Link to="/">Back to Curable</Link>
      </header>
      <main className="cd-welcome-main">
        <div className="mx-auto max-w-xl space-y-6">
          <h1>Prepare for your clinic visit</h1>
          <p>
            Write down what you want your clinician to know. Your answers stay in this tab unless
            you download the note. Anyone with access to the downloaded file can read it.
          </p>
          {prompts.map(([label, hint], index) => (
            <label key={label} className="block space-y-2">
              <span className="block font-medium">{label}</span>
              <textarea
                rows={2}
                maxLength={1500}
                placeholder={hint}
                value={answers[index]}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setAnswers((previous) =>
                    previous.map((answer, i) => (i === index ? value : answer)),
                  );
                }}
                className="w-full rounded-lg border border-input bg-card p-3 text-foreground"
              />
            </label>
          ))}
          {summary && (
            <section aria-labelledby="visit-note-title">
              <h2 id="visit-note-title" className="mb-2">
                Your visit note
              </h2>
              <pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-4 font-sans">
                {summary}
              </pre>
            </section>
          )}
          <button className="cd-primary" type="button" onClick={downloadNote} disabled={!summary}>
            Download visit note
          </button>
        </div>
      </main>
    </div>
  );
}
