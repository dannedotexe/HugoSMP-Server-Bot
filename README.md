:root {
  color-scheme: dark;
  --bg: #050506;
  --panel: #111114;
  --panel-2: #17171c;
  --line: #292932;
  --muted: #aaaab6;
  --text: #ffffff;
  --purple: #9b33f1;
  --purple-2: #6426d9;
  --blue: #5865f2;
  --green: #00c987;
  --yellow: #ffc400;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background:
    radial-gradient(circle at 50% 32%, rgba(132, 48, 220, .13), transparent 34%),
    linear-gradient(90deg, transparent, rgba(255,255,255,.02), transparent),
    var(--bg);
  color: var(--text);
  font-family: Inter, Arial, sans-serif;
  font-weight: 700;
  letter-spacing: 0;
  overflow-x: hidden;
}

button, a, select { font: inherit; }
button { cursor: pointer; }
a { color: inherit; }

body::before,
body::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
}

body::before {
  z-index: -2;
  background:
    radial-gradient(circle at 18% 22%, rgba(155, 51, 241, .18), transparent 24%),
    radial-gradient(circle at 82% 18%, rgba(88, 101, 242, .12), transparent 22%),
    radial-gradient(circle at 50% 88%, rgba(155, 51, 241, .1), transparent 28%);
  animation: ambientShift 14s ease-in-out infinite alternate;
}

body::after {
  z-index: -1;
  opacity: .08;
  background-image:
    linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px);
  background-size: 80px 80px;
  animation: gridDrift 22s linear infinite;
}

@keyframes ambientShift {
  0% { transform: translate3d(-1%, -1%, 0) scale(1); filter: hue-rotate(0deg); }
  100% { transform: translate3d(1.5%, 1%, 0) scale(1.08); filter: hue-rotate(10deg); }
}

@keyframes gridDrift {
  from { background-position: 0 0, 0 0; }
  to { background-position: 80px 80px, 80px 80px; }
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(22px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes softPulse {
  0%, 100% { box-shadow: 0 0 18px rgba(155, 51, 241, .48); }
  50% { box-shadow: 0 0 34px rgba(155, 51, 241, .82); }
}

@keyframes floatImage {
  0%, 100% { transform: scale(1.02) translateY(0); }
  50% { transform: scale(1.04) translateY(-6px); }
}

@keyframes shimmer {
  from { transform: translateX(-140%) skewX(-18deg); }
  to { transform: translateX(140%) skewX(-18deg); }
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid rgba(255,255,255,.07);
  background: rgba(5, 5, 6, .88);
  backdrop-filter: blur(18px);
  animation: fadeUp .55s ease both;
}

.navShell {
  width: min(1060px, calc(100% - 28px));
  min-height: 64px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 24px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  color: var(--text);
  text-decoration: none;
  white-space: nowrap;
}

.logo {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  background: linear-gradient(145deg, #231030, #7b25d7);
  box-shadow: 0 0 22px rgba(155, 51, 241, .52);
  font-weight: 900;
  animation: softPulse 2.8s ease-in-out infinite;
}

.logo.big {
  width: 64px;
  height: 64px;
  margin: 0 auto 24px;
  border-radius: 18px;
  font-size: 30px;
}

.navLinks {
  display: flex;
  gap: 8px;
  flex: 1;
}

.navLinks button,
.footer button {
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: 10px 8px;
  font-size: 13px;
  transition: color .18s ease, transform .18s ease;
}

.navLinks button.active,
.navLinks button:hover,
.footer button:hover,
.footer a:hover {
  color: var(--text);
  transform: translateY(-1px);
}

.navActions {
  display: flex;
  align-items: center;
  gap: 10px;
}

select,
.login,
.cartMini,
.primary,
.secondary,
.success {
  min-height: 38px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #101014;
  color: var(--text);
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-decoration: none;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, filter .18s ease;
}

.login {
  background: var(--blue);
  border-color: transparent;
}

.primary {
  background: linear-gradient(135deg, var(--purple), #8e27e5);
  border-color: transparent;
  box-shadow: 0 12px 32px rgba(155, 51, 241, .3);
  position: relative;
  overflow: hidden;
}

.primary::after,
.login::after,
.success::after {
  content: "";
  position: absolute;
  inset: 0;
  width: 44%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent);
  transform: translateX(-140%) skewX(-18deg);
}

.primary:hover::after,
.login:hover::after,
.success:hover::after {
  animation: shimmer .7s ease;
}

.login,
.success {
  position: relative;
  overflow: hidden;
}

.primary:hover,
.login:hover,
.secondary:hover,
.success:hover,
.cartMini:hover {
  transform: translateY(-2px);
  filter: brightness(1.08);
}

.secondary { background: #28282e; }
.success { background: var(--green); border-color: transparent; }
.full { width: 100%; }

h1, h2, h3, p { margin-top: 0; }

.hero {
  min-height: calc(100vh - 64px);
  display: grid;
  place-content: center;
  text-align: center;
  padding: 80px 18px;
  animation: fadeUp .75s ease both;
}

.statusPill,
.miniLabel {
  width: fit-content;
  margin: 0 auto 34px;
  padding: 8px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(17,17,20,.78);
  font-size: 12px;
  animation: fadeUp .75s .08s ease both;
}

.statusPill span {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--purple);
  margin-right: 8px;
  box-shadow: 0 0 18px var(--purple);
  animation: statusBlink 1.6s ease-in-out infinite;
}

@keyframes statusBlink {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: .55; transform: scale(1.35); }
}

.hero h1 {
  font-size: clamp(44px, 7vw, 76px);
  line-height: 1.05;
  margin-bottom: 24px;
  font-weight: 900;
  animation: fadeUp .75s .16s ease both;
}

.hero h1 strong {
  color: var(--purple);
  text-shadow: 0 0 28px rgba(155, 51, 241, .55);
}

.hero p,
.cta p {
  color: #c8c8d4;
  font-size: 19px;
  max-width: 640px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.5;
  font-weight: 500;
  animation: fadeUp .75s .24s ease both;
}

.heroActions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 32px;
  flex-wrap: wrap;
  animation: fadeUp .75s .32s ease both;
}

.section {
  width: min(980px, calc(100% - 28px));
  margin: 0 auto;
  padding: 80px 0;
  text-align: center;
}

.section h2,
.cta h2 {
  font-size: 34px;
  font-weight: 900;
  margin-bottom: 38px;
}

.categoryGrid,
.statsRow {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 28px;
}

.benefitGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
}

