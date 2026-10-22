import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { EnquirySection, ReviewSubmission } from "./PublicForms";
import { ArrowDownRight, ArrowRight, Check, ChefHat, Clock3, Coffee, Leaf, Menu as MenuIcon, Minus, Plus, Search, ShoppingBag, Sparkles, Star, X } from "lucide-react";

type MenuItem = {
  id: number; name: string; description: string; category: string; price: string | number;
  image_url?: string | null; is_vegetarian: number | boolean; is_available: number | boolean; is_demo?: number | boolean;
};
type Offer = { id: number; title: string; description: string; coupon_code?: string | null; is_demo?: number | boolean };
type Review = { id: number; display_name: string; rating: number; comment: string; is_demo?: number | boolean };
type CartLine = { item: MenuItem; quantity: number };

const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
const fallbackItems: MenuItem[] = [
  { id: 1, name: "Masala Sandwich (Demo)", description: "A toasted, savory campus classic.", category: "Quick Bites", price: 70, image_url: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80", is_vegetarian: true, is_available: true, is_demo: true },
  { id: 2, name: "Classic Veg Burger (Demo)", description: "Crisp lettuce, a hearty patty, and a soft bun.", category: "Quick Bites", price: 90, image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80", is_vegetarian: true, is_available: true, is_demo: true },
  { id: 3, name: "Cold Coffee (Demo)", description: "A chilled pick-me-up for the next lecture.", category: "Drinks", price: 80, image_url: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80", is_vegetarian: true, is_available: true, is_demo: true },
  { id: 4, name: "French Fries (Demo)", description: "Golden, crisp, and made for sharing.", category: "Quick Bites", price: 75, image_url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80", is_vegetarian: true, is_available: true, is_demo: true }
];

export default function App() {
  const [items, setItems] = useState<MenuItem[]>(fallbackItems);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutStage, setCheckoutStage] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutFields, setCheckoutFields] = useState({ customer_name: "", email: "", phone: "", pickup_notes: "" });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [apiStatus, setApiStatus] = useState<"loading" | "connected" | "demo">("loading");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [heroScroll, setHeroScroll] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const storyRef = useRef<HTMLElement | null>(null);
  const [stackProgress, setStackProgress] = useState(0);
  const stackRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const updateProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0);
      setHeroScroll(Math.min(1, Math.max(0, window.scrollY / Math.max(1, window.innerHeight * 0.9))));
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  useEffect(() => {
    const updateStory = () => {
      const section = storyRef.current;
      if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.innerWidth <= 760) {
        setStoryProgress(0);
        return;
      }
      const rect = section.getBoundingClientRect();
      const travel = section.offsetHeight - window.innerHeight;
      const progress = travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0;
      setStoryProgress(progress);
    };
    updateStory();
    window.addEventListener("scroll", updateStory, { passive: true });
    window.addEventListener("resize", updateStory);
    return () => {
      window.removeEventListener("scroll", updateStory);
      window.removeEventListener("resize", updateStory);
    };
  }, []);

  useEffect(() => {
    const updateStack = () => {
      const section = stackRef.current;
      if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.innerWidth <= 760) {
        setStackProgress(0);
        return;
      }
      const rect = section.getBoundingClientRect();
      const travel = section.offsetHeight - window.innerHeight;
      setStackProgress(travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0);
    };
    updateStack();
    window.addEventListener("scroll", updateStack, { passive: true });
    window.addEventListener("resize", updateStack);
    return () => {
      window.removeEventListener("scroll", updateStack);
      window.removeEventListener("resize", updateStack);
    };
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal-on-scroll").forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });

    // Observe elements added later too (e.g. menu cards after search/category filters).
    // Without this, newly-rendered cards keep the hidden/blurred initial reveal style forever.
    const observeReveals = (root) => {
      if (root instanceof Element && root.matches(".reveal-on-scroll")) observer.observe(root);
      if (root && typeof root.querySelectorAll === "function") {
  root.querySelectorAll(".reveal-on-scroll").forEach((node) => observer.observe(node));
}
    };
    observeReveals(document);
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach(observeReveals));
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    return () => { mutationObserver.disconnect(); observer.disconnect(); };
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/menu").then(r => { if (!r.ok) throw new Error("menu"); return r.json(); }),
      fetch("/api/offers").then(r => { if (!r.ok) throw new Error("offers"); return r.json(); }),
      fetch("/api/reviews").then(r => { if (!r.ok) throw new Error("reviews"); return r.json(); })
    ]).then(([menuData, offerData, reviewData]) => {
      if (!alive) return;
      setItems(Array.isArray(menuData.items) ? menuData.items : []);
      setOffers(offerData.offers || []);
      setReviews(reviewData.reviews || []);
      setApiStatus("connected");
    }).catch(() => {
      if (!alive) return;
      setApiStatus("demo");
      setOffers([{ id: 1, title: "Campus Combo Preview", description: "Sample offer only — not a live promotion.", coupon_code: "DEMO10", is_demo: true }]);
      setReviews([{ id: 1, display_name: "Demo Student", rating: 5, comment: "Sample review shown for interface development only.", is_demo: true }]);
    });
    return () => { alive = false; };
  }, []);

  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map(i => i.category)))], [items]);
  const visibleItems = items.filter(item =>
    (category === "All" || item.category === category) &&
    `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase())
  );
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + Number(line.item.price) * line.quantity, 0);

  function addItem(item: MenuItem) {
    setCart(old => {
      const found = old.find(line => line.item.id === item.id);
      return found ? old.map(line => line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line) : [...old, { item, quantity: 1 }];
    });
    setNotice(`${item.name.replace(" (Demo)", "")} added to your bag`);
    window.setTimeout(() => setNotice(""), 2400);
  }
  function changeQuantity(id: number, delta: number) {
    setCart(old => old.map(line => line.item.id === id ? { ...line, quantity: line.quantity + delta } : line).filter(line => line.quantity > 0));
  }
  function demoCheckout() {
    setCheckoutError("");
    setCheckoutStage(true);
  }

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length) return;
    setPlacingOrder(true);
    setCheckoutError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...checkoutFields,
          items: cart.map(line => ({ menu_item_id: line.item.id, quantity: line.quantity })),
          payment_method: "pay_at_counter"
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "We couldn't place your order. Please try again.");
      setCart([]);
      setCartOpen(false);
      setCheckoutStage(false);
      setCheckoutFields({ customer_name: "", email: "", phone: "", pickup_notes: "" });
      setNotice(`Order ${data.order?.order_code || "received"} placed! Pay at the counter when you collect it.`);
      window.setTimeout(() => setNotice(""), 6500);
    } catch (reason) {
      setCheckoutError(reason instanceof Error ? reason.message : "We couldn't place your order. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  }

  return (
    <div className="site-shell">
      <div className="scroll-progress" aria-hidden="true"><span style={{ width: `${scrollProgress}%` }} /></div>
      <div className="ambient-orb orb-one" aria-hidden="true" /><div className="ambient-orb orb-two" aria-hidden="true" />
      <div className="topline"><Sparkles size={14} /> A campus food project made for hungry breaks <span className="topline-dot">•</span> <span className="demo-label">DEMO CONTENT</span></div>
      <header className="nav-wrap">
        <a className="brand" href="#home" aria-label="IIPS Restaurant home">
          <span className="brand-mark"><ChefHat size={23} strokeWidth={2.2} /></span>
          <span className="brand-copy"><strong>IIPS <em>Restaurant</em></strong><small>CAMPUS FOOD · DAVV, INDORE</small></span>
        </a>
        <nav className={mobileOpen ? "nav-links open" : "nav-links"} aria-label="Main navigation">
          <a onClick={() => setMobileOpen(false)} href="#home">Home</a>
          <a onClick={() => setMobileOpen(false)} href="#menu">Menu</a>
          <a onClick={() => setMobileOpen(false)} href="#offers">Offers</a>
          <a onClick={() => setMobileOpen(false)} href="#reviews">Reviews</a>
          <a onClick={() => setMobileOpen(false)} href="#contact">Contact</a>
        </nav>
        <div className="nav-actions">
          <button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Open bag with ${cartCount} items`}>
            <ShoppingBag size={18} /><span>My bag</span><b>{cartCount}</b>
          </button>
          <button className="mobile-menu-button" onClick={() => setMobileOpen(v => !v)} aria-label={mobileOpen ? "Close menu" : "Open menu"}>
            {mobileOpen ? <X /> : <MenuIcon />}
          </button>
        </div>
      </header>

      <main>
        <section className="hero section-wrap" id="home" style={{ "--hero-scroll": heroScroll } as React.CSSProperties}>
          <div className="hero-copy reveal">
            <div className="eyebrow"><span className="eyebrow-line" /> GOOD FOOD. GOOD BREAKS.</div>
            <h1>Your campus<br />cravings, <span>sorted.</span></h1>
            <p className="hero-description">Between lectures, deadlines and your next big idea — make a little room for something delicious.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#menu">Explore the menu <ArrowRight size={17} /></a>
              <a className="text-link" href="#offers">See what's cooking <ArrowDownRight size={17} /></a>
            </div>
            <div className="hero-proof">
              <div className="proof-icon"><Clock3 size={17} /></div>
              <div><strong>Made for your break</strong><small>Simple browsing · easy ordering</small></div>
            </div>
          </div>
          <div className="hero-art" style={{ "--hero-scroll": heroScroll } as React.CSSProperties}>
            <div className="hero-image-frame">
              <img src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=85" alt="A spread of freshly prepared food" />
              <div className="image-shade" />
              <div className="hero-image-caption"><span>YOUR NEXT FAVOURITE</span><strong>Good things<br />on the menu.</strong></div>
            </div>
            <div className="floating-note note-top"><span className="note-emoji">✳</span><span><b>Break time?</b><small>You've earned it.</small></span></div>
            <div className="floating-note note-bottom"><span className="note-emoji orange">↗</span><span><b>Find your bite</b><small>Browse the menu below</small></span></div>
            <span className="hero-sparkle sparkle-one">✳</span><span className="hero-sparkle sparkle-two">✳</span>
          </div>
        </section>

        <section className="marquee-band" aria-label="Restaurant highlights">
          <div className="marquee-inner marquee-track"><span>GOOD FOOD</span><i>✳</i><span>CAMPUS MOOD</span><i>✳</i><span>YOUR KIND OF BREAK</span><i>✳</i><span>GOOD FOOD</span><i>✳</i><span>CAMPUS MOOD</span><i>✳</i></div>
        </section>

        <section className="menu-section section-wrap reveal-on-scroll" id="menu">
          <div className="section-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> THE GOOD STUFF</div><h2>Something for<br /><span>every craving.</span></h2></div>
            <p>Quick bites, little treats and something to sip on. Find your next favourite.</p>
          </div>
          <div className="menu-toolbar">
            <div className="category-pills" role="group" aria-label="Filter menu by category">
              {categories.map(c => <button key={c} className={category === c ? "pill active" : "pill"} onClick={() => setCategory(c)}>{c}</button>)}
            </div>
            <label className="search-box"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find something tasty..." aria-label="Search menu" /><kbd>↵</kbd></label>
          </div>
          {apiStatus === "demo" && <div className="inline-note">API or PostgreSQL is not connected yet. Showing clearly labelled demo items; configure the database and start the API to load live menu data.</div>}
          <div className="food-grid stagger-grid">
            {visibleItems.map((item, index) => (
              <article className="food-card reveal-on-scroll" key={item.id} style={{ animationDelay: `${index * 65}ms` }}>
                <div className="food-photo">
                  {item.image_url ? <img src={item.image_url} alt={item.name} loading="lazy" /> : <div className="image-placeholder"><Coffee size={36} /></div>}
                  <span className="food-category">{item.category}</span>
                  {Boolean(item.is_vegetarian) && <span className="veg-mark" title="Marked vegetarian"><Leaf size={13} /></span>}
                </div>
                <div className="food-card-body">
                  <div className="food-title-row"><h3>{item.name}</h3><strong>{money(Number(item.price))}</strong></div>
                  <p>{item.description}</p>
                  <div className="food-card-bottom"><span className="demo-caption">{Boolean(item.is_demo) ? "SAMPLE ITEM" : "MENU ITEM"}</span><button className="add-button" onClick={() => addItem(item)} disabled={!Boolean(item.is_available)}>{Boolean(item.is_available) ? <><Plus size={16} /> Add</> : "Unavailable"}</button></div>
                </div>
              </article>
            ))}
          </div>
          {visibleItems.length === 0 && <div className="empty-state"><Search size={26} /><h3>No bites found</h3><p>Try another search or choose a different category.</p><button className="text-link" onClick={() => { setQuery(""); setCategory("All"); }}>Clear filters</button></div>}
          <div className="menu-footnote">Menu and prices are demonstration data and are not verified as the actual IIPS restaurant menu.</div>
        </section>

        <section className="scroll-story" ref={storyRef} aria-label="Signature bites scroll showcase">
          <div className="scroll-story-sticky">
            <div className="story-heading">
              <div className="eyebrow"><span className="eyebrow-line" /> THE CAMPUS FAVOURITES</div>
              <h2>One more reason<br />to <span>take a break.</span></h2>
              <p>Keep scrolling. Your next craving is just around the corner.</p>
              <div className="story-progress-label"><span>SCROLL TO EXPLORE</span><b>0{Math.min(3, Math.floor(storyProgress * 2) + 1)} <i>/ 03</i></b></div>
            </div>
            <div className="story-window">
              <div className="story-track" style={{ transform: `translate3d(${-storyProgress * 66.6667}%, 0, 0)` }}>
                <article className="story-panel panel-sand">
                  <div className="story-image-wrap"><img src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1100&q=85" alt="A freshly made burger" loading="eager" decoding="async" /><span className="story-image-tag">01 / THE CLASSIC</span></div>
                  <div className="story-panel-copy"><span>THE QUICK FIX</span><h3>Big bite.<br /><em>Better break.</em></h3><p>A classic burger moment for the gap between lectures.</p><a href="#menu">Explore menu <ArrowRight size={16} /></a></div>
                </article>
                <article className="story-panel panel-peach">
                  <div className="story-image-wrap"><img src="https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=1100&q=85" alt="A toasted sandwich ready to eat" loading="eager" decoding="async" /><span className="story-image-tag">02 / THE TOASTIE</span></div>
                  <div className="story-panel-copy"><span>BETWEEN CLASSES</span><h3>Toasty outside.<br /><em>Happy inside.</em></h3><p>Something warm, crunchy, and easy to love.</p><a href="#menu">Find your bite <ArrowRight size={16} /></a></div>
                </article>
                <article className="story-panel panel-green">
                  <div className="story-image-wrap"><img src="https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=1100&q=85" alt="A glass of iced coffee" loading="eager" decoding="async" /><span className="story-image-tag">03 / THE PICK-ME-UP</span></div>
                  <div className="story-panel-copy"><span>RESET. REFRESH.</span><h3>One sip.<br /><em>New energy.</em></h3><p>A chilled little pause before the next big thing.</p><a href="#menu">See the menu <ArrowRight size={16} /></a></div>
                </article>
              </div>
            </div>
            <div className="story-scroll-cue"><span style={{ transform: `scaleX(${Math.max(.06, storyProgress)})` }} /></div>
          </div>
        </section>

        <section className="offer-section reveal-on-scroll" id="offers">
          <div className="offer-inner section-wrap">
            <div className="offer-copy"><div className="eyebrow light"><span className="eyebrow-line" /> LITTLE EXTRAS</div><h2>A little treat<br />for your <em>break.</em></h2><p>Keep an eye out for combos, specials and good reasons to make your break a little better.</p><a className="button button-light" href="#menu">Find your favourite <ArrowRight size={17} /></a></div>
            <div className="offer-ticket"><div className="ticket-stamp"><Sparkles size={24} /></div><span className="ticket-overline">SAMPLE OFFER</span><strong>{offers[0]?.title || "Campus Combo Preview"}</strong><p>{offers[0]?.description || "Demonstration offer only. Not a live promotion."}</p><div className="ticket-code"><span>DEMO CODE</span><b>{offers[0]?.coupon_code || "DEMO10"}</b></div><small>Demo content — no real discount is applied yet.</small></div>
            <span className="offer-doodle doodle-a">✳</span><span className="offer-doodle doodle-b">✳</span>
          </div>
        </section>

        <section className="scroll-stack" ref={stackRef} aria-label="Three moods for a campus break">
          <div className="scroll-stack-sticky">
            <div className="stack-intro">
              <div className="eyebrow"><span className="eyebrow-line" /> YOUR BREAK, YOUR MOOD</div>
              <h2>Every break<br />has a <em>mood.</em></h2>
              <p>From a quick bite to a slow sip, scroll through three little ways to reset between classes.</p>
              <div className="stack-count"><span>KEEP SCROLLING</span><strong>0{Math.min(3, Math.floor(stackProgress * 2.99) + 1)} <i>/ 03</i></strong></div>
            </div>
            <div className="stack-stage">
              {[
                { id: "01", kicker: "THE QUICK RESET", title: "A little crunch. A lot of joy.", description: "When you've got ten minutes and a very real craving.", image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=1200&q=85", alt: "Freshly toasted sandwiches", label: "THE TOASTIE", tone: "stack-card-sand" },
                { id: "02", kicker: "THE COMFORT BREAK", title: "Golden hour is fry hour.", description: "The kind of snack that makes the long day feel lighter.", image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=1200&q=85", alt: "Golden crispy fries", label: "CRUNCH TIME", tone: "stack-card-peach" },
                { id: "03", kicker: "THE LITTLE RECHARGE", title: "Sip slowly. Start fresh.", description: "A chilled pick-me-up before you get back to it.", image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=1200&q=85", alt: "Iced coffee in a glass", label: "COLD COFFEE", tone: "stack-card-green" }
              ].map((card, index) => {
                // One card remains fully readable at a time. Neighbouring cards peek out
                // behind it; their copy fades before it can collide with the active text.
                const position = stackProgress * 2;
                const distance = index - position;
                const absDistance = Math.abs(distance);
                const depth = Math.min(2, absDistance);
                const isLeaving = distance < -0.5;
                const isWaiting = distance > 0.5;
                const travel = Math.max(0, absDistance - 0.5);
                const x = isLeaving
                  ? -55 - travel * 245
                  : isWaiting
                    ? 66 + Math.min(42, travel * 26)
                    : distance * 90;
                const y = isLeaving
                  ? -20 - travel * 52
                  : isWaiting
                    ? 25 + Math.min(48, travel * 30)
                    : distance * 18;
                const rotate = isLeaving
                  ? -2 - Math.min(5, travel * 4)
                  : isWaiting
                    ? 2 + Math.min(3, travel * 2)
                    : distance * 5;
                const scale = isLeaving
                  ? Math.max(0.88, 0.98 - travel * 0.06)
                  : isWaiting
                    ? Math.max(0.87, 0.94 - travel * 0.035)
                    : 1 - absDistance * 0.025;
                const opacity = isLeaving
                  ? Math.max(0, 1 - travel * 2.4)
                  : isWaiting
                    ? 0.98
                    : 1;
                const copyOpacity = Math.max(0, Math.min(1, (0.42 - absDistance) / 0.24));
                const zIndex = 100 - Math.round(absDistance * 20);
                return <article className={`stack-card ${card.tone}`} key={card.id} style={{ transform: `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rotate}deg)`, opacity, zIndex }}>
                  <div className="stack-card-image"><img src={card.image} alt={card.alt} loading="eager" decoding="async" style={{ transform: `scale(${1.07 - Math.min(.06, depth * .025)})` }} /><span className="stack-photo-label">{card.label}</span><span className="stack-card-number">{card.id}</span></div>
                  <div className="stack-card-copy" style={{ opacity: copyOpacity, visibility: copyOpacity > 0.02 ? "visible" : "hidden", pointerEvents: copyOpacity > 0.98 ? "auto" : "none" }}><span>{card.kicker}</span><h3>{card.title}</h3><p>{card.description}</p><a href="#menu">Find your favourite <ArrowRight size={16} /></a></div>
                </article>;
              })}
            </div>
            <div className="stack-scroll-meter"><span style={{ transform: `scaleX(${Math.max(.06, stackProgress)})` }} /></div>
          </div>
        </section>

        <section className="how-section section-wrap reveal-on-scroll">
          <div className="section-heading compact"><div><div className="eyebrow"><span className="eyebrow-line" /> NO FUSS, JUST FOOD</div><h2>Your break,<br /><span>your way.</span></h2></div><p>A simple experience designed around campus life.</p></div>
          <div className="steps-grid stagger-grid">
            <article className="step-card reveal-on-scroll"><span className="step-number">01</span><div className="step-icon"><Search /></div><h3>Find your bite</h3><p>Browse the menu and spot something that hits the spot.</p><span className="step-arrow"><ArrowRight size={18} /></span></article>
            <article className="step-card highlighted reveal-on-scroll"><span className="step-number">02</span><div className="step-icon"><ShoppingBag /></div><h3>Make it yours</h3><p>Add favourites to your bag and review your selection.</p><span className="step-arrow"><ArrowRight size={18} /></span></article>
            <article className="step-card reveal-on-scroll"><span className="step-number">03</span><div className="step-icon"><ChefHat /></div><h3>Back to your day</h3><p>Place your order and collect it from the counter when the team marks it ready.</p><span className="step-arrow"><ArrowRight size={18} /></span></article>
          </div>
        </section>

        <section className="reviews-section section-wrap reveal-on-scroll" id="reviews">
          <div className="reviews-head"><div><div className="eyebrow"><span className="eyebrow-line" /> WORD ON CAMPUS</div><h2>Good vibes<br /><span>go around.</span></h2></div><div className="reviews-note"><Star size={18} fill="currentColor" /><p>Feedback helps make the experience better.<br /><small>Only approved reviews are shown.</small></p></div></div>
          <div className="reviews-grid stagger-grid">
            {(reviews.length ? reviews : [{ id: 0, display_name: "No reviews yet", rating: 0, comment: "Customer reviews will appear here after the review feature is connected." }]).slice(0, 3).map(review => <article className="review-card reveal-on-scroll" key={review.id}><div className="stars" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={15} fill={i < review.rating ? "currentColor" : "none"} />)}</div><p className="review-quote">“{review.comment}”</p><div className="review-author"><span className="avatar">{review.display_name.slice(0, 1).toUpperCase()}</span><div><strong>{review.display_name}</strong><small>{review.is_demo ? "Sample review" : "Customer feedback"}</small></div></div></article>)}
          </div>
          <p className="reviews-disclaimer">Sample feedback is clearly marked and must not be presented as genuine customer testimonials.</p>
          <ReviewSubmission />
        </section>

        <EnquirySection />

        <section className="closing-cta section-wrap reveal-on-scroll"><div className="cta-mark"><ChefHat size={28} /></div><div><div className="eyebrow"><span className="eyebrow-line" /> TAKE A WELL-DESERVED BREAK</div><h2>Okay, now you're<br /><span>making us hungry.</span></h2></div><a className="button button-primary" href="#menu">Let's find a bite <ArrowRight size={17} /></a><span className="cta-sparkle">✳</span></section>
      </main>

      <footer className="footer"><div className="footer-main section-wrap"><a className="brand footer-brand" href="#home"><span className="brand-mark"><ChefHat size={23} /></span><span className="brand-copy"><strong>IIPS <em>Restaurant</em></strong><small>A CAMPUS FOOD PROJECT</small></span></a><p>Made for the little breaks that make campus life.</p><div className="footer-links"><a href="#menu">Menu</a><a href="#offers">Offers</a><a href="#reviews">Feedback</a><a href="#contact">Contact</a><a href="/admin">Admin login</a><a href="#home">Back to top ↑</a></div></div><div className="footer-bottom section-wrap"><span>© {new Date().getFullYear()} IIPS Restaurant · Student project</span><span className="status-line"><i className={apiStatus === "connected" ? "status-dot online" : "status-dot"} /> {apiStatus === "connected" ? "API connected" : apiStatus === "loading" ? "Connecting…" : "Demo mode"}</span><span>Not an official DAVV website.</span></div></footer>

      {notice && <div className="toast" role="status"><Check size={17} />{notice}</div>}
      {cartOpen && <div className="drawer-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setCartOpen(false); }}><aside className="cart-drawer" aria-label="Shopping bag"><div className="drawer-header"><div><span className="eyebrow"><span className="eyebrow-line" /> YOUR PICKS</span><h2>Your bag <span>({cartCount})</span></h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close bag"><X /></button></div>{cart.length === 0 ? <div className="cart-empty"><div className="empty-bag"><ShoppingBag size={30} /></div><h3>Your bag's taking a break.</h3><p>Find something good on the menu and add it here.</p><button className="button button-primary" onClick={() => setCartOpen(false)}>Explore menu <ArrowRight size={17} /></button></div> : <><div className="cart-lines">{cart.map(line => <div className="cart-line" key={line.item.id}><img src={line.item.image_url || ""} alt="" /><div className="cart-line-info"><strong>{line.item.name}</strong><small>{money(Number(line.item.price))} each</small><div className="quantity-control"><button onClick={() => changeQuantity(line.item.id, -1)} aria-label={`Remove one ${line.item.name}`}><Minus size={13} /></button><span>{line.quantity}</span><button onClick={() => changeQuantity(line.item.id, 1)} aria-label={`Add one ${line.item.name}`}><Plus size={13} /></button></div></div><b>{money(Number(line.item.price) * line.quantity)}</b></div>)}</div><div className="cart-summary">{!checkoutStage ? <><div><span>Estimated total</span><strong>{money(subtotal)}</strong></div><small>Final totals are verified by the server. Payment is at the counter; no online payment is processed.</small><button className="button button-primary checkout-button" onClick={demoCheckout}>Continue to checkout <ArrowRight size={17} /></button><button className="clear-cart" onClick={() => { setCart([]); setCheckoutStage(false); }}>Clear bag</button></> : <form className="checkout-form" onSubmit={placeOrder}><div className="checkout-form-heading"><h3>Almost there.</h3><p>Where can the team reach you?</p></div><label>Your name<input autoComplete="name" value={checkoutFields.customer_name} onChange={e => setCheckoutFields({ ...checkoutFields, customer_name: e.target.value })} minLength={2} maxLength={120} required placeholder="Your name" /></label><label>Email (optional)<input type="email" autoComplete="email" value={checkoutFields.email} onChange={e => setCheckoutFields({ ...checkoutFields, email: e.target.value })} maxLength={254} placeholder="you@example.com" /></label><label>Phone (optional)<input type="tel" autoComplete="tel" value={checkoutFields.phone} onChange={e => setCheckoutFields({ ...checkoutFields, phone: e.target.value })} maxLength={30} placeholder="+91…" /></label><label>Pickup note (optional)<textarea value={checkoutFields.pickup_notes} onChange={e => setCheckoutFields({ ...checkoutFields, pickup_notes: e.target.value })} maxLength={500} rows={2} placeholder="Anything the team should know?" /></label><small>Provide at least an email address or phone number. You’ll pay when collecting your order.</small>{checkoutError && <p className="checkout-error" role="alert">{checkoutError}</p>}<button className="button button-primary checkout-button" type="submit" disabled={placingOrder}>{placingOrder ? "Placing order…" : <>Place order · {money(subtotal)} <ArrowRight size={17} /></>}</button><button className="clear-cart" type="button" onClick={() => { setCheckoutStage(false); setCheckoutError(""); }}>Back to bag</button></form>}</div></>}</aside></div>}
    </div>
  );
}
