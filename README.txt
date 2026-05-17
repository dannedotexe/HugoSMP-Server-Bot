HugoSMP Market Website mit Vercel Discord Login.

WICHTIG IM DISCORD DEVELOPER PORTAL:
OAuth2 > Redirects:
https://hugosmp-market-website.vercel.app/auth.html

Benutze diesen OAuth-Link:
https://discord.com/oauth2/authorize?client_id=1500457237116883005&redirect_uri=https%3A%2F%2Fhugosmp-market-website.vercel.app%2Fauth.html&response_type=token&scope=identify%20guilds

Alle Dateien ins Vercel/GitHub Repo hochladen/ersetzen:
- index.html
- shop.html
- checkout.html
- reviews.html
- support.html
- auth.html
- styles.css
- app.js

Danach neu deployen. Der Discord Login führt dann zu:
https://hugosmp-market-website.vercel.app/auth.html


Update:
- Header nach Login sieht jetzt aus wie gewünscht:
  Avatar + Name + "Meine Bestellungen" + roter Logout-Button + Warenkorb.


Update:
- Website basiert jetzt auf deinen hochgeladenen HugoSMP-Shop-Bildern.
- Banner ist als Hintergrund eingebaut.
- Transparentes Logo wird im Header/Hero benutzt.
- Lila/Rot/Minecraft-Shop Look passend zu deinen Bildern.
- Auth-Ladebildschirm bleibt unsichtbar/schnell.


Fix:
- Chaos/Überlappungen entfernt.
- Großes Logo im Hero entfernt.
- Banner nur noch dezent als Hintergrund.
- Layout bleibt wie vorher clean.


FINAL:
- Header ist transparent/glass.
- Eingeloggt ist Account-Bereich transparent.
- Kategorien sind größer abgerundet und lesbar.
- Störende Sell-Popup-Karte wird ausgeblendet.
- Auth-Ladebildschirm wird nicht mehr angezeigt.


Clean V2:
- Keine breiten globalen CSS-Overrides mehr.
- Header transparent, Account transparent.
- Kategorien runder/lesbarer.
- Hero-Banner nur dezent im Hintergrund.


Final:
- Banner als Hintergrund entfernt.
- Sprachumschalter entfernt/ausgeblendet.
- Account-Bereich transparent.
- Header clean/glass.


Nav Polish:
- Leiste transparenter und kompakter.
- Nav-Links als schöne Glass-Pills.
- Discord Login kleiner.
- Warenkorb kleiner.
- Account eingeloggt bleibt transparent.
- Sprachumschalter entfernt.


Nav Bubble Logo Final:
- Logo + HugoSMP Market + Menü optisch in einer Bubble.
- Neues Logo vor HugoSMP Market eingebaut.
- Discord Login und Warenkorb kleiner.