.categoryCard,
.statCard,
.benefitCard,
.productCard,
.filterPanel,
.reviewsHero,
.reviewLogin,
.reviewList,
.affiliateCard,
.legalCard,
.sellBox {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(18,18,21,.9);
  transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease, background .22s ease;
}

.categoryCard {
  min-height: 160px;
  color: var(--text);
  display: grid;
  place-items: center;
  gap: 14px;
  position: relative;
  overflow: hidden;
}

.categoryCard::after,
.benefitCard::after,
.productCard::after,
.reviewCard::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(135deg, rgba(155,51,241,.18), transparent 48%);
  transition: opacity .22s ease;
}

.categoryCard:hover,
.statCard:hover,
.benefitCard:hover,
.productCard:hover,
.reviewCard:hover {
  transform: translateY(-6px);
  border-color: rgba(155, 51, 241, .55);
  box-shadow: 0 18px 50px rgba(0,0,0,.34), 0 0 28px rgba(155, 51, 241, .15);
}

.categoryCard:hover::after,
.benefitCard:hover::after,
.productCard:hover::after,
.reviewCard:hover::after {
  opacity: 1;
}

.categoryCard:hover svg,
.benefitCard:hover svg,
.statCard:hover svg {
  transform: scale(1.08) rotate(-4deg);
}

.categoryCard svg,
.statCard svg,
.benefitCard svg,
.reviewsHero svg {
  color: var(--purple);
  transition: transform .22s ease;
}

.statsRow {
  width: min(980px, calc(100% - 28px));
  margin: 40px auto 80px;
}

.statCard {
  padding: 24px;
  text-align: center;
  animation: fadeUp .65s ease both;
}

.statCard:nth-child(2) { animation-delay: .06s; }
.statCard:nth-child(3) { animation-delay: .12s; }
.statCard:nth-child(4) { animation-delay: .18s; }

.statCard strong {
  display: block;
  margin-top: 12px;
  font-size: 30px;
  font-weight: 900;
}

.statCard span {
  color: #c8c8d4;
  text-transform: uppercase;
  font-size: 12px;
}

.benefitCard {
  padding: 32px;
  text-align: left;
  position: relative;
  overflow: hidden;
}

.benefitCard svg {
  width: 48px;
  height: 48px;
  padding: 10px;
  margin-bottom: 18px;
  border-radius: 8px;
  background: rgba(155, 51, 241, .18);
}

.benefitCard p,
.faqItem p,
.footer p,
.productBody p,
.legalCard p,
.affiliateCard p,
.reviewCard p,
.reviewLogin p {
  color: #c8c8d4;
  line-height: 1.6;
  font-weight: 500;
}

.faq { max-width: 700px; }

.faqItem {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0;
  margin-bottom: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
  padding: 22px;
  text-align: left;
  transition: border-color .2s ease, transform .2s ease, background .2s ease;
}

.faqItem:hover {
  transform: translateX(4px);
  border-color: rgba(155, 51, 241, .52);
}

.faqItem p {
  display: none;
  grid-column: 1 / -1;
  margin: 14px 0 0;
}

.faqItem.open p {
  display: block;
  animation: fadeUp .22s ease both;
}

.cta {
  padding: 110px 18px;
  text-align: center;
  background: linear-gradient(to bottom, transparent, rgba(155, 51, 241, .12));
  position: relative;
  overflow: hidden;
}

.cta::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 24%;
  width: 520px;
  height: 520px;
  background: radial-gradient(circle, rgba(155,51,241,.18), transparent 62%);
  transform: translateX(-50%);
  animation: ambientShift 9s ease-in-out infinite alternate;
}

.cta > * {
  position: relative;
}

.shopLayout,
.reviewsLayout {
  width: min(1060px, calc(100% - 28px));
  margin: 0 auto;
  padding: 48px 0 80px;
  display: grid;
  grid-template-columns: 230px 1fr;
  gap: 28px;
  align-items: start;
  animation: fadeUp .55s ease both;
}

.filterPanel,
.reviewLogin {
  position: sticky;
  top: 88px;
  padding: 22px;
  animation: fadeUp .55s .08s ease both;
}

.filterPanel h3 {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 15px;
}

.filterPanel button {
  display: block;
  width: 100%;
  margin: 10px 0;
  padding: 14px 16px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  text-align: left;
  transition: color .18s ease, background .18s ease, transform .18s ease;
}

