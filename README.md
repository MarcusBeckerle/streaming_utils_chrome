# Streaming Utils für Chrome / Windows

## Lizenz

Ab Version **1.2.2** gilt die eigene [Streaming Utils Noncommercial Attribution License 1.0](LICENSE). Kostenlose private und sonstige nichtkommerzielle Nutzung, Änderungen und Weitergabe sind mit Namensnennung und Projektlink erlaubt. Der Hinweis **Streaming Utils by mbeckerle** und der [Projektlink](https://github.com/MarcusBeckerle/streaming_utils_chrome) bleiben in den Einstellungen bzw. einer vergleichbaren Infoansicht sichtbar. Private Nutzer müssen dafür nichts öffentlich posten.

**Kommerzielle Nutzung benötigt vorab eine gesonderte schriftliche Lizenz und die vereinbarte Zahlung.** Dazu gehören auch die geschäftliche interne Nutzung, bezahlte Dienstleistungen und der Einbau in kommerzielle Angebote. Preis und Umfang werden mit dem Rechteinhaber über das Projekt vereinbart; dieses Repository legt keinen Pauschalpreis fest.

Die Software ist damit **source-available**, nicht Open Source im Sinne der OSI. Maßgeblich ist der englische Text in `LICENSE`. Bereits für frühere Kopien erteilte MIT-Rechte bleiben bestehen; Drittprogramme behalten ihre eigenen Lizenzen. Das bisherige Copyright-Kürzel **mbeckerle** wird beibehalten.

Dieses Update ändert Lizenz, Namensnennung und Paketbeigaben; ein erneutes Helfer-Setup ist für bestehende Funktionen nicht nötig.

**Neu in 1.2.1:** „Einstellungen speichern“ ist nur aktiv, wenn sich Werte tatsächlich vom gespeicherten Stand unterscheiden. Das gilt für beide Tabs, Checkboxen, Qualitätsauswahl und Ordnerauswahl. Beim Zurücksetzen auf den gespeicherten Wert und nach erfolgreichem Speichern wird der Button wieder deaktiviert; externe Änderungen aus dem Popup werden berücksichtigt. Kein erneutes Helfer-Setup nötig.

**Neu in 1.2.0:** Im Popup zuerst **MP3 oder Video** wählen. Danach erscheinen die gespeicherten Qualitätswerte und der passende Zielordner. MP3: 64–320 kbit/s, Standard 128. Video: höchste verfügbare Auflösung (Standard) oder eine Obergrenze von 144p bis 4320p/8K. Eine nicht vorhandene Stufe fällt auf die beste verfügbare niedrigere Auflösung zurück; es wird nicht hochskaliert. Die Begrenzung bezieht sich auf die Bildhöhe. Bild und Ton bleiben als MKV ohne erneute Videokomprimierung erhalten. Erst der separate Download-Button startet den Vorgang. Änderungen im Popup gelten nur für diesen Download; die dauerhaften Standards stehen im YouTube-Einstellungstab.

**Update für 1.2.0:** Erweiterungsdateien ersetzen, Erweiterung neu laden und das neue `StreamingUtils-Setup.cmd` bzw. `Installieren.cmd` einmal starten. Der Windows-Helfer benötigt dieses Update, damit er die gewählte Videoauflösung berücksichtigt. Ein älterer Helfer wird bei begrenzter Videoqualität ausdrücklich abgefangen; MP3 und höchste Auflösung bleiben damit nutzbar. Vorhandene Programme werden weiterverwendet.

Prüfung für 1.2.0: 32 JavaScript-/Protokolltests und die PowerShell-Validierung bestanden. Die echte yt-dlp.exe wählte bei lokalen Test-Metadaten für 720p die 720p-Spur, für 480p die verfügbare 360p-Spur und bei Maximum die 2160p-Spur. Die Popup-Umschaltung und Qualitätsauswahl wurden in Chrome mit simulierten Helferdaten geprüft.

**Korrektur in 1.1.3:** YouTube-Skip-Buttons werden zusätzlich anhand eindeutiger deutscher/englischer Beschriftungen erkannt, wenn ihre CSS-Klassen abweichen. Ausgeblendete, gesperrte Buttons und Countdowns werden nicht angeklickt. Vor dem Skip-Klick wird das normale Tempo wiederhergestellt; die Beschleunigung bleibt beim Übergang mindestens 1,2 Sekunden aus. Der gemeinsame Tempo-Controller wartet beim Laden/Spotwechsel kurz und reduziert bei mindestens zwei Sekunden ohne Wiedergabefortschritt auf 1× für den restlichen Spot. Er startet keine pausierten Videos und verändert die Abspielposition nicht. YouTube-Tempoänderungen lösen keine sofortige erneute Beschleunigung mehr aus. Die Übergänge sind mit Regressionstests geprüft; der konkret gemeldete Live-Hänger konnte nicht reproduziert werden. Erweiterung und YouTube-Tabs neu laden, kein Helfer-Update erforderlich.

**Neu in 1.1.2:** Die Einstellungen erklären den Zweck des Windows-Helfers, von yt-dlp, FFmpeg, FFprobe und Deno sowie die Voraussetzungen. Diese Hinweise sind auch sichtbar, bevor der Helfer installiert ist. Nur die Erweiterungsdateien ersetzen und die Erweiterung neu laden; der Helfer hat sich nicht geändert.

**Korrektur in 1.1.1:** Der Setup-Download bleibt auch bei einem erreichbaren Helfer sichtbar. Fehlen die Funktionen für Dateidetails und Explorer, heißt der Button **Helfer-Update herunterladen** und zeigt die Startanleitung. Das eigenständige `StreamingUtils-Setup.cmd` wird außerdem neben dem ZIP bereitgestellt und kann ohne Entpacken ausgeführt werden.

Eine lokale Chrome-Erweiterung für YouTube und Amazon Prime Video mit Werbebeschleunigung, automatischem Überspringen und YouTube-Downloads.

**Neu in 1.1.0:** Neuer Name **Streaming Utils**, separate Einstellungs-Tabs **YouTube** und **Amazon**, oben im Popup zwei **Skip-Ads-Schnellschalter**. Jeder schaltet die gesamte Werbehilfe seines Dienstes an/aus, ohne die individuellen Tempo-/Auto-Skip-Einstellungen zu verlieren. YouTube lässt sich direkt mit **MP3 speichern** oder **Video speichern** herunterladen. Das Standardformat wird hervorgehoben; getrennte Zielordner und die Standardbitrate bleiben erhalten.

**Amazon Prime Video:** standardmäßig bis zu **16×** bei erkanntem Werbe-Timer bzw. eindeutigem Werbe-Skip-Button. Sichtbare, freigegebene Werbe-/Werbetrailer-Buttons werden automatisch geklickt (deutsche und englische Beschriftungen). Normale Intros, Rückblicke und Folgenwechsel bleiben unberührt. Beschleunigung und automatische Klicks sind einzeln konfigurierbar. Unterstützte Seiten: `primevideo.com`, `amazon.de`, `amazon.com`, `amazon.co.uk`. **Experimentell:** Simulationen sind geprüft; ob der aktuelle Prime-Player 16× akzeptiert und seine Werbezeit entsprechend verkürzt, ist noch nicht live verifiziert. Bei geänderten Player-Markierungen bleibt die Werbung unbeeinflusst; weder Zeitsprünge noch Netzwerkblockierung werden eingesetzt.

**Update von 1.0.2 auf 1.1.0:** Den Inhalt des Ordners `extension` am bisherigen Speicherort ersetzen, unter `chrome://extensions` **Neu laden** wählen und YouTube-/Prime-Video-Tabs neu laden. Chrome kann die hinzugekommenen Amazon-Seitenberechtigungen bestätigen lassen. Nicht als zweite Erweiterung neu einrichten. ID, Einstellungen, Downloadordner und Helfer-Verbindung bleiben erhalten. **Installieren.cmd muss dafür nicht erneut laufen.**

**Warum war das bei 1.0.2 nötig?** Der Windows-Helfer wurde um Dateigröße, Laufzeit und **Im Explorer anzeigen** erweitert. Die installierte Kopie unter `%LOCALAPPDATA%\YouTubeUtils` wird durch bloßes Ersetzen der Erweiterungsdateien nicht aktualisiert. Wer noch einen älteren Helfer hat, startet `Installieren.cmd` einmal; die Einstellungen zeigen dafür einen Hinweis. Mit Helfer 1.0.2 ist keine Neuinstallation nötig. Er bleibt auch mit Erweiterung 1.1.0 bei seiner eigenen Versionsnummer 1.0.2.

**Dateidetails:** Nach einem fertigen Download erscheint unter dem Fortschrittsbalken **Im Explorer anzeigen**. Der Explorer markiert die Datei. Dateigröße und Spieldauer bleiben gespeichert. Wenn verfügbar, steht die Dauer schon vor dem Download im Popup.

Version 1.0.1 korrigiert den Setup-Download: Das mitgelieferte Skript wird als Dateiinhalt an Chrome übergeben. Die Anzeige meldet erst nach Chromes bestätigtem Downloadabschluss „gespeichert“ und zeigt bei einem Abbruch den Fehler an. Zum Aktualisieren den Ordner `extension` durch die neue Version ersetzen und unter `chrome://extensions` **Neu laden** anklicken. Anschließend die Einstellungsseite neu öffnen. Alternativ funktioniert die erstmalige Einrichtung weiterhin direkt über `Installieren.cmd` im entpackten Paket.

## In drei Schritten starten

1. **StreamingUtils-Windows.zip vollständig entpacken** und den Ordner dauerhaft ablegen. In Chrome `chrome://extensions` öffnen, **Entwicklermodus** einschalten und über **Entpackte Erweiterung laden** den Unterordner **extension** auswählen. Über Chromes Puzzle-Symbol **Streaming Utils anheften**.
2. Rechtsklick auf das Erweiterungssymbol → **Optionen / Einstellungen**. Auf **Windows-Setup herunterladen** klicken, speichern und **StreamingUtils-Setup.cmd** einmal per Doppelklick ausführen. Alternativ direkt **Installieren.cmd** im entpackten Paket starten. Kein Administrator und keine separate Python-Installation nötig. Das Setup braucht Internet und kann wegen FFmpeg mehrere Minuten dauern.
3. In den Einstellungen **Erneut prüfen**, MP3- und Videoordner wählen und **Einstellungen speichern**. Bereits geöffnete YouTube-Tabs nach der ersten Installation einmal neu laden.

Linksklick auf das Symbol öffnet das Popup für das aktuelle Video. Standard: **MP3, 128 kbit/s**. Zuerst das Format wählen, dann die vorausgewählte Qualität prüfen oder ändern und erst anschließend den Download starten. Änderungen im Popup überschreiben die gespeicherten Standards nicht. Während des Downloads darf das Popup geschlossen werden; Chrome muss geöffnet bleiben. Der Fortschritt bleibt im Popup und auf der Einstellungsseite sichtbar. Es läuft jeweils ein Download oder Installationsvorgang.

## Verhalten

- **Werbung:** sichtbar und tatsächlich schneller abgespielt. Keine Werbeblocker-Regeln, kein Verstecken, keine Zeitsprünge und keine Änderung der Lautstärke. Der separate Auto-Überspringen-Schalter klickt YouTubes freigegebenen Skip-Button. Chromiums `playbackRate` unterstützt maximal **16×**. Der gewünschte Standardwert 20× wird deshalb klar als **effektiv 16×** angezeigt. Normale Videos erhalten ihr vorheriges Tempo zurück. Die Erkennung verwendet YouTubes Player-Klasse `ad-showing`; Änderungen an YouTubes Oberfläche können Anpassungen erfordern. Werbe-Countdowns auf YouTube müssen nicht proportional zur Wiedergabegeschwindigkeit ablaufen.
- **Videos:** höchste von yt-dlp zugänglich ermittelte Auflösung innerhalb der gewählten Obergrenze, danach Bildrate; ohne 1080p-Limit. Bild und Ton werden in **MKV** zusammengeführt, ohne das Video neu zu komprimieren. MP4 wird nicht erzwungen, damit kein Codec oder Qualitätsniveau ausgeschlossen wird.
- **MP3:** beste verfügbare Tonspur als Quelle, Umwandlung in MP3 mit standardmäßig 128 kbit/s. Eine höhere Zielbitrate verbessert die ursprüngliche Tonqualität nicht.
- **Dateinamen:** YouTube-Titel mit bereinigten Windows-Sonderzeichen und begrenzter Länge. Wenn die Zieldatei existiert, werden Video-ID und bei Bedarf eine laufende Nummer ergänzt. Fertige Dateien werden nicht überschrieben.
- **Ordner:** getrennte Windows-Ordner, standardmäßig `Musik\YouTube` und `Videos\YouTube` im Benutzerprofil. Vollständige lokale Laufwerkspfade werden unterstützt; Netzwerkfreigaben nicht. Fehlende Zielordner werden erstellt.
- **YouTube:** einzelne Videos, Shorts und abgeschlossene Livestreams. Keine Playlist-Downloads und keine laufenden Streams. Private, altersbeschränkte oder durch YouTube gesperrte Downloads können fehlschlagen; Browser-Cookies werden nicht ausgelesen und Zugangsbeschränkungen nicht umgangen.

## Windows-Einrichtung

**Voraussetzungen für Downloads:** Chrome ab Version 120, Windows x64 (ARM64 nur mit x64-Unterstützung) und Windows PowerShell 5.1. PowerShell gehört normalerweise bereits zu Windows. Das Setup muss ausgeführt werden dürfen; die Einrichtung fehlender Programme benötigt Internetzugriff auf GitHub. Downloads benötigen Internet sowie einen beschreibbaren lokalen Zielordner mit genug Platz für Ergebnis und temporäre Bild-/Tonspuren.

**Python und Node.js müssen nicht installiert werden.** Verwendet wird die eigenständige yt-dlp.exe; Deno wird automatisch eingerichtet. Administratorrechte sind nicht nötig. Die Werbebeschleunigung und automatischen Skip-Klicks funktionieren ohne den Windows-Helfer oder diese Programme.

Die erste Verbindung kann Chrome nicht selbst einrichten. Das einmalig gestartete Setup installiert den Helfer nach `%LOCALAPPDATA%\YouTubeUtils` und registriert **nur für den aktuellen Benutzer** den Native-Messaging-Host `de.youtube_utils.helper`. Die Erweiterungs-ID ist durch den öffentlichen Schlüssel im Manifest festgelegt; sie muss nicht manuell kopiert werden.

Vorhandene, ausführbare Programme in diesem Ordner oder im Windows-PATH werden zuerst geprüft und verwendet. Fehlende Programme werden auf Knopfdruck eingerichtet:

| Programm | Quelle | Zweck |
| --- | --- | --- |
| Windows-Helfer | Im Erweiterungspaket enthalten | Verbindung zwischen Chrome und lokalen Programmen; Downloads starten, Ordner auswählen und fertige Dateien im Explorer anzeigen |
| yt-dlp | [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp/releases/latest) | Titel und Qualitätsstufen ermitteln, beste verfügbare Video-/Tonspuren herunterladen; eigenständige EXE ohne separate Python-Installation |
| FFmpeg | [yt-dlp/FFmpeg-Builds](https://github.com/yt-dlp/FFmpeg-Builds/releases/latest) | Bild und Ton zusammenführen oder Ton in MP3 mit der gewählten Bitrate umwandeln |
| FFprobe | Im selben FFmpeg-Paket enthalten | Spieldauer der fertigen Datei auslesen; die Dateigröße liest der Helfer direkt vom Dateisystem |
| Deno ≥ 2.3 | [denoland/deno](https://github.com/denoland/deno/releases/latest) | JavaScript-Aufgaben für die YouTube-Abfragen von yt-dlp ausführen; wird automatisch installiert, Node.js ist nicht erforderlich |

Das Setup lädt aktuelle Windows-x64-Releases über HTTPS und prüft ihren SHA256-Hash gegen die Release-Metadaten von GitHub, bevor neue Programme ausgeführt werden. Keine Administratorrechte, keine PATH-Änderungen, keine Hintergrunddienste oder offenen Netzwerkports. Programme von Drittanbietern werden erst beim Setup heruntergeladen und nicht im Paket mitgeliefert; ihre jeweiligen Lizenzen gelten.

**Wenn automatische Downloads nicht funktionieren:** Zuerst `Installieren.cmd` ausführen, damit der Helfer registriert ist. Dann aus den obigen Releases `yt-dlp.exe`, `ffmpeg.exe`, `ffprobe.exe` und `deno.exe` entpackt nach `%LOCALAPPDATA%\YouTubeUtils\bin` kopieren und **Erneut prüfen**. Die eigenständige yt-dlp.exe enthält die benötigten EJS-Komponenten. Die automatischen Downloads benötigen Zugriff auf GitHub und dessen Release-CDN; GitHub-API-Ratenlimits oder Firmennetzwerkregeln können das Setup verhindern.

**Aktualisieren:** `Programme-aktualisieren.cmd` lädt neue Versionen in den privaten Programmordner. Bereits im PATH installierte Programme werden dabei nicht verändert. Nach Änderungen am Erweiterungscode unter `chrome://extensions` auf **Neu laden** klicken und YouTube neu laden. Nach Änderungen am Helfer zusätzlich das Setup erneut ausführen.

**Entfernen:** Erweiterung unter `chrome://extensions` entfernen. Mit PowerShell `native\uninstall.ps1` ausführen, um die Chrome-Registrierung zu entfernen. `%LOCALAPPDATA%\YouTubeUtils` kann anschließend manuell gelöscht werden. Downloads bleiben erhalten.

## Berechtigungen und Architektur

Manifest V3, lokales JavaScript ohne Fremdcode oder Tracking. `storage` speichert Einstellungen und den letzten Vorgang. `activeTab` liest nach dem Klick URL und Titel des aktiven Tabs. Content-Scripts laufen auf YouTube und den oben genannten Prime-/Amazon-Seiten. Auf Amazon wird nur innerhalb eines erkannten Video-Players gearbeitet. `nativeMessaging` verbindet mit dem Windows-Helfer, `downloads` speichert das vom Paket mitgelieferte Setup, `contextMenus` ergänzt den Rechtsklick-Eintrag. Nur Popup und Einstellungsseite können native Aktionen auslösen.

Der PowerShell-5.1-Helfer verwendet das binäre Chrome-Native-Messaging-Protokoll. Er validiert URLs, Format, Bitrate und lokale Zielpfade. Externe Programme werden mit getrennten, korrekt maskierten Argumenten gestartet, ohne dynamische Shell-Kommandos. Downloads laden kein Skript von einer fremden Website in die Erweiterung.

## Entwicklung und Prüfung

Benötigt für Entwicklung: Node.js, Windows PowerShell 5.1. Nur zum Neuzeichnen der Icons und zum Erzeugen des ZIP-Pakets: Python (Icons zusätzlich Pillow). Nutzer der fertigen Erweiterung benötigen diese Entwicklungswerkzeuge nicht.

```powershell
node scripts/build.mjs
node --test tests/*.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/native.tests.ps1
python scripts/package.py
```

Der Build erzeugt das eigenständige Setup in `extension/setup`, abgeleitet aus denselben Helferdateien wie `Installieren.cmd`. Den Schlüssel im Manifest nicht ändern, sonst ändert sich die Erweiterungs-ID.

Prüfstand vom 17.10.2026: 26 automatisierte JavaScript-/Protokolltests und die nativen PowerShell-Validierungstests erfolgreich. Die automatische Installation wurde in einem isolierten Projektordner mit echten Releases getestet (yt-dlp 2026.08.19, FFmpeg N-127588, Deno 2.9.7). Ein öffentliches 19-Sekunden-Testvideo wurde über den Helfer als MP3 mit per FFprobe bestätigten 128000 bit/s sowie als MKV mit Video- und Tonspur gespeichert. Popup und Einstellungsseite wurden in Chrome mit simulierten Helferzuständen geprüft. Die eigentliche Chrome-Registrierung wurde auf diesem Rechner nicht ausgeführt; Werbeübergänge wurden automatisiert simuliert, nicht mit live ausgespielter YouTube- oder Amazon-Werbung geprüft. Die neuen Schnellschalter, Download-Buttons und Einstellungs-Tabs wurden in einer lokalen Chrome-Testansicht mit simuliertem Helfer geprüft.

Die optionalen Integrationstests `tests/install.integration.ps1` und `tests/download.integration.ps1` benötigen Netzwerkzugriff und schreiben ausschließlich nach `tests/.runtime`. Sie gehören nicht zum Nutzerpaket.

Technische Referenzen: [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging), [Chromium-Wiedergabegrenze](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/html/media/html_media_element.h), [yt-dlp JavaScript-Laufzeiten](https://github.com/yt-dlp/yt-dlp/wiki/EJS).

Die interne Helferkennung und der lokale Ordner heißen aus Kompatibilitätsgründen weiterhin `YouTubeUtils`; die Erweiterung und das neue ZIP heißen `Streaming Utils`. Referenz der Prime-Player-Markierungen: [Streaming Enhanced, Amazon-Adapter](https://github.com/Dreamlinerm/Netflix-Prime-Auto-Skip/blob/main/src/content-script/amazon.ts). Die Werbesteuerung ist eine eigenständige Implementierung.
