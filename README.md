# Game Library Exporter
Warning! AI Slop user script! But it works!<br>
Newest version can be found here: <a href="https://github.com/TrainStream/GameLibraryExporter/releases">Releases</a><br>
The html export is the highlight feature, providing various filtering options.<br>
<br>
Works on the user pages of: Backloggd.com, HowLongToBeat.com and MobyGames.com.<br>
Planning to add vndb.org an gamefaqs.gamespot.com!<br>
You need Violentmonkey, Tampermonkey, Greasemonkey or another user script manager to install and run this script on your browser!<br>
<br>
This browser userscript can be used when you enter your user page on the websites.<br>
It can export csv, json and html files.<br>
The more tags you choose for exporting, the longer is gonna take.<br>
For most websites "Basic" is only a list of the games.<br>
For Backloggdf.com the Basic tag includes, titles, average score, user score, release dates and others.<br>
Genres and Platforms are additional download tags.<br>
<br>
For Backloggd.com specifically, ~500 games:<br>
Basic takes ~20-30 seconds, Basic + Genres, ~45-60 seconds.<br>
Basic + Genres + Platforms 50 ~1.5-2 minutes, and Basic + Genres + Platform 226 can take ~3-4 minutes.<br>
Offline Covers option adds another ~20-30 seconds or more. Depends on CPU capabiltiies, because of pictures converting to smaller pictures. 
The final html file for ~500 games with all tag options is over 2MB.<br>

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
- On non-Backloggd websites, statuses and their source collections can be configured manually.
- Optional genre/platform/advanced scanning.
- Optional platform scanning, with a faster 50-platform mode or full 226-platform mode (Backloggd only). 
- Optional offline cover image support.
- Generates a polished offline HTML library viewer, not just a raw data file.
- HTML viewer includes search, sorting, status filters, genre filters, platform filters, and release-date filtering.
- Interactive counters show how many games match each status, genre, platform, and filter combination.
- Column picker lets users show or hide covers, links, genres, emoji, platforms, status, ratings, and release dates.
