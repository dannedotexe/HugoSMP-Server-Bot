# HugoSMP Market Website

React/Vite Website basierend auf deinem hochgeladenen Projekt.

## Enthalten
- HugoSMP Design mit deinen Produktbildern
- Shop mit Kategorien
- Warenkorb
- Checkout direkt auf der Website
- Discord OAuth Login über `/auth.html`
- Bestelltext wird automatisch erstellt und kopiert

## Wichtig für Discord OAuth
Im Discord Developer Portal muss diese Redirect URL eingetragen sein:

```txt
https://hugosmp-market-website.vercel.app/auth.html
```

Benutzter OAuth-Link:

```txt
https://discord.com/oauth2/authorize?client_id=1500457237116883005&redirect_uri=https%3A%2F%2Fhugosmp-market-website.vercel.app%2Fauth.html&response_type=token&scope=identify%20guilds
```

## Deployment auf Vercel
1. Alle Dateien hochladen/ersetzen.
2. `npm install`
3. `npm run build`
4. Vercel deployt den Ordner `dist`.

Hinweis: Für echtes automatisches Senden an Discord brauchst du später einen sicheren Backend-Endpunkt/Webhook oder deine Bot-API. Diese Version erstellt und kopiert die Bestellung im Browser.
