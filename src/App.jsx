import { useEffect, useMemo, useState } from "react";
import {
  Box, Castle, ChevronDown, Clock, Coins, Copy, ExternalLink, Filter, Headphones,
  MessageCircle, Minus, Package, Plus, ShieldCheck, ShoppingCart, Star,
  Trash2, UserCheck, Users, Zap
} from "lucide-react";
import { siteData } from "./siteData.js";

const iconMap = { money: Coins, items: Star, kits: Package, bases: Castle, bundles: Zap, spawner: Package };
const statIcons = [Box, Star, Users, Clock];
const benefitIcons = [Zap, ShieldCheck, Headphones];
const API_URL = import.meta.env.VITE_API_URL || siteData.brand.apiUrl;
const LOGIN_URL = siteData.brand.botAuthUrl;

function formatPrice(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: siteData.brand.currency,
    maximumFractionDigits: 2
  }).format(value);
}

function getDiscordUser() {
  try { return JSON.parse(localStorage.getItem("hugosmp_discord_user") || "null"); }
  catch { return null; }
}


function getDiscordAvatar(user) {
  if (!user) return "";
  if (user.avatar) return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=96`;
  const index = Number(user.discriminator || 0) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}


function Header({ page, setPage, cartTotal, cartCount, user, logout }) {
  const links = [
    ["home", "Home"],
    ["shop", "Shop"],
    ["reviews", "Bewertungen"],
    ["affiliate", "Free Money"],
    ["terms", "AGB"]
  ];

  return (
    <header className="topbar">
      <div className="navShell">
        <button className="brand" onClick={() => setPage("home")}>
          <span className="logo">{siteData.brand.logo}</span>
          <strong>{siteData.brand.name}</strong>
        </button>
        <nav className="navLinks">
          {links.map(([key, label]) => (
            <button key={key} className={page === key ? "active" : ""} onClick={() => setPage(key)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="navActions">
{user ? (
            <div className="accountArea">
              <button className="accountChip" onClick={() => setPage("cart")} title="Meine Bestellungen">
                <img className="accountAvatar" src={getDiscordAvatar(user)} alt="" />
                <span>
                  <strong>{user.global_name || user.username}</strong>
                  <small>Meine Bestellungen</small>
                </span>
              </button>
              <button className="logoutBtn" onClick={logout}>Logout</button>
            </div>
          ) : (
            <a className="login" href={LOGIN_URL}><MessageCircle size={16} />Discord Login</a>
          )}
          <button className="cartMini" onClick={() => setPage("cart")}>
            <ShoppingCart size={16} />{formatPrice(cartTotal)}
          </button>
        </div>
      </div>
    </header>
  );
}

function Home({ setPage, setCategory }) {
  return (
    <main>
      <section className="hero">
        <div className="statusPill"><span />247 Spieler online</div>
<h1>Der <strong>Minecraft Shop</strong><br />{siteData.brand.heroLine}</h1>
        <p>{siteData.brand.subtitle}</p>
        <div className="heroActions">
          <button className="primary" onClick={() => setPage("shop")}><ShoppingCart size={18} />Zum Shop</button>
          <a className="secondary" href={siteData.brand.discordUrl}><MessageCircle size={18} />Discord Support</a>
        </div>
      </section>

      <section className="section">
        <h2>Beliebte Kategorien</h2>
        <div className="categoryGrid">
          {siteData.categories.filter((c) => c.id !== "all").map((category) => {
            const Icon = iconMap[category.id] || Package;
            return (
              <button className="categoryCard" key={category.id} onClick={() => setCategory(category.id)}>
                <Icon size={48} />
                <span>{category.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="statsRow">
        {siteData.stats.map(([value, label], index) => {
          const Icon = statIcons[index];
          return <div className="statCard" key={label}><Icon size={28} /><strong>{value}</strong><span>{label}</span></div>;
        })}
      </section>

      <section className="section">
        <h2>Warum {siteData.brand.name}?</h2>
        <div className="benefitGrid">
          {siteData.benefits.map(([title, text], index) => {
            const Icon = benefitIcons[index];
            return <article className="benefitCard" key={title}><Icon size={28} /><h3>{title}</h3><p>{text}</p></article>;
          })}
        </div>
      </section>

      <FAQ />

      <section className="cta">
        <span className="logo big">{siteData.brand.logo}</span>
        <h2>Bereit einzukaufen?</h2>
        <p>Lege Produkte in den Warenkorb und erstelle direkt auf der Website deine Bestellung.</p>
        <div className="heroActions">
          <button className="primary" onClick={() => setPage("shop")}><ShoppingCart size={18} />Jetzt einkaufen</button>
          <button className="secondary" onClick={() => setPage("cart")}>Zum Checkout</button>
        </div>
      </section>
    </main>
  );
}

function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section className="section faq">
      <h2>Häufig gestellte Fragen</h2>
      {siteData.faq.map(([question, answer], index) => (
        <button className={`faqItem ${open === index ? "open" : ""}`} key={question} onClick={() => setOpen(open === index ? -1 : index)}>
          <span>{question}</span>
          <ChevronDown size={18} />
          <p>{answer}</p>
        </button>
      ))}
    </section>
  );
}

function Shop({ category, setCategory, addToCart, products: shopProducts }) {
  const [sort, setSort] = useState("asc");
  const products = useMemo(() => {
    return shopProducts
      .filter((product) => category === "all" || product.category === category)
      .sort((a, b) => sort === "asc" ? a.price - b.price : b.price - a.price);
  }, [category, shopProducts, sort]);

  return (
    <main className="shopLayout">
      <aside className="filterPanel">
        <h3><Filter size={18} />Kategorien</h3>
        {siteData.categories.map((item) => (
          <button className={category === item.id ? "active" : ""} key={item.id} onClick={() => setCategory(item.id)}>
            {item.label}
          </button>
        ))}
      </aside>
      <section className="shopContent">
        <div className="shopHead">
          <div>
            <h1>{siteData.categories.find((c) => c.id === category)?.label}</h1>
            <p>{products.length} Produkte gefunden</p>
          </div>
</div>
        <div className="productGrid">
          {products.map((product) => <ProductCard product={product} addToCart={addToCart} key={product.id} />)}
        </div>
      </section>
    </main>
  );
}

function ProductCard({ product, addToCart }) {
  const [qty, setQty] = useState(1);
  const out = product.stock <= 0;
  return (
    <article className="productCard">
      {product.image ? <img className="productImage" src={product.image} alt={product.name} /> : <div className={`productArt ${product.art}`}><span>{product.art === "coin" ? "M" : ""}</span></div>}
      <div className="productBody">
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <span className={`stock ${product.stock <= 1 ? "low" : ""}`}>{out ? "Ausverkauft" : `${product.stock} auf Lager`}</span>
        <strong>{formatPrice(product.price)}</strong>
        <div className="qty">
          <button onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={14} /></button>
          <span>{qty}</span>
          <button onClick={() => setQty(qty + 1)}><Plus size={14} /></button>
        </div>
        <button className={product.ticket ? "ticketBtn" : "addBtn"} disabled={out} onClick={() => addToCart(product, qty)}>
          {product.ticket ? <MessageCircle size={18} /> : <ShoppingCart size={18} />}
          {out ? "Ausverkauft" : product.ticket ? "Ticket erstellen" : "In den Warenkorb"}
        </button>
      </div>
    </article>
  );
}

function Reviews() {
  return (
    <main className="reviewsLayout">
      <section className="reviewsHero">
        <div><MessageCircle size={34} /><h1>Kundenbewertungen</h1><p>Echte Erfahrungen aus der HugoSMP Community.</p></div>
        <div className="score"><strong>{siteData.reviews.score}</strong><Stars rating={4} /><p>{siteData.reviews.total}</p></div>
      </section>
      <aside className="reviewLogin">
        <h2>Schreibe eine Bewertung</h2>
        <p>Du musst angemeldet sein, um eine Bewertung zu schreiben.</p>
        <a className="login full" href={LOGIN_URL}><MessageCircle size={16} />Mit Discord anmelden</a>
      </aside>
      <section className="reviewList">
        <h2>Verifizierte Käufer ({siteData.reviews.verified.length})</h2>
        {siteData.reviews.verified.map((review) => <ReviewCard review={review} key={review[0]} />)}
        <h2>Andere Bewertungen ({siteData.reviews.other.length})</h2>
        {siteData.reviews.other.map((review) => <ReviewCard review={review} key={review[0]} />)}
      </section>
    </main>
  );
}

function Stars({ rating }) {
  return <div className="stars">{"★★★★★".split("").map((star, index) => <span className={index < rating ? "filled" : ""} key={index}>{star}</span>)}</div>;
}

function ReviewCard({ review }) {
  const [name, date, rating, text] = review;
  return <article className="reviewCard"><div className="avatar">{name[0].toUpperCase()}</div><div><h3>{name}<em>Verifizierter Kauf</em></h3><small>{date}</small><p>{text}</p></div><Stars rating={rating} /></article>;
}

function Affiliate() {
  return (
    <main className="singlePage">
      <section className="affiliateCard">
        <span className="miniLabel">$ Promotion Belohnungen</span>
        <h1>{siteData.affiliate.title}</h1>
        <p>{siteData.affiliate.subtitle}</p>
        <div className="steps">{siteData.affiliate.steps.map(([title, text], index) => <article key={title}><span>{index + 1}</span><h2>{title}</h2><p>{text}</p></article>)}</div>
        <div className="affiliateActions">
          <div><h2><MessageCircle size={20} />Wie forderst du es ein?</h2><p>Öffne ein Ticket auf Discord, um deine Belohnung anzufordern.</p><a className="login" href={siteData.brand.discordUrl}><ExternalLink size={16} />Claim-Ticket öffnen</a></div>
          <div><h2><ShieldCheck size={20} />Partner werden</h2><p>Du möchtest einen individuellen Deal? Öffne ein Partnerschafts-Ticket.</p><a className="success" href={siteData.brand.discordUrl}><MessageCircle size={16} />Partnerschafts-Ticket</a></div>
        </div>
      </section>
    </main>
  );
}

function Legal({ type }) {
  const title = type === "privacy" ? "Datenschutz" : type === "imprint" ? "Impressum" : "Terms of Service (AGB)";
  return <main className="singlePage"><section className="legalCard"><h1>{title}</h1>{type === "terms" ? siteData.legal.terms.map(([heading, text], index) => <div key={heading}><h2>{index + 1}. {heading}</h2><p>{text}</p></div>) : <p>{siteData.legal[type]}</p>}</section></main>;
}

function buildOrderText(entries, total, form, user) {
  const lines = entries.map(({ product, qty }) => `- ${qty}x ${product.name} = ${formatPrice(product.price * qty)}`).join("\n");
  return `🛒 NEUE HUGOSMP BESTELLUNG\nBestellnummer: HUGO-${Math.random().toString(36).slice(2,8).toUpperCase()}\n\nDiscord: ${user ? `${user.global_name || user.username} (${user.id})` : form.discord}\nMinecraft Name: ${form.minecraft}\nZahlungsmethode: ${form.payment}\n\nProdukte:\n${lines}\n\nGesamt: ${formatPrice(total)}\n\nNotiz:\n${form.note || "-"}`;
}

function Cart({ cart, updateQty, removeFromCart, clearCart, user }) {
  const entries = Object.values(cart);
  const total = entries.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const [form, setForm] = useState({ discord: "", minecraft: "", payment: "PayPal", note: "" });
  const [orderText, setOrderText] = useState("");

  useEffect(() => { if (user) setForm((f) => ({ ...f, discord: user.global_name || user.username || "" })); }, [user]);

  async function submit(event) {
    event.preventDefault();
    if (!entries.length) return;
    if (!user) { window.location.href = LOGIN_URL; return; }
    const text = buildOrderText(entries, total, form, user);
    setOrderText(text);
    try { await navigator.clipboard.writeText(text); } catch {}
  }

  return (
    <main className="singlePage checkoutPage">
      <section className="legalCard checkoutCard">
        <div>
          <h1>Checkout</h1>
          <p className="checkoutHint">Bestelle direkt über die Website. Nach dem Absenden wird eine fertige Discord-Bestellnachricht erstellt und kopiert.</p>
          {!user ? <a className="login full discordNotice" href={LOGIN_URL}><MessageCircle size={16} />Zuerst mit Discord anmelden</a> : <div className="discordNotice accountNotice"><img className="accountAvatar" src={getDiscordAvatar(user)} alt="" />Eingeloggt als {user.global_name || user.username}</div>}
          <form className="orderForm" onSubmit={submit}>
            <label>Discord Name<input required value={form.discord} onChange={(e) => setForm({ ...form, discord: e.target.value })} readOnly={!!user} placeholder="Wird nach Login automatisch ausgefüllt" /></label>
            <label>Minecraft Name<input required value={form.minecraft} onChange={(e) => setForm({ ...form, minecraft: e.target.value })} placeholder="Dein Minecraft Name" /></label>
            <label>Zahlungsmethode
</label>
            <label>Notiz<textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Extra Wünsche oder Fragen..." /></label>
            <button className="primary full" disabled={!entries.length}><ShoppingCart size={18} />Bestellung erstellen</button>
          </form>
        </div>
        <div className="cartSummary">
          <h2>Warenkorb</h2>
          {entries.length === 0 ? <p>Dein Warenkorb ist leer.</p> : entries.map(({ product, qty }) => (
            <div className="cartRow" key={product.id}>
              <span>{product.name}<small>{qty} × {formatPrice(product.price)}</small></span>
              <div><b>{formatPrice(product.price * qty)}</b><div className="miniQty"><button onClick={() => updateQty(product.id, qty - 1)}>-</button><button onClick={() => updateQty(product.id, qty + 1)}>+</button><button onClick={() => removeFromCart(product.id)}><Trash2 size={14}/></button></div></div>
            </div>
          ))}
          <div className="cartTotal"><span>Gesamt</span><strong>{formatPrice(total)}</strong></div>
          {entries.length > 0 && <button className="secondary full" onClick={clearCart}>Warenkorb leeren</button>}
          {orderText && <div className="orderResult"><h3>✅ Bestellung erstellt</h3><p>Der Text wurde kopiert. Öffne ein Discord-Ticket und füge ihn dort ein.</p><pre>{orderText}</pre><button className="secondary full" onClick={() => navigator.clipboard?.writeText(orderText)}><Copy size={16}/>Text erneut kopieren</button></div>}
        </div>
      </section>
    </main>
  );
}

function Footer({ setPage }) {
  return <footer className="footer"><div className="footerGrid"><div><div className="brand footBrand"><img className="brandSmallLogo" src="/assets/hugo-shop-logo.png" alt="HugoSMP Shop" /><span className="logo">{siteData.brand.logo}</span><strong>{siteData.brand.name}</strong></div><p>Der moderne Minecraft Shop für den HugoSMP Server.</p></div><div><h3>Links</h3><button onClick={() => setPage("home")}>Home</button><button onClick={() => setPage("shop")}>Shop</button><button onClick={() => setPage("reviews")}>Bewertungen</button><a href={siteData.brand.discordUrl}>Discord</a></div><div><h3>Rechtliches</h3><button onClick={() => setPage("imprint")}>Impressum</button><button onClick={() => setPage("terms")}>AGB</button><button onClick={() => setPage("privacy")}>Datenschutz</button></div></div><div className="footerBottom"><span>© 2026 {siteData.brand.name}. Alle Rechte vorbehalten.</span><span>Nicht offiziell mit Mojang AB oder Microsoft verbunden.</span></div></footer>;
}

function SellBox() { return <aside className="sellBox"><span>Ankauf</span><h3>Willst du echtes Geld verdienen?</h3><p>Wir kaufen deine Items und dein Geld. Werde Supplier und lass dich bezahlen.</p><a href={siteData.brand.discordUrl}>$ Jetzt verkaufen <ExternalLink size={14} /></a></aside>; }

export default function App() {
  const [page, setPage] = useState(() => new URLSearchParams(window.location.search).get("page") || "home");
  const [category, setCategoryState] = useState("all");
  const [cart, setCart] = useState({});
  const [products, setProducts] = useState(siteData.products);
  const [user, setUser] = useState(getDiscordUser());

  const cartTotal = Object.values(cart).reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const cartCount = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);

  function setCategory(nextCategory) { setCategoryState(nextCategory); setPage("shop"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function addToCart(product, qty) { setCart((current) => ({ ...current, [product.id]: { product, qty: (current[product.id]?.qty || 0) + qty } })); setPage("cart"); }
  function updateQty(id, qty) { if (qty < 1) return removeFromCart(id); setCart((current) => ({ ...current, [id]: { ...current[id], qty } })); }
  function removeFromCart(id) { setCart((current) => { const next = { ...current }; delete next[id]; return next; }); }
  function clearCart() { setCart({}); }
  function logout() { localStorage.removeItem("hugosmp_discord_user"); localStorage.removeItem("hugosmp_discord_token"); setUser(null); }

  useEffect(() => {
    const onStorage = () => setUser(getDiscordUser());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!API_URL) return;
    fetch(`${API_URL}/api/stock`).then((response) => response.json()).then((data) => {
      const stockItems = Array.isArray(data) ? data : data.stock;
      if (!Array.isArray(stockItems)) return;
      setProducts((currentProducts) => currentProducts.map((product) => {
        const match = stockItems.find((item) => item.id === product.id || item.name === product.name);
        if (!match) return product;
        const nextStock = Number(match.stock ?? match.amount ?? match.quantity);
        return Number.isFinite(nextStock) ? { ...product, stock: nextStock } : product;
      }));
    }).catch(() => {});
  }, []);

  const pages = {
    home: <Home setPage={setPage} setCategory={setCategory} />,
    shop: <Shop category={category} setCategory={setCategory} addToCart={addToCart} products={products} />,
    reviews: <Reviews />,
    affiliate: <Affiliate />,
    terms: <Legal type="terms" />,
    imprint: <Legal type="imprint" />,
    privacy: <Legal type="privacy" />,
    cart: <Cart cart={cart} updateQty={updateQty} removeFromCart={removeFromCart} clearCart={clearCart} user={user} />
  };

  return <><Header page={page} setPage={setPage} cartTotal={cartTotal} cartCount={cartCount} user={user} logout={logout} />{pages[page] || pages.home}<Footer setPage={setPage} /><SellBox /></>;
}
