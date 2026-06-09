# Game Library Exporter
Warning! AI Slop! But it works!<br>
<br>
Works on Backloggd.com, HowLongToBeat.com and MobyGames.com by going to their respective user/collection pages!<br>
Planning to add vndb.org an gamefaqs.gamespot.com!<br>
You need Violentmonkey, Tampermonkey, Greasemonkey or another user script manager to install and run this script on your browser!<br>
Newest version can be found here: <a href="https://github.com/TrainStream/GameLibraryExporter/releases">Releases</a><br>
<br>
This browser userscript can be used when you enter your user page on Backloggd.com.<br>
It can export csv, json and html files.<br>
The more tags you choose for exporting, the longer is gonna take.<br>
The Basic tag includes, titles, average score, user score, release dates and others.<br>
For Backloggd.com specifically, ~500 games:
Basic takes ~20-30 seconds, Basic + Genres, ~45-60 seconds.<br>
Basic + Genres + Platforms 50 ~1.5-2 minutes, and Basic + Genres + Platform 226 can take ~3-4 minutes.<br>
Offline Covers option adds another ~20-30 seconds or more. Depends on CPU capabiltiies. The final html file for ~500 games will be over 2MB.<br>
The html expport is really the prime feature, with many filtering options.<br>

Exporting Menu:<br>
<img width="358" height="188" alt="Export Menu" src="https://github.com/user-attachments/assets/0e92dfe9-e544-463b-886b-58c9ac8e1632" />
<br>

Exported html:<br>
<img width="1457" height="1409" alt="Backloggd Library" src="https://github.com/user-attachments/assets/1ccd4d55-9bb9-4dd8-bc05-53f61ebec6cc" />

List of Features:
- Supports: Backloggd.com, HowLongToBeat.com and MobyGames.com
- Export the user’s video game library.
- Download your library as `HTML`, `CSV`, and/or `JSON`.
- Includes core game data: title, status, release date, average rating, your rating, Backloggd game ID, game URL, and cover image URL.
- Supports all main Backloggd library states: Played, Playing, Backlog, and Wishlist.
- Preserves Played sub-statuses like Completed, Retired, Shelved, and Abandoned.
- Optional genre scanning.
- Optional platform scanning, with a faster 50-platform mode or full 226-platform mode.
- Optional offline cover image support.
- Generates a polished offline HTML library viewer, not just a raw data file.
- HTML viewer includes search, sorting, status filters, genre filters, platform filters, and release-date filtering.
- Interactive counters show how many games match each status, genre, platform, and filter combination.
- Column picker lets users show or hide covers, links, genres, platforms, status, ratings, and release dates.
- Saves viewer preferences such as sort order, light/dark mode, column visibility, and filter display settings.
- Built-in file converter can convert previous exports between CSV, JSON, and HTML.
- Floating Backloggd panel with progress bar and export log.
- Pause, resume, and stop controls for long exports.