.filterPanel button:hover {
  transform: translateX(4px);
  color: var(--text);
}

.filterPanel button.active {
  background: rgba(155, 51, 241, .14);
  color: #c374ff;
  outline: 1px solid rgba(155, 51, 241, .45);
}

.shopHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.shopHead h1 { margin-bottom: 6px; font-size: 30px; }
.shopHead p { margin-bottom: 0; color: #c8c8d4; font-weight: 500; }

.productGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.productCard {
  overflow: hidden;
  position: relative;
  animation: fadeUp .5s ease both;
}

.productCard:nth-child(2) { animation-delay: .04s; }
.productCard:nth-child(3) { animation-delay: .08s; }
.productCard:nth-child(4) { animation-delay: .12s; }
.productCard:nth-child(5) { animation-delay: .16s; }
.productCard:nth-child(6) { animation-delay: .2s; }

.productImage {
  width: 100%;
  height: 190px;
  display: block;
  object-fit: cover;
  background: linear-gradient(180deg, #191920, #111114);
  transform: scale(1.02);
  animation: floatImage 4.8s ease-in-out infinite;
  transition: transform .28s ease, filter .28s ease;
}

.productCard:hover .productImage {
  transform: scale(1.08);
  filter: saturate(1.15) brightness(1.08);
}

.productArt {
  height: 170px;
  display: grid;
  place-items: center;
  position: relative;
  background: linear-gradient(180deg, #191920, #111114);
}

.productArt::before {
  content: "";
  width: 130px;
  height: 130px;
  display: block;
  filter: drop-shadow(0 16px 18px rgba(0,0,0,.35));
}

.productArt span {
  position: absolute;
  color: #fff3a4;
  font-size: 74px;
  font-weight: 900;
}

.coin::before {
  border-radius: 50%;
  background: conic-gradient(from 45deg, #ffd400, #fff3a4, #d28a00, #ffd400);
  clip-path: polygon(12% 20%, 88% 20%, 100% 50%, 88% 80%, 12% 80%, 0 50%);
}

.blackstone::before {
  background:
    linear-gradient(45deg, transparent 20%, #f7af18 20% 30%, transparent 30% 45%, #c67000 45% 52%, transparent 52%),
    repeating-linear-gradient(45deg, #202028 0 16px, #3b3038 16px 30px);
}

.debris::before { background: repeating-linear-gradient(45deg, #4f2e27 0 16px, #8d6254 16px 28px, #2a1c19 28px 42px); }
.ingot::before { border-radius: 10px; transform: skew(-18deg); background: linear-gradient(135deg, #6f737c, #2b2227 45%, #a8a9b2); }
.mace::before { width: 44px; height: 150px; background: linear-gradient(#9ea9b7 0 35%, #6d78aa 35% 60%, #1f2452 60%); transform: rotate(45deg); box-shadow: 34px -58px 0 20px #58616f; }
.trident::before { width: 26px; height: 150px; background: #2b8b78; transform: rotate(45deg); box-shadow: 28px -58px 0 2px #e9e9e9, 8px -76px 0 2px #e9e9e9, 48px -40px 0 2px #e9e9e9; }
.diamond::before { background: linear-gradient(135deg, #56dfff, #156d9d); clip-path: polygon(10% 18%, 90% 18%, 100% 56%, 50% 92%, 0 56%); }
.netherite::before { background: linear-gradient(135deg, #222830, #5b616c, #1c1c22); clip-path: polygon(10% 18%, 90% 18%, 100% 56%, 50% 92%, 0 56%); }
.elytra::before { background: linear-gradient(90deg, #acb0c2 0 34%, transparent 34% 66%, #acb0c2 66%); clip-path: polygon(0 0, 42% 0, 35% 100%, 7% 88%, 0 30%, 58% 0, 100% 0, 93% 88%, 65% 100%, 58% 0); }
.builder::before { border-radius: 12px; background: linear-gradient(90deg, #8e5a34 0 22%, #00a7aa 22% 78%, #8e5a34 78%); clip-path: polygon(25% 0, 75% 0, 90% 55%, 68% 100%, 32% 100%, 10% 55%); }
.castle::before { background: linear-gradient(135deg, #ff80c8, #b875ff); clip-path: polygon(5% 90%, 5% 42%, 20% 42%, 20% 22%, 34% 42%, 48% 42%, 48% 18%, 62% 42%, 80% 42%, 80% 24%, 95% 42%, 95% 90%); }

.productBody { padding: 18px; }
.productBody h3 { min-height: 42px; margin-bottom: 8px; font-size: 18px; }
.productBody p {
  min-height: 42px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 13px;
}

.stock {
  display: block;
  color: var(--green);
  font-size: 13px;
  margin: 12px 0;
}

.stock::before {
  content: "";
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: currentColor;
  margin-right: 5px;
  animation: stockPulse 1.9s ease-in-out infinite;
}

@keyframes stockPulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 rgba(0,201,135,0); }
  50% { opacity: .65; box-shadow: 0 0 12px currentColor; }
}

.stock.low { color: #ff8b2f; }
.productBody strong { display: block; font-size: 24px; margin-bottom: 20px; }

.qty {
  height: 42px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 6px;
  margin-bottom: 8px;
}

.qty button,
.qty span {
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--text);
  display: grid;
  place-items: center;
}

.addBtn,
.ticketBtn {
  width: 100%;
  height: 42px;
  border: 0;
  border-radius: 6px;
  background: #29292f;
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: transform .18s ease, background .18s ease, filter .18s ease;
}

.ticketBtn { background: var(--blue); }

.addBtn:hover,
.ticketBtn:hover {
  transform: translateY(-2px);
  filter: brightness(1.13);
}

.reviewsLayout { grid-template-columns: 290px 1fr; }

.reviewsHero {
  grid-column: 1 / -1;
  padding: 34px;
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: center;
  animation: fadeUp .55s ease both;
}

.reviewsHero h1 { display: inline; margin-left: 12px; font-size: 32px; }

.score {
  min-width: 170px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 24px;
  text-align: center;
}

.score strong {
  display: block;
  font-size: 46px;
  color: var(--purple);
  animation: softPulse 2.8s ease-in-out infinite;
}

.stars { color: #3a3a40; white-space: nowrap; }
.stars .filled { color: var(--yellow); }

.reviewLogin p {
  background: #202026;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 24px;
}

.reviewList { padding: 28px; }
.reviewList h2 { font-size: 18px; }

.reviewCard {
  display: grid;
  grid-template-columns: 42px 1fr auto;
  gap: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 22px;
  margin-bottom: 14px;
  position: relative;
  overflow: hidden;
  animation: fadeUp .45s ease both;
}

.reviewCard:nth-of-type(2) { animation-delay: .04s; }
.reviewCard:nth-of-type(3) { animation-delay: .08s; }
.reviewCard:nth-of-type(4) { animation-delay: .12s; }

.avatar {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #28282f;
}

.reviewCard h3 { font-size: 15px; margin-bottom: 3px; }
.reviewCard em {
  margin-left: 8px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(0, 201, 135, .15);
  color: var(--green);
  font-size: 10px;
  font-style: normal;
  text-transform: uppercase;
}

.reviewCard small { color: var(--muted); font-weight: 500; }

.singlePage {
  min-height: calc(100vh - 64px);
  width: min(760px, calc(100% - 28px));
  margin: 0 auto;
  padding: 48px 0 80px;
  animation: fadeUp .55s ease both;
}

.affiliateCard,
.legalCard {
  padding: 44px;
}

.affiliateCard {
  text-align: center;
  background: linear-gradient(145deg, #17171c, #14121d);
  position: relative;
  overflow: hidden;
}

.affiliateCard::before,
.legalCard::before {
  content: "";
  position: absolute;
  inset: -1px;
  pointer-events: none;
  background: linear-gradient(120deg, transparent 20%, rgba(155,51,241,.13), transparent 78%);
  transform: translateX(-100%);
  animation: shimmer 5s ease-in-out infinite;
}

.legalCard {
  position: relative;
  overflow: hidden;
}

.affiliateCard h1,
.legalCard h1 { font-size: 40px; }

.miniLabel {
  color: var(--purple);
  text-transform: uppercase;
  margin-bottom: 24px;
}

.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin: 40px 0;
}

.steps article {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 28px 18px;
  background: rgba(255,255,255,.03);
  transition: transform .2s ease, border-color .2s ease;
}

.steps article:hover {
  transform: translateY(-5px);
  border-color: rgba(155, 51, 241, .5);
}

.steps span {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  margin: 0 auto 18px;
  border-radius: 12px;
  background: rgba(155, 51, 241, .17);
  color: var(--purple);
  font-size: 24px;
}

.steps h2,
.affiliateActions h2 { font-size: 17px; }

.affiliateActions {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 28px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
  text-align: left;
}

.affiliateActions h2 {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legalCard h1 {
  border-bottom: 1px solid var(--line);
  padding-bottom: 22px;
  margin-bottom: 28px;
}

.legalCard h2 { font-size: 22px; margin-top: 28px; }

.cartRow,
.cartTotal {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}

.cartTotal {
  align-items: center;
  border-bottom: 0;
  margin-top: 12px;
}

.cartTotal strong { font-size: 28px; }

.sellBox {
  position: fixed;
  right: 26px;
  bottom: 26px;
  z-index: 25;
  width: 330px;
  padding: 24px;
  background: linear-gradient(145deg, rgba(24,22,30,.96), rgba(15,13,18,.96));
  box-shadow: 0 18px 60px rgba(0,0,0,.35);
  animation: sellBoxIn .7s .45s ease both, sellBoxFloat 5s 1.3s ease-in-out infinite;
}

@keyframes sellBoxIn {
  from { opacity: 0; transform: translateY(24px) scale(.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes sellBoxFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}

.sellBox span {
  color: var(--purple);
  text-transform: uppercase;
  font-size: 11px;
}

.sellBox h3 { margin: 8px 0 12px; font-size: 18px; }
.sellBox p { color: var(--muted); line-height: 1.5; font-size: 13px; font-weight: 500; }
.sellBox a {
  display: flex;
  justify-content: center;
  gap: 8px;
  text-decoration: none;
  background: var(--purple);
  padding: 13px;
  border-radius: 6px;
  margin-top: 18px;
  transition: transform .18s ease, filter .18s ease;
}

.sellBox a:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.footer {
  border-top: 1px solid var(--line);
  padding: 42px 0 34px;
  animation: fadeUp .55s ease both;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
  }
}

.footerGrid,
.footerBottom {
  width: min(1060px, calc(100% - 28px));
  margin: 0 auto;
}

.footerGrid {
  display: grid;
  grid-template-columns: 1fr 240px 240px;
  gap: 40px;
}

.footBrand { margin-bottom: 18px; }
.footer h3 { font-size: 15px; }
.footer a {
  display: block;
  color: var(--muted);
  text-decoration: none;
  padding: 10px 8px;
  font-size: 13px;
}

.footer button { display: block; }

.footerBottom {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  border-top: 1px solid var(--line);
  margin-top: 34px;
  padding-top: 28px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
}

@media (max-width: 900px) {
  .navShell {
    height: auto;
    min-height: 64px;
    flex-wrap: wrap;
    padding: 12px 0;
  }

  .navLinks {
    order: 3;
    width: 100%;
    overflow-x: auto;
  }

  .navActions { margin-left: auto; }
  .categoryGrid, .statsRow, .benefitGrid, .productGrid, .steps, .affiliateActions, .footerGrid { grid-template-columns: 1fr 1fr; }
  .shopLayout, .reviewsLayout { grid-template-columns: 1fr; }
  .filterPanel, .reviewLogin { position: static; }
  .sellBox { display: none; }
}

@media (max-width: 620px) {
  .navActions select,
  .login { display: none; }
  .hero h1 { font-size: 42px; }
  .categoryGrid, .statsRow, .benefitGrid, .productGrid, .steps, .affiliateActions, .footerGrid { grid-template-columns: 1fr; }
  .shopHead, .reviewsHero, .footerBottom { align-items: stretch; flex-direction: column; }
  .reviewCard { grid-template-columns: 42px 1fr; }
  .reviewCard .stars { grid-column: 2; }
  .affiliateCard, .legalCard { padding: 26px; }
}

/* Checkout / Discord Login additions */
.cartBubble {
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  background: #fff;
  color: var(--purple);
  font-size: 12px;
  margin-left: 4px;
}
.checkoutPage .checkoutCard {
  display: grid;
  grid-template-columns: 1.1fr .9fr;
  gap: 28px;
  max-width: 1100px;
}
.checkoutHint {
  color: var(--muted);
  line-height: 1.7;
  margin: 0 0 18px;
}
.discordNotice {
  margin: 18px 0;
  padding: 16px;
  border-radius: 16px;
  background: rgba(155, 51, 241, .12);
  border: 1px solid rgba(155, 51, 241, .32);
  display: flex;
  gap: 10px;
  align-items: center;
}
.orderForm {
  display: grid;
  gap: 16px;
}
.orderForm label {
  display: grid;
  gap: 8px;
  color: var(--text);
}
.orderForm input,
.orderForm select,
.orderForm textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px;
  background: rgba(255,255,255,.06);
  color: var(--text);
  outline: none;
}
.orderForm textarea { min-height: 110px; resize: vertical; }
.orderForm input:focus,
.orderForm select:focus,
.orderForm textarea:focus {
  border-color: rgba(155, 51, 241, .65);
  box-shadow: 0 0 0 4px rgba(155, 51, 241, .13);
}
.cartSummary {
  padding: 20px;
  border-radius: 22px;
  background: rgba(255,255,255,.04);
  border: 1px solid var(--line);
  height: max-content;
}
.cartRow small {
  display: block;
  color: var(--muted);
  margin-top: 4px;
}
.miniQty {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  justify-content: flex-end;
}
.miniQty button {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(255,255,255,.06);
  color: var(--text);
  display: inline-grid;
  place-items: center;
}
.orderResult {
  margin-top: 20px;
  padding: 18px;
  border-radius: 18px;
  background: rgba(0,201,135,.08);
  border: 1px solid rgba(0,201,135,.25);
}
.orderResult pre {
  margin: 14px 0;
  padding: 14px;
  border-radius: 14px;
  background: rgba(0,0,0,.32);
  color: #ddd;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.55;
}
button:disabled {
  opacity: .45;
  cursor: not-allowed;
  filter: grayscale(1);
}
@media (max-width: 900px) {
  .checkoutPage .checkoutCard { grid-template-columns: 1fr; }
}









/* === FINAL: no banner background, no language selector, clean transparent account === */

/* Kein Banner mehr als Hintergrund */
body::before,
.hero::before,
.heroSection::before,
.hero-section::before {
  background-image: none !important;
}

body {
  background:
    radial-gradient(circle at 20% 10%, rgba(168,85,247,.22), transparent 30%),
    radial-gradient(circle at 80% 18%, rgba(217,70,239,.12), transparent 28%),
    linear-gradient(180deg, #05020a 0%, #080411 48%, #030107 100%) !important;
}

/* Navigation sauber/glass statt lila Block */
header,
nav,
.navbar,
.topbar,
.mainNav,
.nav {
  background: rgba(5, 2, 10, .58) !important;
  backdrop-filter: blur(18px) !important;
  -webkit-backdrop-filter: blur(18px) !important;
  border-bottom: 1px solid rgba(168,85,247,.18) !important;
  box-shadow: 0 10px 38px rgba(0,0,0,.30) !important;
}

/* Sprach-Umschalter ausblenden */
select,
.lang,
.language,
.langSwitch,
.languageSwitch,
[class*="language"],
[class*="Language"],
[class*="lang"],
[class*="Lang"] {
  display: none !important;
}

/* Account transparent */
.accountArea {
  display: inline-flex !important;
  align-items: center !important;
  gap: 10px !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.accountChip {
  display: inline-flex !important;
  align-items: center !important;
  gap: 9px !important;
  padding: 0 !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  color: #fff !important;
}

.accountAvatar {
  width: 40px !important;
  height: 40px !important;
  border-radius: 999px !important;
  object-fit: cover !important;
  border: 2px solid rgba(168,85,247,.95) !important;
  box-shadow: 0 0 0 2px rgba(0,0,0,.45), 0 0 16px rgba(168,85,247,.5) !important;
}

.accountChip span {
  display: grid !important;
  line-height: 1.08 !important;
}

.accountChip strong {
  font-size: 13px !important;
  font-weight: 900 !important;
  color: #fff !important;
}

.accountChip small {
  font-size: 11px !important;
  color: rgba(255,255,255,.62) !important;
  font-weight: 700 !important;
}

.logoutBtn {
  height: 36px !important;
  border-radius: 9px !important;
  background: rgba(77, 7, 10, .88) !important;
  color: #ff4b55 !important;
  border: 1px solid rgba(255,75,85,.18) !important;
  box-shadow: none !important;
  padding: 0 14px !important;
  font-size: 12px !important;
  font-weight: 900 !important;
}

.cartMini {
  height: 40px !important;
  border-radius: 10px !important;
  background: rgba(255,255,255,.08) !important;
  border: 1px solid rgba(255,255,255,.12) !important;
  box-shadow: none !important;
}

.cartBubble {
  display: none !important;
}

/* Hero wieder cleaner ohne Bildchaos */
.hero,
.heroSection,
.hero-section {
  background:
    radial-gradient(circle at 50% 25%, rgba(168,85,247,.22), transparent 34%),
    linear-gradient(180deg, rgba(255,255,255,.02), rgba(168,85,247,.035), rgba(0,0,0,.20)) !important;
}

/* Kategorien lesbarer und runder, aber nicht grell */
.category-card,
.category,
.cat-card,
.catCard,
.categories .card,
.category-grid .card,
.categoryGrid .card {
  border-radius: 26px !important;
  background: linear-gradient(145deg, rgba(168,85,247,.20), rgba(21,8,38,.78)) !important;
  border: 1px solid rgba(216,180,254,.24) !important;
  box-shadow: 0 18px 54px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.10) !important;
}

.category-card svg,
.category svg,
.cat-card svg,
.catCard svg,
.categories .card svg,
.category-grid .card svg,
.categoryGrid .card svg {
  opacity: 1 !important;
  color: #e9d5ff !important;
  filter: drop-shadow(0 0 12px rgba(168,85,247,.55)) !important;
}

/* Störende rechte Verkaufskarte weg */
.sell-card,
.supplier-card,
.floating-sell-card,
[class*="sellCard"],
[class*="supplier"] {
  display: none !important;
}

@media (max-width: 760px) {
  .accountChip span { display: none !important; }
  .logoutBtn { display: none !important; }
}


/* === NAV POLISH FINAL === */

/* Header-Leiste schöner, dünner, transparenter */
header,
nav,
.navbar,
.topbar,
.mainNav,
.nav {
  height: 64px !important;
  background: rgba(5, 2, 10, .70) !important;
  backdrop-filter: blur(20px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(20px) saturate(1.15) !important;
  border-bottom: 1px solid rgba(168, 85, 247, .18) !important;
  box-shadow: 0 10px 38px rgba(0,0,0,.28) !important;
}

/* Innerer Header sauber ausrichten */
.headerInner,
.navInner,
.nav-inner,
header > div,
nav > div {
  min-height: 64px !important;
  align-items: center !important;
}

/* Logo kompakter */
.brand,
.logo {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  padding: 0 !important;
}

.brandIcon,
.logoIcon {
  width: 32px !important;
  height: 32px !important;
  border-radius: 10px !important;
  box-shadow: 0 0 18px rgba(168,85,247,.35) !important;
}

.brand span,
.logo span,
.brandName {
  font-size: 15px !important;
  font-weight: 900 !important;
}

/* Nav-Menü: keine großen lila Kacheln mehr */
.navLinks,
.nav-links,
.menu,
.navMenu {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 4px !important;
  border-radius: 14px !important;
  background: rgba(255,255,255,.025) !important;
  border: 1px solid rgba(255,255,255,.055) !important;
}

.navLinks a,
.nav-links a,
.menu a,
.navMenu a,
.nav a,
header nav a {
  min-height: 34px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 12px !important;
  border-radius: 10px !important;
  background: transparent !important;
  border: 1px solid transparent !important;
  color: rgba(255,255,255,.62) !important;
  font-size: 13px !important;
  font-weight: 800 !important;
  line-height: 1 !important;
  box-shadow: none !important;
  transition: .16s ease !important;
}

.navLinks a:hover,
.nav-links a:hover,
.menu a:hover,
.navMenu a:hover,
.nav a:hover,
header nav a:hover {
  color: #fff !important;
  background: rgba(168,85,247,.11) !important;
  border-color: rgba(168,85,247,.22) !important;
  transform: translateY(-1px) !important;
}

/* Aktive Seite: elegant statt hässlicher weißer Rahmen */
.navLinks a.active,
.nav-links a.active,
.menu a.active,
.navMenu a.active,
.nav a.active,
header nav a.active,
a[aria-current="page"] {
  color: #fff !important;
  background: rgba(168,85,247,.18) !important;
  border-color: rgba(168,85,247,.32) !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 0 18px rgba(168,85,247,.12) !important;
}

/* Discord Login kleiner und cleaner */
.login,
[data-discord-login],
.discordLogin,
.discord-login {
  height: 38px !important;
  min-height: 38px !important;
  padding: 0 15px !important;
  border-radius: 11px !important;
  background: linear-gradient(135deg, rgba(123,92,255,.94), rgba(168,85,247,.92)) !important;
  border: 1px solid rgba(255,255,255,.13) !important;
  color: #fff !important;
  font-size: 13px !important;
  font-weight: 900 !important;
  gap: 7px !important;
  box-shadow: 0 10px 26px rgba(123,92,255,.22), inset 0 1px 0 rgba(255,255,255,.15) !important;
}

.login svg,
[data-discord-login] svg {
  width: 15px !important;
  height: 15px !important;
}

/* Warenkorb kleiner und edler */
.cartMini {
  height: 38px !important;
  min-height: 38px !important;
  min-width: 88px !important;
  padding: 0 13px !important;
  border-radius: 11px !important;
  background: rgba(255,255,255,.07) !important;
  border: 1px solid rgba(255,255,255,.11) !important;
  color: #fff !important;
  font-size: 13px !important;
  font-weight: 900 !important;
  gap: 7px !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 10px 26px rgba(0,0,0,.16) !important;
}

.cartMini svg {
  width: 15px !important;
  height: 15px !important;
}

.cartMini:hover,
.login:hover,
[data-discord-login]:hover {
  transform: translateY(-2px) !important;
  filter: brightness(1.08) !important;
}

/* Eingeloggt: Account bleibt transparent, aber kompakter */
.accountArea {
  height: 38px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.accountChip {
  height: 38px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  padding: 0 !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.accountAvatar {
  width: 34px !important;
  height: 34px !important;
  border-radius: 999px !important;
  border: 2px solid rgba(168,85,247,.92) !important;
  box-shadow: 0 0 0 2px rgba(0,0,0,.40), 0 0 14px rgba(168,85,247,.42) !important;
}

.accountChip strong {
  font-size: 12px !important;
  line-height: 1 !important;
}

.accountChip small {
  font-size: 10px !important;
  color: rgba(255,255,255,.55) !important;
  line-height: 1 !important;
}

.logoutBtn {
  height: 34px !important;
  padding: 0 12px !important;
  border-radius: 9px !important;
  font-size: 11px !important;
}

/* Header Actions sauberer Abstand */
.navActions,
.headerActions,
.actionsRight {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

/* Sprache sicher weg */
select,
.lang,
.language,
.langSwitch,
.languageSwitch,
[class*="language"],
[class*="Language"],
[class*="lang"],
[class*="Lang"] {
  display: none !important;
}

@media (max-width: 850px) {
  .navLinks,
  .nav-links,
  .menu,
  .navMenu {
    gap: 2px !important;
  }

  .navLinks a,
  .nav-links a,
  .menu a,
  .navMenu a {
    padding: 0 9px !important;
    font-size: 12px !important;
  }

  .accountChip span {
    display: none !important;
  }
}

@media (max-width: 640px) {
  header,
  nav,
  .navbar,
  .topbar,
  .mainNav,
  .nav {
    height: 58px !important;
  }

  .navLinks,
  .nav-links,
  .menu,
  .navMenu {
    display: none !important;
  }

  .login,
  [data-discord-login] {
    height: 34px !important;
    padding: 0 11px !important;
    font-size: 12px !important;
  }

  .cartMini {
    height: 34px !important;
    min-width: 76px !important;
    padding: 0 10px !important;
  }
}


/* === NAV BUBBLE LOGO FINAL === */

/* Header-Grundfläche: clean und transparent */
header,
nav,
.navbar,
.topbar,
.mainNav,
.nav {
  height: 66px !important;
  background: rgba(5, 2, 10, .62) !important;
  backdrop-filter: blur(20px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(20px) saturate(1.15) !important;
  border-bottom: 1px solid rgba(168,85,247,.18) !important;
  box-shadow: 0 10px 36px rgba(0,0,0,.28) !important;
}

/* Header-Inhalt sauber in einer Reihe */
.headerInner,
.navInner,
.nav-inner,
.headerContent,
.navContent,
header > div,
nav > div {
  min-height: 66px !important;
  display: flex !important;
  align-items: center !important;
  gap: 14px !important;
}

/* DIE Bubble: Logo + HugoSMP Market + Links direkt zusammen */
.brand,
.logo {
  height: 46px !important;
  min-width: max-content !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 0 14px !important;
  border-radius: 18px 0 0 18px !important;
  background: rgba(255,255,255,.045) !important;
  border: 1px solid rgba(255,255,255,.08) !important;
  border-right: 0 !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06) !important;
}

/* Kleines echtes Logo vor HugoSMP Market */
.brandSmallLogo {
  width: 32px !important;
  height: 32px !important;
  object-fit: contain !important;
  flex: 0 0 auto !important;
  filter: drop-shadow(0 0 12px rgba(168,85,247,.65)) !important;
}

/* Altes H-Icon verstecken, falls noch vorhanden */
.brandIcon,
.logoIcon {
  display: none !important;
}

.brand span,
.logo span,
.brandName,
.logoName {
  font-size: 15px !important;
  font-weight: 950 !important;
  color: #fff !important;
  white-space: nowrap !important;
}

/* Nav-Links werden zur rechten Hälfte derselben Bubble */
.navLinks,
.nav-links,
.menu,
.navMenu {
  height: 46px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
  padding: 5px 8px !important;
  margin-left: -14px !important;
  border-radius: 0 18px 18px 0 !important;
  background: rgba(255,255,255,.045) !important;
  border: 1px solid rgba(255,255,255,.08) !important;
  border-left: 0 !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06) !important;
}

/* Links edel, kompakt, nicht klobig */
.navLinks a,
.nav-links a,
.menu a,
.navMenu a {
  height: 34px !important;
  min-height: 34px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 13px !important;
  border-radius: 11px !important;
  background: transparent !important;
  border: 1px solid transparent !important;
  color: rgba(255,255,255,.68) !important;
  font-size: 13px !important;
  font-weight: 850 !important;
  line-height: 1 !important;
  box-shadow: none !important;
  transition: .16s ease !important;
}

/* Aktive Seite als dezenter heller Pill */
.navLinks a.active,
.nav-links a.active,
.menu a.active,
.navMenu a.active,
.navLinks a[aria-current="page"],
.nav-links a[aria-current="page"] {
  color: #fff !important;
  background: rgba(255,255,255,.10) !important;
  border-color: rgba(255,255,255,.18) !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 0 18px rgba(168,85,247,.10) !important;
}

.navLinks a:hover,
.nav-links a:hover,
.menu a:hover,
.navMenu a:hover {
  color: #fff !important;
  background: rgba(168,85,247,.14) !important;
  border-color: rgba(168,85,247,.24) !important;
  transform: translateY(-1px) !important;
}

/* Rechte Aktionen kleiner und schöner */
.navActions,
.headerActions,
.actionsRight {
  margin-left: auto !important;
  display: flex !important;
  align-items: center !important;
  gap: 9px !important;
}

/* Discord Login klein und elegant */
.login,
[data-discord-login],
.discordLogin,
.discord-login {
  height: 38px !important;
  min-height: 38px !important;
  padding: 0 15px !important;
  border-radius: 12px !important;
  background: linear-gradient(135deg, rgba(124,92,255,.95), rgba(168,85,247,.92)) !important;
  border: 1px solid rgba(255,255,255,.14) !important;
  color: #fff !important;
  font-size: 13px !important;
  font-weight: 900 !important;
  gap: 7px !important;
  box-shadow: 0 10px 26px rgba(124,92,255,.23), inset 0 1px 0 rgba(255,255,255,.16) !important;
}

.login svg,
[data-discord-login] svg {
  width: 15px !important;
  height: 15px !important;
}

/* Warenkorb klein und sauber */
.cartMini {
  height: 38px !important;
  min-height: 38px !important;
  min-width: 88px !important;
  padding: 0 13px !important;
  border-radius: 12px !important;
  background: rgba(255,255,255,.075) !important;
  border: 1px solid rgba(255,255,255,.12) !important;
  color: #fff !important;
  font-size: 13px !important;
  font-weight: 900 !important;
  gap: 7px !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 10px 26px rgba(0,0,0,.16) !important;
}

.cartMini svg {
  width: 15px !important;
  height: 15px !important;
}

.cartBubble {
  display: none !important;
}

/* Eingeloggt bleibt der Account transparent */
.accountArea {
  height: 38px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.accountChip {
  height: 38px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  padding: 0 !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  color: #fff !important;
}

.accountAvatar {
  width: 34px !important;
  height: 34px !important;
  border-radius: 999px !important;
  border: 2px solid rgba(168,85,247,.92) !important;
  box-shadow: 0 0 0 2px rgba(0,0,0,.40), 0 0 14px rgba(168,85,247,.42) !important;
}

.accountChip strong {
  font-size: 12px !important;
  line-height: 1 !important;
}

.accountChip small {
  font-size: 10px !important;
  color: rgba(255,255,255,.55) !important;
  line-height: 1 !important;
}

.logoutBtn {
  height: 34px !important;
  padding: 0 12px !important;
  border-radius: 9px !important;
  font-size: 11px !important;
}

/* Sprache sicher weg */
select,
.lang,
.language,
.langSwitch,
.languageSwitch,
[class*="language"],
[class*="Language"],
[class*="lang"],
[class*="Lang"] {
  display: none !important;
}

@media (max-width: 980px) {
  .brand,
  .logo {
    border-radius: 16px !important;
    border-right: 1px solid rgba(255,255,255,.08) !important;
  }

  .navLinks,
  .nav-links,
  .menu,
  .navMenu {
    margin-left: 0 !important;
    border-radius: 16px !important;
    border-left: 1px solid rgba(255,255,255,.08) !important;
  }
}

@media (max-width: 760px) {
  header,
  nav,
  .navbar,
  .topbar,
  .mainNav,
  .nav {
    height: 60px !important;
  }

  .brand,
  .logo {
    height: 42px !important;
    padding: 0 10px !important;
  }

  .brandSmallLogo {
    width: 28px !important;
    height: 28px !important;
  }

  .brand span,
  .logo span,
  .brandName,
  .logoName {
    font-size: 13px !important;
  }

  .navLinks,
  .nav-links,
  .menu,
  .navMenu {
    display: none !important;
  }

  .accountChip span {
    display: none !important;
  }

  .logoutBtn {
    display: none !important;
  }

  .login,
  [data-discord-login],
  .cartMini {
    height: 34px !important;
    min-height: 34px !important;
    font-size: 12px !important;
    padding: 0 10px !important;
  }
}
