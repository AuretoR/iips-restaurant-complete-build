import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ChefHat, Check, ClipboardList, Eye, EyeOff, LayoutDashboard, LogOut,
  Mail, MessageSquare, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, Utensils, X
} from "lucide-react";

type MenuItem = {
  id: number; name: string; description: string; category: string; price: string | number;
  image_url: string | null; is_vegetarian: boolean; is_available: boolean; is_active: boolean; is_demo: boolean; sort_order: number;
};
type OrderItem = { id: number; name: string; quantity: number; unit_price: string | number; line_total: string | number };
type Order = {
  id: number; order_code: string; customer_name: string; customer_email: string | null; customer_phone: string | null;
  pickup_notes: string; status: string; payment_status: string; total: string | number; created_at: string; items: OrderItem[];
};
type Enquiry = { id: number; name: string; email: string | null; phone: string | null; subject: string; message: string; status: string; created_at: string };
type Review = { id: number; display_name: string; rating: number; comment: string; moderation_status: string; created_at: string; is_demo: boolean };
type Summary = { active_menu_items: number; orders_today: number; open_orders: number; new_enquiries: number; pending_reviews: number };
type AdminTab = "overview" | "menu" | "orders" | "enquiries" | "reviews";
type MenuForm = { name: string; description: string; category: string; price: string; image_url: string; is_vegetarian: boolean; is_available: boolean; is_demo: boolean; sort_order: string };

