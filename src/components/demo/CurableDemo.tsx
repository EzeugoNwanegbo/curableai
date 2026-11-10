import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Plus, Send, X } from "lucide-react";
import "./demo.css";
type View = "home" | "chat" | "records" | "care" | "doctor";
type Message = { role: "student" | "assistant"; text: string };
const history = [
  ["Allergies", "Penicillin", "Recorded at clinic intake"],
  ["Ongoing conditions", "Mild asthma", "Diagnosed 2022 · routine follow-up"],
  ["Medication", "Salbutamol inhaler", "As needed · per recorded prescription"],
  ["Last clinic visit", "12 October 2026", "Routine asthma review"],
  ["Recent result", "Haemoglobin: 13.2 g/dL", "12 October 2026 · sample result"],
  ["Student profile", "Amara Okafor · age 21", "300 level · Computer Science"],
];
export function CurableDemo() {
  const [view, setView] = useState<View>("home");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [review, setReview] = useState(false);
  const [summary, setSummary] = useState("");
  const [goal, setGoal] = useState(
    "I would like a doctor to review my concern and advise me on the next steps.",
  );
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"none" | "pending" | "accepted">("none");
  const [submitted, setSubmitted] = useState({ summary: "", goal: "" });
  const [doctorInput, setDoctorInput] = useState("");
  const [doctorMessages, setDoctorMessages] = useState<{ role: string; text: string }[]>([]);
  const [role, setRole] = useState<"student" | "doctor">("student");
  function send(text = input) {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "student", text: text.trim() },
      {
        role: "assistant",
        text: "This is a scripted demonstration, not a medical assessment. Your sample record includes mild asthma, a salbutamol inhaler and a penicillin allergy. In the connected experience, Curable would use relevant history to ask follow-up questions and explain reliable health information. What started this concern, how long has it been happening, and what would you like help understanding?",
      },
    ]);
    setInput("");
    setView("chat");
  }
  function openReview() {
    setSummary(
      messages
        .filter((m) => m.role === "student")
        .map((m) => m.text)
        .join("\n\n"),
    );
    setConsent(false);
    setReview(true);
  }
  const nav: [View, string][] = [
    ["home", "Overview"],
    ["chat", "Ask Curable"],
    ["records", "My health records"],
    ["care", "Doctor conversations"],
  ];
  return (
    <div className="cd">
      <aside className="cd-sidebar">
        <a className="cd-brand" href="/" aria-label="Curable home">
          <span className="cd-logo">
            <Plus />
          </span>
          curable<span className="cd-brand-dot">.</span>
        </a>
        <div className="cd-workspace">
          <span className="cd-avatar">V</span>
          <div>
            Veritas University<small>Student health demo</small>
          </div>
        </div>
        <p className="cd-nav-label">YOUR SPACE</p>
        <nav>
          {nav.map(([id, label]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => {
                setRole("student");
                setView(id);
              }}
            >
              {label}
              {id === "care" && status !== "none" && <span className="cd-dot" />}
            </button>
          ))}
        </nav>
        <div className="cd-sidebar-bottom">
          <button
            className="cd-doctor-switch"
            onClick={() => {
              setRole("doctor");
              setView("doctor");
            }}
          >
            Explore doctor view
          </button>
          <div className="cd-person">
            <span className="cd-avatar pink">AO</span>
            <div>
              Amara Okafor<small>Fictional student profile</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="cd-body">
        <header className="cd-topbar">
          <span>
            <span className="cd-live" /> VERITAS PILOT CONCEPT
          </span>
          <span className="cd-demo-badge">
            Interactive demo · fictional data{" "}
            <Link to="/auth" className="cd-signin">
              Sign in to Curable
            </Link>
          </span>
        </header>
        <main className="cd-main">
          {view === "home" && (
            <>
              <div className="cd-page-heading">
                <div>
                  <h1>
                    Hey Amara, <span>how are you?</span>
                  </h1>
                  <p>Your health questions deserve answers you understand.</p>
                </div>
              </div>
              <section className="cd-hero">
                <div className="cd-hero-copy">
                  <span className="cd-pill">PERSONALIZED STUDENT HEALTH</span>
                  <h2>
                    Your health.
                    <br />
                    Less confusing.
                    <br />
                    <em>More you.</em>
                  </h2>
                  <p>
                    Make sense of symptoms, medicines and clinic results—with your health history in
                    the picture.
                  </p>
                  <button className="cd-primary" onClick={() => setView("chat")}>
                    Let’s talk about your health <ArrowRight size={18} />
                  </button>
                  <span className="cd-hero-note">
                    Start with a question. Choose a doctor when you want one.
                  </span>
                </div>
              </section>
              <div className="cd-section-title">
                <h2>What’s on your mind?</h2>
              </div>
              <div className="cd-prompt-grid">
                {[
                  [
                    "Understand a symptom",
                    "Talk through something you’re feeling.",
                    "I want to understand a symptom.",
                  ],
                  [
                    "Know your medicines",
                    "Make sense of your prescription.",
                    "I have a question about my recorded inhaler.",
                  ],
                  [
                    "Decode a clinic result",
                    "Understand the words and numbers.",
                    "Can you help me understand my last haemoglobin result?",
                  ],
                ].map(([title, desc, prompt]) => (
                  <button className="cd-prompt" key={title} onClick={() => send(prompt)}>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                  </button>
                ))}
              </div>
              <div className="cd-lower-grid">
                <section className="cd-panel">
                  <div className="cd-section-title">
                    <h2>Your health, connected</h2>
                    <button onClick={() => setView("records")}>
                      View records <ArrowRight size={15} />
                    </button>
                  </div>
                  <p>A little context makes a better conversation.</p>
                  <div className="cd-record-mini">
                    <div>
                      Veritas clinic records<small>Sample record · EMR connection simulated</small>
                    </div>
                    <span className="cd-tag">Demo</span>
                  </div>
                  <div className="cd-chips">
                    <span>Mild asthma</span>
                    <span>Penicillin allergy</span>
                    <span>1 recorded medicine</span>
                  </div>
                </section>
                <section className="cd-panel cd-care-card">
                  <h2>
                    A human perspective,
                    <br />
                    when you want it.
                  </h2>
                  <p>
                    Review your summary, choose to share it, and continue with a doctor once they
                    accept.
                  </p>
                  <button onClick={() => setView("care")}>
                    Explore doctor review <ArrowRight size={16} />
                  </button>
                </section>
              </div>
            </>
          )}
          {view === "records" && (
            <>
              <PageTitle
                eyebrow="YOUR STORY, IN ONE PLACE"
                title="My health records"
                text="Fictional clinic history used to demonstrate personalization. No live EMR is connected."
              />
              <div className="cd-record-grid">
                {history.map(([label, value, note]) => (
                  <section className="cd-panel" key={label}>
                    <span className="cd-eyebrow">{label}</span>
                    <h2>{value}</h2>
                    <p>{note}</p>
                  </section>
                ))}
              </div>
            </>
          )}
          {view === "chat" && (
            <>
              <PageTitle
                eyebrow="ASK. UNDERSTAND. FEEL MORE INFORMED."
                title="Talk to Curable"
                text="A space for your health questions, with your story in mind."
              />
              <div className="cd-chat-layout">
                <section className="cd-panel cd-chat">
                  <div className="cd-chat-heading">
                    <div>
                      Curable companion<small>Scripted demo · no live AI assessment</small>
                    </div>
                  </div>
                  <div className="cd-messages" aria-live="polite">
                    {messages.length === 0 ? (
                      <div className="cd-empty">
                        <h2>What would you like to understand?</h2>
                        <p>Ask about a symptom, a medicine, or something in your clinic records.</p>
                      </div>
                    ) : (
                      messages.map((m, i) => (
                        <div key={i} className={"cd-message " + m.role}>
                          <strong>
                            {m.role === "student" ? "You" : "Curable · demo response"}
                          </strong>
                          <p>{m.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <form
                    className="cd-composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      send();
                    }}
                  >
                    <input
                      aria-label="Your health question"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="What’s on your mind?"
                    />
                    <button aria-label="Send question" disabled={!input.trim()}>
                      <Send size={20} />
                    </button>
                  </form>
                  <p className="cd-small-note">
                    Demo only. If you believe you need urgent help, contact emergency services or
                    your clinic directly.
                  </p>
                </section>
                <aside className="cd-context">
                  <section className="cd-panel">
                    <h3>Your context</h3>
                    <p>Fictional Veritas clinic record</p>
                    <div className="cd-chips">
                      <span>Mild asthma</span>
                      <span>Penicillin allergy</span>
                      <span>Salbutamol inhaler</span>
                    </div>
                    <button className="cd-text-button" onClick={() => setView("records")}>
                      See your health history <ArrowRight size={15} />
                    </button>
                  </section>
                  <section className="cd-panel">
                    <h3>Want a doctor’s perspective?</h3>
                    <p>You can review and edit a summary before requesting a doctor’s review.</p>
                    <button
                      className="cd-primary"
                      disabled={!messages.length || status !== "none"}
                      onClick={openReview}
                    >
                      {status === "none" ? "Prepare my summary" : "Review already requested"}
                      <ArrowRight size={16} />
                    </button>
                  </section>
                </aside>
              </div>
            </>
          )}
          {(view === "care" || view === "doctor") && (
            <>
              <PageTitle
                eyebrow={
                  view === "doctor"
                    ? "CLINIC WORKSPACE · SIMULATION"
                    : "YOUR NEXT STEP, YOUR CHOICE"
                }
                title={view === "doctor" ? "Doctor workspace" : "Doctor conversations"}
                text={
                  view === "doctor"
                    ? "Review the student’s confirmed request and available fictional history."
                    : "A separate conversation with a doctor, after they accept your request."
                }
              />
              {status === "none" ? (
                <section className="cd-panel cd-empty">
                  <h2>No review requests yet</h2>
                  <p>
                    Start a conversation with Curable, then review your summary to request a doctor.
                  </p>
                  <button
                    className="cd-primary"
                    onClick={() => {
                      setView("chat");
                      setRole("student");
                    }}
                  >
                    Ask Curable <ArrowRight size={17} />
                  </button>
                </section>
              ) : (
                <div className="cd-chat-layout">
                  <section className="cd-panel">
                    <span className="cd-tag">
                      {status === "pending"
                        ? "Awaiting doctor acceptance"
                        : "Accepted · demo consultation"}
                    </span>
                    <h2>{view === "doctor" ? "Amara Okafor" : "Your confirmed request"}</h2>
                    <h3>Student’s concern</h3>
                    <p className="cd-prewrap">{submitted.summary}</p>
                    <h3>What the student wants</h3>
                    <p>{submitted.goal}</p>
                    <p className="cd-small-note">
                      Student confirmed sharing this summary and the full available fictional health
                      history.
                    </p>
                    {status === "pending" &&
                      (view === "doctor" ? (
                        <button
                          className="cd-primary"
                          onClick={() => {
                            setStatus("accepted");
                            setDoctorMessages([
                              {
                                role: "doctor",
                                text: "Hello Amara. I’ve accepted your demo request. I can see your confirmed summary and sample history. What would you like to discuss first?",
                              },
                            ]);
                          }}
                        >
                          Accept & open conversation <ArrowRight size={17} />
                        </button>
                      ) : (
                        <button
                          className="cd-secondary"
                          onClick={() => {
                            setView("doctor");
                            setRole("doctor");
                          }}
                        >
                          Simulate doctor acceptance <ArrowUpRight size={16} />
                        </button>
                      ))}
                    {status === "accepted" && (
                      <>
                        <div className="cd-chat-heading">
                          <div>
                            Dr. Ada · fictional clinician
                            <small>Separate doctor–student conversation</small>
                          </div>
                        </div>
                        <div className="cd-messages" aria-live="polite">
                          {doctorMessages.map((m, i) => (
                            <div
                              className={
                                "cd-message " + (m.role === role ? "student" : "assistant")
                              }
                              key={i}
                            >
                              <strong>
                                {m.role === "doctor" ? "Dr. Ada · demo" : "Amara · demo"}
                              </strong>
                              <p>{m.text}</p>
                            </div>
                          ))}
                        </div>
                        <div className="cd-role-switch">
                          <button
                            className={role === "student" ? "selected" : ""}
                            onClick={() => setRole("student")}
                          >
                            Write as student
                          </button>
                          <button
                            className={role === "doctor" ? "selected" : ""}
                            onClick={() => setRole("doctor")}
                          >
                            Write as doctor
                          </button>
                        </div>
                        <form
                          className="cd-composer"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (doctorInput.trim()) {
                              setDoctorMessages((m) => [...m, { role, text: doctorInput.trim() }]);
                              setDoctorInput("");
                            }
                          }}
                        >
                          <input
                            aria-label="Consultation message"
                            value={doctorInput}
                            onChange={(e) => setDoctorInput(e.target.value)}
                            placeholder={`Message as ${role}…`}
                          />
                          <button
                            disabled={!doctorInput.trim()}
                            aria-label="Send consultation message"
                          >
                            <Send size={20} />
                          </button>
                        </form>
                      </>
                    )}
                  </section>
                  <aside className="cd-panel">
                    <h2>Patient history</h2>
                    <p>Full available sample clinic record</p>
                    {history.map(([label, value, note]) => (
                      <div className="cd-history-row" key={label}>
                        <small>{label}</small>
                        <strong>{value}</strong>
                        <p>{note}</p>
                      </div>
                    ))}
                  </aside>
                </div>
              )}
            </>
          )}
          <footer className="cd-footer">
            <span>curable · made for student life</span>
            <span>Partnership concept only · not connected to Veritas EMR</span>
            <button
              onClick={() => {
                setMessages([]);
                setStatus("none");
                setDoctorMessages([]);
                setView("home");
                setRole("student");
                setReview(false);
              }}
            >
              Reset demo
            </button>
          </footer>
        </main>
      </div>
      {review && (
        <div className="cd-modal-backdrop">
          <section
            className="cd-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
          >
            <button
              className="cd-close"
              onClick={() => setReview(false)}
              aria-label="Close summary"
            >
              <X />
            </button>
            <span className="cd-eyebrow">YOU HAVE THE FINAL SAY</span>
            <h2 id="review-title">Review before you share.</h2>
            <p>Check the details and change anything that doesn’t feel right.</p>
            <label>
              Your conversation summary
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={5} />
            </label>
            <label>
              What would you like the doctor to help with?
              <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} />
            </label>
            <label className="cd-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                I have checked this summary. I agree to share it and my full available health
                history with the reviewing doctor. This demo uses fictional data and sends nothing
                to a real doctor.
              </span>
            </label>
            <button
              className="cd-primary"
              disabled={!consent || !summary.trim() || !goal.trim()}
              onClick={() => {
                setSubmitted({ summary, goal });
                setStatus("pending");
                setReview(false);
                setView("care");
              }}
            >
              Confirm & request review <ArrowRight size={17} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function PageTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="cd-page-heading">
      <div>
        <p className="cd-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}
