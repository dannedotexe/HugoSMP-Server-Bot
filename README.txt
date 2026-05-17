export const siteData = {
  brand: {
    name: "HugoSMP Market",
    shortName: "HugoSMP",
    logo: "H",
    status: "Online & Bereit",
    heroTitle: "Der Minecraft Shop",
    heroLine: "auf HugoSMP",
    subtitle: "Kaufe Ränge, Items und Boosters direkt über die Website. Schnell, sicher und mit Discord-Login verbunden.",
    discordUrl: "#",
    botAuthUrl: "https://discord.com/oauth2/authorize?client_id=1500457237116883005&redirect_uri=https%3A%2F%2Fhugosmp-market-website.vercel.app%2Fauth.html&response_type=token&scope=identify%20guilds",
    apiUrl: "",
    email: "hugosmpmarket@gmail.com",
    currency: "EUR"
  },
  stats: [
    ["596+", "Bestellungen"],
    ["4.9/5", "Bewertungen"],
    ["500+", "Kunden"],
    ["< 24h", "Lieferzeit"]
  ],
  categories: [
    { id: "all", label: "Alle Produkte" },
    { id: "money", label: "Geld" },
    { id: "items", label: "Items" },
    { id: "kits", label: "Kits" },
    { id: "bundles", label: "Boosters" },
    { id: "spawner", label: "Spawner" }
  ],
  products: [
    { id: "money_100k", category: "money", name: "100.000 Money", price: 1.5, stock: 465, image: "/products/hugo-smp-money.jpg", description: "Schnelles Money-Paket für deinen Start." },
    { id: "money_1m", category: "money", name: "1M Money", price: 5, stock: 46, image: "/products/1m-batzen.jpg", description: "Großes Money-Paket für Builds, Trades und Upgrades." },
    { id: "money_500k", category: "money", name: "500.000 Money", price: 3.5, stock: 93, image: "/products/5m-batzen.jpg", description: "Beliebtes Money-Paket für größere Einkäufe." },
    { id: "booster", category: "bundles", name: "Booster Deal", price: 15, stock: 50, image: "/products/bundles.jpg", description: "Deals und Booster als individuelles Paket." },
    { id: "gilded_blackstone", category: "items", name: "Gilded Blackstone", price: 0.5, stock: 935, image: "/products/gilded-blackstone.jpg", description: "Dekorativer Block für hochwertige Builds." },
    { id: "netherite_set", category: "kits", name: "Netherite Set", price: 12, stock: 12, image: "/products/netherite-set.jpg", description: "Netherite-Rüstung als starkes Set." },
    { id: "mace", category: "items", name: "Mace", price: 5.5, stock: 1, image: "/products/mace.jpg", description: "Seltene Waffe für starke Kämpfer." },
    { id: "spawner_skeleton", category: "spawner", name: "Skeleton Spawner", price: 6, stock: 8, image: "/products/crystal.jpg", description: "Spawner für Farmen und Projekte." },
    { id: "crystal", category: "items", name: "Crystal", price: 3, stock: 64, image: "/products/crystal.jpg", description: "Crystal-Item für besondere Einsätze." }
  ],
  benefits: [
    ["Automatisiertes Bestellsystem", "Bestellungen können über Checkout oder Discord-Ticket bearbeitet werden."],
    ["100% Sicher", "Beschreibe hier deine echten Zahlungswege, Regeln und Absicherung."],
    ["24/7 Support", "Verlinke hier deinen Discord oder dein Support-System."]
  ],
  faq: [
    ["Wie erhalte ich meine Items?", "Nach dem Kauf bekommst du weitere Informationen per Discord oder direkt im Shop."],
    ["Welche Zahlungsmethoden?", "Trage hier PayPal, Stripe, Paysafecard oder deine echten Methoden ein."],
    ["Wie lange dauert die Lieferung?", "Passe diese Antwort an deine echte Lieferzeit an."],
    ["Muss ich online sein?", "Erkläre hier, ob Spieler online sein müssen oder nicht."],
    ["Wie läuft die Bestellung ab?", "Du legst Produkte in den Warenkorb und erstellst im Checkout eine fertige Bestellnachricht für Discord."],
    ["Wie kann ich euch kontaktieren?", "Verlinke deinen Discord, deine E-Mail oder dein Ticketsystem."]
  ],
  reviews: {
    score: "4.6",
    total: "16 Bewertungen insgesamt",
    verified: [
      ["shadowkiller", "21. Apr. 2026", 5, "tysm for the money, got it instantly"],
      ["jonaspvp", "20. Apr. 2026", 5, "10/10 automated ticket system is sick"],
      ["tim1337", "19. Apr. 2026", 5, "everything went perfect, huge vouch"],
      ["janik.w", "17. Apr. 2026", 5, "vouch very fast and trusted"],
      ["x_killer_x", "25. März 2026", 5, "bester shop aufm server, sehr trusted"]
    ],
    other: [
      ["grind_jonas", "25. Apr. 2026", 5, "War ein schneller Trade und ist vertrauenswürdig."],
      ["nilsooo", "18. Apr. 2026", 3, "prices are alright but need more items tbh"],
      ["maxi.", "17. Apr. 2026", 3, "how long does the ticket take? waiting for 5 mins alrdy"],
      ["alx_99", "31. März 2026", 4, "is this actually real? prices seem to good"]
    ]
  },
  affiliate: {
    title: "Kostenloses Geld verdienen",
    subtitle: "Wirb für deinen Market und lass dich für deine Aufrufe bezahlen.",
    steps: [
      ["Content Erstellen", "Erstelle Inhalte über deine Website."],
      ["Domain Zeigen", "Sorge dafür, dass deine Domain sichtbar ist."],
      ["Bezahlt Werden", "Trage hier deine echte Belohnung ein."]
    ]
  },
  legal: {
    imprint: "Hier dein Impressum einfügen: Betreiber, Adresse, Kontakt und rechtliche Angaben.",
    privacy: "Hier deine Datenschutzerklärung einfügen.",
    terms: [
      ["General", "Diese Terms sind Platzhalter und müssen an dein Projekt angepasst werden."],
      ["Virtual Goods & Ownership", "Alle Produkte sind virtuelle Güter innerhalb deines Servers."],
      ["Refunds & Returns", "Lege hier deine Regeln für Rückerstattungen fest."],
      ["Delivery", "Beschreibe hier den genauen Lieferablauf."],
      ["Account Responsibility", "Kunden müssen korrekte Accountdaten angeben."],
      ["Contact", "Kontakt: hugosmpmarket@gmail.com"]
    ]
  }
};