const blankMenuForm: MenuForm = { name: "", description: "", category: "Quick Bites", price: "", image_url: "", is_vegetarian: true, is_available: true, is_demo: false, sort_order: "0" };
const money = (amount: number | string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(amount) || 0);
const dateTime = (value: string) => new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const tabs: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "menu", label: "Menu", icon: Utensils },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "enquiries", label: "Enquiries", icon: Mail },
  { id: "reviews", label: "Reviews", icon: MessageSquare }
];

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
  return body as T;
}

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<AdminTab>("overview");
  const [summary, setSummary] = useState<Summary>({ active_menu_items: 0, orders_today: 0, open_orders: 0, new_enquiries: 0, pending_reviews: 0 });
  const [items, setItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [menuForm, setMenuForm] = useState<MenuForm>(blankMenuForm);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    setError("");
  }, []);
  const loadDashboard = useCallback(async () => {
    const [summaryData, menuData, orderData, enquiryData, reviewData] = await Promise.all([
      api<{ summary: Summary }>("/api/admin/summary"),
      api<{ items: MenuItem[] }>("/api/admin/menu"),
      api<{ orders: Order[] }>("/api/admin/orders"),
      api<{ enquiries: Enquiry[] }>("/api/admin/enquiries"),
      api<{ reviews: Review[] }>("/api/admin/reviews")
    ]);
    setSummary(summaryData.summary);
    setItems(menuData.items);
    setOrders(orderData.orders);
    setEnquiries(enquiryData.enquiries);
    setReviews(reviewData.reviews);
  }, []);

  useEffect(() => {
    let alive = true;
    api<{ admin: { id: number; email: string } }>("/api/admin/me")
      .then(() => { if (alive) setAuthenticated(true); })
      .catch(() => { if (alive) setAuthenticated(false); })
      .finally(() => { if (alive) setCheckingSession(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    setBusy(true);
    loadDashboard().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load admin data."))
      .finally(() => setBusy(false));
  }, [authenticated, loadDashboard]);

  const pendingOrders = useMemo(() => orders.filter(order => ["pending", "accepted", "preparing"].includes(order.status)).length, [orders]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api("/api/admin/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setPassword(""); setAuthenticated(true); showNotice("Signed in securely.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed.");
    } finally { setBusy(false); }
  }

  async function logout() {
    try { await api("/api/admin/logout", { method: "POST" }); } finally { setAuthenticated(false); setTab("overview"); }
  }

  function startNewItem() { setEditingItemId(null); setMenuForm(blankMenuForm); setFormOpen(true); setError(""); }
  function startEditItem(item: MenuItem) {
    setEditingItemId(item.id);
    setMenuForm({ name: item.name, description: item.description, category: item.category, price: String(item.price), image_url: item.image_url || "", is_vegetarian: item.is_vegetarian, is_available: item.is_available, is_demo: item.is_demo, sort_order: String(item.sort_order) });
    setFormOpen(true); setError("");
  }

  async function saveMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const payload = { ...menuForm, price: Number(menuForm.price), sort_order: Number(menuForm.sort_order), image_url: menuForm.image_url.trim() || null };
    try {
      await api(editingItemId ? `/api/admin/menu/${editingItemId}` : "/api/admin/menu", { method: editingItemId ? "PUT" : "POST", body: JSON.stringify(payload) });
      setFormOpen(false); setMenuForm(blankMenuForm); setEditingItemId(null);
      await loadDashboard(); showNotice(editingItemId ? "Menu item updated." : "Menu item added.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the menu item."); }
    finally { setBusy(false); }
  }

  async function toggleAvailability(item: MenuItem) {
    setBusy(true); setError("");
    try {
      await api(`/api/admin/menu/${item.id}/availability`, { method: "PATCH", body: JSON.stringify({ is_available: !item.is_available }) });
      await loadDashboard(); showNotice(`${item.name} is now ${item.is_available ? "unavailable" : "available"}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not change availability."); }
    finally { setBusy(false); }
  }

  async function deactivateItem(item: MenuItem) {
    if (!window.confirm(`Hide “${item.name}” from the public menu? Existing order history will be retained.`)) return;
    setBusy(true); setError("");
    try {
      await api(`/api/admin/menu/${item.id}`, { method: "DELETE" });
      await loadDashboard(); showNotice("Menu item hidden from the public menu.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not hide the item."); }
    finally { setBusy(false); }
  }

  async function updateOrderStatus(order: Order, status: string) {
    try {
      await api(`/api/admin/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      await loadDashboard(); showNotice(`${order.order_code} updated to ${status}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update the order."); }
  }

  async function updateEnquiryStatus(enquiry: Enquiry, status: string) {
    try {
      await api(`/api/admin/enquiries/${enquiry.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      await loadDashboard(); showNotice("Enquiry status updated.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update the enquiry."); }
  }

  async function updateReviewStatus(review: Review, moderation_status: string) {
    try {
      await api(`/api/admin/reviews/${review.id}/status`, { method: "PATCH", body: JSON.stringify({ moderation_status }) });
      await loadDashboard(); showNotice(`Review ${moderation_status}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update the review."); }
  }

  if (checkingSession) return <div className="admin-loading"><div className="admin-loader" /><p>Opening your dashboard…</p></div>;

  if (!authenticated) return (
    <main className="admin-login-shell">
      <a className="admin-back-link" href="/"><ArrowLeft size={16} /> Back to IIPS Restaurant</a>
      <section className="admin-login-card">
        <div className="admin-login-mark"><ChefHat size={27} /></div>
        <span className="admin-kicker">RESTAURANT MANAGEMENT</span>
        <h1>Welcome <em>back.</em></h1>
        <p>Sign in with the administrator credentials configured for this deployment.</p>
        <form onSubmit={handleLogin} className="admin-login-form">
          <label>Email address<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required placeholder="admin@example.com" /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required placeholder="Your admin password" /></label>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "Signing in…" : <><ShieldCheck size={17} /> Sign in securely</>}</button>
        </form>
        <small className="admin-login-footnote">Admin accounts are created from server environment variables. There is no public sign-up.</small>
      </section>
    </main>
  );

  return (
    <main className="admin-app-shell">
      <header className="admin-topbar">
        <a className="admin-brand" href="/"><span><ChefHat size={22} /></span><div><strong>IIPS <em>Restaurant</em></strong><small>ADMIN WORKSPACE</small></div></a>
        <div className="admin-top-actions"><a href="/" className="admin-view-site"><ArrowLeft size={15} /> View website</a><button className="admin-logout" onClick={() => void logout()}><LogOut size={15} /> Sign out</button></div>
      </header>
      <div className="admin-workspace">
        <aside className="admin-sidebar">
          <span className="admin-nav-caption">WORKSPACE</span>
          {tabs.map(entry => { const Icon = entry.icon; return <button key={entry.id} className={tab === entry.id ? "admin-nav-item active" : "admin-nav-item"} onClick={() => setTab(entry.id)}><Icon size={17} /><span>{entry.label}</span>{entry.id === "orders" && pendingOrders > 0 && <b>{pendingOrders}</b>}{entry.id === "enquiries" && summary.new_enquiries > 0 && <b>{summary.new_enquiries}</b>}</button>; })}
          <div className="admin-sidebar-note"><ShieldCheck size={18} /><strong>Private workspace</strong><p>Menu, orders, enquiries and reviews are only available after admin sign-in.</p></div>
        </aside>
        <section className="admin-content">
          <div className="admin-page-heading"><div><span className="admin-kicker">IIPS DAVV · INDORE</span><h1>{tabs.find(entry => entry.id === tab)?.label}</h1><p>{tab === "overview" ? "A quick look at what's happening in your restaurant." : tab === "menu" ? "Update what visitors can browse and order." : tab === "orders" ? "Review incoming orders and move them through preparation." : tab === "enquiries" ? "Keep track of messages submitted by visitors." : "Approve genuine customer feedback before it appears publicly."}</p></div><button className="admin-refresh" disabled={busy} onClick={() => { setBusy(true); loadDashboard().then(() => showNotice("Workspace refreshed.")).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Refresh failed.")).finally(() => setBusy(false)); }}><RefreshCw size={15} className={busy ? "admin-spin" : ""} /> Refresh</button></div>
          {error && <div className="admin-alert error" role="alert"><X size={16} />{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
          {notice && <div className="admin-alert success" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={15} /></button></div>}

          {tab === "overview" && <>
            <div className="admin-stat-grid">
              <article className="admin-stat-card"><span>ACTIVE MENU ITEMS</span><strong>{summary.active_menu_items}</strong><small><Utensils size={14} /> Public menu</small></article>
              <article className="admin-stat-card"><span>ORDERS TODAY</span><strong>{summary.orders_today}</strong><small><ClipboardList size={14} /> Total received today</small></article>
              <article className="admin-stat-card"><span>OPEN ORDERS</span><strong>{summary.open_orders}</strong><small><RefreshCw size={14} /> Need attention</small></article>
              <article className="admin-stat-card"><span>NEW ENQUIRIES</span><strong>{summary.new_enquiries}</strong><small><Mail size={14} /> Awaiting response</small></article>
            </div>
            <div className="admin-overview-grid">
              <section className="admin-panel"><div className="admin-panel-head"><div><span className="admin-kicker">RECENT ACTIVITY</span><h2>Latest orders</h2></div><button className="admin-subtle-button" onClick={() => setTab("orders")}>View all <ArrowLeft size={14} /></button></div>
                {orders.slice(0, 5).length ? orders.slice(0, 5).map(order => <div className="admin-recent-row" key={order.id}><div><strong>{order.order_code}</strong><small>{order.customer_name} · {dateTime(order.created_at)}</small></div><div className="admin-recent-meta"><b>{money(order.total)}</b><span className={`admin-status status-${order.status}`}>{order.status}</span></div></div>) : <div className="admin-empty">Orders placed on the website will appear here.</div>}
              </section>
              <section className="admin-panel"><div className="admin-panel-head"><div><span className="admin-kicker">NEEDS REVIEW</span><h2>Pending work</h2></div></div>
                <button className="admin-queue-row" onClick={() => setTab("enquiries")}><span className="admin-queue-icon"><Mail /></span><span><strong>{summary.new_enquiries} new enquiries</strong><small>Read and update visitor messages</small></span><ArrowLeft size={15} /></button>
                <button className="admin-queue-row" onClick={() => setTab("reviews")}><span className="admin-queue-icon"><MessageSquare /></span><span><strong>{summary.pending_reviews} reviews awaiting approval</strong><small>Approve reviews that are appropriate to publish</small></span><ArrowLeft size={15} /></button>
                <button className="admin-queue-row" onClick={() => setTab("menu")}><span className="admin-queue-icon"><Utensils /></span><span><strong>Keep the menu current</strong><small>Update availability and prices</small></span><ArrowLeft size={15} /></button>
              </section>
            </div>
          </>}

          {tab === "menu" && <section className="admin-panel">
            <div className="admin-panel-head"><div><span className="admin-kicker">PUBLIC CATALOGUE</span><h2>Menu items <span className="admin-count">{items.filter(item => item.is_active).length}</span></h2></div><button className="admin-primary-button compact" onClick={startNewItem}><Plus size={16} /> Add item</button></div>
            {formOpen && <form className="admin-menu-form" onSubmit={saveMenuItem}>
              <div className="admin-form-heading"><h3>{editingItemId ? "Edit menu item" : "Create menu item"}</h3><button type="button" className="admin-icon-button" onClick={() => setFormOpen(false)} aria-label="Close form"><X size={17} /></button></div>
              <div className="admin-form-grid">
                <label>Item name<input value={menuForm.name} onChange={event => setMenuForm({ ...menuForm, name: event.target.value })} required maxLength={120} /></label>
                <label>Category<input value={menuForm.category} onChange={event => setMenuForm({ ...menuForm, category: event.target.value })} required maxLength={60} /></label>
                <label>Price (₹)<input type="number" min="0" max="100000" step="0.01" value={menuForm.price} onChange={event => setMenuForm({ ...menuForm, price: event.target.value })} required /></label>
                <label>Sort order<input type="number" step="1" value={menuForm.sort_order} onChange={event => setMenuForm({ ...menuForm, sort_order: event.target.value })} required /></label>
                <label className="wide">Description<textarea value={menuForm.description} onChange={event => setMenuForm({ ...menuForm, description: event.target.value })} maxLength={500} rows={2} /></label>
                <label className="wide">Image URL (HTTPS)<input type="url" value={menuForm.image_url} onChange={event => setMenuForm({ ...menuForm, image_url: event.target.value })} placeholder="https://…" /></label>
              </div>
              <div className="admin-check-row"><label><input type="checkbox" checked={menuForm.is_vegetarian} onChange={event => setMenuForm({ ...menuForm, is_vegetarian: event.target.checked })} /> Vegetarian</label><label><input type="checkbox" checked={menuForm.is_available} onChange={event => setMenuForm({ ...menuForm, is_available: event.target.checked })} /> Available to order</label><label><input type="checkbox" checked={menuForm.is_demo} onChange={event => setMenuForm({ ...menuForm, is_demo: event.target.checked })} /> Mark as demo content</label></div>
              <div className="admin-form-actions"><button className="admin-primary-button compact" type="submit" disabled={busy}>{busy ? "Saving…" : editingItemId ? "Save changes" : "Create item"}</button><button className="admin-secondary-button" type="button" onClick={() => setFormOpen(false)}>Cancel</button></div>
            </form>}
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Availability</th><th>Actions</th></tr></thead><tbody>{items.filter(item => item.is_active).map(item => <tr key={item.id}><td><div className="admin-item-cell">{item.image_url ? <img src={item.image_url} alt="" /> : <span className="admin-item-placeholder"><Utensils size={16} /></span>}<span><strong>{item.name}</strong><small>{item.is_demo ? "Demo item" : "Menu item"}</small></span></div></td><td>{item.category}</td><td className="admin-price">{money(item.price)}</td><td><button className={item.is_available ? "admin-availability available" : "admin-availability unavailable"} onClick={() => void toggleAvailability(item)}>{item.is_available ? "Available" : "Unavailable"}</button></td><td><div className="admin-row-actions"><button title="Edit item" aria-label={`Edit ${item.name}`} onClick={() => startEditItem(item)}><Pencil size={15} /></button><button title="Hide item" aria-label={`Hide ${item.name}`} onClick={() => void deactivateItem(item)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>
            {!items.some(item => item.is_active) && <div className="admin-empty">No active menu items yet. Add your first item.</div>}
          </section>}

          {tab === "orders" && <section className="admin-panel"><div className="admin-panel-head"><div><span className="admin-kicker">ORDER MANAGEMENT</span><h2>Recent orders <span className="admin-count">{orders.length}</span></h2></div></div>
            {orders.length ? <div className="admin-order-list">{orders.map(order => <article className="admin-order-card" key={order.id}><div className="admin-order-top"><div><strong>{order.order_code}</strong><small>{dateTime(order.created_at)}</small></div><b>{money(order.total)}</b></div><div className="admin-order-customer"><strong>{order.customer_name}</strong><span>{[order.customer_phone, order.customer_email].filter(Boolean).join(" · ")}</span>{order.pickup_notes && <p>Pickup note: {order.pickup_notes}</p>}</div><div className="admin-order-items">{(order.items || []).map((item, index) => <span key={item.id || `${item.name}-${index}`}>{item.quantity} × {item.name}</span>)}</div><div className="admin-order-bottom"><span className="admin-payment-label">Pay at counter · {order.payment_status}</span><label className="admin-status-control">Status<select value={order.status} onChange={event => void updateOrderStatus(order, event.target.value)}>{["pending", "accepted", "preparing", "ready", "completed", "cancelled"].map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label></div></article>)}</div> : <div className="admin-empty"><ClipboardList size={24} /><strong>No orders yet</strong><p>Orders submitted through the website will appear here.</p></div>}
          </section>}

          {tab === "enquiries" && <section className="admin-panel"><div className="admin-panel-head"><div><span className="admin-kicker">CONTACT MESSAGES</span><h2>Enquiries <span className="admin-count">{enquiries.length}</span></h2></div></div>
            {enquiries.length ? <div className="admin-enquiry-list">{enquiries.map(enquiry => <article className="admin-enquiry-card" key={enquiry.id}><div className="admin-enquiry-head"><div><h3>{enquiry.subject}</h3><small>{enquiry.name} · {dateTime(enquiry.created_at)}</small></div><select value={enquiry.status} onChange={event => void updateEnquiryStatus(enquiry, event.target.value)} aria-label={`Status for enquiry from ${enquiry.name}`}>{["new", "in_progress", "resolved", "closed"].map(status => <option key={status} value={status}>{status.replace("_", " ")}</option>)}</select></div><p>{enquiry.message}</p><div className="admin-contact-details">{enquiry.email && <a href={`mailto:${enquiry.email}`}>{enquiry.email}</a>}{enquiry.phone && <a href={`tel:${enquiry.phone}`}>{enquiry.phone}</a>}</div></article>)}</div> : <div className="admin-empty"><Mail size={24} /><strong>No enquiries yet</strong><p>Messages from the website will appear here.</p></div>}
          </section>}

          {tab === "reviews" && <section className="admin-panel"><div className="admin-panel-head"><div><span className="admin-kicker">CUSTOMER FEEDBACK</span><h2>Reviews <span className="admin-count">{reviews.length}</span></h2></div></div>
            {reviews.length ? <div className="admin-review-list">{reviews.map(review => <article className="admin-review-card" key={review.id}><div className="admin-review-head"><div><strong>{review.display_name}</strong><span className="admin-review-stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></div><span className={`admin-status status-${review.moderation_status}`}>{review.moderation_status}</span></div><p>{review.comment}</p><small>{dateTime(review.created_at)}{review.is_demo ? " · Demo content" : ""}</small><div className="admin-review-actions"><button onClick={() => void updateReviewStatus(review, "approved")} disabled={review.moderation_status === "approved"}><Eye size={15} /> Approve</button><button onClick={() => void updateReviewStatus(review, "hidden")} disabled={review.moderation_status === "hidden"}><EyeOff size={15} /> Hide</button><button onClick={() => void updateReviewStatus(review, "pending")} disabled={review.moderation_status === "pending"}>Reset</button></div></article>)}</div> : <div className="admin-empty">No reviews have been submitted yet.</div>}
          </section>}
          <footer className="admin-content-foot"><span>Private administrator workspace</span><span>Orders are pay-at-counter only. No online payments are processed.</span></footer>
        </section>
      </div>
    </main>
  );
}
