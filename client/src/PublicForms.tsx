import { FormEvent, useState } from "react";
import { ArrowRight, Check, MessageSquare, Send } from "lucide-react";

async function postForm<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
  return body as T;
}

export function EnquirySection() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "General enquiry", message: "" });
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      const result = await postForm<{ message: string }>("/api/enquiries", form);
      setSuccess(result.message); setForm({ name: "", email: "", phone: "", subject: "General enquiry", message: "" });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not send your enquiry."); }
    finally { setBusy(false); }
  }

  return (
    <section className="contact-section section-wrap reveal-on-scroll" id="contact">
      <div className="contact-copy"><div className="eyebrow"><span className="eyebrow-line" /> SAY WHAT'S ON YOUR MIND</div><h2>Questions, ideas<br /><em>or just a hello.</em></h2><p>Send a message to the restaurant team. Your enquiry goes into the admin workspace so it can be reviewed.</p><div className="contact-mini-note"><span><MessageSquare size={18} /></span><div><strong>Right to the team</strong><small>Messages are stored securely in the project database.</small></div></div></div>
      <form className="contact-form" onSubmit={submit}>
        <div className="contact-form-head"><div><span>CONTACT THE TEAM</span><h3>Drop us a note.</h3></div><Send size={21} /></div>
        <div className="contact-form-grid">
          <label>Your name<input required minLength={2} maxLength={120} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Name" /></label>
          <label>Subject<select value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })}><option>General enquiry</option><option>Menu question</option><option>Order support</option><option>Feedback</option><option>College project</option></select></label>
          <label>Email<input type="email" maxLength={254} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label>
          <label>Phone (optional)<input type="tel" maxLength={30} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="+91…" /></label>
          <label className="contact-wide">Message<textarea required minLength={10} maxLength={2000} rows={4} value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} placeholder="Write your message here…" /></label>
        </div>
        {!form.email.trim() && !form.phone.trim() && <small className="contact-hint">Please provide an email address or a phone number so the team can follow up.</small>}
        {error && <p className="public-form-message error" role="alert">{error}</p>}
        {success && <p className="public-form-message success" role="status"><Check size={16} />{success}</p>}
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Sending…" : <>Send enquiry <ArrowRight size={17} /></>}</button>
      </form>
    </section>
  );
}

export function ReviewSubmission() {
  const [form, setForm] = useState({ display_name: "", rating: "5", comment: "" });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFeedback(null);
    try {
      const result = await postForm<{ message: string }>("/api/reviews", { ...form, rating: Number(form.rating) });
      setFeedback({ type: "success", text: result.message }); setForm({ display_name: "", rating: "5", comment: "" });
    } catch (reason) { setFeedback({ type: "error", text: reason instanceof Error ? reason.message : "Could not submit review." }); }
    finally { setBusy(false); }
  }

  return (
    <form className="review-submit-form" onSubmit={submit}>
      <div className="review-submit-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> YOUR TURN</span><h3>Leave a little feedback.</h3></div><MessageSquare size={22} /></div>
      <div className="review-submit-fields"><label>Your name<input required minLength={2} maxLength={80} value={form.display_name} onChange={event => setForm({ ...form, display_name: event.target.value })} placeholder="Name to display" /></label><label>Rating<select value={form.rating} onChange={event => setForm({ ...form, rating: event.target.value })}><option value="5">5 — Loved it</option><option value="4">4 — Really good</option><option value="3">3 — It was okay</option><option value="2">2 — Could be better</option><option value="1">1 — Not for me</option></select></label><label className="review-submit-wide">Your review<textarea required minLength={8} maxLength={1000} rows={3} value={form.comment} onChange={event => setForm({ ...form, comment: event.target.value })} placeholder="Share a genuine experience…" /></label></div>
      {feedback && <p className={`public-form-message ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>{feedback.type === "success" && <Check size={16} />}{feedback.text}</p>}
      <button className="button button-secondary-outline" type="submit" disabled={busy}>{busy ? "Sending…" : <>Submit for review <ArrowRight size={16} /></>}</button>
      <small>Reviews are held for admin approval before publication.</small>
    </form>
  );
}
