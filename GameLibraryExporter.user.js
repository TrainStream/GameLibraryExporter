// ==UserScript==
// @name         Game Library Exporter
// @namespace    https://backloggd.com/
// @version      1.1.1
// @description  Export game libraries from supported websites as HTML, CSV, and JSON.
// @author       TrainStream
// Written with Codex and Claude assistance.
// @license https://github.com/TrainStream/GameLibraryExporter/blob/main/LICENSE
// @match        https://backloggd.com/*
// @match        https://www.backloggd.com/*
// @match        https://mobygames.com/user/*
// @match        https://www.mobygames.com/user/*
// @match        https://howlongtobeat.com/user/*
// @match        https://www.howlongtobeat.com/user/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      github.com
// @connect      images.igdb.com
// @connect      howlongtobeat.com
// @updateURL    https://github.com/TrainStream/GameLibraryExporter/raw/refs/heads/main/GameLibraryExporter.meta.js
// @downloadURL  https://github.com/TrainStream/GameLibraryExporter/raw/refs/heads/main/GameLibraryExporter.user.js
// ==/UserScript==

(function () {
  'use strict';

  const ENABLE_EXPORTER_DIAGNOSTICS = true;

  // ---------------------------------------------------------------------------
  // Section map
  // ---------------------------------------------------------------------------
  // 1. Constants and lookup tables
  // 2. Navigation and panel lifecycle
  // 3. Exporter panel UI
  // 4. File conversion
  // 5. Shared utilities
  // 6. Network and version checks
  // 7. Backloggd scraping
  // 8. Output builders
  // 9. Generated HTML viewer
  // 10. Export orchestration

  // ---------------------------------------------------------------------------
  // 1. Constants and lookup tables
  // ---------------------------------------------------------------------------

  const STATUS_ORDER = ['played', 'playing', 'backlog', 'wishlist'];
  const COMBINED_TYPE = STATUS_ORDER.join(',');
  const STATUS_LABELS = {
    played: 'Played',
    playing: 'Playing',
    backlog: 'Backlog',
    wishlist: 'Wishlist',
  };

  const STATUS_PRIORITY = {
    playing: 0,
    played: 1,
    backlog: 2,
    wishlist: 3,
  };

  const MONTH_NAME_RE = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
  const FULL_RELEASE_DATE_RE = new RegExp(`\\b(?:${MONTH_NAME_RE})\\.?\\s+\\d{1,2},\\s+\\d{4}\\b`, 'i');
  const MONTH_YEAR_RELEASE_RE = new RegExp(`\\b(?:${MONTH_NAME_RE})\\.?\\s+\\d{4}\\b`, 'i');
  const YEAR_ONLY_RELEASE_RE = /\b(?:19|20)\d{2}\b/;
  const TBD_RELEASE_RE = /\bTBD\b/i;

  const STATUS_COLORS = {
    played: '#1fbf75',
    playing: '#2f8df7',
    backlog: '#9b6cff',
    wishlist: '#f0a500',
  };

  // Sub-statuses for the "Played" status (scraped from data-status-title)
  const PLAY_TYPE_ORDER = ['played', 'completed', 'retired', 'shelved', 'abandoned'];
  const PLAY_TYPE_LABELS = {
    played:    'Played',
    completed: 'Completed',
    retired:   'Retired',
    shelved:   'Shelved',
    abandoned: 'Abandoned',
  };
  // Colors: Played=magenta-pink, Completed=same green as main Played,
  // Retired=cornflower blue, Shelved=ochre orange, Abandoned=muted terracotta
  const PLAY_TYPE_COLORS = {
    played:    '#d63f8c',
    completed: '#1fbf75',
    retired:   '#6488e8',
    shelved:   '#c47f1a',
    abandoned: '#b05a47',
  };

  const PLAY_TYPE_ALIASES = {
    played: 'played',
    play: 'played',
    completed: 'completed',
    complete: 'completed',
    retired: 'retired',
    retire: 'retired',
    shelved: 'shelved',
    shelve: 'shelved',
    abandoned: 'abandoned',
    abandon: 'abandoned',
    '\u30d7\u30ec\u30a4\u6e08\u307f': 'played',
    '\u30d7\u30ec\u30a4\u3057\u305f': 'played',
    '\u5b8c\u4e86': 'completed',
    '\u5b8c\u6210': 'completed',
    '\u30af\u30ea\u30a2': 'completed',
    '\u30af\u30ea\u30a2\u6e08\u307f': 'completed',
    '\u30ea\u30bf\u30a4\u30a2': 'retired',
    '\u5f15\u9000': 'retired',
    '\u9000\u5f79': 'retired',
    '\u5f03\u7f6e': 'shelved',
    '\u68da\u4e0a\u3052': 'shelved',
    '\u4fdd\u7559': 'shelved',
    '\u6401\u7f6e': 'shelved',
    '\u64f1\u7f6e': 'shelved',
    '\u4e2d\u6b62': 'abandoned',
    '\u65ad\u5ff5': 'abandoned',
    '\u653e\u68c4': 'abandoned',
    '\u653e\u5f03': 'abandoned',
    '\u653e\u68c4\u3057\u305f': 'abandoned',
    '\u653e\u68c4\u6e08\u307f': 'abandoned',
  };

  const GENRE_SLUGS = [
    { label: 'Adventure',    slug: 'adventure' },
    { label: 'Arcade',       slug: 'arcade' },
    { label: 'Hack & Slash', slug: 'hack-and-slash-beat-em-up' },
    { label: 'Card & Board', slug: 'card-and-board-game' },
    { label: 'Fighting',     slug: 'fighting' },
    { label: 'Indie',        slug: 'indie' },
    { label: 'MOBA',         slug: 'moba' },
    { label: 'Music',        slug: 'music' },
    { label: 'Pinball',      slug: 'pinball' },
    { label: 'Platform',     slug: 'platform' },
    { label: 'Point & Click',slug: 'point-and-click' },
    { label: 'Puzzle',       slug: 'puzzle' },
    { label: 'Quiz & Trivia',slug: 'quiz-trivia' },
    { label: 'Racing',       slug: 'racing' },
    { label: 'RTS',          slug: 'real-time-strategy-rts' },
    { label: 'RPG',          slug: 'role-playing-rpg' },
    { label: 'Shooter',      slug: 'shooter' },
    { label: 'Simulator',    slug: 'simulator' },
    { label: 'Sport',        slug: 'sport' },
    { label: 'Strategy',     slug: 'strategy' },
    { label: 'Tactical',     slug: 'tactical' },
    { label: 'Turn Based',   slug: 'turn-based-strategy-tbs' },
    { label: 'Visual Novel', slug: 'visual-novel' },
  ];

  // Vibrant, distinct palette - intentionally different from status pill colours
  const GENRE_COLORS = {
    'Adventure':    '#f79f1b',
    'Arcade':       '#94c916',
    'Hack & Slash': '#eb241d',
    'Card & Board': '#138fae',
    'Fighting':     '#b4500d',
    'Indie':        '#21a41d',
    'MOBA':         '#30a1ed',
    'Music':        '#ea4793',
    'Pinball':      '#cfd515',
    'Platform':     '#4dda81',
    'Point & Click':'#301fa2',
    'Puzzle':       '#1554c0',
    'Quiz & Trivia':'#924224',
    'Racing':       '#efc804',
    'RTS':          '#39e4d3',
    'RPG':          '#8340e7',
    'Shooter':      '#4d61e4',
    'Simulator':    '#189567',
    'Sport':        '#7de439',
    'Strategy':     '#7912a5',
    'Tactical':     '#825e35',
    'Turn Based':   '#d25fd2',
    'Visual Novel': '#ce11a2',
  };

  const MOBYGAMES_GENRE_COLORS = {
    '4X': '#6f4ed8',
    'Action': '#e23d28',
    'Action RPG': '#bb42d6',
    'Add-on': '#6b8f1a',
    'Adventure': '#d88712',
    'Arcade': '#31a61f',
    'Artillery': '#b86c18',
    'Battle royale': '#d12f69',
    'Beat \'em up / brawler': '#c4471e',
    'Board game': '#008f86',
    'Cards / tiles': '#1274c7',
    'Chess': '#4b6078',
    'City building / construction simulation': '#009d5a',
    'Compilation': '#8c6f2d',
    'Dating simulation': '#d83f91',
    'Educational': '#2f8fdf',
    'Falling block puzzle': '#8aa600',
    'Fighting': '#d51d40',
    'Gambling': '#0e9a50',
    'Gambling elements': '#5aae2d',
    'Game show / trivia / quiz': '#d2a400',
    'Graphic adventure': '#c56b2b',
    'Hack and slash': '#b51f1f',
    'Hidden object': '#6c56a8',
    'Hunting': '#74851f',
    'Idle': '#7b8794',
    'Interactive book': '#9b5a2e',
    'Interactive fiction / text adventure': '#5b4ec9',
    'Japanese-style adventure': '#db5c84',
    'Japanese-style RPG (JRPG)': '#9348d1',
    'Jigsaw puzzle': '#3b93b8',
    'Life / social simulation': '#29a474',
    'Managerial / business simulation': '#0a8f9f',
    'Massively Multiplayer': '#256fe6',
    'Mental training': '#6972cf',
    'Metroidvania': '#a522b5',
    'Minigames': '#e17616',
    'MOBA / ARTS': '#006fd1',
    'Music / rhythm': '#d946a6',
    'Paddle / Pong': '#53a316',
    'Party game': '#ee6f2d',
    'Pinball': '#b99400',
    'Platform': '#28a64e',
    'Puzzle': '#157bc2',
    'Puzzle elements': '#44a6c6',
    'Quick Time Events (QTEs)': '#d06011',
    'Racing / Driving': '#e5b300',
    'Rail shooter': '#2570b8',
    'Real-time strategy (RTS)': '#0c8f73',
    'Real-time tactics (RTT)': '#2e9f98',
    'Roguelike': '#5d35c8',
    'Role-playing (RPG)': '#7b43df',
    'RPG elements': '#9a63d8',
    'Sandbox / open world': '#3b9f39',
    'Shooter': '#2954d6',
    'Simulation': '#1f9f8f',
    'Special edition': '#b06a00',
    'Sports': '#76a51b',
    'Stealth': '#56606d',
    'Strategy / tactics': '#0f8d62',
    'Survival horror': '#7c2f3d',
    'Tactical RPG': '#6542ba',
    'Tactical shooter': '#3948a6',
    'Tile matching puzzle': '#20a6a6',
    'Time management': '#c48700',
    'Timed input': '#d66f2d',
    'Tower defense': '#7f8f17',
    'Trading / collectible card': '#0e86b7',
    'Tricks / stunts': '#e05d1b',
    'Turn-based strategy (TBS)': '#6a8f24',
    'Turn-based tactics (TBT)': '#3a9b72',
    'Visual novel': '#c83e9c',
    'Wargame': '#6f6b25',
    'Word construction': '#4773c9',
  };
  const MOBYGAMES_GENRE_LABELS = Object.keys(MOBYGAMES_GENRE_COLORS);

  const GENRE_EMOJIS = {
    'Adventure':    '\u{1f5dd}\ufe0f',
    'Arcade':       '\u{1f579}\ufe0f',
    'Hack & Slash': '\u2694\ufe0f',
    'Card & Board': '\u{1f3b2}',
    'Fighting':     '\u{1f94a}',
    'Indie':        '\u{1f48e}',
    'MOBA':         '\u{1f3c6}',
    'Music':        '\u{1f3b5}',
    'Pinball':      '\u{1f3b0}',
    'Platform':     '\u{1f3ae}',
    'Point & Click':'\u{1f5b1}\ufe0f',
    'Puzzle':       '\u{1f9e9}',
    'Quiz & Trivia':'\u2753',
    'Racing':       '\u{1f3c1}',
    'RTS':          '\u26a1',
    'RPG':          '\u{1f409}',
    'Shooter':      '\u{1f3af}',
    'Simulator':    '\u2708\ufe0f',
    'Sport':        '\u26bd',
    'Strategy':     '\u265f\ufe0f',
    'Tactical':     '\u{1f396}\ufe0f',
    'Turn Based':   '\u23f3',
    'Visual Novel': '\u{1f4d6}',
  };

  const PLATFORM_LABELS = [
    'Amiga',
    'Amstrad CPC',
    'Android',
    'Apple II',
    'Arcade',
    'Atari 8-bit',
    'Atari ST/STE',
    'Commodore C64/128/MAX',
    'DOS',
    'e-Reader / Card-e Reader',
    'Family Computer',
    'Game Boy',
    'Game Boy Advance',
    'Game Boy Color',
    'Handheld Electronic LCD',
    'iOS',
    'Legacy Mobile Device',
    'Linux',
    'Mac',
    'Meta Quest 2',
    'MSX',
    'NES',
    'Nintendo 3DS',
    'Nintendo 64',
    'Nintendo DS',
    'Nintendo GameCube',
    'Nintendo Switch',
    'Nintendo Switch 2',
    'PC-9800 Series',
    'PlayStation',
    'PlayStation 2',
    'PlayStation 3',
    'PlayStation 4',
    'PlayStation 5',
    'PlayStation Portable',
    'PlayStation Vita',
    'Sega Mega Drive/Genesis',
    'Sega Saturn',
    'SteamVR',
    'Super Famicom',
    'Super Nintendo Entertainment System',
    'Web browser',
    'Wii',
    'Wii U',
    'Windows PC',
    'Xbox',
    'Xbox 360',
    'Xbox One',
    'Xbox Series X|S',
    'ZX Spectrum',
  ];

  // All 226 platforms (alphabetical) used by the "Platforms (226)" full-scan mode.
  const ALL_PLATFORM_SLUGS = [
    { label: '1292 Advanced Programmable Video System', slug: '1292-advanced-programmable-video-system' },
    { label: '3DO Interactive Multiplayer', slug: '3do' },
    { label: '64DD', slug: '64dd' },
    { label: 'Acorn Archimedes', slug: 'acorn-archimedes' },
    { label: 'Acorn Electron', slug: 'acorn-electron' },
    { label: 'Advanced Pico Beena', slug: 'advanced-pico-beena' },
    { label: 'AirConsole', slug: 'airconsole' },
    { label: 'Amazon Fire TV', slug: 'firetv' },
    { label: 'Amiga', slug: 'amiga' },
    { label: 'Amiga CD32', slug: 'amiga-cd32' },
    { label: 'Amstrad CPC', slug: 'acpc' },
    { label: 'Amstrad GX4000', slug: 'gx4000' },
    { label: 'Amstrad PCW', slug: 'apcw' },
    { label: 'Analogue Electronics', slug: 'analogueelectronics' },
    { label: 'Android', slug: 'android' },
    { label: 'Apple II', slug: 'appleii' },
    { label: 'Apple IIGS', slug: 'apple-iigs' },
    { label: 'Apple Pippin', slug: 'apple-pippin' },
    { label: 'Arcade', slug: 'arcade' },
    { label: 'Arcadia 2001', slug: 'arcadia-2001' },
    { label: 'Arduboy', slug: 'arduboy' },
    { label: 'Atari 2600', slug: 'atari2600' },
    { label: 'Atari 5200', slug: 'atari5200' },
    { label: 'Atari 7800', slug: 'atari7800' },
    { label: 'Atari 8-bit', slug: 'atari8bit' },
    { label: 'Atari Jaguar', slug: 'jaguar' },
    { label: 'Atari Jaguar CD', slug: 'atari-jaguar-cd' },
    { label: 'Atari Lynx', slug: 'lynx' },
    { label: 'Atari ST/STE', slug: 'atari-st' },
    { label: 'AY-3-8500', slug: 'ay-3-8500' },
    { label: 'AY-3-8603', slug: 'ay-3-8603' },
    { label: 'AY-3-8605', slug: 'ay-3-8605' },
    { label: 'AY-3-8606', slug: 'ay-3-8606' },
    { label: 'AY-3-8607', slug: 'ay-3-8607' },
    { label: 'AY-3-8610', slug: 'ay-3-8610' },
    { label: 'AY-3-8710', slug: 'ay-3-8710' },
    { label: 'AY-3-8760', slug: 'ay-3-8760' },
    { label: 'Bally Astrocade', slug: 'astrocade' },
    { label: 'BBC Microcomputer System', slug: 'bbcmicro' },
    { label: 'BlackBerry OS', slug: 'blackberry' },
    { label: 'Blu-ray Player', slug: 'blu-ray-player' },
    { label: 'Call-A-Computer', slug: 'call-a-computer' },
    { label: 'Casio Loopy', slug: 'casio-loopy' },
    { label: 'CDC Cyber 70', slug: 'cdccyber70' },
    { label: 'ColecoVision', slug: 'colecovision' },
    { label: 'Commodore 16', slug: 'c16' },
    { label: 'Commodore C64/128/MAX', slug: 'c64' },
    { label: 'Commodore CDTV', slug: 'commodore-cdtv' },
    { label: 'Commodore PET', slug: 'cpet' },
    { label: 'Commodore Plus/4', slug: 'c-plus-4' },
    { label: 'Commodore VIC-20', slug: 'vic-20' },
    { label: 'Daydream', slug: 'daydream' },
    { label: 'DEC GT40', slug: 'gt40' },
    { label: 'Digiblast', slug: 'digiblast' },
    { label: 'Donner Model 30', slug: 'donner30' },
    { label: 'DOS', slug: 'dos' },
    { label: 'Dragon 32/64', slug: 'dragon-32-slash-64' },
    { label: 'Dreamcast', slug: 'dc' },
    { label: 'DUPLICATE Stadia', slug: 'duplicate-stadia' },
    { label: 'DVD Player', slug: 'dvd-player' },
    { label: 'e-Reader / Card-e Reader', slug: 'e-reader-slash-card-e-reader' },
    { label: 'EDSAC', slug: 'edsac--1' },
    { label: 'Elektor TV Games Computer', slug: 'elektor-tv-games-computer' },
    { label: 'Epoch Cassette Vision', slug: 'epoch-cassette-vision' },
    { label: 'Epoch Super Cassette Vision', slug: 'epoch-super-cassette-vision' },
    { label: 'Evercade', slug: 'evercade' },
    { label: 'Exidy Sorcerer', slug: 'exidy-sorcerer' },
    { label: 'Fairchild Channel F', slug: 'fairchild-channel-f' },
    { label: 'Family Computer', slug: 'famicom' },
    { label: 'Family Computer Disk System', slug: 'fds' },
    { label: 'Ferranti Nimrod Computer', slug: 'nimrod' },
    { label: 'FM Towns', slug: 'fm-towns' },
    { label: 'FM-7', slug: 'fm-7' },
    { label: 'Gamate', slug: 'gamate' },
    { label: 'Game & Watch', slug: 'g-and-w' },
    { label: 'Game Boy', slug: 'gb' },
    { label: 'Game Boy Advance', slug: 'gba' },
    { label: 'Game Boy Color', slug: 'gbc' },
    { label: 'Game.com', slug: 'game-dot-com' },
    { label: 'Gear VR', slug: 'gear-vr' },
    { label: 'Gizmondo', slug: 'gizmondo' },
    { label: 'Google Stadia', slug: 'stadia' },
    { label: 'Handheld Console', slug: 'handheld-console' },
    { label: 'Handheld Electronic LCD', slug: 'handheld' },
    { label: 'HP 2100', slug: 'hp2100' },
    { label: 'HP 3000', slug: 'hp3000' },
    { label: 'Hyper Neo Geo 64', slug: 'hyper-neo-geo-64' },
    { label: 'HyperScan', slug: 'hyperscan' },
    { label: 'Imlac PDS-1', slug: 'imlac-pds1' },
    { label: 'Intellivision', slug: 'intellivision' },
    { label: 'Intellivision Amico', slug: 'intellivision-amico' },
    { label: 'iOS', slug: 'ios' },
    { label: 'LaserActive', slug: 'laseractive' },
    { label: 'Leapster', slug: 'leapster' },
    { label: 'Leapster Explorer/LeadPad Explorer', slug: 'leapster-explorer-slash-leadpad-explorer' },
    { label: 'LeapTV', slug: 'leaptv' },
    { label: 'Legacy Computer', slug: 'legacy-computer' },
    { label: 'Legacy Mobile Device', slug: 'mobile' },
    { label: 'Linux', slug: 'linux' },
    { label: 'Mac', slug: 'mac' },
    { label: 'Mega Duck/Cougar Boy', slug: 'mega-duck-slash-cougar-boy' },
    { label: 'Meta Quest 2', slug: 'meta-quest-2' },
    { label: 'Meta Quest 3', slug: 'meta-quest-3' },
    { label: 'Microcomputer', slug: 'microcomputer--1' },
    { label: 'Microvision', slug: 'microvision--1' },
    { label: 'MSX', slug: 'msx' },
    { label: 'MSX2', slug: 'msx2' },
    { label: 'N-Gage', slug: 'ngage' },
    { label: 'NEC PC-6000 Series', slug: 'nec-pc-6000-series' },
    { label: 'Neo Geo AES', slug: 'neogeoaes' },
    { label: 'Neo Geo CD', slug: 'neo-geo-cd' },
    { label: 'Neo Geo MVS', slug: 'neogeomvs' },
    { label: 'Neo Geo Pocket', slug: 'neo-geo-pocket' },
    { label: 'Neo Geo Pocket Color', slug: 'neo-geo-pocket-color' },
    { label: 'NES', slug: 'nes' },
    { label: 'New Nintendo 3DS', slug: 'new-3ds' },
    { label: 'Nintendo 3DS', slug: '3ds' },
    { label: 'Nintendo 64', slug: 'n64' },
    { label: 'Nintendo DS', slug: 'nds' },
    { label: 'Nintendo DSi', slug: 'nintendo-dsi' },
    { label: 'Nintendo eShop', slug: 'nintendo-eshop' },
    { label: 'Nintendo GameCube', slug: 'ngc' },
    { label: 'Nintendo Switch', slug: 'switch' },
    { label: 'Nintendo Switch 2', slug: 'switch-2' },
    { label: 'Nuon', slug: 'nuon' },
    { label: 'Oculus Go', slug: 'oculus-go' },
    { label: 'Oculus Quest', slug: 'oculus-quest' },
    { label: 'Oculus Rift', slug: 'oculus-rift' },
    { label: 'Oculus VR', slug: 'oculus-vr' },
    { label: 'Odyssey', slug: 'odyssey--1' },
    { label: 'Odyssey 2 / Videopac G7000', slug: 'odyssey-2-slash-videopac-g7000' },
    { label: 'OnLive Game System', slug: 'onlive' },
    { label: 'OOParts', slug: 'ooparts' },
    { label: 'Ouya', slug: 'ouya' },
    { label: 'Palm OS', slug: 'palm-os' },
    { label: 'Panasonic Jungle', slug: 'panasonic-jungle' },
    { label: 'Panasonic M2', slug: 'panasonic-m2' },
    { label: 'PC Engine SuperGrafx', slug: 'supergrafx' },
    { label: 'PC-50X Family', slug: 'pc-50x-family' },
    { label: 'PC-8800 Series', slug: 'pc-8800-series' },
    { label: 'PC-9800 Series', slug: 'pc-9800-series' },
    { label: 'PC-FX', slug: 'pc-fx' },
    { label: 'PDP-1', slug: 'pdp1' },
    { label: 'PDP-10', slug: 'pdp10' },
    { label: 'PDP-11', slug: 'pdp11' },
    { label: 'PDP-7', slug: 'pdp-7--1' },
    { label: 'PDP-8', slug: 'pdp-8--1' },
    { label: 'Philips CD-i', slug: 'philips-cdi' },
    { label: 'PLATO', slug: 'plato--1' },
    { label: 'Playdate', slug: 'playdate' },
    { label: 'Playdia', slug: 'playdia' },
    { label: 'PlayStation', slug: 'ps' },
    { label: 'PlayStation 2', slug: 'ps2' },
    { label: 'PlayStation 3', slug: 'ps3' },
    { label: 'PlayStation 4', slug: 'ps4--1' },
    { label: 'PlayStation 5', slug: 'ps5' },
    { label: 'PlayStation Network', slug: 'psn' },
    { label: 'PlayStation Portable', slug: 'psp' },
    { label: 'PlayStation Vita', slug: 'psvita' },
    { label: 'PlayStation VR', slug: 'psvr' },
    { label: 'PlayStation VR2', slug: 'psvr2' },
    { label: 'Plug & Play', slug: 'plug-and-play' },
    { label: 'PocketStation', slug: 'pocketstation' },
    { label: 'Pokemon mini', slug: 'pokemon-mini' },
    { label: 'Polymega', slug: 'polymega' },
    { label: 'R-Zone', slug: 'r-zone' },
    { label: 'Satellaview', slug: 'satellaview' },
    { label: 'SDS Sigma 7', slug: 'sdssigma7' },
    { label: 'Sega 32X', slug: 'sega32' },
    { label: 'Sega CD', slug: 'sega-cd' },
    { label: 'Sega CD 32X', slug: 'sega-cd-32x' },
    { label: 'Sega Game Gear', slug: 'gamegear' },
    { label: 'Sega Master System/Mark III', slug: 'sms' },
    { label: 'Sega Mega Drive/Genesis', slug: 'genesis-slash-megadrive' },
    { label: 'Sega Pico', slug: 'sega-pico' },
    { label: 'Sega Saturn', slug: 'saturn' },
    { label: 'SG-1000', slug: 'sg1000' },
    { label: 'Sharp MZ-2200', slug: 'sharp-mz-2200' },
    { label: 'Sharp X1', slug: 'x1' },
    { label: 'Sharp X68000', slug: 'sharp-x68000' },
    { label: 'Sinclair QL', slug: 'sinclair-ql' },
    { label: 'Sinclair ZX81', slug: 'sinclair-zx81' },
    { label: 'Sol-20', slug: 'sol-20' },
    { label: 'Steam Deck', slug: 'steam-deck' },
    { label: 'SteamOS', slug: 'steam--1' },
    { label: 'SteamVR', slug: 'steam-vr' },
    { label: "Super A'Can", slug: 'super-acan' },
    { label: 'Super Famicom', slug: 'sfam' },
    { label: 'Super NES CD-ROM System', slug: 'super-nes-cd-rom-system' },
    { label: 'Super Nintendo Entertainment System', slug: 'snes' },
    { label: 'Tapwave Zodiac', slug: 'zod' },
    { label: 'Tatung Einstein', slug: 'tatung-einstein' },
    { label: "Terebikko / See 'n Say Video Phone", slug: 'terebikko-slash-see-n-say-video-phone' },
    { label: 'Texas Instruments TI-99', slug: 'ti-99' },
    { label: 'Thomson MO5', slug: 'thomson-mo5' },
    { label: 'Tomy Tutor/Pyuta/Grandstand Tutor', slug: 'tomy-tutor-slash-pyuta-slash-grandstand-tutor' },
    { label: 'TRS-80', slug: 'trs-80' },
    { label: 'TRS-80 Color Computer', slug: 'trs-80-color-computer' },
    { label: 'TurboGrafx-16/PC Engine', slug: 'turbografx16--1' },
    { label: 'Turbografx-16/PC Engine CD', slug: 'turbografx-16-slash-pc-engine-cd' },
    { label: 'Uzebox', slug: 'uzebox' },
    { label: 'V.Smile', slug: 'vsmile' },
    { label: 'VC 4000', slug: 'vc-4000' },
    { label: 'Vectrex', slug: 'vectrex' },
    { label: 'Virtual Boy', slug: 'virtualboy' },
    { label: 'Virtual Console', slug: 'vc' },
    { label: 'VisionOS', slug: 'visionos' },
    { label: 'Visual Memory Unit/Visual Memory System', slug: 'visual-memory-unit-slash-visual-memory-system' },
    { label: 'Watara/Quickshot Supervision', slug: 'watara-slash-quickshot-supervision' },
    { label: 'Web browser', slug: 'browser' },
    { label: 'Wii', slug: 'wii' },
    { label: 'Wii U', slug: 'wiiu' },
    { label: 'WiiWare', slug: 'wiiware' },
    { label: 'Windows Mixed Reality', slug: 'windows-mixed-reality' },
    { label: 'Windows Mobile', slug: 'windows-mobile' },
    { label: 'Windows PC', slug: 'win' },
    { label: 'Windows Phone', slug: 'winphone' },
    { label: 'WonderSwan', slug: 'wonderswan' },
    { label: 'WonderSwan Color', slug: 'wonderswan-color' },
    { label: 'Xbox', slug: 'xbox' },
    { label: 'Xbox 360', slug: 'xbox360' },
    { label: 'Xbox Live Arcade', slug: 'xla' },
    { label: 'Xbox One', slug: 'xboxone' },
    { label: 'Xbox Series X|S', slug: 'series-x-s' },
    { label: 'Zeebo', slug: 'zeebo' },
    { label: 'ZX Spectrum', slug: 'zxs' },
  ];
  const PLATFORM_SLUGS = PLATFORM_LABELS.map(label => {
    const entry = ALL_PLATFORM_SLUGS.find(platform => platform.label === label);
    if (!entry) throw new Error(`Missing platform slug for ${label}`);
    return entry;
  });

  const MOBYGAMES_PLATFORM_LABELS = `1292 Advanced Programmable Video System
3DO
ABC 80
Acorn 32-bit
Adventure Vision
AirConsole
Alice 32/90
Altair 680
Altair 8800
Amazon Alexa
Amiga
Amiga CD32
Amstrad CPC
Amstrad PCW
Android
Antstream
APF MP1000/Imagination Machine
Apple I
Apple II
Apple IIgs
Arcade
Arcadia 2001
Arduboy
Astral 2000
Atari 2600
Atari 5200
Atari 7800
Atari 8-bit
Atari ST
Atari VCS
Atom
Auto Response Board
bada
Bally Astrocade
Bandai RX-78 Gundam
BBC Micro
BeOS
BlackBerry
Blacknut
Blu-ray Disc Player
BREW
Browser
Bubble
Camputers Lynx
Casio FP-1000/1100
Casio Loopy
Casio Programmable Calculator
Casio PV-1000
CD-i
CDTV
Champion 2711
Channel F
ClickStart
Coleco Adam
ColecoVision
Colour Genie
Commodore 128
Commodore 16, Plus/4
Commodore 64
Commodore PET/CBM
Compal 80
Compucolor I
Compucolor II
Compucorp Programmable Calculator
COSMAC
CP/M
CreatiVision
Cybervision
DAI
Danger OS
Dedicated console
Dedicated handheld
Didj
digiBlast
DoJa
DOS
Dragon 32/64
Dreamcast
DVD Player
ECD Micromind
Electron
Enterprise
Epoch Cassette Vision
Epoch Game Pocket Computer
Epoch Super Cassette Vision
Evercade
Exelvision
ExEn
Exidy Sorcerer
Feature phone
Fire OS
FM Towns
FM-7
Freebox
FreeBSD
G-cluster
Galaksija
Game Boy
Game Boy Advance
Game Boy Color
Game Gear
Game Wave
Game.Com
GameCube
GameStick
Genesis
GIMINI
Gizmondo
Gloud
Glulx
GNEX
GP2X
GP2X Wiz
GP32
GVM
HD DVD Player
Heath/Zenith H8/H89
Heathkit H11
Hitachi Basic Master
Hitachi Basic Master Level 3
Hitachi H68/TR
Hitachi S1
HP 9800
HP Oscilloscope
HP Programmable Calculator
HP Series 80
Hugo
HyperScan
IBM 5100
Ideal-Computer
iiRcade
Intel 8008
Intel 8080
Intel 8086 / 8088
Intellivision
Interact Model One
Interton Video 2000
iPad
iPhone
iPod Classic
J2ME
Jaguar
Jolt
Jupiter Ace
KaiOS
KIM-1
Kindle Classic
Laser 200
LaserActive
LeapFrog Explorer
Leapster
LeapTV
Linux
Lkit-16
Luna
Lynx
Macintosh
Maemo
Magic Leap
Mainframe
Marvel 2000
Matsushita/Panasonic JR
Mattel Aquarius
MeeGo
Memotech MTX
Meritum
Microbee
Microtan 65
Microvision
Mitsubishi Multi-8
Modular Game System
Mophun
MOS Technology 6502
Motorola 6800
Motorola 68k
MRE
MSX
N-Gage
N-Gage (service)
Nascom
NEC TK-80
Neo Geo
Neo Geo CD
Neo Geo Pocket
Neo Geo Pocket Color
Neo Geo X
NES
NetBSD
New Nintendo 3DS
NewBrain
Newton
Nintendo 3DS
Nintendo 64
Nintendo DS
Nintendo DSi
Nintendo Switch
Nintendo Switch 2
North Star
Noval 760
Nuon
Oculus Go
Odyssey
Odyssey 2
Ohio Scientific
OnLive
OOParts
OpenBSD
Orao
Oric
OS/2
Ouya
Palm OS
Pandora
PC Booter
PC-6001
PC-8000
PC-88
PC-98
PC-FX
Pebble
Philips P2000
Philips VG 5000
Photo CD
PICO
Pippin
Playdate
Playdia
PlayStation
PlayStation 2
PlayStation 3
PlayStation 4
PlayStation 5
PlayStation Now
Plex Arcade
Pokitto
PokÃ©mon Mini
Poly-88
PS Vita
PSP
Quest
RCA Studio II
Research Machines 380Z
Roku
SAM CoupÃ©
SC/MP
SD-200/270/290
SEGA 32X
SEGA CD
SEGA Master System
SEGA Pico
SEGA Saturn
SG-1000
Sharp MZ-80B/2000/2500
Sharp MZ-80K/700/800/1500
Sharp X1
Sharp X68000
Sharp Zaurus
Signetics 2650
Sinclair QL
SK-VM
SMC-777
SNES
Socrates
Sol-20
Solaris
Sord M5
SPC-1000
Spectravideo
SRI-500/1000
Stadia
Super A'can
Super Vision 8000
SuperGrafx
Supervision
Sure Shot HD
SWTPC 6800
Symbian
TADS
Taito X-55
Tatung Einstein
Tektronix 4050
Tele-Spiel ES-2201
Telstar Arcade
TempleOS
Terminal
Thomson MO
Thomson TO
TI Programmable Calculator
TI-99/4A
TIC-80
Tiki 100
TIM
Timex Sinclair 2068
Tizen
Tomahawk F1
Tomy Tutor
Toshiba Ex-80
Toshiba Pasopia
Triton
TRS-80
TRS-80 CoCo
TRS-80 MC-10
TRS-80 Model 100
TurboGrafx CD
TurboGrafx-16
tvOS
V.Flash
V.Smile
Vectrex
Versatile
VIC-20
VideoBrain
Videopac+ G7400
Virtual Boy
VIS
visionOS
Wang 2200
watchOS
webOS
Wii
Wii U
Windows
Windows 16-bit
Windows Apps
Windows Mobile
Windows Phone
WIPI
WonderSwan
WonderSwan Color
XaviXPORT
Xbox
Xbox 360
Xbox Cloud Gaming
Xbox One
Xbox Series
Xerox Alto
Z-machine
Zeebo
Zilog Z80
Zilog Z8000
Zodiac
Zune
ZX Spectrum
ZX Spectrum Next
ZX80
ZX81`
    .split('\n')
    .map(label => label.trim())
    .filter(Boolean);

  const EXPORTER_ID = 'bgd-exporter-root';
  const EXPORTER_VERSION = '1.1.1';
  const EXPORTER_RELEASES_URL = 'https://github.com/TrainStream/GameLibraryExporter/releases';
  // Maximum number of game detail pages fetched in parallel when resolving
  // missing release dates.  Increase cautiously - higher values may trigger
  // rate-limiting on Backloggd's servers.
  const DETAIL_FETCH_CONCURRENCY = 3;

  function getBackloggdUserSlug() {
    const match = location.pathname.match(/^\/u\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function getMobyGamesCollectionUserSlug() {
    const match = location.pathname.match(/^\/user\/(\d+)\/([^/?#]+)(?:\/|$)/i);
    return match ? decodeURIComponent(match[2]) : '';
  }

  function getHowLongToBeatUserSlug() {
    const match = location.pathname.match(/^\/user\/([^/?#]+)(?:\/|$)/i);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function getHowLongToBeatUserGamesRootUrl(pageUrl = location.href) {
    const match = String(pageUrl || '').match(/^(https?:\/\/(?:www\.)?howlongtobeat\.com\/user\/[^/?#]+\/games\/?)/i);
    if (match) return match[1].replace(/\/?$/, '/');
    const username = getHowLongToBeatUserSlug();
    return username ? `${location.origin}/user/${encodeURIComponent(username)}/games/` : '';
  }

  function getMobyGamesCollectionRootUrl(pageUrl = location.href) {
    const match = String(pageUrl || '').match(/^(https?:\/\/(?:www\.)?mobygames\.com\/user\/\d+\/[^/?#]+\/)/i);
    return match ? `${match[1]}collection/` : '';
  }

  function isMobyGamesCollectionRootPage(pageUrl = location.href) {
    try {
      const url = new URL(pageUrl, location.origin);
      return /^\/user\/\d+\/[^/?#]+\/collection\/?$/i.test(url.pathname);
    } catch (_) {
      return false;
    }
  }

  function isHowLongToBeatUserGamesRootPage(pageUrl = location.href) {
    try {
      const url = new URL(pageUrl, location.origin);
      return /^\/user\/[^/?#]+\/games(\/|$)/i.test(url.pathname);
    } catch (_) {
      return false;
    }
  }

  function getMobyGamesDisplayNameFromDocument(doc = document) {
    const h1 = doc.querySelector('h1.mb-0');
    if (h1) {
      const clone = h1.cloneNode(true);
      clone.querySelectorAll('small').forEach(el => el.remove());
      const name = String(clone.textContent || '').trim().replace(/\s+/g, ' ');
      if (name) return name;
    }
    const displayNameEl = doc.querySelector('[\\:display-name], [display-name]');
    const displayNameAttr = displayNameEl && (displayNameEl.getAttribute(':display-name') || displayNameEl.getAttribute('display-name'));
    const displayName = String(displayNameAttr || '').trim().replace(/^['"]|['"]$/g, '');
    if (displayName) return displayName;
    const title = doc.querySelector('meta[property="og:title"]') && doc.querySelector('meta[property="og:title"]').content;
    const titleMatch = String(title || '').match(/^Game Collection for\s+(.+?)(?:\s+\(@[^)]*\))?\s+-\s+MobyGames$/i);
    return titleMatch ? titleMatch[1].trim() : '';
  }

  function getUserSlug() {
    if (/^(?:www\.)?mobygames\.com$/i.test(location.hostname)) {
      return getMobyGamesCollectionUserSlug();
    }
    if (/^(?:www\.)?howlongtobeat\.com$/i.test(location.hostname)) {
      return getHowLongToBeatUserSlug();
    }
    return getBackloggdUserSlug();
  }

  function isMobyGamesHost() {
    return /^(?:www\.)?mobygames\.com$/i.test(location.hostname);
  }

  function isHowLongToBeatHost() {
    return /^(?:www\.)?howlongtobeat\.com$/i.test(location.hostname);
  }

  function isConfiguredStatusSourceHost() {
    return !!getSourceStatusConfigDescriptorForHost();
  }

  // Source adapter checklist:
  // - Add userscript @match entries for the website.
  // - Add one SOURCE_REGISTRY entry with identity, host matching, export metadata, and canonical fields.
  // - Add site-specific page detection, scraping, parser, and payload-normalization functions.
  // - Wire formats with configureSourceDescriptor(..., { formats }) after the builders/parsers exist.
  // - Wire runtime with configureSourceDescriptor(..., { runtime }) after the export functions exist.
  // - Prefer registry helpers over direct sourceWebsite string checks in shared code.
  // - Add descriptor diagnostics for host matching, format builders, runtime mapping, and required fields.
  const DEFAULT_SOURCE_ID = 'backloggd';
  const DEFAULT_SOURCE_UI = {
    hostClass: 'bgd-host-mobygames',
    hasStatusConfiguration: true,
    metadataLabel: 'Advanced',
    platformOptions: false,
  };
  const SOURCE_REGISTRY = {
    backloggd: {
      id: 'backloggd',
      label: 'Backloggd',
      sourceWebsite: 'Backloggd',
      converterMode: 'backloggd',
      match: {
        hostPattern: 'backloggd.com',
        hostRegex: /^(?:www\.)?backloggd\.com$/i,
      },
      export: {
        filenameSuffix: 'backloggd-library',
        optionKeys: ['includeGenres', 'includePlatforms', 'includePlatforms226', 'includeOfflineCovers'],
      },
      ui: {
        ...DEFAULT_SOURCE_UI,
        hostClass: 'bgd-host-backloggd bgd-host-mobygames',
        hasStatusConfiguration: false,
        metadataLabel: 'Genres',
        platformOptions: true,
      },
      statusConfig: null,
      media: {
        offlineCovers: {
          enabled: true,
          label: 'Offline Covers',
          options: {},
        },
      },
      fields: {
        sharedItemFields: ['title', 'url', 'cover_url', 'status', 'statuses', 'release_date', 'genres', 'platforms', 'user_rating', 'average_rating'],
        sourceMetaFields: ['game_id', 'play_type'],
        preserveSourceMetaFieldsOnItems: true,
      },
      formats: null,
      runtime: null,
    },
    mobygames: {
      id: 'mobygames',
      label: 'MobyGames',
      sourceWebsite: 'MobyGames',
      converterMode: 'mobygames',
      match: {
        hostPattern: 'mobygames.com',
        hostRegex: /^(?:www\.)?mobygames\.com$/i,
      },
      export: {
        filenameSuffix: 'mobygames-library',
        optionKeys: ['includeEnhancedMetadata', 'includeOfflineCovers'],
      },
      ui: {
        ...DEFAULT_SOURCE_UI,
      },
      statusConfig: null,
      media: {
        offlineCovers: {
          enabled: true,
          label: 'Offline Covers',
          options: {
            coverUrlKeys: ['cover_url', 'coverUrl'],
            originalCoverUrlKeys: ['original_cover_url', 'originalCoverUrl'],
            preserveOrientation: true,
            portraitWidth: 48,
            portraitHeight: 72,
            landscapeWidth: 72,
            landscapeHeight: 48,
            resizeMode: 'stretch',
            quality: 0.78,
          },
        },
      },
      fields: {
        sharedItemFields: ['title', 'url', 'cover_url', 'status', 'statuses', 'release_date', 'genres', 'platforms', 'user_rating', 'average_rating'],
        sourceMetaFields: ['collection', 'collections', 'collection_url', 'collection_urls', 'gameplay', 'release_year', 'full_release_date', 'status_ids', 'status_color'],
        preserveSourceMetaFieldsOnItems: false,
      },
      formats: null,
      runtime: null,
    },
    howlongtobeat: {
      id: 'howlongtobeat',
      label: 'HowLongToBeat',
      sourceWebsite: 'HowLongToBeat',
      converterMode: 'howlongtobeat',
      match: {
        hostPattern: 'howlongtobeat.com',
        hostRegex: /^(?:www\.)?howlongtobeat\.com$/i,
      },
      export: {
        filenameSuffix: 'howlongtobeat-library',
        optionKeys: ['includeEnhancedMetadata', 'includeOfflineCovers'],
      },
      ui: {
        ...DEFAULT_SOURCE_UI,
        hostClass: 'bgd-host-howlongtobeat bgd-host-mobygames',
      },
      statusConfig: null,
      media: {
        offlineCovers: {
          enabled: true,
          label: 'Offline Covers',
          options: {
            coverUrlKeys: ['cover_url', 'coverUrl'],
            originalCoverUrlKeys: ['original_cover_url', 'originalCoverUrl'],
            preserveOrientation: false,
            quality: 0.82,
          },
        },
      },
      fields: {
        sharedItemFields: ['title', 'url', 'cover_url', 'status', 'statuses', 'release_date', 'genres', 'platforms', 'user_rating', 'average_rating'],
        sourceMetaFields: ['category', 'categories', 'category_url', 'category_urls', 'status_ids', 'status_color'],
        preserveSourceMetaFieldsOnItems: false,
      },
      formats: null,
      runtime: null,
    },
  };

  function getDefaultSourceDescriptor() {
    return SOURCE_REGISTRY[DEFAULT_SOURCE_ID];
  }

  function getSourceDescriptorById(sourceId = DEFAULT_SOURCE_ID) {
    const normalizedId = String(sourceId || DEFAULT_SOURCE_ID).toLowerCase();
    return SOURCE_REGISTRY[normalizedId]
      || Object.values(SOURCE_REGISTRY).find(source => source.id === normalizedId || source.converterMode === normalizedId)
      || getDefaultSourceDescriptor();
  }

  function getSourceDescriptorForHost(hostname = location.hostname) {
    const normalizedHost = String(hostname || '');
    return Object.values(SOURCE_REGISTRY).find(source => source.match.hostRegex.test(normalizedHost))
      || getDefaultSourceDescriptor();
  }

  function getSourceDescriptorByWebsite(sourceWebsite) {
    const normalizedWebsite = String(sourceWebsite || '').toLowerCase();
    return Object.values(SOURCE_REGISTRY).find(source => source.sourceWebsite.toLowerCase() === normalizedWebsite)
      || getDefaultSourceDescriptor();
  }

  function getSourceWebsite(sourceId = DEFAULT_SOURCE_ID) {
    return getSourceDescriptorById(sourceId).sourceWebsite;
  }

  function isSourceWebsite(sourceWebsite, sourceId) {
    if (!sourceWebsite) return false;
    return getSourceDescriptorByWebsite(sourceWebsite).id === getSourceDescriptorById(sourceId).id;
  }

  function getSourceUiDescriptorForHost(hostname = location.hostname) {
    return {
      ...DEFAULT_SOURCE_UI,
      ...(getSourceDescriptorForHost(hostname).ui || {}),
    };
  }

  function getSourceStatusConfigDescriptorForHost(hostname = location.hostname) {
    return getSourceDescriptorForHost(hostname).statusConfig || null;
  }

  function getSourceOfflineCoverOptions(sourceId = DEFAULT_SOURCE_ID) {
    const source = getSourceDescriptorById(sourceId);
    return (source.media && source.media.offlineCovers && source.media.offlineCovers.options) || {};
  }

  function configureSourceDescriptor(sourceId, sections) {
    const source = SOURCE_REGISTRY[sourceId];
    if (!source) throw new Error(`Unknown source registry id: ${sourceId}`);
    Object.assign(source, sections);
    return source;
  }

  function getSourceFormatDescriptor(converterMode = DEFAULT_SOURCE_ID) {
    const source = getSourceDescriptorById(converterMode);
    if (!source.formats) throw new Error(`Source format registry is not configured for ${source.id}.`);
    return source.formats;
  }

  function getSourceRuntimeDescriptorForHost(hostname = location.hostname) {
    const source = getSourceDescriptorForHost(hostname);
    if (!source.runtime) throw new Error(`Source runtime registry is not configured for ${source.id}.`);
    return source.runtime;
  }

  function sourceLabelForWebsite(sourceWebsite) {
    return getSourceDescriptorByWebsite(sourceWebsite).label;
  }

  const STATUS_PILL_CONFIG_STORAGE_KEY = 'bgdMobyStatusPillConfig';
  const PENDING_NAV_MESSAGE_KEY = 'bgdPendingNavMessage';
  const MOBYGAMES_EXPORT_STATE_KEY = 'bgdMobyGamesExportState';
  const HLTB_STATUS_PILL_CONFIG_STORAGE_KEY = 'bgdHowLongToBeatStatusPillConfig';
  const HLTB_EXPORT_STATE_KEY = 'bgdHowLongToBeatExportState';
  const STATUS_PILL_SLOT_COUNT = 4;
  const MOBYGAMES_COLLECTION_CACHE_TTL_MS = 5 * 60 * 1000;
  const STATUS_PILL_SOURCE_DEFS = {
    played:    { label: 'Played',    type: 'play_type', value: 'played',    color: PLAY_TYPE_COLORS.played },
    completed: { label: 'Completed', type: 'play_type', value: 'completed', color: PLAY_TYPE_COLORS.completed },
    retired:   { label: 'Retired',   type: 'play_type', value: 'retired',   color: PLAY_TYPE_COLORS.retired },
    shelved:   { label: 'Shelved',   type: 'play_type', value: 'shelved',   color: PLAY_TYPE_COLORS.shelved },
    abandoned: { label: 'Abandoned', type: 'play_type', value: 'abandoned', color: PLAY_TYPE_COLORS.abandoned },
    playing:   { label: 'Playing',   type: 'status',    value: 'playing',   color: STATUS_COLORS.playing },
    backlog:   { label: 'Backlog',   type: 'status',    value: 'backlog',   color: STATUS_COLORS.backlog },
    wishlist:  { label: 'Wishlist',  type: 'status',    value: 'wishlist',  color: STATUS_COLORS.wishlist },
  };

  function makeDefaultStatusPillConfig() {
    return {
      categories: [
        {
          id: 'cat-played',
          label: 'Group 1',
          pills: [
            { id: 'agg-played-total', kind: 'aggregate', label: 'Played Total', sources: ['played', 'completed', 'retired', 'shelved', 'abandoned'] },
            { id: 'played', kind: 'status', label: 'Played', color: PLAY_TYPE_COLORS.played, source: { type: 'play_type', value: 'played' } },
            { id: 'completed', kind: 'status', label: 'Completed', color: PLAY_TYPE_COLORS.completed, source: { type: 'play_type', value: 'completed' } },
          ],
        },
        {
          id: 'cat-retired',
          label: 'Group 2',
          pills: [
            { id: 'retired', kind: 'status', label: 'Retired', color: PLAY_TYPE_COLORS.retired, source: { type: 'play_type', value: 'retired' } },
            { id: 'shelved', kind: 'status', label: 'Shelved', color: PLAY_TYPE_COLORS.shelved, source: { type: 'play_type', value: 'shelved' } },
            { id: 'abandoned', kind: 'status', label: 'Abandoned', color: PLAY_TYPE_COLORS.abandoned, source: { type: 'play_type', value: 'abandoned' } },
          ],
        },
        {
          id: 'cat-queue',
          label: 'Group 3',
          pills: [
            { id: 'agg-queue', kind: 'aggregate', label: 'Queue', sources: ['playing', 'backlog', 'wishlist'] },
            { id: 'playing', kind: 'status', label: 'Playing', color: STATUS_COLORS.playing, source: { type: 'status', value: 'playing' } },
            { id: 'backlog', kind: 'status', label: 'Backlog', color: STATUS_COLORS.backlog, source: { type: 'status', value: 'backlog' } },
            { id: 'wishlist', kind: 'status', label: 'Wishlist', color: STATUS_COLORS.wishlist, source: { type: 'status', value: 'wishlist' } },
          ],
        },
      ],
    };
  }

  function cloneStatusPillConfig(config) {
    return JSON.parse(JSON.stringify(config || makeDefaultStatusPillConfig()));
  }

  // -- Purely event-driven SPA-aware initialisation ---
  //
  // Backloggd is a Turbolinks / Hotwire Turbo Drive SPA.  Every in-app
  // navigation follows this sequence:
  //
  //   1. A History API call (pushState OR replaceState) updates the URL.
  //   2. The framework fetches the next page over the network.
  //   3. It replaces <body> (or a large sub-tree) with the new markup.
  //
  // We hook all three stages with no timers and no polling:
  //
  //  A) pushState / replaceState patch
  //     Both History API methods are wrapped so we record that a navigation
  //     is in flight.  We do NOT call onNavigate() here - the DOM still
  //     shows the old page at this point.
  //
  //  B) popstate event
  //     Fires on browser back/forward.  Same idea: mark navigation in flight.
  //
  //  C) MutationObserver - structural landmark detection
  //     Watches <html> for childList changes.  Instead of firing on every
  //     mutation (too noisy) it looks for the addition of a known stable
  //     landmark that Backloggd always renders on every page:
  //       #navbarDropdown - the logged-in-user navbar link
  //     When that node appears in a mutation batch it means the new page's
  //     DOM is sufficiently ready, so we call onNavigate().
  //
  //     For navigations that do NOT replace the navbar (e.g. content-only
  //     swaps within the same layout shell) we watch for the addition of
  //     the main content wrapper instead:
  //       #main-content, main, [data-turbo-permanent], body
  //     Any direct child of <html> being replaced also triggers a check.
  //
  //  D) Framework lifecycle events (belt-and-suspenders)
  //     turbolinks:load and turbo:load both fire after the new page is
  //     fully rendered.  We handle them if present.
  //
  //  E) DOMContentLoaded / immediate call
  //     Covers the initial hard page load.
  //
  // onNavigate() is idempotent - safe to call any number of times.
  //
  // -- Username detection ---
  //
  // The export target slug comes from the URL path (/u/<slug>).
  // The logged-in user's name is read from the navbar element on every page:
  //   <a id="navbarDropdown">USERNAME<i ...></i></a>

  let userSlug = '';
  let exportTargetSlug = '';
  let panel, minimizeBtn, restoreBtn, exportBtn, configBtn, diagnosticsBtn, runControls, pauseExportBtn, stopExportBtn,
      chkCsv, chkJson, chkHtml, fileChangeNote, versionNotice,
      converterBtn, converterPanel, converterCloseBtn, converterRunBtn, converterFileInput,
      chkGenres, chkOfflineCovers, chkPlatforms, chkPlatforms226, log, fill;
  let statusPillConfig = makeDefaultStatusPillConfig();
  let statusPillConfigModal = null;
  let mobyGamesCollectionCache = null;
  let mobyGamesCollectionLastDebug = null;
  let hltbPreflightCategories = null;
  let hltbPreflightData = null;
  let hltbPreflightInProgress = false;
  let logUpdateLines = new Map();
  let panelCleanupFns = [];
  let exportInProgress = false;
  let exportCancelRequested = false;
  let exportPauseRequested = false;
  let exportPauseResolver = null;
  let exportPausedStartedAt = 0;
  let exportPausedTotalMs = 0;
  let exportPriorElapsedMs = 0;
  let exportStopMessageShown = false;
  const activeExportFetchControllers = new Set();
  let exportStartFileFormatSignature = '';
  let fileChangeNoteTimer = null;
  let configButtonDisabledTimer = null;

  // ---------------------------------------------------------------------------
  // 2. Navigation and panel lifecycle
  // ---------------------------------------------------------------------------

  // -- Core: inject or remove the panel based on the current URL ---
  function setUserSlug(slug) {
    userSlug = slug;
    if (panel) {
      const titleSlug = panel.querySelector('.bgd-title span');
      if (titleSlug) titleSlug.textContent = `/u/${slug}`;
    }
  }

  function getExportUserSlug() {
    return exportTargetSlug || userSlug;
  }

  function addPanelCleanup(fn) {
    panelCleanupFns.push(fn);
  }

  function cleanupPanel({ removeDom = true } = {}) {
    while (panelCleanupFns.length) {
      const cleanup = panelCleanupFns.pop();
      try {
        cleanup();
      } catch (_) {}
    }
    if (fileChangeNoteTimer) {
      clearTimeout(fileChangeNoteTimer);
      fileChangeNoteTimer = null;
    }
    if (configButtonDisabledTimer) {
      clearTimeout(configButtonDisabledTimer);
      configButtonDisabledTimer = null;
    }
    const root = panel || document.getElementById(EXPORTER_ID);
    if (removeDom && root) root.remove();
    panel = null;
  }

  function onNavigate() {
    const slug = getUserSlug();

    if (!slug) {
      // Navigated away from an exportable profile/library page - tear down the panel if present.
      cleanupPanel();
      userSlug = '';
      return;
    }

    // Clean up a detached reference left over from a body swap.
    if (panel && !document.body.contains(panel)) cleanupPanel({ removeDom: false });

    // Already live - keep the target profile in sync for content-only SPA swaps.
    if (panel) {
      if (userSlug !== slug) setUserSlug(slug);
      return;
    }
    if (document.getElementById(EXPORTER_ID)) {
      setUserSlug(slug);
      return;
    }
    if (!document.body) return;

    setUserSlug(slug);
    initPanel();
  }

  // -- A + B) Patch pushState, replaceState, and listen for popstate ---
  //
  // These fire at the START of navigation (URL changes but DOM is still old).
  // We cannot call onNavigate() here.  Instead we use them as a signal to
  // arm the MutationObserver so it knows a navigation is in progress and
  // should call onNavigate() on the next meaningful structural mutation.
  //
  // For popstate (back/forward) the browser itself handles the DOM restoration
  // and fires the event after the cached page is restored, so we CAN call
  // onNavigate() directly there - but only after the current call stack
  // unwinds (queueMicrotask ensures we read the already-updated DOM).

  let navPending = false;

  function onHistoryApiCall() {
    // URL has changed; flag that we are waiting for the DOM to catch up.
    navPending = true;
    // Also call onNavigate immediately - if the body is already updated
    // (e.g. bfcache restore) this handles it; if not, the MutationObserver
    // will call it once the DOM is ready.
    queueMicrotask(onNavigate);
  }

  (function patchHistoryApi() {
    const origPush    = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = function (...args) {
      origPush(...args);
      onHistoryApiCall();
    };
    history.replaceState = function (...args) {
      origReplace(...args);
      onHistoryApiCall();
    };
  })();

  window.addEventListener('popstate', () => {
    queueMicrotask(onNavigate);
  });

  // MutationObserver: fires when the new page's DOM is ready.
  //
  // Backloggd can replace <body> during Turbo/Turbolinks navigation, and it can
  // also update content inside the existing layout. A single subtree observer on
  // <html> handles both cases while the filter below ignores unrelated mutations.
  //
  // Readiness signals:
  // - direct <html> child changes, which catch body swaps
  // - #navbarDropdown, #main-content, or [data-turbo-permanent] insertions

  function isPageReadyMutation(mutations) {
    for (const m of mutations) {
      // <body> itself was added/replaced - new page DOM is live.
      if (m.target === document.documentElement) return true;
      // A known page-ready landmark was inserted anywhere in the tree.
      for (const node of m.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.id === 'navbarDropdown') return true;
        if (node.querySelector && node.querySelector('#navbarDropdown, #main-content, [data-turbo-permanent]')) return true;
      }
    }
    return false;
  }

  const observer = new MutationObserver((mutations) => {
    if (!navPending && !isPageReadyMutation(mutations)) return;
    navPending = false;
    onNavigate();
  });

  function startObserver() {
    // Watch <html> and its subtree for body swaps and landmark insertions.
    // attributes:false and characterData:false keep this cheap.
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // -- D) Framework lifecycle events ---
  document.addEventListener('turbolinks:load', onNavigate);
  document.addEventListener('turbo:load',      onNavigate);
  document.addEventListener('turbo:render',    onNavigate);

  // -- E) Initial page load ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startObserver();
      onNavigate();
    }, { once: true });
  } else {
    startObserver();
    onNavigate();
  }

  // ---------------------------------------------------------------------------
  // 3. Exporter panel UI
  // ---------------------------------------------------------------------------

  function initPanel() {

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #${EXPORTER_ID} {
        position: fixed;
        top: 86px;
        right: 18px;
        z-index: 99999;
        width: min(360px, calc(100vw - 28px));
        color: #eaf4ff;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        font-size: 12px;
        line-height: 1.35;
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
        isolation: isolate;
      }

      #${EXPORTER_ID},
      #${EXPORTER_ID} * {
        box-sizing: border-box;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        font-style: normal !important;
        font-variant-ligatures: normal !important;
        font-variant-caps: normal !important;
        font-variant-east-asian: normal !important;
        font-variant-position: normal !important;
        text-shadow: none !important;
        text-decoration: none !important;
      }

      #${EXPORTER_ID} button,
      #${EXPORTER_ID} input {
        font-family: inherit !important;
        margin: 0;
        letter-spacing: 0 !important;
        text-transform: none !important;
      }

      #${EXPORTER_ID} button {
        appearance: none;
        -webkit-appearance: none;
        border-style: solid;
      }

      #${EXPORTER_ID} .bgd-panel {
        border: 1px solid rgba(125, 211, 252, 0.34);
        border-radius: 18px;
        background:
          linear-gradient(145deg, rgba(10, 16, 30, 0.92), rgba(18, 24, 42, 0.86)),
          radial-gradient(circle at 20% 0%, rgba(47, 141, 247, 0.34), transparent 36%);
        box-shadow:
          0 22px 70px rgba(0, 0, 0, 0.38),
          inset 0 1px 0 rgba(255, 255, 255, 0.10);
        overflow: hidden;
        backdrop-filter: blur(16px) saturate(1.25);
      }

      #${EXPORTER_ID} .bgd-top {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 14px 10px;
      }

      #${EXPORTER_ID} .bgd-top-row {
        display: flex;
        align-items: stretch;
        justify-content: space-between;
        gap: 10px;
      }

      #${EXPORTER_ID} .bgd-title {
        min-width: 0;
      }

      #${EXPORTER_ID} .bgd-title-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        margin-top: 3px;
      }

      #${EXPORTER_ID} .bgd-title strong {
        display: block;
        font-size: 13px !important;
        font-weight: 900 !important;
        line-height: 1.2 !important;
        letter-spacing: 0.08em !important;
        text-transform: uppercase !important;
        color: #b9e6ff;
      }

      #${EXPORTER_ID} .bgd-title span {
        display: block;
        color: rgba(234, 244, 255, 0.72);
        font-size: 12px !important;
        font-weight: 700 !important;
        line-height: 1.25 !important;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #${EXPORTER_ID} .bgd-diagnostics-button {
        border: 1px solid rgba(167, 243, 208, 0.34);
        border-radius: 8px;
        height: 20px;
        padding: 0 8px;
        color: rgba(167, 243, 208, 0.92);
        cursor: pointer;
        font-size: 10px !important;
        font-weight: 900 !important;
        line-height: 1 !important;
        letter-spacing: 0 !important;
        text-transform: uppercase !important;
        background: rgba(167, 243, 208, 0.10);
        flex-shrink: 0;
      }

      #${EXPORTER_ID} .bgd-window-controls {
        position: relative;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
        align-self: flex-start;
        margin-top: -8px;
      }

      #${EXPORTER_ID} .bgd-minimize-button {
        border: 1px solid rgba(167, 243, 208, 0.42);
        border-radius: 8px;
        height: 20px;
        padding: 0 11px;
        color: rgba(234, 244, 255, 0.92);
        cursor: pointer;
        font-size: 0 !important;
        font-weight: 900 !important;
        line-height: 1 !important;
        letter-spacing: 0 !important;
        text-transform: none !important;
        white-space: nowrap;
        background: rgba(167, 243, 208, 0.12);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
        align-self: center;
        min-width: unset;
        width: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      #${EXPORTER_ID} .bgd-github-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(125, 211, 252, 0.38);
        border-radius: 50%;
        width: 34px;
        min-width: 34px;
        flex: 0 0 34px;
        height: 34px;
        align-self: center;
        box-sizing: border-box;
        padding: 0;
        color: #b9e6ff;
        cursor: pointer;
        line-height: 0;
        text-decoration: none;
        background: rgba(125, 211, 252, 0.10);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
      }

      #${EXPORTER_ID} .bgd-github-button svg {
        width: 18px;
        height: 18px;
        fill: currentColor;
        display: block;
      }

      #${EXPORTER_ID} .bgd-btn-icon {
        display: block;
        width: 12px;
        height: 12px;
        flex-shrink: 0;
        overflow: visible;
      }

      #${EXPORTER_ID} .bgd-config-button .bgd-btn-icon {
        width: 16px;
        height: 16px;
      }

      #${EXPORTER_ID} .bgd-export-button {
        position: relative;
        border: 0;
        border-radius: 10px;
        padding: 0 20px;
        color: #1d2630;
        cursor: pointer;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        font-weight: 950 !important;
        font-size: 15px !important;
        text-align: center;
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
        -webkit-text-stroke: 0;
        text-shadow:
          0 1px 0 rgba(255, 255, 255, 0.22),
          0 -1px 0 rgba(6, 16, 31, 0.22) !important;
        letter-spacing: 0.01em !important;
        background: linear-gradient(135deg, #7dd3fc, #a7f3d0 55%, #fef08a);
        -webkit-text-fill-color: #1d2630;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.28), 0 8px 22px rgba(47, 141, 247, 0.30);
        transition: transform 0.16s ease, filter 0.16s ease, opacity 0.16s ease;
        line-height: 1 !important;
        text-transform: none !important;
        white-space: nowrap;
        flex-shrink: 0;
        align-self: stretch;
        min-width: 68px;
        overflow: hidden;
      }


      #${EXPORTER_ID} .bgd-export-wait {
        display: none;
      }

      #${EXPORTER_ID}.bgd-hltb-preflight-running .bgd-export-button {
        opacity: 0.72;
        cursor: wait;
      }

      #${EXPORTER_ID} .bgd-run-controls {
        display: flex;
        align-self: stretch;
        flex-shrink: 0;
        min-width: 84px;
        width: 84px;
        border-radius: 10px;
        overflow: hidden;
        background: linear-gradient(135deg, #7dd3fc, #a7f3d0 55%, #fef08a);
        box-shadow: 0 0 0 1px rgba(255,255,255,0.28), 0 8px 22px rgba(47, 141, 247, 0.30);
      }

      #${EXPORTER_ID} .bgd-run-controls[hidden] {
        display: none !important;
      }

      #${EXPORTER_ID} .bgd-run-control-button {
        flex: 1 1 50%;
        min-width: 0;
        border: 0;
        border-right: 1px solid rgba(6, 16, 31, 0.26);
        padding: 0;
        color: #06101f;
        cursor: pointer;
        font-size: 15px;
        font-weight: 900;
        line-height: 1;
        text-align: center;
        background: transparent;
        transition: filter 0.16s ease, opacity 0.16s ease, background 0.16s ease;
      }

      #${EXPORTER_ID} .bgd-run-control-button:last-child {
        border-right: 0;
      }

      #${EXPORTER_ID} .bgd-run-control-button:hover {
        background: rgba(255, 255, 255, 0.16);
        filter: brightness(1.04);
      }

      #${EXPORTER_ID} .bgd-run-control-button:disabled {
        opacity: 0.48;
        cursor: wait;
      }

      #${EXPORTER_ID} .bgd-run-icon {
        position: relative;
        display: inline-block;
        width: 16px;
        height: 16px;
        flex: 0 0 auto;
      }

      #${EXPORTER_ID} .bgd-run-icon-pause::before,
      #${EXPORTER_ID} .bgd-run-icon-pause::after {
        content: '';
        position: absolute;
        top: 2px;
        bottom: 2px;
        width: 4px;
        border-radius: 1px;
        background: #06101f;
      }

      #${EXPORTER_ID} .bgd-run-icon-pause::before {
        left: 3px;
      }

      #${EXPORTER_ID} .bgd-run-icon-pause::after {
        right: 3px;
      }

      #${EXPORTER_ID} .bgd-run-icon-play {
        display: none;
      }

      #${EXPORTER_ID} .bgd-run-icon-play::before {
        content: '';
        position: absolute;
        left: 4px;
        top: 2px;
        width: 0;
        height: 0;
        border-top: 6px solid transparent;
        border-bottom: 6px solid transparent;
        border-left: 10px solid #06101f;
      }

      #${EXPORTER_ID} .bgd-run-control-toggle.is-resume .bgd-run-icon-pause {
        display: none;
      }

      #${EXPORTER_ID} .bgd-run-control-toggle.is-resume .bgd-run-icon-play {
        display: inline-block;
      }

      #${EXPORTER_ID} .bgd-run-icon-stop::before {
        content: '';
        position: absolute;
        left: 4px;
        top: 4px;
        width: 8px;
        height: 8px;
        border-radius: 1px;
        background: #06101f;
      }

      #${EXPORTER_ID} .bgd-version-notice {
        display: none;
        position: absolute;
        align-items: center;
        height: 20px;
        box-sizing: border-box;
        padding: 0 8px;
        border: 1px solid rgba(253, 224, 71, 0.42);
        border-radius: 8px;
        background: rgba(253, 224, 71, 0.12);
        color: rgba(253, 224, 71, 0.98);
        font-size: 10px;
        font-weight: 900;
        line-height: 1;
        letter-spacing: 0 !important;
        text-transform: uppercase !important;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 8px 24px rgba(253, 224, 71, 0.14);
        pointer-events: none;
        flex-shrink: 0;
      }

      #${EXPORTER_ID} .bgd-version-notice.is-visible {
        display: inline-flex;
        z-index: 1;
      }

      #${EXPORTER_ID} .bgd-actions {
        display: flex;
        flex-direction: column;
        gap: 0;
        min-width: 0;
      }

      #${EXPORTER_ID} .bgd-checks {
        display: flex;
        flex-direction: column;
        gap: 6px;
        position: relative;
      }

      #${EXPORTER_ID} .bgd-checks-row {
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      #${EXPORTER_ID} .bgd-col-label {
        position: relative;
        font-size: 10px !important;
        font-weight: 800 !important;
        line-height: 1.2 !important;
        letter-spacing: 0.10em !important;
        text-transform: uppercase !important;
        color: rgba(125, 211, 252, 0.7);
        padding-bottom: 3px;
        border-bottom: 1px solid rgba(125, 211, 252, 0.18);
        margin-bottom: 3px;
      }

      #${EXPORTER_ID} .bgd-files-label {
        padding-right: 178px;
      }

      #${EXPORTER_ID} .bgd-files-controls {
        position: absolute;
        right: 0;
        bottom: 6px;
        display: inline-flex;
        align-items: stretch;
        gap: 8px;
      }

      #${EXPORTER_ID} .bgd-config-button {
        border: 1px solid rgba(125, 211, 252, 0.38);
        border-radius: 10px;
        width: 34px;
        min-width: 34px;
        padding: 0;
        color: #b9e6ff;
        cursor: pointer;
        font-size: 18px !important;
        line-height: 1 !important;
        background: rgba(125, 211, 252, 0.10);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: static;
        height: auto;
        bottom: auto;
        right: auto;
        letter-spacing: 0 !important;
        text-transform: none !important;
        white-space: nowrap;
        align-self: stretch;
      }

      #${EXPORTER_ID} .bgd-chk-items {
        display: flex;
        flex-wrap: nowrap;
        gap: 3px 6px;
        align-items: center;
        justify-content: flex-start;
      }

      #${EXPORTER_ID} .bgd-tag-lines {
        display: flex;
        flex-direction: column;
        gap: 2px;
        align-items: flex-start;
      }

      #${EXPORTER_ID} .bgd-tag-line {
        display: flex;
        flex-wrap: nowrap;
        gap: 3px 6px;
        align-items: center;
        justify-content: flex-start;
      }

      #${EXPORTER_ID} .bgd-file-format-items {
        min-height: 24px;
        box-sizing: border-box;
        padding-right: 142px;
      }

      #${EXPORTER_ID} .bgd-format-note-anchor {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      #${EXPORTER_ID} .bgd-chk {
        display: flex;
        align-items: center;
        gap: 4px;
        color: rgba(234,244,255,0.85);
        font-size: 12px !important;
        font-weight: 700 !important;
        line-height: 1.25 !important;
        cursor: pointer;
        user-select: none;
        padding: 1px 0;
        white-space: nowrap;
      }

      #${EXPORTER_ID} .bgd-chk input[type="checkbox"] {
        appearance: none;
        -webkit-appearance: none;
        position: relative;
        display: inline-block;
        width: 16px;
        height: 16px;
        margin: 0;
        border: 1px solid rgba(234, 244, 255, 0.58);
        border-radius: 3px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: inset 0 1px 1px rgba(6, 16, 31, 0.20);
        cursor: pointer;
        flex-shrink: 0;
      }

      #${EXPORTER_ID} .bgd-chk input[type="checkbox"]::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 45%;
        width: 5px;
        height: 9px;
        border: solid #082033;
        border-width: 0 2.5px 2.5px 0;
        opacity: 0;
        transform: translate(-50%, -50%) rotate(45deg);
      }

      #${EXPORTER_ID} .bgd-chk input[type="checkbox"]:checked {
        border-color: rgba(125, 211, 252, 0.98);
        background: #7dd3fc;
      }

      #${EXPORTER_ID} .bgd-chk input[type="checkbox"]:checked::after {
        opacity: 1;
      }

      #${EXPORTER_ID} .bgd-chk-basic {
        color: rgba(234,244,255,0.85);
        cursor: default;
        pointer-events: none;
      }

      #${EXPORTER_ID} .bgd-chk-basic input[type="checkbox"] {
        border-color: rgba(170, 174, 184, 0.72);
        background: #8f939b;
        cursor: default;
      }

      #${EXPORTER_ID} .bgd-chk-basic input[type="checkbox"]::after {
        border-color: rgba(245, 247, 250, 0.92);
      }

      #${EXPORTER_ID} .bgd-chk-basic input[type="checkbox"]:checked {
        border-color: rgba(170, 174, 184, 0.72);
        background: #8f939b;
      }

      #${EXPORTER_ID}.bgd-host-mobygames .bgd-chk-basic input[type="checkbox"] {
        filter: none;
        opacity: 1;
      }

      #${EXPORTER_ID} .bgd-chk-opt {
        color: rgba(234,244,255,0.85);
      }

      #${EXPORTER_ID} .bgd-converter-button {
        position: absolute;
        right: 0;
        top: 25px;
        border: 1px solid rgba(167, 243, 208, 0.42);
        border-radius: 999px;
        height: 30px;
        padding: 0 14px;
        color: rgba(234, 244, 255, 0.92);
        cursor: pointer;
        font-size: 11px !important;
        font-weight: 900 !important;
        line-height: 1 !important;
        letter-spacing: 0 !important;
        text-transform: uppercase !important;
        white-space: nowrap;
        text-align: center;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        align-self: center;
        background: rgba(167, 243, 208, 0.12);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
      }

      #${EXPORTER_ID} .bgd-converter-button:hover,
      #${EXPORTER_ID} .bgd-converter-button.open {
        transform: translateY(-1px);
        border-color: rgba(167, 243, 208, 0.72);
        background: rgba(167, 243, 208, 0.18);
      }

      #${EXPORTER_ID} .bgd-converter-panel {
        position: fixed;
        z-index: 100000;
        width: min(312px, calc(100vw - 20px));
        box-sizing: border-box;
        padding: 10px;
        border: 1px solid rgba(125, 211, 252, 0.38);
        border-radius: 12px;
        background:
          linear-gradient(145deg, rgba(10, 16, 30, 0.98), rgba(18, 24, 42, 0.96)),
          radial-gradient(circle at 20% 0%, rgba(47, 141, 247, 0.24), transparent 38%);
        box-shadow: 0 18px 42px rgba(0, 0, 0, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.10);
        color: #eaf4ff;
        backdrop-filter: blur(14px) saturate(1.2);
      }

      #${EXPORTER_ID} .bgd-converter-panel[hidden] {
        display: none !important;
      }

      #${EXPORTER_ID} .bgd-converter-close {
        position: absolute;
        top: 6px;
        right: 6px;
        border: 0;
        border-radius: 7px;
        width: 21px;
        height: 21px;
        color: rgba(234, 244, 255, 0.72);
        cursor: pointer;
        font-size: 14px;
        font-weight: 900;
        line-height: 1;
        background: rgba(125, 211, 252, 0.10);
      }

      #${EXPORTER_ID} .bgd-converter-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 9px;
        padding-right: 18px;
      }

      #${EXPORTER_ID} .bgd-converter-heading {
        margin-bottom: 6px;
        padding-bottom: 4px;
        border-bottom: 1px solid rgba(125, 211, 252, 0.18);
        color: rgba(125, 211, 252, 0.78);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      #${EXPORTER_ID} .bgd-converter-choice-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 23px;
      }

      #${EXPORTER_ID} .bgd-converter-choice {
        display: flex;
        align-items: center;
        gap: 5px;
        min-height: 23px;
        color: rgba(234, 244, 255, 0.88);
        cursor: pointer;
        font-size: 12px;
        font-weight: 800;
        white-space: nowrap;
      }

      #${EXPORTER_ID} .bgd-converter-choice input {
        appearance: none;
        -webkit-appearance: none;
        position: relative;
        display: inline-block;
        width: 16px;
        height: 16px;
        margin: 0;
        border: 1px solid rgba(234, 244, 255, 0.58);
        background: rgba(255, 255, 255, 0.96);
        box-shadow: inset 0 1px 1px rgba(6, 16, 31, 0.20);
        flex-shrink: 0;
      }

      #${EXPORTER_ID} .bgd-converter-choice input[type="radio"] {
        border-radius: 50%;
      }

      #${EXPORTER_ID} .bgd-converter-choice input[type="checkbox"] {
        border-radius: 3px;
      }

      #${EXPORTER_ID} .bgd-converter-choice input[type="radio"]:checked {
        border-color: rgba(125, 211, 252, 0.98);
        background:
          radial-gradient(circle at center, #1a3a52 0 26%, transparent 32%),
          #7dd3fc;
      }

      #${EXPORTER_ID} .bgd-converter-choice input[type="checkbox"]::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 45%;
        width: 5px;
        height: 9px;
        border: solid #082033;
        border-width: 0 2.5px 2.5px 0;
        opacity: 0;
        transform: translate(-50%, -50%) rotate(45deg);
      }

      #${EXPORTER_ID} .bgd-converter-choice input[type="checkbox"]:checked {
        border-color: rgba(125, 211, 252, 0.98);
        background: #7dd3fc;
      }

      #${EXPORTER_ID} .bgd-converter-choice input[type="checkbox"]:checked::after {
        opacity: 1;
      }

      #${EXPORTER_ID} .bgd-converter-choice:has(input:disabled) {
        opacity: 0.52;
        cursor: default;
      }

      #${EXPORTER_ID} .bgd-converter-inline-option {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: rgba(167, 243, 208, 0.9);
        cursor: pointer;
        font-size: 12px;
        font-weight: 800;
        white-space: nowrap;
      }

      #${EXPORTER_ID} .bgd-converter-inline-option input[type="checkbox"] {
        appearance: none;
        -webkit-appearance: none;
        position: relative;
        display: inline-block;
        width: 16px;
        height: 16px;
        margin: 0;
        border: 1px solid rgba(234, 244, 255, 0.58);
        border-radius: 3px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: inset 0 1px 1px rgba(6, 16, 31, 0.20);
        flex-shrink: 0;
      }

      #${EXPORTER_ID} .bgd-converter-inline-option input[type="checkbox"]::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 45%;
        width: 5px;
        height: 9px;
        border: solid #082033;
        border-width: 0 2.5px 2.5px 0;
        opacity: 0;
        transform: translate(-50%, -50%) rotate(45deg);
      }

      #${EXPORTER_ID} .bgd-converter-inline-option input[type="checkbox"]:checked {
        border-color: rgba(125, 211, 252, 0.98);
        background: #7dd3fc;
      }

      #${EXPORTER_ID} .bgd-converter-inline-option input[type="checkbox"]:checked::after {
        opacity: 1;
      }

      #${EXPORTER_ID} .bgd-converter-inline-option:has(input:disabled) {
        opacity: 0.48;
      }

      #${EXPORTER_ID} .bgd-converter-run {
        width: 100%;
        margin-top: 9px;
        border: 0;
        border-radius: 9px;
        padding: 7px 10px;
        color: #06101f;
        cursor: pointer;
        font-size: 12px;
        font-weight: 900;
        background: linear-gradient(135deg, #7dd3fc, #a7f3d0 65%, #fef08a);
        box-shadow: 0 0 0 1px rgba(255,255,255,0.22), 0 8px 18px rgba(47, 141, 247, 0.22);
      }

      #${EXPORTER_ID} .bgd-file-change-note {
        display: none;
        position: absolute;
        top: 23px;
        left: 50%;
        z-index: 1;
        translate: -50% 0;
        margin-left: 0;
        padding: 3px 8px;
        border: 1px solid rgba(253, 224, 71, 0.42);
        border-radius: 999px;
        background: rgba(253, 224, 71, 0.12);
        color: rgba(253, 224, 71, 0.98);
        font-size: 11px;
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
        box-shadow: 0 8px 24px rgba(253, 224, 71, 0.16);
        pointer-events: none;
      }

      #${EXPORTER_ID} .bgd-file-change-note.is-visible {
        display: inline-flex;
        animation: bgd-file-note-pop 1.9s ease forwards;
      }

      @keyframes bgd-file-note-pop {
        0%   { opacity: 0; transform: translateY(5px) scale(0.96); }
        14%  { opacity: 1; transform: translateY(-3px) scale(1); }
        72%  { opacity: 1; transform: translateY(-3px) scale(1); }
        100% { opacity: 0; transform: translateY(-8px) scale(0.98); }
      }

      #${EXPORTER_ID} .bgd-minimize-button:hover {
        transform: translateY(-1px);
        border-color: rgba(167, 243, 208, 0.72);
        background: rgba(167, 243, 208, 0.18);
      }

      #${EXPORTER_ID} .bgd-github-button:hover {
        transform: translateY(-1px);
        border-color: rgba(125, 211, 252, 0.7);
        background: rgba(125, 211, 252, 0.16);
      }

      #${EXPORTER_ID} .bgd-export-button:hover {
        transform: translateY(-1px);
        filter: brightness(1.04);
      }

      #${EXPORTER_ID} .bgd-config-button:hover {
        transform: translateY(-1px);
        border-color: rgba(125, 211, 252, 0.7);
        background: rgba(125, 211, 252, 0.16);
      }

      #${EXPORTER_ID}.bgd-host-mobygames .bgd-config-button.is-disabled {
        opacity: 0.58;
        cursor: not-allowed;
        transform: none;
      }

      #${EXPORTER_ID} .bgd-export-button:disabled {
        opacity: 0.62;
        cursor: wait;
        transform: none;
      }

      #${EXPORTER_ID} .bgd-progress {
        display: none;
        padding: 0 14px 14px;
      }

      #${EXPORTER_ID}.is-active .bgd-progress {
        display: block;
      }

      #${EXPORTER_ID}.bgd-config-open .bgd-panel {
        display: none !important;
      }

      #${EXPORTER_ID}.bgd-config-open {
        width: min(1160px, calc(100vw - 28px));
      }

      @keyframes bgd-shimmer {
        0%   { background-position: -200% center; }
        100% { background-position:  200% center; }
      }

      #${EXPORTER_ID} .bgd-bar {
        height: 8px;
        margin-bottom: 12px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(234, 244, 255, 0.12);
      }

      #${EXPORTER_ID} .bgd-fill {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background-size: 200% 100%;
        background-image: linear-gradient(90deg,
          #2f8df7 0%,
          #9b6cff 30%,
          #e0f0ff 50%,
          #9b6cff 70%,
          #1fbf75 100%
        );
        transition: width 1.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        animation: bgd-shimmer 2.2s linear infinite;
      }

      #${EXPORTER_ID}.is-active .bgd-fill[style*="width: 100"] {
        animation: none;
        transition: width 0.5s ease;
      }

      #${EXPORTER_ID} .bgd-log {
        display: grid;
        gap: 7px;
        max-height: 230px;
        overflow: auto;
        padding-right: 3px;
      }

      #${EXPORTER_ID} .bgd-log-line {
        display: grid;
        grid-template-columns: 8px 1fr;
        gap: 8px;
        align-items: start;
        color: rgba(234, 244, 255, 0.78);
        font-size: 12px;
        line-height: 1.35;
      }

      #${EXPORTER_ID} .bgd-log-line::before {
        content: "";
        width: 7px;
        height: 7px;
        margin-top: 5px;
        border-radius: 50%;
        background: #7dd3fc;
        box-shadow: 0 0 12px rgba(125, 211, 252, 0.85);
      }

      #${EXPORTER_ID} .bgd-log-line.is-error::before {
        background: #fb7185;
        box-shadow: 0 0 12px rgba(251, 113, 133, 0.85);
      }

      #${EXPORTER_ID}.is-minimized {
        width: 44px;
      }

      #${EXPORTER_ID}.is-minimized .bgd-panel {
        border-radius: 12px;
      }

      #${EXPORTER_ID}.is-minimized .bgd-top {
        padding: 4px;
        gap: 0;
      }

      #${EXPORTER_ID}.is-minimized .bgd-top-row {
        display: block;
      }

      #${EXPORTER_ID}.is-minimized .bgd-title,
      #${EXPORTER_ID}.is-minimized .bgd-github-button,
      #${EXPORTER_ID}.is-minimized .bgd-export-button,
      #${EXPORTER_ID}.is-minimized .bgd-run-controls,
      #${EXPORTER_ID}.is-minimized .bgd-version-notice,
      #${EXPORTER_ID}.is-minimized .bgd-diagnostics-button,
      #${EXPORTER_ID}.is-minimized .bgd-converter-panel,
      #${EXPORTER_ID}.is-minimized .bgd-actions,
      #${EXPORTER_ID}.is-minimized .bgd-progress {
        display: none !important;
      }

      #${EXPORTER_ID}.is-minimized .bgd-window-controls {
        display: block;
        margin-top: 0;
      }

      #${EXPORTER_ID}.is-minimized .bgd-minimize-button {
        display: none;
      }

      /* In window-controls, the restore button is hidden when expanded and shown when minimized */
      #${EXPORTER_ID} .bgd-window-controls .bgd-restore-button {
        display: none;
      }

      #${EXPORTER_ID}.is-minimized .bgd-window-controls .bgd-restore-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        line-height: 1 !important;
        letter-spacing: 0 !important;
        text-transform: none !important;
        vertical-align: middle;
      }

      /* Hide the config gear button when minimized — the restore button takes its visual slot */
      #${EXPORTER_ID}.is-minimized .bgd-window-controls .bgd-config-button:not(.bgd-restore-button) {
        display: none;
      }

      #${EXPORTER_ID} .bgd-status-config-modal,
      #${EXPORTER_ID} .bgd-source-config-modal {
        position: relative;
        z-index: 100001;
        width: 100%;
        max-height: calc(100vh - 92px);
        overflow: auto;
        padding: 18px;
        border: 1px solid rgba(125, 211, 252, 0.38);
        border-radius: 16px;
        background:
          linear-gradient(145deg, rgba(10, 16, 30, 0.98), rgba(18, 24, 42, 0.96)),
          radial-gradient(circle at 18% 0%, rgba(47, 141, 247, 0.24), transparent 38%);
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.10);
        color: #eaf4ff;
        backdrop-filter: blur(16px) saturate(1.2);
      }

      #${EXPORTER_ID} .bgd-source-config-modal {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 100002;
        width: min(420px, calc(100vw - 28px));
      }

      #${EXPORTER_ID} .bgd-status-config-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      #${EXPORTER_ID} .bgd-status-config-title strong {
        display: block;
        color: #b9e6ff;
        font-size: 13px;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      #${EXPORTER_ID} .bgd-status-config-title span {
        display: block;
        margin-top: 3px;
        color: rgba(234, 244, 255, 0.66);
        font-size: 12px;
      }

      #${EXPORTER_ID} .bgd-status-config-tip {
        margin: -4px 0 12px;
        color: rgba(167, 243, 208, 0.82);
        font-size: 12px;
        font-weight: 700;
      }

      #${EXPORTER_ID} .bgd-status-config-buttons {
        display: flex;
        align-items: stretch;
        gap: 8px;
        flex-shrink: 0;
      }

      #${EXPORTER_ID} .bgd-status-config-small {
        border: 1px solid rgba(125, 211, 252, 0.38);
        border-radius: 9px;
        padding: 7px 10px;
        color: #eaf4ff;
        cursor: pointer;
        font-size: 12px;
        font-weight: 900;
        background: rgba(125, 211, 252, 0.12);
      }

      #${EXPORTER_ID} .bgd-status-config-x {
        min-width: 34px;
        width: 34px;
        padding-left: 0;
        padding-right: 0;
      }

      #${EXPORTER_ID} .bgd-status-config-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 290px), 1fr));
        gap: 14px;
      }

      #${EXPORTER_ID} .bgd-status-category {
        box-sizing: border-box;
        min-width: 0;
        max-width: 100%;
        overflow: visible;
        padding: 12px;
        border: 1px solid rgba(125, 211, 252, 0.24);
        border-radius: 12px;
        background: rgba(125, 211, 252, 0.07);
      }

      #${EXPORTER_ID} .bgd-status-category-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
        min-width: 0;
      }

      #${EXPORTER_ID} .bgd-status-category-head strong {
        min-width: 0;
        color: rgba(234, 244, 255, 0.86);
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #${EXPORTER_ID} .bgd-status-category-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 6px;
        flex-shrink: 0;
      }

      #${EXPORTER_ID} .bgd-status-category-actions button {
        border: 1px solid rgba(167, 243, 208, 0.38);
        border-radius: 8px;
        min-width: 72px;
        min-height: 28px;
        padding: 6px 10px;
        color: rgba(167, 243, 208, 0.94);
        cursor: pointer;
        font-size: 12px;
        font-weight: 900;
        line-height: 1;
        white-space: nowrap;
        background: rgba(167, 243, 208, 0.10);
      }

      #${EXPORTER_ID} .bgd-status-category-actions button:disabled {
        opacity: 0.42;
        cursor: not-allowed;
      }

      #${EXPORTER_ID} .bgd-config-pill-list {
        display: grid;
        gap: 7px;
        min-width: 0;
        max-width: 100%;
      }

      #${EXPORTER_ID} .bgd-config-pill-slot {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        min-height: 42px;
        border: 1px dashed rgba(125, 211, 252, 0.22);
        border-radius: 9px;
        background: rgba(125, 211, 252, 0.035);
        transition: border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
      }

      #${EXPORTER_ID} .bgd-config-pill-slot.is-empty {
        min-height: 34px;
      }

      #${EXPORTER_ID} .bgd-config-pill-slot.is-drag-over {
        border-color: rgba(125, 211, 252, 0.82);
        background: rgba(125, 211, 252, 0.13);
        box-shadow: inset 0 0 0 1px rgba(125, 211, 252, 0.22);
      }

      #${EXPORTER_ID}.bgd-slot-drag-active .bgd-config-pill {
        pointer-events: none;
      }

      #${EXPORTER_ID} .bgd-config-pill {
        box-sizing: border-box;
        display: grid;
        grid-template-columns: 18px 22px minmax(0, 1fr) 94px;
        align-items: center;
        gap: 7px;
        width: 100%;
        min-height: 46px;
        max-width: 100%;
        min-width: 0;
        padding: 7px;
        border: 1px solid rgba(234, 244, 255, 0.13);
        border-radius: 9px;
        background: rgba(234, 244, 255, 0.06);
        cursor: default;
        overflow: hidden;
      }

      #${EXPORTER_ID} .bgd-config-pill.is-dragging {
        opacity: 0.52;
        cursor: grabbing;
      }

      #${EXPORTER_ID} .bgd-config-pill.is-aggregate {
        grid-template-columns: 18px minmax(0, 1fr) 98px;
        border-color: rgba(253, 224, 71, 0.32);
        background: rgba(253, 224, 71, 0.08);
      }

      #${EXPORTER_ID} .bgd-config-drag-handle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 28px;
        color: rgba(234, 244, 255, 0.42);
        cursor: grab;
        user-select: none;
      }

      #${EXPORTER_ID} .bgd-config-icon {
        display: block;
        width: 15px;
        height: 15px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
        pointer-events: none;
      }

      #${EXPORTER_ID} .bgd-config-drag-handle .bgd-config-icon {
        width: 16px;
        height: 20px;
        stroke-width: 2.4;
      }

      #${EXPORTER_ID} .bgd-config-pill.is-dragging .bgd-config-drag-handle {
        cursor: grabbing;
      }

      #${EXPORTER_ID} .bgd-config-color {
        width: 22px;
        height: 26px;
        padding: 0;
        border: 0;
        border-radius: 6px;
        overflow: hidden;
        background: transparent;
        cursor: pointer;
      }

      #${EXPORTER_ID} .bgd-config-label {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        border: 0;
        border-radius: 7px;
        padding: 7px 8px;
        color: #eaf4ff;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
        background: rgba(7, 11, 20, 0.42);
        cursor: text;
        user-select: text;
      }

      #${EXPORTER_ID} .bgd-config-pill-actions {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 5px;
        justify-content: flex-end;
        width: 100%;
        min-width: 0;
        overflow: hidden;
      }

      #${EXPORTER_ID} .bgd-config-count {
        min-width: 26px;
        color: rgba(234, 244, 255, 0.82);
        font-size: 12px;
        font-weight: 900;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      #${EXPORTER_ID} .bgd-config-sources,
      #${EXPORTER_ID} .bgd-config-remove {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(125, 211, 252, 0.34);
        border-radius: 8px;
        min-width: 27px;
        width: 27px;
        height: 27px;
        padding: 0;
        color: rgba(234, 244, 255, 0.84);
        cursor: pointer;
        font-size: 13px;
        font-weight: 900;
        background: rgba(125, 211, 252, 0.10);
      }

      #${EXPORTER_ID} .bgd-config-remove {
        border-color: rgba(251, 113, 133, 0.34);
        color: rgba(251, 113, 133, 0.96);
        background: rgba(251, 113, 133, 0.10);
      }

      #${EXPORTER_ID} .bgd-config-pill.is-aggregate .bgd-config-sources {
        min-width: 27px;
        width: 27px;
        height: 27px;
        padding: 0;
        font-size: 14px;
        line-height: 1;
      }

      #${EXPORTER_ID} .bgd-status-limit {
        margin-top: 7px;
        color: rgba(253, 224, 71, 0.94);
        font-size: 11px;
        font-weight: 800;
        line-height: 1.25;
      }

      #${EXPORTER_ID} .bgd-source-list {
        display: grid;
        gap: 7px;
        margin: 12px 0;
      }

      #${EXPORTER_ID} .bgd-source-choice {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 8px;
        border: 1px solid rgba(234, 244, 255, 0.12);
        border-radius: 8px;
        background: rgba(234, 244, 255, 0.05);
        color: rgba(234, 244, 255, 0.86);
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }

      #${EXPORTER_ID} .bgd-source-choice input {
        appearance: none;
        -webkit-appearance: none;
        position: relative;
        display: inline-block;
        width: 16px;
        height: 16px;
        margin: 0;
        border: 1px solid rgba(234, 244, 255, 0.58);
        background: rgba(255, 255, 255, 0.96);
        box-shadow: inset 0 1px 1px rgba(6, 16, 31, 0.20);
        flex-shrink: 0;
      }

      #${EXPORTER_ID} .bgd-source-choice input[type="radio"] {
        border-radius: 50%;
      }

      #${EXPORTER_ID} .bgd-source-choice input[type="checkbox"] {
        border-radius: 3px;
      }

      #${EXPORTER_ID} .bgd-source-choice input[type="radio"]:checked {
        border-color: rgba(125, 211, 252, 0.98);
        background:
          radial-gradient(circle at center, #082033 0 34%, transparent 38%),
          #7dd3fc;
      }

      #${EXPORTER_ID} .bgd-source-choice input[type="checkbox"]::after {
        content: '';
        position: absolute;
        left: 4px;
        top: 1px;
        width: 5px;
        height: 9px;
        border: solid #082033;
        border-width: 0 3px 3px 0;
        opacity: 0;
        transform: rotate(45deg);
      }

      #${EXPORTER_ID} .bgd-source-choice input[type="checkbox"]:checked {
        border-color: rgba(125, 211, 252, 0.98);
        background: #7dd3fc;
      }

      #${EXPORTER_ID} .bgd-source-choice input[type="checkbox"]:checked::after {
        opacity: 1;
      }

      #${EXPORTER_ID} .bgd-source-message {
        margin: 8px 0 10px;
        color: rgba(253, 224, 71, 0.92);
        font-size: 12px;
        font-weight: 800;
        line-height: 1.35;
      }

      #${EXPORTER_ID} .bgd-source-count {
        margin-left: auto;
        color: rgba(234, 244, 255, 0.68);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      #${EXPORTER_ID} .bgd-source-empty {
        padding: 9px 10px;
        border: 1px dashed rgba(234, 244, 255, 0.18);
        border-radius: 8px;
        color: rgba(234, 244, 255, 0.70);
        font-size: 12px;
        font-weight: 800;
        background: rgba(234, 244, 255, 0.04);
      }

      #${EXPORTER_ID} .bgd-source-debug {
        margin-top: 8px;
        color: rgba(234, 244, 255, 0.52);
        font-size: 11px;
        font-weight: 700;
        line-height: 1.35;
      }

      @media (max-width: 760px) {
        #${EXPORTER_ID} .bgd-status-config-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 720px) {
        #${EXPORTER_ID} {
          top: auto;
          right: 10px;
          bottom: 10px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createPanel() {
    injectStyles();
    const sourceUi = getSourceUiDescriptorForHost();
    const root = document.createElement('div');
    root.id = EXPORTER_ID;
    root.className = sourceUi.hostClass || '';
    root.innerHTML = `
      <div class="bgd-panel">
        <div class="bgd-top">
          <div class="bgd-top-row">
            <div class="bgd-title">
              <strong>Library Export</strong>
              <div class="bgd-title-meta">
                <span>/u/${escapeHtml(userSlug)}</span>
              </div>
            </div>
            <div class="bgd-window-controls">
              ${ENABLE_EXPORTER_DIAGNOSTICS ? '<button class="bgd-diagnostics-button" type="button" id="bgdDiagnosticsBtn" title="Run exporter diagnostics">Diagnostics</button>' : ''}
              <button class="bgd-config-button bgd-restore-button" type="button" id="bgdRestoreBtn" title="Expand exporter" aria-label="Expand exporter"><svg class="bgd-btn-icon" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
              <button class="bgd-minimize-button" type="button" id="bgdMinimizeBtn" title="Minimize exporter" aria-label="Minimize exporter"><svg class="bgd-btn-icon" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
            </div>
          </div>
          <span class="bgd-version-notice" id="bgdVersionNotice">UPDATE AVAILABLE!</span>
          <div class="bgd-actions">
            <div class="bgd-checks">
              <div class="bgd-checks-row">
                <div class="bgd-col-label bgd-files-label">
                  <span>Files</span>
                  <span class="bgd-files-controls">
                    <a class="bgd-github-button" href="${EXPORTER_RELEASES_URL}" target="_blank" rel="noopener noreferrer" title="Open exporter releases on GitHub" aria-label="Open exporter releases on GitHub">
                      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.64 7.64 0 0 1 8 3.87c.68 0 1.36.09 2 .26 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"></path>
                      </svg>
                    </a>
                    ${sourceUi.hasStatusConfiguration ? '<button class="bgd-config-button" type="button" id="bgdConfigBtn" title="Open status pill configuration" aria-label="Open status pill configuration">⚙️</button>' : ''}
                    <button class="bgd-export-button" type="button" id="bgdExportBtn">Export</button>
                    <div class="bgd-export-wait" id="bgdExportWait" aria-live="polite">WAIT</div>
                    <div class="bgd-run-controls" id="bgdRunControls" hidden>
                      <button class="bgd-run-control-button bgd-run-control-toggle" type="button" id="bgdPauseExportBtn" title="Pause export" aria-label="Pause export"><span class="bgd-run-icon bgd-run-icon-pause" aria-hidden="true"></span><span class="bgd-run-icon bgd-run-icon-play" aria-hidden="true"></span></button>
                      <button class="bgd-run-control-button" type="button" id="bgdStopExportBtn" title="Stop export" aria-label="Stop export"><span class="bgd-run-icon bgd-run-icon-stop" aria-hidden="true"></span></button>
                    </div>
                  </span>
                </div>
                <div class="bgd-chk-items bgd-file-format-items">
                  <label class="bgd-chk"><input type="checkbox" id="bgdChkCsv"> CSV</label>
                  <span class="bgd-format-note-anchor">
                    <label class="bgd-chk"><input type="checkbox" id="bgdChkJson"> JSON</label>
                    <label class="bgd-chk"><input type="checkbox" id="bgdChkHtml" checked> HTML</label>
                    <span class="bgd-file-change-note" id="bgdFileChangeNote">Export Queue Updated</span>
                  </span>
                  <button class="bgd-converter-button" type="button" id="bgdConverterBtn">FILE CONVERTER</button>
                </div>
              </div>
              <div class="bgd-checks-row">
                <div class="bgd-col-label">Tags</div>
                <div class="bgd-chk-items bgd-tag-lines">
                  <div class="bgd-tag-line">
                    <label class="bgd-chk bgd-chk-basic"><input type="checkbox" checked disabled> Basic</label>
                    <label class="bgd-chk bgd-chk-opt"><input type="checkbox" id="bgdChkGenres"> ${escapeHtml(sourceUi.metadataLabel || 'Genres')}</label>
                    <label class="bgd-chk bgd-chk-opt"><input type="checkbox" id="bgdChkOfflineCovers"> Offline Covers</label>
                  </div>
                  ${sourceUi.platformOptions ? `<div class="bgd-tag-line">
                    <label class="bgd-chk bgd-chk-opt"><input type="checkbox" id="bgdChkPlatforms"> Platforms (50)</label>
                    <label class="bgd-chk bgd-chk-opt"><input type="checkbox" id="bgdChkPlatforms226"> Platforms (226)</label>
                  </div>` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="bgd-progress">
          <div class="bgd-bar"><div class="bgd-fill"></div></div>
          <div class="bgd-log"></div>
        </div>
      </div>
      <div class="bgd-converter-panel" id="bgdConverterPanel" hidden>
        <button class="bgd-converter-close" type="button" id="bgdConverterClose" aria-label="Close">x</button>
        <div class="bgd-converter-grid">
          <div>
            <div class="bgd-converter-heading">Select File</div>
            <label class="bgd-converter-choice"><input type="radio" name="bgdConverterSource" value="csv" checked> CSV</label>
            <label class="bgd-converter-choice"><input type="radio" name="bgdConverterSource" value="json"> JSON</label>
            <label class="bgd-converter-choice"><input type="radio" name="bgdConverterSource" value="html"> HTML</label>
          </div>
          <div>
            <div class="bgd-converter-heading">Export File</div>
            <label class="bgd-converter-choice"><input type="checkbox" name="bgdConverterTarget" value="csv"> CSV</label>
            <label class="bgd-converter-choice"><input type="checkbox" name="bgdConverterTarget" value="json" checked> JSON</label>
            <div class="bgd-converter-choice-row"><label class="bgd-converter-choice"><input type="checkbox" name="bgdConverterTarget" value="html" checked> HTML</label><label class="bgd-converter-inline-option"><input type="checkbox" id="bgdConverterOfflineCovers"> Offline Covers</label></div>
          </div>
        </div>
        <button class="bgd-converter-run" type="button" id="bgdConverterRun">Convert</button>
        <input type="file" id="bgdConverterFileInput" hidden>
      </div>
    `;
    document.body.appendChild(root);
    return root;
  }

  // Assign to the outer-scope variables used by panel controls and export flow.
  panel          = createPanel();
  minimizeBtn    = panel.querySelector('#bgdMinimizeBtn');
  restoreBtn     = panel.querySelector('#bgdRestoreBtn');
  exportBtn      = panel.querySelector('#bgdExportBtn');
  configBtn      = panel.querySelector('#bgdConfigBtn');
  diagnosticsBtn = panel.querySelector('#bgdDiagnosticsBtn');
  runControls    = panel.querySelector('#bgdRunControls');
  pauseExportBtn = panel.querySelector('#bgdPauseExportBtn');
  stopExportBtn  = panel.querySelector('#bgdStopExportBtn');
  chkCsv         = panel.querySelector('#bgdChkCsv');
  chkJson        = panel.querySelector('#bgdChkJson');
  chkHtml        = panel.querySelector('#bgdChkHtml');
  fileChangeNote = panel.querySelector('#bgdFileChangeNote');
  versionNotice  = panel.querySelector('#bgdVersionNotice');
  converterBtn   = panel.querySelector('#bgdConverterBtn');
  converterPanel = panel.querySelector('#bgdConverterPanel');
  converterCloseBtn = panel.querySelector('#bgdConverterClose');
  converterRunBtn = panel.querySelector('#bgdConverterRun');
  converterFileInput = panel.querySelector('#bgdConverterFileInput');
  chkGenres      = panel.querySelector('#bgdChkGenres');
  chkOfflineCovers = panel.querySelector('#bgdChkOfflineCovers');
  chkPlatforms   = panel.querySelector('#bgdChkPlatforms');
  chkPlatforms226 = panel.querySelector('#bgdChkPlatforms226');
  log            = panel.querySelector('.bgd-log');
  fill           = panel.querySelector('.bgd-fill');
  logUpdateLines = new Map();

  function setPanelMinimized(isMinimized) {
    if (!panel || (!minimizeBtn && !restoreBtn)) return;
    panel.classList.toggle('is-minimized', isMinimized);
    if (isMinimized) closeConverterPanel();
    if (minimizeBtn) {
      minimizeBtn.innerHTML = isMinimized
        ? '<svg class="bgd-btn-icon" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
        : '<svg class="bgd-btn-icon" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
      minimizeBtn.title = isMinimized ? 'Expand exporter' : 'Minimize exporter';
      minimizeBtn.setAttribute('aria-label', minimizeBtn.title);
    }
    if (restoreBtn) {
      restoreBtn.title = isMinimized ? 'Expand exporter' : 'Minimize exporter';
      restoreBtn.setAttribute('aria-label', restoreBtn.title);
    }
    storageSet('bgdExporterMinimized', isMinimized ? '1' : '0');
  }

  if (minimizeBtn) {
    setPanelMinimized(storageGet('bgdExporterMinimized', '0') === '1');
    minimizeBtn.addEventListener('click', () => {
      setPanelMinimized(!panel.classList.contains('is-minimized'));
    });
  }
  if (restoreBtn) {
    if (!minimizeBtn) setPanelMinimized(storageGet('bgdExporterMinimized', '0') === '1');
    restoreBtn.addEventListener('click', () => {
      setPanelMinimized(!panel.classList.contains('is-minimized'));
    });
  }
  const alignVersionNoticeOnResize = () => alignVersionNoticeToGithubButton();
  window.addEventListener('resize', alignVersionNoticeOnResize);
  addPanelCleanup(() => window.removeEventListener('resize', alignVersionNoticeOnResize));
  checkLatestExporterVersion();

  // Mutual exclusion: Platforms and Platforms(226) are mutually exclusive
  function enforcePlatformScanCheckboxes(preferred = 'basic') {
    if (!chkPlatforms || !chkPlatforms226) return;
    if (chkPlatforms.checked && chkPlatforms226.checked) {
      if (preferred === 'full') {
        chkPlatforms.checked = false;
        storageSet('bgdChkPlatforms', '0');
      } else {
        chkPlatforms226.checked = false;
        storageSet('bgdChkPlatforms226', '0');
      }
    }
  }
  if (chkPlatforms) chkPlatforms.addEventListener('change', () => enforcePlatformScanCheckboxes('basic'));
  if (chkPlatforms226) chkPlatforms226.addEventListener('change', () => enforcePlatformScanCheckboxes('full'));

  function getSelectedFileFormats() {
    return {
      csv: !!(chkCsv && chkCsv.checked),
      json: !!(chkJson && chkJson.checked),
      html: !!(chkHtml && chkHtml.checked),
    };
  }

  function getFileFormatSignature(formats = getSelectedFileFormats()) {
    return ['csv', 'json', 'html'].filter(key => formats[key]).join('|');
  }

  function getFileFormatLabels(formats) {
    return [
      formats.csv && 'CSV',
      formats.json && 'JSON',
      formats.html && 'HTML',
    ].filter(Boolean);
  }

  function prepareFormatsForDownload(formats) {
    const labels = getFileFormatLabels(formats);
    if (!labels.length) {
      addLog('No file type selected at finish; nothing downloaded', 'error');
      return { labels, canDownload: false };
    }
    addLog(`Building ${labels.join(', ')} file${labels.length > 1 ? 's' : ''}`);
    return { labels, canDownload: true };
  }

  function getMobyGamesExportFormatsForDownload(state) {
    return state && state.formats ? state.formats : getSelectedFileFormats();
  }

  function getHowLongToBeatExportFormatsForDownload(state) {
    return state && state.formats ? state.formats : getSelectedFileFormats();
  }

  function persistMobyGamesExportFormatSelection() {
    if (!isMobyGamesHost() || !exportInProgress) return;
    const state = loadMobyGamesExportState();
    if (!state) return;
    state.formats = getSelectedFileFormats();
    saveMobyGamesExportState(state);
  }

  function persistHowLongToBeatExportFormatSelection() {
    if (!isHowLongToBeatHost() || !exportInProgress) return;
    const state = loadHowLongToBeatExportState();
    if (!state) return;
    state.formats = getSelectedFileFormats();
    saveHowLongToBeatExportState(state);
  }

  function updatePendingFileFormatNote() {
    if (!fileChangeNote) return;
    const changed = exportInProgress && getFileFormatSignature() !== exportStartFileFormatSignature;
    if (fileChangeNoteTimer) {
      clearTimeout(fileChangeNoteTimer);
      fileChangeNoteTimer = null;
    }
    fileChangeNote.classList.remove('is-visible');
    if (!changed) return;
    fileChangeNote.style.animation = 'none';
    void fileChangeNote.offsetWidth;
    fileChangeNote.style.animation = '';
    fileChangeNote.classList.add('is-visible');
    fileChangeNoteTimer = setTimeout(() => {
      fileChangeNote.classList.remove('is-visible');
      fileChangeNoteTimer = null;
    }, 1900);
  }

  // Restore checkbox states from localStorage
  (function restoreCheckboxes() {
    const stored = { bgdChkCsv: '0', bgdChkJson: '0', bgdChkHtml: '1', bgdChkGenres: '0', bgdChkOfflineCovers: '0', bgdChkPlatforms: '0', bgdChkPlatforms226: '0' };
    for (const [key, def] of Object.entries(stored)) {
      const el = panel.querySelector('#' + key);
      if (!el) continue;
      const v = storageGet(key, null);
      el.checked = (v !== null ? v : def) === '1';
      el.addEventListener('change', () => storageSet(key, el.checked ? '1' : '0'));
    }
    // Enforce mutual exclusion after restore: if both are checked, prefer Platforms (50)
    enforcePlatformScanCheckboxes('basic');
    syncHowLongToBeatOfflineCoverOption();
  })();

  if (chkGenres) chkGenres.addEventListener('change', syncHowLongToBeatOfflineCoverOption);

  [chkCsv, chkJson, chkHtml].forEach(el => {
    if (el) el.addEventListener('change', () => {
      updatePendingFileFormatNote();
      persistMobyGamesExportFormatSelection();
      persistHowLongToBeatExportFormatSelection();
    });
  });

  function normalizeMobyGamesCollection(collection) {
    const name = String(collection && collection.name || '').trim();
    const url = String(collection && collection.url || '').trim();
    const games = Number(collection && collection.games);
    if (!name || !url) return null;
    return {
      name,
      games: Number.isFinite(games) && games >= 0 ? Math.floor(games) : 0,
      url,
    };
  }

  function normalizeStatusPillCollections(collections) {
    const byUrl = new Map();
    (Array.isArray(collections) ? collections : []).forEach(collection => {
      const normalized = normalizeMobyGamesCollection(collection);
      if (normalized) byUrl.set(normalized.url, normalized);
    });
    return [...byUrl.values()];
  }

  function normalizeStatusPillConfig(config) {
    const fallback = makeDefaultStatusPillConfig();
    const source = config && Array.isArray(config.categories) ? config : fallback;
    source.categories = source.categories.map((category, categoryIndex) => {
      const fallbackCategory = fallback.categories[categoryIndex] || {};
      return {
        id: category.id || fallbackCategory.id || makeConfigPillId('cat'),
        label: category.label || fallbackCategory.label || `Group ${categoryIndex + 1}`,
        pills: (Array.isArray(category.pills) ? category.pills : []).filter(Boolean).slice(0, STATUS_PILL_SLOT_COUNT).map(pill => {
          if (pill.kind === 'aggregate') {
            return {
              id: pill.id || makeConfigPillId('agg'),
              kind: 'aggregate',
              label: pill.label || 'Aggregate Pill',
              sources: Array.isArray(pill.sources) ? pill.sources.filter(Boolean) : [],
            };
          }
          const sourceDef = pill.source && pill.source.type && pill.source.value ? pill.source : { type: 'play_type', value: 'played' };
          return {
            id: pill.id || makeConfigPillId('status'),
            kind: 'status',
            label: pill.label || 'Status Pill',
            color: pill.color || '#7dd3fc',
            source: sourceDef,
            collections: normalizeStatusPillCollections(pill.collections),
          };
        }),
      };
    });
    return source;
  }

  configureSourceDescriptor('mobygames', {
    statusConfig: {
      discoverCollections: fetchMobyGamesPublicCollections,
      defaultConfigFromCollections: makeDefaultStatusPillConfig,
      storageKey: STATUS_PILL_CONFIG_STORAGE_KEY,
    },
  });

  function normalizeHowLongToBeatCategoryName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ');
  }

  function makeHowLongToBeatCategorySlug(name) {
    return normalizeHowLongToBeatCategoryName(name).toLowerCase().replace(/\s+/g, '-');
  }

  const HLTB_DEFAULT_CATEGORY_ROUTES = [
    { name: 'Playing', route: 'playing' },
    { name: 'Backlog', route: 'backlog' },
    { name: 'Replays', route: 'replays' },
    { name: 'Completed', route: 'completed' },
    { name: 'Retired', route: 'retired' },
  ];

  function isHowLongToBeatDefaultCategoryName(name) {
    const normalized = normalizeHowLongToBeatCategoryName(name).toLowerCase();
    return HLTB_DEFAULT_CATEGORY_ROUTES.some(entry => entry.name.toLowerCase() === normalized);
  }

  function getHowLongToBeatCategoryUrlFromRoute(route, page = 1, username = getHowLongToBeatUserSlug()) {
    if (!username || !route) return '';
    const cleanRoute = String(route || '').trim().replace(/^\/+|\/+$/g, '');
    const origin = isHowLongToBeatHost() ? location.origin : 'https://howlongtobeat.com';
    return `${origin}/user/${encodeURIComponent(username)}/games/${cleanRoute}/${page}`;
  }

  function normalizeHowLongToBeatCategory(category) {
    const name = normalizeHowLongToBeatCategoryName(category && category.name);
    const url = String(category && category.url || '').trim();
    const games = Number(category && category.games);
    if (!name || !url) return null;
    return {
      name,
      games: Number.isFinite(games) && games >= 0 ? Math.floor(games) : 0,
      url,
    };
  }

  function getHowLongToBeatCategoryUrl(name, page = 1, username = getHowLongToBeatUserSlug()) {
    if (!username) return '';
    const defaultRoute = HLTB_DEFAULT_CATEGORY_ROUTES.find(entry =>
      entry.name.toLowerCase() === normalizeHowLongToBeatCategoryName(name).toLowerCase()
    );
    return getHowLongToBeatCategoryUrlFromRoute(defaultRoute ? defaultRoute.route : makeHowLongToBeatCategorySlug(name), page, username);
  }

  function getHowLongToBeatDetectedCustomCategoryNames(doc = document) {
    return [...doc.querySelectorAll('li')]
      .filter(li => {
        const name = normalizeHowLongToBeatCategoryName(li.textContent);
        if (!name || /^options$/i.test(name) || /^single list$/i.test(name)) return false;
        if (![...li.classList].some(className => className.includes('user_games_nav'))) return false;
        const inlineDisplay = String(li.getAttribute('style') || '').match(/display\s*:\s*([^;]+)/i);
        if (inlineDisplay && inlineDisplay[1].trim().toLowerCase() === 'none') return false;
        if (doc === document && getComputedStyle(li).display === 'none') return false;
        return !isHowLongToBeatDefaultCategoryName(name);
      })
      .map(li => normalizeHowLongToBeatCategoryName(li.textContent))
      .filter(Boolean);
  }

  function buildHowLongToBeatKnownCategories(username = getHowLongToBeatUserSlug(), doc = document) {
    const categories = HLTB_DEFAULT_CATEGORY_ROUTES.map(entry => normalizeHowLongToBeatCategory({
      name: entry.name,
      url: getHowLongToBeatCategoryUrlFromRoute(entry.route, 1, username || 'tester'),
      games: 0,
    })).filter(Boolean);
    const customNames = [...new Set(getHowLongToBeatDetectedCustomCategoryNames(doc))].slice(0, 3);
    customNames.forEach((name, index) => {
      categories.push(normalizeHowLongToBeatCategory({
        name,
        url: getHowLongToBeatCategoryUrlFromRoute(index === 0 ? 'custom' : `custom${index + 1}`, 1, username || 'tester'),
        games: 0,
      }));
    });
    return categories;
  }

  function parseHowLongToBeatCategoriesDocument(doc = document) {
    const username = doc === document && isHowLongToBeatHost()
      ? getHowLongToBeatUserSlug()
      : 'tester';
    const categories = buildHowLongToBeatKnownCategories(username || 'tester', doc);
    const byUrl = new Map();
    categories.forEach(category => byUrl.set(category.url, category));
    return [...byUrl.values()];
  }

  async function fetchHowLongToBeatPublicCategories() {
    return hltbPreflightCategories || parseHowLongToBeatCategoriesDocument(document);
  }

  configureSourceDescriptor('howlongtobeat', {
    statusConfig: {
      discoverCollections: fetchHowLongToBeatPublicCategories,
      defaultConfigFromCollections: makeDefaultStatusPillConfig,
      storageKey: HLTB_STATUS_PILL_CONFIG_STORAGE_KEY,
    },
  });

  function loadStatusPillConfig() {
    const statusConfigDescriptor = getSourceStatusConfigDescriptorForHost();
    const makeDefaultConfig = statusConfigDescriptor && statusConfigDescriptor.defaultConfigFromCollections
      ? statusConfigDescriptor.defaultConfigFromCollections
      : makeDefaultStatusPillConfig;
    const storageKey = statusConfigDescriptor && statusConfigDescriptor.storageKey;
    const stored = storageKey ? storageGet(storageKey, null) : null;
    if (!stored) return normalizeStatusPillConfig(makeDefaultConfig());
    try {
      return normalizeStatusPillConfig(JSON.parse(stored));
    } catch (_) {
      return normalizeStatusPillConfig(makeDefaultConfig());
    }
  }

  function saveStatusPillConfig() {
    const statusConfigDescriptor = getSourceStatusConfigDescriptorForHost();
    const storageKey = statusConfigDescriptor && statusConfigDescriptor.storageKey;
    if (!storageKey) return;
    storageSet(storageKey, JSON.stringify(normalizeStatusPillConfig(cloneStatusPillConfig(statusPillConfig))));
  }

  statusPillConfig = loadStatusPillConfig();

  function getAllStatusPillsFromConfig(config = statusPillConfig) {
    return (config.categories || []).flatMap(category =>
      (category.pills || []).filter(pill => pill.kind === 'status')
    );
  }

  function makeConfigPillId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function getConfigPillCount(pill) {
    if (!pill) return 0;
    if (pill.kind === 'aggregate') {
      const byId = new Map(getAllStatusPillsFromConfig().map(statusPill => [statusPill.id, statusPill]));
      return (pill.sources || []).reduce((sum, id) => sum + getConfigPillCount(byId.get(id)), 0);
    }
    const collections = normalizeStatusPillCollections(pill.collections);
    if (collections.length) return collections.reduce((sum, collection) => sum + collection.games, 0);
    return 0;
  }

  function getMobyGamesCollectionPageUrl(pageUrl = location.href) {
    const match = String(pageUrl || '').match(/^(https?:\/\/(?:www\.)?mobygames\.com\/user\/\d+\/[^/?#]+\/collection\/)/i);
    return match ? match[1] : '';
  }

  function logMobyGamesCollectionDebug(message, details = {}) {
    const payload = { message, ...details };
    try {
      console.info('[Game Library Exporter] MobyGames collections:', payload);
    } catch (_) {}
    return payload;
  }

  function parseMobyGamesCollectionDocument(doc, pageUrl) {
    const baseUrl = pageUrl || location.href;
    const normalizeText = value => String(value || '').trim().replace(/\s+/g, ' ');
    const failures = [];
    const table = [...doc.querySelectorAll('table')].find(candidate => {
      const headers = [...candidate.querySelectorAll('thead th, tr:first-child th')].map(th => normalizeText(th.textContent));
      return headers.includes('Name') && headers.includes('Games');
    });
    if (!table) {
      return {
        collections: [],
        nextUrl: null,
        debug: {
          rowCount: 0,
          names: [],
          tableFound: false,
          failures: ['No table with Name and Games headers was found.'],
        },
      };
    }
    const headers = [...table.querySelectorAll('thead th, tr:first-child th')].map(th => normalizeText(th.textContent));
    const nameIndex = headers.indexOf('Name');
    const gamesIndex = headers.indexOf('Games');
    const rows = [...table.querySelectorAll('tbody tr')];
    const collections = rows.map((row, rowIndex) => {
      const cells = [...row.children];
      const nameCell = cells[nameIndex];
      const gamesCell = cells[gamesIndex];
      const link = nameCell && nameCell.querySelector('a[href]');
      if (!link) {
        failures.push(`Row ${rowIndex + 1}: missing collection link in Name column.`);
        return null;
      }
      const collection = normalizeMobyGamesCollection({
        name: normalizeText(link.textContent || nameCell.textContent),
        games: Number(normalizeText(gamesCell && gamesCell.textContent).replace(/,/g, '')),
        url: new URL(link.getAttribute('href'), baseUrl).href,
      });
      if (!collection) failures.push(`Row ${rowIndex + 1}: failed to normalize collection data.`);
      return collection;
    }).filter(Boolean);
    const nextLink = [...doc.querySelectorAll('a[href]')].find(link => {
      const text = normalizeText(link.textContent).toLowerCase();
      const aria = normalizeText(link.getAttribute('aria-label')).toLowerCase();
      const rel = normalizeText(link.getAttribute('rel')).toLowerCase();
      const href = link.getAttribute('href') || '';
      return href !== '#' && (rel === 'next' || text === 'next' || aria.includes('next'));
    });
    return {
      collections,
      nextUrl: nextLink ? new URL(nextLink.getAttribute('href'), baseUrl).href : null,
      debug: {
        rowCount: rows.length,
        names: collections.map(collection => collection.name),
        tableFound: true,
        failures,
      },
    };
  }

  function parseMobyGamesCollectionPage(html, pageUrl) {
    const text = String(html || '');
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const parsed = parseMobyGamesCollectionDocument(doc, pageUrl);
    parsed.debug = {
      ...(parsed.debug || {}),
      htmlLength: text.length,
      cloudflareChallenge: /Just a moment|__cf_chl|Enable JavaScript and cookies to continue/i.test(text),
    };
    if (parsed.debug.cloudflareChallenge && !parsed.collections.length) {
      parsed.debug.failures = [...(parsed.debug.failures || []), 'Fetched HTML appears to be a Cloudflare challenge page.'];
    }
    return parsed;
  }

  async function fetchMobyGamesPublicCollections() {
    const now = Date.now();
    const firstUrl = getMobyGamesCollectionPageUrl();
    if (!firstUrl) return [];
    if (
      mobyGamesCollectionCache &&
      mobyGamesCollectionCache.url === firstUrl &&
      now - mobyGamesCollectionCache.fetchedAt < MOBYGAMES_COLLECTION_CACHE_TTL_MS
    ) {
      mobyGamesCollectionLastDebug = {
        message: 'Using cached collection discovery result.',
        rowCount: mobyGamesCollectionCache.collections.length,
        names: mobyGamesCollectionCache.collections.map(collection => collection.name),
        failures: [],
        events: mobyGamesCollectionCache.debugEvents || [],
      };
      return mobyGamesCollectionCache.collections;
    }
    const byUrl = new Map();
    const seenPages = new Set();
    const debugEvents = [];
    const currentPageParsed = parseMobyGamesCollectionDocument(document, location.href);
    debugEvents.push(logMobyGamesCollectionDebug('Parsed rendered collection page.', currentPageParsed.debug));
    currentPageParsed.collections.forEach(collection => byUrl.set(collection.url, collection));
    let nextUrl = currentPageParsed.nextUrl;
    while (nextUrl && !seenPages.has(nextUrl) && seenPages.size < 20) {
      if (exportInProgress) await waitIfExportPaused();
      seenPages.add(nextUrl);
      try {
        const html = await fetchHtml(nextUrl, { maxAttempts: 2, timeoutMs: 12000 });
        if (exportInProgress) await waitIfExportPaused();
        const parsed = parseMobyGamesCollectionPage(html, nextUrl);
        debugEvents.push(logMobyGamesCollectionDebug('Parsed fetched collection page.', { url: nextUrl, ...(parsed.debug || {}) }));
        parsed.collections.forEach(collection => byUrl.set(collection.url, collection));
        nextUrl = parsed.nextUrl;
      } catch (error) {
        debugEvents.push(logMobyGamesCollectionDebug('Failed to fetch collection pagination page.', {
          url: nextUrl,
          error: error && error.message ? error.message : String(error),
        }));
        nextUrl = null;
      }
    }
    const collections = [...byUrl.values()];
    const finalDebug = logMobyGamesCollectionDebug('Collection discovery complete.', {
      rowCount: collections.length,
      names: collections.map(collection => collection.name),
      failures: debugEvents.flatMap(event => event.failures || []),
    });
    mobyGamesCollectionLastDebug = { ...finalDebug, events: debugEvents };
    mobyGamesCollectionCache = { url: firstUrl, fetchedAt: now, collections, debugEvents };
    return collections;
  }

  function parseMobyGamesRatingFromElement(root) {
    if (!root) return null;
    const selectedStars = root.querySelectorAll && root.querySelectorAll('.score.score-selected, .score-selected').length;
    if (selectedStars) return selectedStars;
    const sources = [];
    const addSource = value => {
      const text = String(value || '').trim();
      if (text) sources.push(text);
    };
    addSource(root.getAttribute && root.getAttribute('data-tooltip'));
    addSource(root.getAttribute && root.getAttribute('title'));
    addSource(root.getAttribute && root.getAttribute('aria-label'));
    addSource(root.getAttribute && root.getAttribute('style'));
    addSource(root.textContent);
    root.querySelectorAll('[data-tooltip], [title], [aria-label], [style*="--rating"], .stars').forEach(element => {
      addSource(element.getAttribute('data-tooltip'));
      addSource(element.getAttribute('title'));
      addSource(element.getAttribute('aria-label'));
      addSource(element.getAttribute('style'));
      addSource(element.textContent);
    });
    for (const source of sources) {
      const match = source.match(/--rating:\s*(\d+(?:\.\d+)?)/i)
        || source.match(/\b(\d+(?:\.\d+)?)\s*(?:out of\s*5|stars?)\b/i)
        || source.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
      if (match) {
        const rating = Number(match[1]);
        if (Number.isFinite(rating)) return rating;
      }
    }
    return null;
  }

  function parseMobyGamesCollectionComponentGamesDocument(doc, pageUrl, mapping) {
    const normalizeText = value => String(value || '').trim().replace(/\s+/g, ' ');
    const failures = [];
    const component = [...doc.querySelectorAll('list')].find(element => element.getAttribute(':games'))
      || [...doc.querySelectorAll('*')].find(element => element.getAttribute(':games'));
    const rawGames = component && component.getAttribute(':games');
    if (!rawGames) {
      return {
        games: [],
        nextUrl: null,
        debug: {
          componentFound: false,
          rowCount: 0,
          failures: ['No MobyGames collection component :games payload was found.'],
        },
      };
    }

    let sourceGames = [];
    try {
      sourceGames = JSON.parse(rawGames);
    } catch (error) {
      failures.push(`Could not parse MobyGames collection component :games payload: ${error && error.message ? error.message : String(error)}`);
    }

    const games = (Array.isArray(sourceGames) ? sourceGames : []).map((entry, index) => {
      if (!entry || !entry.game_url) {
        failures.push(`Component game ${index + 1}: missing game_url.`);
        return null;
      }
      const rawRating = entry.rating && typeof entry.rating === 'object' ? entry.rating.rating : entry.rating;
      const userRating = rawRating == null || rawRating === '' ? null : Number(rawRating);
      const releaseYearMatch = String(entry.initial_date || '').match(/\b(19|20)\d{2}\b/);
      const gameUrl = new URL(entry.game_url, pageUrl || location.href).href;
      const coverUrl = entry.cover && entry.cover.url ? new URL(entry.cover.url, pageUrl || location.href).href : '';
      return {
        name: normalizeText(entry.game_title),
        title: normalizeText(entry.game_title),
        release_year: releaseYearMatch ? Number(releaseYearMatch[0]) : null,
        platform: normalizeText(entry.platform),
        userRating: Number.isFinite(userRating) ? userRating : null,
        user_rating: Number.isFinite(userRating) ? userRating : null,
        collection: mapping.collection.name,
        status: mapping.status,
        statusId: mapping.statusId,
        status_id: mapping.statusId,
        statuses: [mapping.status],
        collection_url: mapping.collection.url,
        gameUrl,
        url: gameUrl,
        cover_url: coverUrl,
      };
    }).filter(Boolean);

    return {
      games,
      nextUrl: null,
      debug: {
        componentFound: true,
        rowCount: games.length,
        names: games.map(game => game.name),
        failures,
      },
    };
  }

  function getMobyGamesConfiguredCollectionMappings(config = statusPillConfig) {
    const mappings = [];
    (config.categories || []).forEach(category => {
      (category.pills || []).forEach(pill => {
        if (!pill || pill.kind !== 'status') return;
        normalizeStatusPillCollections(pill.collections).forEach(collection => {
          mappings.push({
            statusId: pill.id,
            status: pill.label || 'Status Pill',
            statusColor: pill.color || '#7dd3fc',
            collection,
          });
        });
      });
    });
    const byKey = new Map();
    mappings.forEach(mapping => {
      byKey.set(`${mapping.statusId}|${mapping.collection.url}`, mapping);
    });
    return [...byKey.values()];
  }

  function parseMobyGamesCollectionGamesDocument(doc, pageUrl, mapping) {
    const normalizeText = value => String(value || '').trim().replace(/\s+/g, ' ');
    const table = [...doc.querySelectorAll('table')].find(candidate => {
      const headers = [...candidate.querySelectorAll('thead th, tr:first-child th')].map(th => normalizeText(th.textContent));
      return headers.includes('Title (Year)') && headers.includes('Platform');
    });
    if (!table) {
      const componentParsed = parseMobyGamesCollectionComponentGamesDocument(doc, pageUrl, mapping);
      if (componentParsed.games.length) {
        return {
          ...componentParsed,
          debug: {
            ...(componentParsed.debug || {}),
            tableFound: false,
            fallback: 'component-games',
          },
        };
      }
      return {
        games: [],
        nextUrl: null,
        debug: {
          tableFound: false,
          rowCount: 0,
          failures: ['No table with Title (Year) and Platform headers was found.'],
        },
      };
    }
    const headers = [...table.querySelectorAll('thead th, tr:first-child th')].map(th => normalizeText(th.textContent));
    const titleIndex = headers.indexOf('Title (Year)');
    const platformIndex = headers.indexOf('Platform');
    const ratingIndex = headers.indexOf('Rating');
    const failures = [];
    const rows = [...table.querySelectorAll('tbody tr')];
    const games = rows.map((row, rowIndex) => {
      const cells = [...row.children];
      const titleCell = cells[titleIndex];
      const platformCell = cells[platformIndex];
      const ratingCell = ratingIndex >= 0 ? cells[ratingIndex] : null;
      const gameLink = titleCell && titleCell.querySelector('a[href*="/game/"]');
      const coverImage = titleCell && titleCell.querySelector('img[src]');
      if (!gameLink) {
        failures.push(`Row ${rowIndex + 1}: missing game link in Title (Year) column.`);
        return null;
      }
      const titleText = normalizeText(titleCell.textContent);
      const yearMatch = titleText.match(/\((\d{4})\)\s*$/);
      const linkText = normalizeText(gameLink.textContent);
      const name = linkText || titleText.replace(/\s*\(\d{4}\)\s*$/, '');
      const rowReviewLink = row.querySelector('a[href*="/user-review/"]');
      const userRating = parseMobyGamesRatingFromElement(ratingCell)
        ?? parseMobyGamesRatingFromElement(rowReviewLink)
        ?? parseMobyGamesRatingFromElement(row.querySelector('.stars[style*="--rating"], [data-tooltip*="star"]'));
      const gameUrl = new URL(gameLink.getAttribute('href'), pageUrl || location.href).href;
      const coverUrl = coverImage ? new URL(coverImage.getAttribute('src'), pageUrl || location.href).href : '';
      return {
        name,
        title: name,
        release_year: yearMatch ? Number(yearMatch[1]) : null,
        platform: normalizeText(platformCell && platformCell.textContent),
        userRating,
        user_rating: userRating,
        collection: mapping.collection.name,
        status: mapping.status,
        statusId: mapping.statusId,
        status_id: mapping.statusId,
        statuses: [mapping.status],
        collection_url: mapping.collection.url,
        gameUrl,
        url: gameUrl,
        cover_url: coverUrl,
      };
    }).filter(Boolean);
    const componentParsed = parseMobyGamesCollectionComponentGamesDocument(doc, pageUrl, mapping);
    if (componentParsed.games.length) {
      const componentByKey = new Map();
      componentParsed.games.forEach(game => {
        componentByKey.set(`${game.gameUrl}|${game.platform}`, game);
        componentByKey.set(game.gameUrl, game);
      });
      games.forEach(game => {
        const componentGame = componentByKey.get(`${game.gameUrl}|${game.platform}`) || componentByKey.get(game.gameUrl);
        if (!componentGame) return;
        const userRating = getMobyGamesUserRating(game) ?? getMobyGamesUserRating(componentGame);
        game.userRating = userRating;
        game.user_rating = userRating;
      });
    }
    const nextLink = [...doc.querySelectorAll('a[href]')].find(link => {
      const text = normalizeText(link.textContent).toLowerCase();
      const aria = normalizeText(link.getAttribute('aria-label')).toLowerCase();
      const rel = normalizeText(link.getAttribute('rel')).toLowerCase();
      return rel === 'next' || text === 'next' || aria.includes('next');
    });
    return {
      games,
      nextUrl: nextLink ? new URL(nextLink.getAttribute('href'), pageUrl || location.href).href : null,
      debug: {
        tableFound: true,
        rowCount: rows.length,
        names: games.map(game => game.name),
        componentGames: componentParsed.games.length,
        failures,
      },
    };
  }

  function parseMobyGamesCollectionGamesPage(html, pageUrl, mapping) {
    const text = String(html || '');
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const parsed = parseMobyGamesCollectionGamesDocument(doc, pageUrl, mapping);
    parsed.debug = {
      ...(parsed.debug || {}),
      htmlLength: text.length,
      cloudflareChallenge: /Just a moment|__cf_chl|Enable JavaScript and cookies to continue/i.test(text),
    };
    if (parsed.debug.cloudflareChallenge && !parsed.games.length) {
      parsed.debug.failures = [...(parsed.debug.failures || []), 'Fetched HTML appears to be a Cloudflare challenge page.'];
    }
    return parsed;
  }

  function findMobyGamesMetadataValue(doc, label, rootSelector) {
    const normalize = value => String(value || '').trim().replace(/\s+/g, ' ');
    const roots = rootSelector ? [...doc.querySelectorAll(rootSelector)] : [doc];
    for (const root of roots) {
      for (const term of root.querySelectorAll('dl.metadata > dt')) {
        if (normalize(term.textContent) !== label) continue;
        const value = term.nextElementSibling;
        if (value && value.tagName && value.tagName.toLowerCase() === 'dd') return value;
      }
    }
    for (const term of doc.querySelectorAll('dl.metadata > dt')) {
      if (normalize(term.textContent) !== label) continue;
      const value = term.nextElementSibling;
      if (value && value.tagName && value.tagName.toLowerCase() === 'dd') return value;
    }
    return null;
  }

  function extractMobyGamesMetadataLinks(valueElement) {
    const normalize = value => String(value || '').trim().replace(/\s+/g, ' ');
    if (!valueElement) return [];
    const values = [...valueElement.querySelectorAll('a')]
      .map(link => normalize(link.textContent))
      .filter(Boolean);
    return [...new Set(values)];
  }

  function formatIsoDateForDisplay(value) {
    const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    if (!months[monthIndex] || !day) return '';
    return `${months[monthIndex]} ${day}, ${match[1]}`;
  }

  function findMobyGamesJsonLdValue(doc, key) {
    for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(script.textContent || 'null');
        const entries = Array.isArray(data) ? data : [data];
        for (const entry of entries) {
          if (entry && Object.prototype.hasOwnProperty.call(entry, key)) return entry[key];
        }
      } catch (_) {}
    }
    return '';
  }

  function uniqueSortedLabels(values) {
    const unique = [...new Set((Array.isArray(values) ? values : [])
      .map(value => String(value || '').trim().replace(/\s+/g, ' '))
      .filter(Boolean))];
    return unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
  }

  function parseMobyGamesPlayerAverageRating(doc) {
    const playerReviews = doc.querySelector('#player-reviews');
    if (playerReviews) {
      const directParagraph = [...playerReviews.children].find(child => child.tagName && child.tagName.toLowerCase() === 'p');
      const text = String(directParagraph ? directParagraph.textContent : playerReviews.textContent || '').trim().replace(/\s+/g, ' ');
      const match = text.match(/Average score:\s*(\d+(?:\.\d+)?)\s*out of 5/i);
      if (match) return Number(match[1]);
    }

    const playersValue = findMobyGamesMetadataValue(doc, 'Players', '.info-scores');
    const stars = playersValue && playersValue.querySelector('.stars[style*="--rating"], .stars[data-tooltip]');
    const raw = stars
      ? `${stars.getAttribute('style') || ''} ${stars.getAttribute('data-tooltip') || ''}`
      : '';
    const ratingMatch = raw.match(/--rating:\s*(\d+(?:\.\d+)?)/i) || raw.match(/\b(\d+(?:\.\d+)?)\s*stars?\b/i);
    return ratingMatch ? Number(ratingMatch[1]) : null;
  }

  function parseMobyGamesScoreValue(valueElement) {
    const text = String(valueElement ? valueElement.textContent : '').trim().replace(/\s+/g, ' ');
    if (!text || /^n\/a\b/i.test(text)) return null;
    const match = text.match(/\b(\d+(?:\.\d+)?)\b/);
    return match ? Number(match[1]) : null;
  }

  function extractMobyGamesPlatforms(doc, releaseValue) {
    const platformLinks = doc.querySelector('#platformLinks')
      ? [...doc.querySelectorAll('#platformLinks li a[href*="/platform/"]')]
      : [];
    const values = platformLinks.length
      ? platformLinks.map(link => link.textContent)
      : [...(releaseValue ? releaseValue.querySelectorAll('a[href*="/platform/"]') : [])].map(link => link.textContent);
    return uniqueSortedLabels(values);
  }

  function parseMobyGamesOverviewDocument(doc) {
    const releaseValue = findMobyGamesMetadataValue(doc, 'Released', '.info-release');
    const releaseDateFromMetadata = findReleaseDate(
      releaseValue && releaseValue.querySelector('a')
        ? releaseValue.querySelector('a').textContent
        : releaseValue
          ? releaseValue.textContent
          : ''
    );
    const releaseDate = releaseDateFromMetadata || formatIsoDateForDisplay(findMobyGamesJsonLdValue(doc, 'datePublished'));
    const playerAverageRating = parseMobyGamesPlayerAverageRating(doc);
    const mobyScore = parseMobyGamesScoreValue(findMobyGamesMetadataValue(doc, 'Moby Score', '.info-scores'));
    const averageRating = playerAverageRating == null && mobyScore != null ? mobyScore / 2 : playerAverageRating;
    return {
      release_date: releaseDate,
      fullReleaseDate: releaseDate,
      average_rating: averageRating,
      averageRating: averageRating,
      genres: extractMobyGamesMetadataLinks(findMobyGamesMetadataValue(doc, 'Genre', '.info-genres')),
      gameplay: extractMobyGamesMetadataLinks(findMobyGamesMetadataValue(doc, 'Gameplay', '.info-genres')),
      platforms: extractMobyGamesPlatforms(doc, releaseValue),
    };
  }

  function parseMobyGamesOverviewPage(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    return parseMobyGamesOverviewDocument(doc);
  }

  function stripHowLongToBeatImageWidth(url) {
    return String(url || '').replace(/\?width=\d+$/, '');
  }

  function getHowLongToBeatNextData(doc) {
    const script = doc.querySelector('script#__NEXT_DATA__');
    if (!script || !script.textContent) return null;
    try {
      return JSON.parse(script.textContent);
    } catch (_) {
      return null;
    }
  }

  function getHowLongToBeatGameObject(nextData) {
    return (
      nextData?.props?.pageProps?.game?.data?.game?.[0]
      || nextData?.props?.pageProps?.game?.game?.[0]
      || null
    );
  }

  function getHowLongToBeatPageMetadata(nextData) {
    return nextData?.props?.pageProps?.pageMetadata || null;
  }

  function formatHowLongToBeatIsoDate(value) {
    const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match || value === '0000-00-00') return '';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return formatAbbreviatedReleaseDate(value);
  }

  function normalizeHowLongToBeatPartialReleaseDate(value) {
    const raw = String(value || '').trim().replace(/\s+/g, ' ');
    if (!raw || /^0{4}(?:-0{2}){0,2}$/.test(raw)) return null;
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      if (match[2] === '00' && match[3] === '00') return { sort: `${match[1]}-99-99`, display: match[1] };
      if (match[2] !== '00' && match[3] === '00') {
        const monthDate = new Date(`${match[1]}-${match[2]}-01T00:00:00`);
        if (Number.isNaN(monthDate.getTime())) return null;
        return { sort: `${match[1]}-${match[2]}-99`, display: monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }) };
      }
      const display = formatHowLongToBeatIsoDate(raw);
      return display ? { sort: raw, display } : null;
    }
    match = raw.match(/^(\d{4})$/);
    if (match) return { sort: `${match[1]}-99-99`, display: match[1] };
    match = raw.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (match) {
      const monthDate = new Date(`${match[1]} 1, ${match[2]}`);
      if (Number.isNaN(monthDate.getTime())) return null;
      const month = String(monthDate.getMonth() + 1).padStart(2, '0');
      return { sort: `${match[2]}-${month}-99`, display: monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }) };
    }
    const parts = parseDateParts(raw);
    if (parts && parts.year) {
      const month = String(parts.month || 1).padStart(2, '0');
      const day = String(parts.day || 1).padStart(2, '0');
      return { sort: `${parts.year}-${month}-${day}`, display: parts.month && parts.day ? formatAbbreviatedReleaseDate(raw) : raw };
    }
    return null;
  }

  function fallbackHowLongToBeatDomReleaseDates(doc) {
    const releases = [];
    [...doc.querySelectorAll('div')].forEach(block => {
      const strong = block.querySelector('strong');
      if (!strong) return;
      const label = String(strong.textContent || '').trim().replace(/:$/, '').toLowerCase();
      if (!['world', 'na', 'eu', 'jp'].includes(label)) return;
      const clone = block.cloneNode(true);
      const cloneStrong = clone.querySelector('strong');
      if (cloneStrong) cloneStrong.remove();
      const value = String(clone.textContent || '').trim().replace(/\s+/g, ' ');
      const normalized = normalizeHowLongToBeatPartialReleaseDate(value);
      if (normalized) releases.push(normalized);
    });
    return releases;
  }

  function earliestHowLongToBeatReleaseDate(game, doc = document) {
    const dates = [
      game && game.release_world,
      game && game.release_na,
      game && game.release_eu,
      game && game.release_jp,
    ].map(normalizeHowLongToBeatPartialReleaseDate).filter(Boolean);
    dates.push(...fallbackHowLongToBeatDomReleaseDates(doc));
    if (!dates.length) return '';
    dates.sort((a, b) => a.sort.localeCompare(b.sort));
    return dates[0].display;
  }

  function fallbackHowLongToBeatMetaImage(doc) {
    return doc.querySelector('meta[property="og:image"]')?.getAttribute('content')
      || doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content')
      || doc.querySelector('meta[name="thumbnail"]')?.getAttribute('content')
      || '';
  }

  function fallbackHowLongToBeatDomField(doc, label) {
    const blocks = [...doc.querySelectorAll('div')];
    for (const block of blocks) {
      const strong = block.querySelector('strong');
      if (!strong) continue;
      const strongText = String(strong.textContent || '').trim().replace(/\s+/g, '').toLowerCase();
      if (!strongText.startsWith(String(label || '').toLowerCase())) continue;
      return String(block.textContent || '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/Platforms?:/i, '')
        .replace(/Genres?:/i, '')
        .trim();
    }
    return '';
  }

  function splitHowLongToBeatMetadataList(value) {
    return String(value || '')
      .split(/\s*(?:;|,|\|)\s*/)
      .map(v => v.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
  }

  function convertHowLongToBeatPercentRatingToFiveScale(percent) {
    const n = Number(percent);
    if (!Number.isFinite(n)) return null;
    return Math.round((n / 20) * 100) / 100;
  }

  function extractHowLongToBeatGamePageRating(doc, game) {
    const detailItems = [...doc.querySelectorAll("[class*='profile_details'] li")];
    for (const li of detailItems) {
      const text = String(li.textContent || '').trim().replace(/\s+/g, ' ');
      const match = text.match(/(\d+(?:\.\d+)?)\s*%\s*Rating/i);
      if (match) return convertHowLongToBeatPercentRatingToFiveScale(match[1]);
    }
    const bodyText = String(doc.body && doc.body.innerText || '').trim().replace(/\s+/g, ' ');
    const bodyMatch = bodyText.match(/(\d+(?:\.\d+)?)\s*%\s*Rating/i);
    if (bodyMatch) return convertHowLongToBeatPercentRatingToFiveScale(bodyMatch[1]);
    const raw = game && game.review_score;
    if (raw != null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n)) return n > 5 ? convertHowLongToBeatPercentRatingToFiveScale(n) : Math.round(n * 100) / 100;
    }
    return null;
  }

  function extractHowLongToBeatGamePageDetails(doc, pageUrl = location.href) {
    const nextData = getHowLongToBeatNextData(doc);
    const game = getHowLongToBeatGameObject(nextData);
    const metadata = getHowLongToBeatPageMetadata(nextData);
    const gamePagePlatforms = String(
      (game && game.profile_platform)
      || fallbackHowLongToBeatDomField(doc, 'Platforms')
      || ''
    ).trim().replace(/\s+/g, ' ');
    const genre = String(
      (game && game.profile_genre)
      || fallbackHowLongToBeatDomField(doc, 'Genres')
      || ''
    ).trim().replace(/\s+/g, ' ');
    const rawCoverUrl = (metadata && metadata.image)
      || fallbackHowLongToBeatMetaImage(doc)
      || (game && game.game_image ? `/games/${game.game_image}` : '');
    const coverUrl = rawCoverUrl
      ? stripHowLongToBeatImageWidth(new URL(rawCoverUrl, pageUrl || 'https://howlongtobeat.com/').href)
      : '';
    return {
      gamePagePlatforms,
      gamePageRating: extractHowLongToBeatGamePageRating(doc, game),
      genres: splitHowLongToBeatMetadataList(genre),
      releaseDate: earliestHowLongToBeatReleaseDate(game, doc),
      coverUrl,
    };
  }

  function parseHowLongToBeatGamePage(html, pageUrl) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    return extractHowLongToBeatGamePageDetails(doc, pageUrl);
  }

  async function enrichHowLongToBeatItemsFromGamePages(items) {
    const missed = [];
    const missedByField = {
      releaseDate: [],
      genres: [],
      platforms: [],
      averageRating: [],
      coverUrl: [],
    };
    const failed = [];
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return { missed, missedByField, failed };
    addLog(`HowLongToBeat advanced metadata: checking ${list.length} game pages`);
    let completed = 0;
    await mapWithConcurrency(list, 1, async item => {
      const itemUrl = item.url || item.gameUrl;
      const itemName = item.name || item.title || itemUrl || 'Unknown game';
      try {
        const html = await fetchHtml(itemUrl, { maxAttempts: 2, timeoutMs: 12000 });
        const details = parseHowLongToBeatGamePage(html, itemUrl);
        const detailPlatforms = uniqueSortedLabels(splitHowLongToBeatMetadataList(details.gamePagePlatforms));
        item.platforms = uniqueSortedLabels([...(item.platforms || []), item.platform, ...detailPlatforms]);
        item.genres = uniqueSortedLabels([...(item.genres || []), ...(details.genres || [])]);
        item.release_date = details.releaseDate || item.release_date || '';
        item.fullReleaseDate = item.release_date;
        item.full_release_date = item.release_date;
        item.average_rating = details.gamePageRating == null ? item.average_rating : details.gamePageRating;
        item.averageRating = item.average_rating;
        item.cover_url = details.coverUrl || item.cover_url || '';
        item.coverUrl = item.cover_url;
        item.gamePagePlatforms = detailPlatforms;
        item.game_page_platforms = detailPlatforms;
        completed += 1;
        if (completed === list.length || completed % 5 === 0) {
          addLog(`HowLongToBeat advanced metadata ${completed} of ${list.length}`, 'info', 'hltb-advanced-progress');
        }
        setProgressInRange(20, 80, completed, list.length);
      } catch (error) {
        failed.push({ title: itemName, url: itemUrl, error: error && error.message ? error.message : String(error) });
      }
      if (!item.release_date) missedByField.releaseDate.push(itemName);
      if (!item.genres || !item.genres.length) missedByField.genres.push(itemName);
      if (!item.platforms || !item.platforms.length) missedByField.platforms.push(itemName);
      if (item.average_rating == null) missedByField.averageRating.push(itemName);
      if (!item.cover_url) missedByField.coverUrl.push(itemName);
    });
    removeLog('hltb-advanced-progress');
    Object.entries(missedByField).forEach(([field, names]) => {
      uniqueSortedLabels(names).forEach(name => missed.push({ field, title: name }));
    });
    if (failed.length) addLog(`HowLongToBeat advanced metadata failed for ${failed.length} game page${failed.length === 1 ? '' : 's'}`, 'error');
    return { missed, missedByField, failed };
  }

  async function enrichMobyGamesItemsFromOverviewPages(items) {
    const missed = [];
    const missedByField = {
      fullReleaseDate: [],
      genres: [],
      gameplay: [],
      averageRating: [],
    };
    const failed = [];
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return { missed, missedByField, failed };
    addLog(`MobyGames enhanced metadata: checking ${list.length} game pages`);
    let completed = 0;
    await mapWithConcurrency(items, 1, async item => {
      const itemUrl = mobyItemUrl(item);
      const itemName = item.name || item.title || itemUrl || 'Unknown game';
      try {
        const html = await fetchHtml(itemUrl, { maxAttempts: 2, timeoutMs: 12000 });
        const overview = parseMobyGamesOverviewPage(html);
        item.fullReleaseDate = overview.fullReleaseDate || overview.release_date || item.fullReleaseDate || item.release_date || '';
        item.full_release_date = item.fullReleaseDate;
        item.release_date = item.fullReleaseDate || item.release_date || '';
        if (item.fullReleaseDate) {
          const parts = parseDateParts(item.fullReleaseDate);
          if (parts && parts.year) {
            item.releaseYear = parts.year;
            item.release_year = parts.year;
          }
        }
        item.genres = overview.genres || [];
        item.gameplay = overview.gameplay || [];
        item.platforms = uniqueSortedLabels((overview.platforms && overview.platforms.length ? overview.platforms : item.platforms) || (item.platform ? [item.platform] : []));
        item.averageRating = overview.averageRating == null ? item.averageRating : overview.averageRating;
        item.average_rating = normalizeAverageRatingValue(overview.average_rating == null ? item.average_rating : overview.average_rating);
        if (item.average_rating == null && item.averageRating != null) item.average_rating = normalizeAverageRatingValue(item.averageRating);
        item.averageRating = item.average_rating;
        const missing = [
          !item.fullReleaseDate ? 'full release date' : '',
          !(item.genres.length || item.gameplay.length) ? 'genres/gameplay' : '',
          item.average_rating == null ? 'player average rating' : '',
        ].filter(Boolean);
        if (missing.length) {
          if (!item.fullReleaseDate) missedByField.fullReleaseDate.push(itemName);
          if (!(item.genres.length || item.gameplay.length)) {
            missedByField.genres.push(itemName);
            missedByField.gameplay.push(itemName);
          }
          if (item.average_rating == null) missedByField.averageRating.push(itemName);
          missed.push({
            name: itemName,
            missing,
          });
        }
      } catch (error) {
        item.release_date = item.release_date || (item.releaseYear ? String(item.releaseYear) : '');
        item.fullReleaseDate = item.fullReleaseDate || '';
        item.full_release_date = item.fullReleaseDate;
        item.genres = item.genres || [];
        item.gameplay = item.gameplay || [];
        item.platforms = uniqueSortedLabels(item.platforms || (item.platform ? [item.platform] : []));
        item.average_rating = normalizeAverageRatingValue(item.average_rating == null ? item.averageRating : item.average_rating);
        item.averageRating = item.average_rating;
        failed.push(itemName);
        missedByField.fullReleaseDate.push(itemName);
        missedByField.genres.push(itemName);
        missedByField.gameplay.push(itemName);
        missedByField.averageRating.push(itemName);
        missed.push({
          name: itemName,
          missing: ['full release date', 'genres/gameplay', 'player average rating'],
        });
      } finally {
        if (!exportCancelRequested) {
          completed += 1;
          addLog(`MobyGames enhanced metadata ${completed} of ${list.length}`, 'info', 'moby-enhanced-progress');
          setProgressInRange(20, 80, completed, list.length);
        }
      }
    });
    removeLog('moby-enhanced-progress');
    [
      ['full release dates', missedByField.fullReleaseDate],
      ['genres/gameplay', [...missedByField.genres, ...missedByField.gameplay]],
      ['player average ratings', missedByField.averageRating],
    ].forEach(([label, names]) => {
      const uniqueNames = [...new Set(names.filter(Boolean))];
      if (uniqueNames.length) addLog(`MobyGames missing ${label}: ${uniqueNames.join(', ')}`, 'error');
    });
    return { missed, missedByField, failed };
  }

  function withMobyGamesRenderedDocument(url, parser, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      let settled = false;
      let interval = null;
      let timeout = null;

      function cleanup() {
        if (interval) clearInterval(interval);
        if (timeout) clearTimeout(timeout);
        iframe.remove();
      }

      function finish(fn, value) {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      }

      function tryParse({ allowEmpty = false } = {}) {
        try {
          const doc = iframe.contentDocument;
          if (!doc) return false;
          const hasLikelyTable = [...doc.querySelectorAll('table')].some(table => {
            const headers = [...table.querySelectorAll('thead th, tr:first-child th')]
              .map(th => String(th.textContent || '').trim().replace(/\s+/g, ' '));
            return headers.includes('Title (Year)') || (headers.includes('Name') && headers.includes('Games'));
          });
          if (!allowEmpty && !hasLikelyTable) return false;
          finish(resolve, parser(doc, iframe.contentWindow ? iframe.contentWindow.location.href : url));
          return true;
        } catch (error) {
          finish(reject, error);
          return true;
        }
      }

      iframe.hidden = true;
      iframe.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none;';
      iframe.addEventListener('load', () => {
        setTimeout(() => tryParse({ allowEmpty: false }), 250);
      });
      interval = setInterval(() => tryParse({ allowEmpty: false }), 300);
      timeout = setTimeout(() => {
        if (!tryParse({ allowEmpty: true })) {
          finish(reject, new Error(`Timed out loading ${url}`));
        }
      }, timeoutMs);
      document.body.appendChild(iframe);
      iframe.src = url;
    });
  }

  function withHowLongToBeatRenderedDocument(url, parser, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      let settled = false;
      let interval = null;
      let timeout = null;

      function cleanup() {
        if (interval) clearInterval(interval);
        if (timeout) clearTimeout(timeout);
        iframe.remove();
      }

      function finish(fn, value) {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      }

      function tryParse({ allowEmpty = false } = {}) {
        try {
          const doc = iframe.contentDocument;
          if (!doc) return false;
          const container = doc.querySelector('#user_games');
          const loading = container && container.querySelector('.loading_bar');
          const hasGames = !!(container && container.querySelector('a[href*="/game"]'));
          if (!allowEmpty && (!container || loading || !hasGames)) return false;
          finish(resolve, parser(doc, iframe.contentWindow ? iframe.contentWindow.location.href : url));
          return true;
        } catch (error) {
          finish(reject, error);
          return true;
        }
      }

      iframe.hidden = true;
      iframe.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none;';
      iframe.addEventListener('load', () => {
        setTimeout(() => tryParse({ allowEmpty: false }), 500);
      });
      interval = setInterval(() => tryParse({ allowEmpty: false }), 500);
      timeout = setTimeout(() => {
        if (!tryParse({ allowEmpty: true })) {
          finish(reject, new Error(`Timed out loading ${url}`));
        }
      }, timeoutMs);
      document.body.appendChild(iframe);
      iframe.src = url;
    });
  }

  function loadMobyGamesExportState() {
    const raw = storageGet(MOBYGAMES_EXPORT_STATE_KEY, null);
    if (!raw) return null;
    try {
      const state = JSON.parse(raw);
      return state && state.active ? state : null;
    } catch (_) {
      return null;
    }
  }

  function isBrowserReloadNavigation() {
    const navEntry = performance && typeof performance.getEntriesByType === 'function'
      ? performance.getEntriesByType('navigation')[0]
      : null;
    if (navEntry && navEntry.type) return navEntry.type === 'reload';
    return !!(performance && performance.navigation && performance.navigation.type === 1);
  }

  function saveMobyGamesExportState(state) {
    if (state && exportInProgress) {
      state.formats = getSelectedFileFormats();
      state.pausedTotalMs = exportPausedTotalMs + (exportPauseRequested && exportPausedStartedAt ? Date.now() - exportPausedStartedAt : 0);
    }
    storageSet(MOBYGAMES_EXPORT_STATE_KEY, JSON.stringify(state));
  }

  function clearMobyGamesExportState() {
    try {
      localStorage.removeItem(MOBYGAMES_EXPORT_STATE_KEY);
    } catch (_) {
      storageSet(MOBYGAMES_EXPORT_STATE_KEY, '');
    }
  }

  function currentMobyGamesUrlWithoutHash() {
    return `${location.origin}${location.pathname}${location.search}`;
  }

  function openMobyGamesStatusConfiguration() {
    const collectionUrl = getMobyGamesCollectionRootUrl(location.href);
    if (collectionUrl && !isMobyGamesCollectionRootPage(location.href)) {
      savePendingNavMessage('Navigated to the correct page. Continue with configurations or exporting.');
      location.href = collectionUrl;
      return;
    }
    renderStatusPillConfigModal();
  }

  function setHowLongToBeatPreflightWait(on) {
    hltbPreflightInProgress = !!on;
    if (panel) panel.classList.toggle('bgd-hltb-preflight-running', !!on);
    if (exportBtn) {
      exportBtn.disabled = !!on;
      exportBtn.textContent = on ? 'LOADING' : 'Export';
    }
    if (configBtn) configBtn.disabled = !!on;
    // During config preflight, suppress the Pause/Stop run controls and keep
    // the Export button (in WAIT state) as the only visible control.
    if (on) {
      if (runControls) runControls.hidden = true;
      if (exportBtn) exportBtn.hidden = false;
    }
  }

  async function countHowLongToBeatCategoryGames(category, statusId) {
    const mapping = {
      statusId,
      status: category.name,
      statusColor: '#7dd3fc',
      collection: category,
    };
    const signatures = new Set();
    let total = 0;
    for (let page = 1; page <= 100; page += 1) {
      const url = getHowLongToBeatPageUrl(category.url, page);
      let parsed = null;
      try {
        const target = new URL(url, location.href);
        const current = new URL(location.href);
        if (target.pathname === current.pathname && target.search === current.search) {
          parsed = parseHowLongToBeatGamesDocument(document, location.href, mapping);
        } else {
          parsed = await withHowLongToBeatRenderedDocument(url, (doc, renderedUrl) =>
            parseHowLongToBeatGamesDocument(doc, renderedUrl, mapping)
          );
        }
      } catch (error) {
        if (page === 1) addLog(`HowLongToBeat status source ${category.name}: no page found, counted as 0`, 'info', `hltb-config-empty-${statusId}`);
        break;
      }
      const signature = (parsed.games || []).map(game => `${game.gameUrl}|${game.platform}`).join('||');
      if (!signature || signatures.has(signature) || !(parsed.games || []).length) break;
      signatures.add(signature);
      total += parsed.games.length;
    }
    return total;
  }

  function syncHowLongToBeatConfigCollectionCounts(categories) {
    const byUrl = new Map((categories || []).map(category => [category.url, category]));
    (statusPillConfig.categories || []).forEach(category => {
      (category.pills || []).forEach(pill => {
        if (!pill || pill.kind !== 'status') return;
        pill.collections = normalizeStatusPillCollections(pill.collections).map(collection => {
          const fresh = byUrl.get(collection.url);
          return fresh ? { ...collection, name: fresh.name, games: fresh.games } : collection;
        });
      });
    });
    saveStatusPillConfig();
  }

  async function runHowLongToBeatStatusConfigurationPreflight() {
    if (hltbPreflightInProgress) return;
    clearExportLog();
    panel.classList.add('is-active');
    setProgress(5);
    setHowLongToBeatPreflightWait(true);
    const username = getHowLongToBeatUserSlug();
    try {
      if (!username) throw new Error('Open a HowLongToBeat user games page before configuring status pills.');
      addLog('HowLongToBeat status configuration scrape started');
      const categories = buildHowLongToBeatKnownCategories(username, document);
      const mappings = categories.map((category, index) => ({
        statusId: makeHowLongToBeatCategorySlug(category.name) || `category-${index + 1}`,
        status: category.name,
        statusColor: '#7dd3fc',
        collection: category,
      }));
      const state = {
        active: true,
        phase: 'scrape',
        configPreflight: true,
        startUrl: currentHowLongToBeatUrlWithoutHash(),
        username,
        userSlug: username,
        config: cloneStatusPillConfig(statusPillConfig),
        formats: { csv: false, json: false, html: false },
        mappings,
        currentIndex: 0,
        currentPage: 1,
        pageSignatures: [],
        items: [],
        failures: [],
        categoryCounts: [],
        includeEnhancedMetadata: false,
        includeOfflineCovers: false,
        enhancedMetadataComplete: false,
        enhancedMetadataMisses: [],
        enhancedMetadataMissesByField: {},
        enhancedMetadataFailures: [],
        startedAt: Date.now(),
      };
      saveHowLongToBeatExportState(state);
      addLog(`Opening ${mappings[0].collection.name} category page...`);
      location.href = getHowLongToBeatPageUrl(mappings[0].collection.url, 1);
    } catch (error) {
      setProgress(100);
      addLog(error && error.message ? error.message : String(error), 'error');
      setHowLongToBeatPreflightWait(false);
    }
  }

  async function openSourceStatusConfiguration() {
    if (isMobyGamesHost()) {
      openMobyGamesStatusConfiguration();
      return;
    }
    if (isHowLongToBeatHost()) {
      const gamesRootUrl = getHowLongToBeatUserGamesRootUrl(location.href);
      if (gamesRootUrl && !isHowLongToBeatUserGamesRootPage(location.href)) {
        savePendingNavMessage('Navigated to the correct page. Continue with configurations or exporting.');
        location.href = gamesRootUrl;
        return;
      }
      if (hltbPreflightData) {
        renderStatusPillConfigModal();
        return;
      }
      await runHowLongToBeatStatusConfigurationPreflight();
      return;
    }
    renderStatusPillConfigModal();
  }

  function flashMobyGamesConfigDisabled() {
    if (!configBtn) return;
    if (configButtonDisabledTimer) {
      clearTimeout(configButtonDisabledTimer);
      configButtonDisabledTimer = null;
    }
    configBtn.classList.add('is-disabled');
    configBtn.setAttribute('aria-disabled', 'true');
    configBtn.textContent = '🚫';
    configButtonDisabledTimer = setTimeout(() => {
      if (!configBtn) return;
      configBtn.textContent = '⚙️';
      if (!exportInProgress) {
        configBtn.classList.remove('is-disabled');
        configBtn.removeAttribute('aria-disabled');
      }
      configButtonDisabledTimer = null;
    }, 2200);
  }

  function syncMobyGamesConfigButtonDisabledState() {
    if (!isConfiguredStatusSourceHost() || !configBtn) return;
    const disabled = !!exportInProgress;
    configBtn.classList.toggle('is-disabled', disabled);
    if (disabled) {
      configBtn.setAttribute('aria-disabled', 'true');
    } else {
      configBtn.removeAttribute('aria-disabled');
      if (!configButtonDisabledTimer) configBtn.textContent = '⚙️';
    }
  }

  async function waitForMobyGamesCollectionGameTable(timeoutMs = 12000) {
    let started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const pauseCheckStartedAt = Date.now();
      await waitIfExportPaused();
      started += Date.now() - pauseCheckStartedAt;
      const parsed = parseMobyGamesCollectionGamesDocument(document, location.href, {
        collection: { name: 'probe', url: location.href },
        status: 'probe',
      });
      if (parsed.debug && parsed.debug.tableFound) return parsed;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    return parseMobyGamesCollectionGamesDocument(document, location.href, {
      collection: { name: 'probe', url: location.href },
      status: 'probe',
    });
  }

  function getMobyGamesCollectionRowsSignature() {
    const parsed = parseMobyGamesCollectionGamesDocument(document, location.href, {
      collection: { name: 'probe', url: location.href },
      status: 'probe',
    });
    return (parsed.games || []).map(game => `${game.gameUrl}|${game.platform}`).join('||');
  }

  function findMobyGamesClientNextButton() {
    return [...document.querySelectorAll('p.no-select a[href="#"], a[href="#"]')].find(link => {
      const text = String(link.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase();
      if (text !== 'next') return false;
      const parentText = String(link.parentElement && link.parentElement.textContent || '').toLowerCase();
      return parentText.includes('page') || parentText.includes('games');
    }) || null;
  }

  async function waitForMobyGamesCollectionPageChange(previousSignature, timeoutMs = 8000) {
    let started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const pauseCheckStartedAt = Date.now();
      await waitIfExportPaused();
      started += Date.now() - pauseCheckStartedAt;
      const nextSignature = getMobyGamesCollectionRowsSignature();
      if (nextSignature && nextSignature !== previousSignature) return true;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
  }

  function activateMobyGamesClientNextButton(nextButton) {
    if (!nextButton) return;
    if (typeof nextButton.click === 'function') {
      try { nextButton.click(); } catch (_) {}
    }
    ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(type => {
      try {
        nextButton.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      } catch (_) {}
    });
  }

  async function scrapeCurrentRenderedMobyGamesCollection(mapping) {
    const games = [];
    const failures = [];
    let pageCount = 0;
    const seenSignatures = new Set();

    while (pageCount < 100) {
      addLog(`Waiting for ${mapping.collection.name} table to render...`, 'info', `moby-wait-${mapping.collection.url}`);
      const parsedProbe = await waitForMobyGamesCollectionGameTable(60000);
      removeLog(`moby-wait-${mapping.collection.url}`);
      const parsed = parseMobyGamesCollectionGamesDocument(document, location.href, mapping);
      const debug = parsed.debug || parsedProbe.debug || {};
      const signature = getMobyGamesCollectionRowsSignature();
      logMobyGamesCollectionDebug('Parsed top-level MobyGames collection games page.', {
        collection: mapping.collection.name,
        url: location.href,
        page: pageCount + 1,
        ...debug,
      });

      if (!parsed.games.length) {
        failures.push((debug.failures || []).join(' ') || `No games found on rendered page ${pageCount + 1}.`);
        break;
      }
      if (seenSignatures.has(signature)) {
        failures.push(`Repeated table page detected at rendered page ${pageCount + 1}; stopping pagination.`);
        break;
      }
      seenSignatures.add(signature);
      games.push(...parsed.games);
      pageCount += 1;

      const nextButton = findMobyGamesClientNextButton();
      if (!nextButton) break;
      addLog(`Scraped ${games.length} games from ${mapping.collection.name}; loading next page...`, 'info', `moby-page-${mapping.collection.url}`);
      activateMobyGamesClientNextButton(nextButton);
      const changed = await waitForMobyGamesCollectionPageChange(signature);
      if (!changed) {
        failures.push(`Next page did not load after page ${pageCount}.`);
        break;
      }
    }

    const uniqueByKey = new Map();
    games.forEach(game => uniqueByKey.set(`${game.gameUrl}|${game.platform}|${game.collection}|${game.status}`, game));
    return {
      games: [...uniqueByKey.values()],
      pageCount,
      failures,
    };
  }

  function getMobyGamesStatusOrderMap(config) {
    const order = new Map();
    let index = 0;
    (config && Array.isArray(config.categories) ? config.categories : []).forEach(category => {
      (category.pills || []).forEach(pill => {
        if (!pill || pill.kind !== 'status') return;
        if (pill.id && !order.has(pill.id)) {
          order.set(pill.id, index);
          index += 1;
        }
      });
    });
    return order;
  }

  function getMobyGamesItemIdentity(item) {
    return String(mobyItemUrl(item) || item.name || item.title || '')
      .trim()
      .toLowerCase();
  }

  function mergeOrderedMobyGamesStatusEntries(entries, statusOrder) {
    const byKey = new Map();
    entries.forEach(entry => {
      const key = entry.id || entry.label;
      if (!key || byKey.has(key)) return;
      byKey.set(key, entry);
    });
    return [...byKey.values()].sort((a, b) => {
      const aOrder = a.id && statusOrder.has(a.id) ? statusOrder.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bOrder = b.id && statusOrder.has(b.id) ? statusOrder.get(b.id) : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a.label || '').localeCompare(String(b.label || ''), undefined, { sensitivity: 'base', numeric: true });
    });
  }

  function normalizeMobyGamesSharedExportItem(rawItem) {
    const sourceMeta = rawItem && rawItem.source_meta && typeof rawItem.source_meta === 'object'
      ? rawItem.source_meta
      : {};
    const item = normalizeSharedExportItem(rawItem, { defaultStatus: '' });
    const userRating = getMobyGamesUserRating(rawItem);
    const statuses = [...new Set(exportListFromValue(
      Array.isArray(rawItem.statuses) && rawItem.statuses.length ? rawItem.statuses : rawItem.status
    ))];
    const statusIds = [...new Set(exportListFromValue(
      Array.isArray(rawItem.statusIds) && rawItem.statusIds.length
        ? rawItem.statusIds
        : Array.isArray(rawItem.status_ids) && rawItem.status_ids.length
          ? rawItem.status_ids
          : rawItem.statusId || rawItem.status_id || sourceMeta.status_id || sourceMeta.status_ids
    ))];

    item.name = item.name || item.title || '';
    item.title = item.title || item.name;
    item.gameUrl = item.gameUrl || item.url || '';
    item.url = item.url || item.gameUrl;
    item.coverUrl = item.coverUrl || item.cover_url || '';
    item.cover_url = item.cover_url || item.coverUrl;
    item.status = statuses[0] || item.status || '';
    item.statusId = statusIds[0] || item.statusId || item.status_id || '';
    item.status_id = statusIds[0] || item.status_id || item.statusId || '';
    item.statuses = statuses.length ? statuses : (item.status ? [item.status] : []);
    item.statusIds = statusIds;
    item.status_ids = statusIds;
    item.collection = item.collection || item.mobygames_collection || sourceMeta.collection || '';
    item.collections = exportListFromValue(item.collections || sourceMeta.collections || item.collection);
    item.collectionUrl = item.collectionUrl || item.collection_url || item.mobygames_collection_url || sourceMeta.collection_url || '';
    item.collection_url = item.collection_url || item.collectionUrl;
    item.collectionUrls = exportListFromValue(item.collectionUrls || item.collection_urls || sourceMeta.collection_urls || item.collectionUrl);
    item.collection_urls = item.collectionUrls;
    item.releaseYear = item.releaseYear || item.release_year || sourceMeta.release_year || '';
    item.release_year = item.release_year || item.releaseYear;
    item.fullReleaseDate = item.fullReleaseDate || item.full_release_date || sourceMeta.full_release_date || item.release_date || '';
    item.full_release_date = item.full_release_date || item.fullReleaseDate;
    item.release_date = item.release_date || item.fullReleaseDate || item.releaseYear || '';
    item.genres = Array.isArray(rawItem.mobygames_genres) ? rawItem.mobygames_genres : exportListFromValue(item.genres);
    item.gameplay = Array.isArray(rawItem.mobygames_gameplay) ? rawItem.mobygames_gameplay : exportListFromValue(item.gameplay || sourceMeta.gameplay);
    item.platforms = uniqueSortedLabels(item.platforms || (item.platform ? [item.platform] : []));
    item.userRating = userRating;
    item.user_rating = userRating;
    item.average_rating = normalizeAverageRatingValue(item.average_rating === undefined ? item.averageRating : item.average_rating);
    item.averageRating = item.average_rating;
    item.source_meta = {
      ...sourceMeta,
      collection: item.collection,
      collections: item.collections,
      collection_url: mobyItemCollectionUrl(item),
      collection_urls: item.collectionUrls,
      gameplay: item.gameplay,
      release_year: mobyItemReleaseYear(item),
      full_release_date: mobyItemFullReleaseDate(item),
      status_ids: item.statusIds,
      status_color: item.statusColor || sourceMeta.status_color || '',
    };
    return item;
  }

  function mergeMobyGamesItemsForExport(items, config) {
    const statusOrder = getMobyGamesStatusOrderMap(config);
    const byGame = new Map();
    function getStatusEntriesForItem(item) {
      const labels = Array.isArray(item.statuses) && item.statuses.length ? item.statuses : [item.status || 'Status Pill'];
      const ids = Array.isArray(item.statusIds) && item.statusIds.length
        ? item.statusIds
        : Array.isArray(item.status_ids) && item.status_ids.length
          ? item.status_ids
          : item.statusId || item.status_id
            ? [item.statusId || item.status_id]
            : [];
      return labels.map((label, index) => ({
        id: ids[index] || '',
        label: label || 'Status Pill',
        color: index === 0 ? item.statusColor || '' : '',
      }));
    }
    (Array.isArray(items) ? items : []).forEach(item => {
      const key = getMobyGamesItemIdentity(item);
      if (!key) return;
      const statusEntries = getStatusEntriesForItem(item);

      if (!byGame.has(key)) {
        byGame.set(key, {
          ...item,
          _statusEntries: statusEntries,
          _collectionEntries: [{
            name: item.collection || '',
            url: mobyItemCollectionUrl(item),
          }],
        });
        return;
      }

      const existing = byGame.get(key);
      existing._statusEntries.push(...statusEntries);
      existing._collectionEntries.push({
        name: item.collection || '',
        url: mobyItemCollectionUrl(item),
      });
      existing.platforms = uniqueSortedLabels([...(existing.platforms || []), ...(item.platforms || []), item.platform]);
      existing.genres = [...new Set([...(existing.genres || []), ...(item.genres || [])].filter(Boolean))];
      existing.gameplay = [...new Set([...(existing.gameplay || []), ...(item.gameplay || [])].filter(Boolean))];
      existing.full_release_date = mobyItemFullReleaseDate(existing) || mobyItemFullReleaseDate(item);
      existing.fullReleaseDate = existing.fullReleaseDate || existing.full_release_date;
      existing.release_date = existing.release_date || item.release_date || existing.full_release_date || '';
      existing.releaseYear = existing.releaseYear == null ? item.releaseYear : existing.releaseYear;
      existing.release_year = existing.release_year == null ? item.release_year : existing.release_year;
      existing.average_rating = existing.average_rating == null ? item.average_rating : existing.average_rating;
      existing.averageRating = existing.averageRating == null ? item.averageRating : existing.averageRating;
      existing.userRating = existing.userRating == null ? (item.userRating == null ? item.user_rating : item.userRating) : existing.userRating;
      existing.user_rating = existing.user_rating == null ? (item.user_rating == null ? item.userRating : item.user_rating) : existing.user_rating;
      existing.coverUrl = existing.coverUrl || mobyItemCoverUrl(item);
      existing.cover_url = existing.cover_url || mobyItemCoverUrl(item);
    });

    return [...byGame.values()].map(item => {
      const userRating = getMobyGamesUserRating(item);
      const statusEntries = mergeOrderedMobyGamesStatusEntries(item._statusEntries || [], statusOrder);
      const collectionEntries = [];
      const collectionKeys = new Set();
      (item._collectionEntries || []).forEach(collection => {
        const key = collection.url || collection.name;
        if (!key || collectionKeys.has(key)) return;
        collectionKeys.add(key);
        collectionEntries.push(collection);
      });
      const statuses = statusEntries.map(entry => entry.label).filter(Boolean);
      const statusIds = statusEntries.map(entry => entry.id).filter(Boolean);
      const collections = collectionEntries.map(entry => entry.name).filter(Boolean);
      const collectionUrls = collectionEntries.map(entry => entry.url).filter(Boolean);
      const primaryStatus = statusEntries[0] || {};
      const url = mobyItemUrl(item);
      const coverUrl = mobyItemCoverUrl(item);
      const collectionUrl = collectionUrls[0] || mobyItemCollectionUrl(item);
      const releaseYear = mobyItemReleaseYear(item);
      const fullReleaseDate = mobyItemFullReleaseDate(item);
      return {
        ...item,
        url,
        gameUrl: item.gameUrl || url,
        cover_url: coverUrl,
        coverUrl: item.coverUrl || coverUrl,
        status: statuses[0] || item.status || '',
        statusId: primaryStatus.id || item.statusId || item.status_id || '',
        status_id: primaryStatus.id || item.status_id || item.statusId || '',
        statusColor: primaryStatus.color || item.statusColor || '',
        statuses,
        statusIds,
        status_ids: statusIds,
        collection: collections.join('; ') || item.collection || '',
        collections,
        collection_url: collectionUrl,
        collectionUrl: item.collectionUrl || collectionUrl,
        collectionUrls,
        collection_urls: collectionUrls,
        release_year: releaseYear,
        releaseYear: item.releaseYear || releaseYear,
        full_release_date: fullReleaseDate,
        fullReleaseDate: item.fullReleaseDate || fullReleaseDate,
        release_date: item.release_date || fullReleaseDate || releaseYear || '',
        userRating,
        user_rating: userRating,
        platforms: uniqueSortedLabels(item.platforms || (item.platform ? [item.platform] : [])),
        _statusEntries: undefined,
        _collectionEntries: undefined,
      };
    });
  }

  function buildMobyGamesPayloadFromState(state) {
    const items = mergeMobyGamesItemsForExport(state.items || [], state.config || null)
      .map(item => normalizeMobyGamesSharedExportItem(item));
    return {
      sourceWebsite: getSourceWebsite('mobygames'),
      username: state.username || userSlug,
      source: state.startUrl,
      generated_at: new Date().toISOString(),
      status_pill_config: state.config || null,
      collections: (state.mappings || []).map(mapping => ({
        name: mapping.collection.name,
        games: mapping.collection.games,
        url: mapping.collection.url,
        status: mapping.status,
      })),
      failed_collections: state.failures || [],
      enhanced_metadata_misses: state.enhancedMetadataMisses || [],
      enhanced_metadata_misses_by_field: state.enhancedMetadataMissesByField || {},
      enhanced_metadata_failures: state.enhancedMetadataFailures || [],
      total: items.length,
      items: items.sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base', numeric: true }) ||
        String(a.platform || '').localeCompare(String(b.platform || ''), undefined, { sensitivity: 'base', numeric: true })
      ),
    };
  }

  async function prepareHtmlPayloadWithOfflineCovers(sourceId, payload, includeOfflineCovers) {
    if (!includeOfflineCovers) return payload;
    const offlineCoverOptions = getSourceOfflineCoverOptions(sourceId);
    const coverByUrl = await buildOfflineCoverMap(payload.items || [], offlineCoverOptions);
    checkExportCancelled();
    return payloadWithOfflineCovers(payload, coverByUrl, offlineCoverOptions);
  }

  function downloadPayloadFiles({ source, payload, htmlPayload, formats, baseName }) {
    const descriptor = getSourceFormatDescriptor(source);
    if (formats.json) downloadText(`${baseName}.json`, 'application/json;charset=utf-8', descriptor.buildJson(payload));
    if (formats.csv) downloadText(`${baseName}.csv`, 'text/csv;charset=utf-8', descriptor.buildCsv(payload));
    if (formats.html) downloadText(`${baseName}.html`, 'text/html;charset=utf-8', descriptor.buildHtml(htmlPayload));
  }

  async function downloadBackloggdPayload(payload, formats, targetSlug, { includeOfflineCovers = false } = {}) {
    const source = getSourceDescriptorById(DEFAULT_SOURCE_ID);
    const finalFormats = formats || getSelectedFileFormats();
    const htmlPayload = finalFormats.html
      ? await prepareHtmlPayloadWithOfflineCovers(source.id, payload, includeOfflineCovers)
      : payload;
    const baseName = libraryBaseName(source.id, targetSlug || payload.username || userSlug);
    downloadPayloadFiles({
      source: source.id,
      payload,
      htmlPayload,
      formats: finalFormats,
      baseName,
    });
  }

  async function downloadMobyGamesPayload(payload, formats, targetSlug, { includeOfflineCovers = false } = {}) {
    const source = getSourceDescriptorById('mobygames');
    const finalFormats = formats || getSelectedFileFormats();
    const htmlPayload = finalFormats.html
      ? await prepareHtmlPayloadWithOfflineCovers(source.id, payload, includeOfflineCovers)
      : payload;
    const baseName = libraryBaseName(source.id, targetSlug || payload.username || userSlug);
    downloadPayloadFiles({
      source: source.id,
      payload,
      htmlPayload,
      formats: finalFormats,
      baseName,
    });
  }

  async function downloadHowLongToBeatPayload(payload, formats, targetSlug, { includeOfflineCovers = false } = {}) {
    const source = getSourceDescriptorById('howlongtobeat');
    const finalFormats = formats || getSelectedFileFormats();
    const htmlPayload = finalFormats.html
      ? await prepareHtmlPayloadWithOfflineCovers(source.id, payload, includeOfflineCovers)
      : payload;
    const baseName = libraryBaseName(source.id, targetSlug || payload.username || userSlug);
    downloadPayloadFiles({
      source: source.id,
      payload,
      htmlPayload,
      formats: finalFormats,
      baseName,
    });
  }

  async function resumeMobyGamesExportIfNeeded() {
    if (!isMobyGamesHost()) return;
    if (isBrowserReloadNavigation()) {
      clearMobyGamesExportState();
      return;
    }
    const state = loadMobyGamesExportState();
    if (!state || state.phase === 'idle') return;

    panel.classList.add('is-active');
    clearExportLog();
    exportInProgress = true;
    exportCancelRequested = false;
    exportPauseRequested = false;
    exportPauseResolver = null;
    exportPausedStartedAt = 0;
    exportPausedTotalMs = Number(state.pausedTotalMs || 0);
    exportPriorElapsedMs = 0;
    exportStopMessageShown = false;
    exportStartFileFormatSignature = getFileFormatSignature(state.formats || getSelectedFileFormats());
    showRunControls();
    syncRunControls();
    syncMobyGamesConfigButtonDisabledState();
    updatePendingFileFormatNote();
    setProgress(10);

    try {
      if (state.phase === 'finalize') {
        addLog(`MobyGames selected collections: ${(state.mappings || []).map(mapping => `${mapping.collection.name} -> ${mapping.status}`).join(', ')}`);
        (state.collectionCounts || []).forEach(entry => addLog(`Scraped ${entry.count} games from ${entry.collection}`));
        if ((state.failures || []).length) addLog(`MobyGames failed collections: ${state.failures.map(failure => failure.collection).join(', ')}`, 'error');
        if (state.includeEnhancedMetadata && !state.enhancedMetadataComplete) {
          state.items = mergeMobyGamesItemsForExport(state.items || [], state.config || null);
          const enhancement = await enrichMobyGamesItemsFromOverviewPages(state.items || []);
          state.enhancedMetadataComplete = true;
          state.enhancedMetadataMisses = enhancement.missed || [];
          state.enhancedMetadataMissesByField = enhancement.missedByField || {};
          state.enhancedMetadataFailures = enhancement.failed || [];
          saveMobyGamesExportState(state);
        }
        const payload = buildMobyGamesPayloadFromState(state);
        const finalFormats = getMobyGamesExportFormatsForDownload(state);
        const formatDownload = prepareFormatsForDownload(finalFormats);
        addLog(`MobyGames total games exported: ${payload.items.length}`);
        if (formatDownload.canDownload) {
          await downloadMobyGamesPayload(payload, finalFormats, state.username, {
            includeOfflineCovers: !!state.includeOfflineCovers,
          });
        }
        clearMobyGamesExportState();
        setProgress(100);
        addLog(`Finished: ${payload.items.length} MobyGames games exported`);
        addLog(`Export took ${formatExportElapsedTime(state.startedAt || Date.now())}`);
        exportInProgress = false;
        exportTargetSlug = '';
        exportCancelRequested = false;
        exportStartFileFormatSignature = '';
        updatePendingFileFormatNote();
        hideRunControls();
        return;
      }

      const mapping = (state.mappings || [])[state.currentIndex || 0];
      if (!mapping) {
        state.phase = 'finalize';
        saveMobyGamesExportState(state);
        location.href = state.startUrl;
        return;
      }

      addLog(`MobyGames selected collections: ${(state.mappings || []).map(entry => `${entry.collection.name} -> ${entry.status}`).join(', ')}`);
      addLog(`Scraping ${mapping.collection.name} (${mapping.status}) from rendered page...`);

      const renderedCollection = await scrapeCurrentRenderedMobyGamesCollection(mapping);

      const existingItems = Array.isArray(state.items) ? state.items : [];
      const nextItems = [...existingItems, ...renderedCollection.games];
      const uniqueByKey = new Map();
      nextItems.forEach(game => uniqueByKey.set(`${game.gameUrl}|${game.platform}|${game.collection}|${game.status}`, game));
      state.items = [...uniqueByKey.values()];
      if (!renderedCollection.games.length || renderedCollection.failures.length) {
        state.failures = Array.isArray(state.failures) ? state.failures : [];
        renderedCollection.failures.forEach(error => {
          state.failures.push({
            collection: mapping.collection.name,
            url: mapping.collection.url,
            error,
          });
        });
      }

      state.collectionCounts = Array.isArray(state.collectionCounts) ? state.collectionCounts : [];
      state.collectionCounts.push({ collection: mapping.collection.name, status: mapping.status, count: renderedCollection.games.length });
      const nextIndex = (state.currentIndex || 0) + 1;
      state.currentIndex = nextIndex;
      setProgress(Math.min(92, 15 + Math.round((nextIndex / Math.max(1, state.mappings.length)) * 75)));
      if (nextIndex >= state.mappings.length) {
        state.phase = 'finalize';
        saveMobyGamesExportState(state);
        location.href = state.startUrl;
      } else {
        state.phase = 'scrape';
        saveMobyGamesExportState(state);
        location.href = state.mappings[nextIndex].collection.url;
      }
    } catch (error) {
      clearMobyGamesExportState();
      addLog(error && error.message ? error.message : String(error), 'error');
      setProgress(100);
      exportInProgress = false;
      exportTargetSlug = '';
      exportCancelRequested = false;
      hideRunControls();
    }
  }

  function syncHowLongToBeatOfflineCoverOption() {
    if (!isHowLongToBeatHost() || !chkOfflineCovers) return;
    const enabled = !!(chkGenres && chkGenres.checked);
    chkOfflineCovers.disabled = !enabled;
    if (!enabled && chkOfflineCovers.checked) {
      chkOfflineCovers.checked = false;
      storageSet('bgdChkOfflineCovers', '0');
    }
  }

  async function resumeHowLongToBeatExportIfNeeded() {
    if (!isHowLongToBeatHost()) return;
    if (isBrowserReloadNavigation()) {
      clearHowLongToBeatExportState();
      return;
    }
    const state = loadHowLongToBeatExportState();
    if (!state || state.phase === 'idle') return;

    panel.classList.add('is-active');
    clearExportLog();
    exportInProgress = true;
    exportCancelRequested = false;
    exportPauseRequested = false;
    exportPauseResolver = null;
    exportPausedStartedAt = 0;
    exportPausedTotalMs = Number(state.pausedTotalMs || 0);
    exportPriorElapsedMs = Number(state.priorElapsedMs || 0);
    exportStopMessageShown = false;
    // (no real download is happening).  Using that as the start signature would make the
    // "Export Queue Updated" notification fire on every page navigation, because the UI
    // checkboxes still reflect the user's real format selection.  Instead, treat the current
    // UI selection as the baseline so the note is never triggered spuriously.
    exportStartFileFormatSignature = state.configPreflight
      ? getFileFormatSignature()
      : getFileFormatSignature(state.formats || getSelectedFileFormats());
    showRunControls();
    syncRunControls();
    syncMobyGamesConfigButtonDisabledState();
    updatePendingFileFormatNote();
    setProgress(10);
    if (state.configPreflight) setHowLongToBeatPreflightWait(true);

    try {
      if (state.phase === 'finalize') {
        addLog(`HowLongToBeat selected categories: ${(state.mappings || []).map(mapping => `${mapping.collection.name} -> ${mapping.status}`).join(', ')}`);
        (state.categoryCounts || []).forEach(entry => addLog(`Scraped ${entry.count} games from ${entry.category}`));
        if ((state.failures || []).length) addLog(`HowLongToBeat failed categories: ${state.failures.map(failure => failure.category).join(', ')}`, 'error');
        if (state.configPreflight) {
          const categories = (state.mappings || []).map(mapping => {
            const countEntry = (state.categoryCounts || []).find(entry => entry.category === mapping.collection.name);
            return {
              ...mapping.collection,
              games: countEntry ? Number(countEntry.count) || 0 : 0,
            };
          });
          hltbPreflightCategories = categories;
          const preflightElapsedMs = getActiveExportElapsedMs(state.startedAt || Date.now());
          hltbPreflightData = {
            items: state.items || [],
            mappings: state.mappings || [],
            categoryCounts: state.categoryCounts || [],
            username: state.username || userSlug,
            startUrl: state.startUrl || location.href,
            startedAt: state.startedAt || Date.now(),
            preflightElapsedMs,
          };
          syncHowLongToBeatConfigCollectionCounts(categories);
          clearHowLongToBeatExportState();
          setProgress(100);
          addLog(`HowLongToBeat status configuration scrape complete: ${categories.map(category => `${category.name} ${category.games}`).join(', ')}`);
          exportInProgress = false;
          exportTargetSlug = '';
          exportCancelRequested = false;
          exportStartFileFormatSignature = '';
          updatePendingFileFormatNote();
          hideRunControls();
          setHowLongToBeatPreflightWait(false);
          renderStatusPillConfigModal();
          return;
        }
        if (state.includeEnhancedMetadata && !state.enhancedMetadataComplete) {
          state.items = mergeHowLongToBeatItemsForExport(state.items || [], state.config || null);
          const enhancement = await enrichHowLongToBeatItemsFromGamePages(state.items || []);
          state.enhancedMetadataComplete = true;
          state.enhancedMetadataMisses = enhancement.missed || [];
          state.enhancedMetadataMissesByField = enhancement.missedByField || {};
          state.enhancedMetadataFailures = enhancement.failed || [];
          saveHowLongToBeatExportState(state);
        }
        const payload = buildHowLongToBeatPayloadFromState(state);
        const finalFormats = getHowLongToBeatExportFormatsForDownload(state);
        const formatDownload = prepareFormatsForDownload(finalFormats);
        addLog(`HowLongToBeat total games exported: ${payload.items.length}`);
        if (formatDownload.canDownload) {
          await downloadHowLongToBeatPayload(payload, finalFormats, state.username, {
            includeOfflineCovers: !!state.includeOfflineCovers,
          });
        }
        clearHowLongToBeatExportState();
        setProgress(100);
        addLog(`Finished: ${payload.items.length} HowLongToBeat games exported`);
        addLog(`Export took ${formatExportElapsedTime(state.startedAt || Date.now())}`);
        exportInProgress = false;
        exportTargetSlug = '';
        exportCancelRequested = false;
        exportStartFileFormatSignature = '';
        updatePendingFileFormatNote();
        hideRunControls();
        return;
      }

      const mappings = state.mappings || [];
      const mapping = mappings[state.currentIndex || 0];
      if (!mapping) {
        state.phase = 'finalize';
        saveHowLongToBeatExportState(state);
        location.href = state.startUrl;
        return;
      }

      const currentPage = Number(state.currentPage || 1);
      addLog(`HowLongToBeat selected categories: ${mappings.map(entry => `${entry.collection.name} -> ${entry.status}`).join(', ')}`);
      addLog(`Scraping ${mapping.collection.name} (${mapping.status}) page ${currentPage}...`);
      await waitForHowLongToBeatGameList(60000);
      checkExportCancelled();
      const parsed = parseHowLongToBeatGamesDocument(document, location.href, mapping);
      const signature = getHowLongToBeatRowsSignature(mapping);
      const pageSignatures = Array.isArray(state.pageSignatures) ? state.pageSignatures : [];
      const repeatedPage = !!signature && pageSignatures.includes(signature);
      const hitPageCap = currentPage >= 100;

      if (!signature || !parsed.games.length) {
        state.failures = Array.isArray(state.failures) ? state.failures : [];
        if (!state.configPreflight) {
          state.failures.push({
            category: mapping.collection.name,
            url: location.href,
            error: (parsed.debug && parsed.debug.failures && parsed.debug.failures.join(' ')) || `No games found on page ${currentPage}.`,
          });
        }
      } else if (!repeatedPage) {
        state.items = [...(Array.isArray(state.items) ? state.items : []), ...parsed.games];
        pageSignatures.push(signature);
        state.pageSignatures = pageSignatures;
      }

      if (repeatedPage || hitPageCap || !signature || !parsed.games.length) {
        const categoryItems = (Array.isArray(state.items) ? state.items : [])
          .filter(item => item.category_url === mapping.collection.url && item.statusId === mapping.statusId);
        state.categoryCounts = Array.isArray(state.categoryCounts) ? state.categoryCounts : [];
        state.categoryCounts.push({ category: mapping.collection.name, status: mapping.status, count: categoryItems.length });
        const nextIndex = (state.currentIndex || 0) + 1;
        state.currentIndex = nextIndex;
        state.currentPage = 1;
        state.pageSignatures = [];
        setProgress(Math.min(92, 15 + Math.round((nextIndex / Math.max(1, mappings.length)) * 75)));
        if (nextIndex >= mappings.length) {
          state.phase = 'finalize';
          saveHowLongToBeatExportState(state);
          location.href = state.startUrl;
        } else {
          state.phase = 'scrape';
          saveHowLongToBeatExportState(state);
          location.href = getHowLongToBeatPageUrl(mappings[nextIndex].collection.url, 1);
        }
        return;
      }

      state.currentPage = currentPage + 1;
      state.phase = 'scrape';
      saveHowLongToBeatExportState(state);
      addLog(`Scraped ${parsed.games.length} games from ${mapping.collection.name} page ${currentPage}; loading next page...`);
      location.href = getHowLongToBeatPageUrl(mapping.collection.url, state.currentPage);
    } catch (error) {
      clearHowLongToBeatExportState();
      addLog(error && error.message ? error.message : String(error), 'error');
      setProgress(100);
      exportInProgress = false;
      exportTargetSlug = '';
      exportCancelRequested = false;
      hideRunControls();
    }
  }

  function renderStatusPillConfigModal() {
    if (statusPillConfigModal) statusPillConfigModal.remove();
    panel.classList.add('bgd-config-open');
    const modal = document.createElement('div');
    modal.className = 'bgd-status-config-modal';
    modal.innerHTML = `
      <div class="bgd-status-config-head">
        <div class="bgd-status-config-title">
          <strong>Status Pill Configuration</strong>
          <span>Configure the status groups used by the exported HTML.</span>
        </div>
        <div class="bgd-status-config-buttons">
          <button class="bgd-status-config-small" type="button" id="bgdStatusConfigDefault">Default</button>
          <button class="bgd-status-config-small bgd-status-config-x" type="button" id="bgdStatusConfigX" title="Close" aria-label="Close">X</button>
        </div>
      </div>
      <div class="bgd-status-config-tip">Tip: Drag and drop pills with the left mouse button to reorder them.</div>
      <div class="bgd-status-config-grid"></div>
    `;
    panel.appendChild(modal);
    statusPillConfigModal = modal;

    function rerender() {
      saveStatusPillConfig();
      const grid = modal.querySelector('.bgd-status-config-grid');
      grid.innerHTML = '';
      statusPillConfig.categories.forEach((category, categoryIndex) => {
        category.pills = (category.pills || []).filter(Boolean).slice(0, STATUS_PILL_SLOT_COUNT);
        const totalCount = category.pills.length;
        const isFull = totalCount >= STATUS_PILL_SLOT_COUNT;
        const categoryEl = document.createElement('section');
        categoryEl.className = 'bgd-status-category';
        categoryEl.innerHTML = `
          <div class="bgd-status-category-head">
            <strong>${escapeHtml(category.label || `Group ${categoryIndex + 1}`)}</strong>
            <div class="bgd-status-category-actions">
              <button type="button" data-add-aggregate>+ Total</button>
              <button type="button" data-add-status>+ Status</button>
            </div>
          </div>
          <div class="bgd-config-pill-list"></div>
          ${isFull ? `<div class="bgd-status-limit">This group has reached its maximum capacity of ${STATUS_PILL_SLOT_COUNT} pills.</div>` : ''}
        `;
        const addAggregateBtn = categoryEl.querySelector('[data-add-aggregate]');
        const addStatusBtn = categoryEl.querySelector('[data-add-status]');
        addAggregateBtn.disabled = isFull;
        addStatusBtn.disabled = isFull;
        addAggregateBtn.addEventListener('click', () => {
          if (category.pills.length >= STATUS_PILL_SLOT_COUNT) return;
          category.pills.unshift({
            id: makeConfigPillId('agg'),
            kind: 'aggregate',
            label: 'Aggregate Pill',
            sources: getAllStatusPillsFromConfig().slice(0, 2).map(pill => pill.id),
          });
          rerender();
        });
        addStatusBtn.addEventListener('click', () => {
          if (category.pills.length >= STATUS_PILL_SLOT_COUNT) return;
          const fallback = STATUS_PILL_SOURCE_DEFS.played;
          category.pills.push({
            id: makeConfigPillId('status'),
            kind: 'status',
            label: 'Status Pill',
            color: fallback.color,
            source: { type: fallback.type, value: fallback.value },
            collections: [],
          });
          rerender();
        });

        const list = categoryEl.querySelector('.bgd-config-pill-list');
        const categorySlots = Array.from({ length: STATUS_PILL_SLOT_COUNT }, (_, slotIndex) => (category.pills || [])[slotIndex] || null);

        function compactSlotArray(slots) {
          const compacted = slots.filter(Boolean);
          while (compacted.length < STATUS_PILL_SLOT_COUNT) compacted.push(null);
          return compacted.slice(0, STATUS_PILL_SLOT_COUNT);
        }

        function readDragData(event) {
          try {
            return JSON.parse(event.dataTransfer.getData('text/plain') || '{}');
          } catch (_) {
            return {};
          }
        }

        function insertPillIntoSlot(slots, targetSlotIndex, pill) {
          if (!slots[targetSlotIndex]) {
            slots[targetSlotIndex] = pill;
            return true;
          }
          if (slots[STATUS_PILL_SLOT_COUNT - 1]) return false;
          for (let index = STATUS_PILL_SLOT_COUNT - 1; index > targetSlotIndex; index -= 1) {
            slots[index] = slots[index - 1];
          }
          slots[targetSlotIndex] = pill;
          return true;
        }

        function rebuildCategoryFromSlots(targetCategory, slots) {
          targetCategory.pills = slots.filter(Boolean);
        }

        function moveDraggedPillToSlot(dragData, targetCategoryIndex, targetSlotIndex) {
          const fromCategoryIndex = Number(dragData.categoryIndex);
          const fromSlotIndex = Number(dragData.slotIndex);
          if (!Number.isInteger(fromCategoryIndex) || !Number.isInteger(fromSlotIndex)) return;
          if (!Number.isInteger(targetSlotIndex) || targetSlotIndex < 0 || targetSlotIndex >= STATUS_PILL_SLOT_COUNT) return;
          if (fromSlotIndex < 0 || fromSlotIndex >= STATUS_PILL_SLOT_COUNT) return;

          const fromCategory = statusPillConfig.categories[fromCategoryIndex];
          const targetCategory = statusPillConfig.categories[targetCategoryIndex];
          if (!fromCategory || !targetCategory) return;

          const fromSlots = Array.from({ length: STATUS_PILL_SLOT_COUNT }, (_, slotIndex) => (fromCategory.pills || [])[slotIndex] || null);
          const moved = fromSlots[fromSlotIndex];
          if (!moved) return;
          fromSlots[fromSlotIndex] = null;
          const compactedFromSlots = compactSlotArray(fromSlots);

          if (fromCategory === targetCategory) {
            const nextSlots = compactedFromSlots.slice();
            if (!insertPillIntoSlot(nextSlots, targetSlotIndex, moved)) return;
            rebuildCategoryFromSlots(targetCategory, nextSlots);
            rerender();
            return;
          }

          const targetSlots = Array.from({ length: STATUS_PILL_SLOT_COUNT }, (_, slotIndex) => (targetCategory.pills || [])[slotIndex] || null);
          if (!insertPillIntoSlot(targetSlots, targetSlotIndex, moved)) return;
          rebuildCategoryFromSlots(fromCategory, compactedFromSlots);
          rebuildCategoryFromSlots(targetCategory, targetSlots);
          rerender();
        }

        function clearSlotHighlights() {
          list.querySelectorAll('.bgd-config-pill-slot.is-drag-over').forEach(slotEl => {
            slotEl.classList.remove('is-drag-over');
          });
        }

        function renderPillInSlot(slotEl, pill, slotIndex) {
          const pillEl = document.createElement('div');
          pillEl.className = `bgd-config-pill${pill.kind === 'aggregate' ? ' is-aggregate' : ''}`;
          pillEl.draggable = false;
          pillEl.dataset.categoryIndex = String(categoryIndex);
          pillEl.dataset.slotIndex = String(slotIndex);
          pillEl.innerHTML = `
            <span class="bgd-config-drag-handle" title="Drag to reorder" aria-label="Drag to reorder">
              <svg class="bgd-config-icon" viewBox="0 0 16 20" aria-hidden="true" focusable="false">
                <circle cx="5" cy="4" r="1.2"></circle>
                <circle cx="11" cy="4" r="1.2"></circle>
                <circle cx="5" cy="10" r="1.2"></circle>
                <circle cx="11" cy="10" r="1.2"></circle>
                <circle cx="5" cy="16" r="1.2"></circle>
                <circle cx="11" cy="16" r="1.2"></circle>
              </svg>
            </span>
            ${pill.kind === 'status' ? `<input class="bgd-config-color" type="color" value="${escapeHtml(pill.color || '#7dd3fc')}" title="Pick color">` : ''}
            <input class="bgd-config-label" type="text" value="${escapeHtml(pill.label || '')}" aria-label="Pill label">
            <div class="bgd-config-pill-actions">
              <span class="bgd-config-count">${getConfigPillCount(pill)}</span>
              <button class="bgd-config-sources" type="button" title="${pill.kind === 'aggregate' ? 'Configure aggregate sources' : 'Status pill settings'}" aria-label="${pill.kind === 'aggregate' ? 'Configure included status pills' : 'Status pill settings'}">
                <svg class="bgd-config-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"></path>
                  <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05a2.1 2.1 0 0 1-2.97 2.97l-.05-.05a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.08 1.65V21.3a2.1 2.1 0 0 1-4.2 0v-.08a1.8 1.8 0 0 0-1.08-1.65 1.8 1.8 0 0 0-1.98.36l-.05.05a2.1 2.1 0 0 1-2.97-2.97l.05-.05A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.65-1.08H2.9a2.1 2.1 0 0 1 0-4.2h.08A1.8 1.8 0 0 0 4.6 8.64a1.8 1.8 0 0 0-.36-1.98l-.05-.05a2.1 2.1 0 0 1 2.97-2.97l.05.05a1.8 1.8 0 0 0 1.98.36A1.8 1.8 0 0 0 10.27 2.4V2.1a2.1 2.1 0 0 1 4.2 0v.08a1.8 1.8 0 0 0 1.08 1.65 1.8 1.8 0 0 0 1.98-.36l.05-.05a2.1 2.1 0 0 1 2.97 2.97l-.05.05a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.65 1.08h.08a2.1 2.1 0 0 1 0 4.2h-.08A1.8 1.8 0 0 0 19.4 15Z"></path>
                </svg>
              </button>
              <button class="bgd-config-remove" type="button" title="Remove pill" aria-label="Remove pill">
                <svg class="bgd-config-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M7 12h10"></path>
                </svg>
              </button>
            </div>
          `;
          const colorInput = pillEl.querySelector('.bgd-config-color');
          if (colorInput) {
            colorInput.addEventListener('input', event => {
              pill.color = event.target.value;
              saveStatusPillConfig();
            });
          }
          pillEl.querySelector('.bgd-config-label').addEventListener('input', event => {
            pill.label = event.target.value;
            saveStatusPillConfig();
          });
          pillEl.querySelector('.bgd-config-label').addEventListener('dragstart', event => {
            event.stopPropagation();
          });
          const sourceBtn = pillEl.querySelector('.bgd-config-sources');
          if (sourceBtn) sourceBtn.addEventListener('click', () => {
            if (pill.kind === 'aggregate') {
              openAggregateSourcesModal(pill, rerender);
              return;
            }
            openStatusCollectionsModal(pill, rerender);
          });
          pillEl.querySelector('.bgd-config-remove').addEventListener('click', () => {
            category.pills = (category.pills || []).filter(candidate => candidate !== pill);
            statusPillConfig.categories.forEach(otherCategory => {
              (otherCategory.pills || []).forEach(otherPill => {
                if (otherPill.kind === 'aggregate') {
                  otherPill.sources = (otherPill.sources || []).filter(id => id !== pill.id);
                }
              });
            });
            rerender();
          });
          const dragHandle = pillEl.querySelector('.bgd-config-drag-handle');
          dragHandle.draggable = true;
          dragHandle.addEventListener('dragstart', event => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', JSON.stringify({ categoryIndex, slotIndex }));
            pillEl.classList.add('is-dragging');
            panel.classList.add('bgd-slot-drag-active');
          });
          dragHandle.addEventListener('dragend', () => {
            pillEl.classList.remove('is-dragging');
            panel.classList.remove('bgd-slot-drag-active');
            clearSlotHighlights();
          });
          slotEl.appendChild(pillEl);
        }

        for (let slotIndex = 0; slotIndex < STATUS_PILL_SLOT_COUNT; slotIndex += 1) {
          const pill = categorySlots[slotIndex];
          const slotEl = document.createElement('div');
          slotEl.className = `bgd-config-pill-slot${pill ? '' : ' is-empty'}`;
          slotEl.dataset.categoryIndex = String(categoryIndex);
          slotEl.dataset.slotIndex = String(slotIndex);
          slotEl.title = `Drop pill into Slot ${slotIndex + 1}`;
          slotEl.addEventListener('dragenter', event => {
            event.preventDefault();
            slotEl.classList.add('is-drag-over');
          }, true);
          slotEl.addEventListener('dragover', event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            slotEl.classList.add('is-drag-over');
          }, true);
          slotEl.addEventListener('dragleave', event => {
            if (!event.relatedTarget || !slotEl.contains(event.relatedTarget)) {
              slotEl.classList.remove('is-drag-over');
            }
          }, true);
          slotEl.addEventListener('drop', event => {
            event.preventDefault();
            event.stopPropagation();
            clearSlotHighlights();
            panel.classList.remove('bgd-slot-drag-active');
            moveDraggedPillToSlot(readDragData(event), categoryIndex, slotIndex);
          }, true);
          if (pill) renderPillInSlot(slotEl, pill, slotIndex);
          list.appendChild(slotEl);
        }
        grid.appendChild(categoryEl);
      });
    }

    function closeConfigModal() {
      saveStatusPillConfig();
      const sourceModal = panel.querySelector('.bgd-source-config-modal');
      if (sourceModal) sourceModal.remove();
      modal.remove();
      statusPillConfigModal = null;
      panel.classList.remove('bgd-config-open');
    }

    modal.querySelector('#bgdStatusConfigX').addEventListener('click', () => {
      closeConfigModal();
    });
    modal.querySelector('#bgdStatusConfigDefault').addEventListener('click', () => {
      const sourceModal = panel.querySelector('.bgd-source-config-modal');
      if (sourceModal) sourceModal.remove();
      const statusConfigDescriptor = getSourceStatusConfigDescriptorForHost();
      const makeDefaultConfig = statusConfigDescriptor && statusConfigDescriptor.defaultConfigFromCollections
        ? statusConfigDescriptor.defaultConfigFromCollections
        : makeDefaultStatusPillConfig;
      statusPillConfig = normalizeStatusPillConfig(makeDefaultConfig());
      rerender();
    });

    rerender();
  }

  function openAggregateSourcesModal(aggregatePill, onDone) {
    const existing = panel.querySelector('.bgd-source-config-modal');
    if (existing) existing.remove();
    const statusPills = getAllStatusPillsFromConfig();
    const selected = new Set(aggregatePill.sources || []);
    const modal = document.createElement('div');
    modal.className = 'bgd-source-config-modal';
    modal.innerHTML = `
      <div class="bgd-status-config-head">
        <div class="bgd-status-config-title">
          <strong>Configure Sources</strong>
          <span>${escapeHtml(aggregatePill.label || 'Aggregate Pill')}</span>
        </div>
        <button class="bgd-status-config-small" type="button" id="bgdSourceDone">Done</button>
      </div>
      <div class="bgd-source-list">
        ${statusPills.map(pill => `
          <label class="bgd-source-choice">
            <input type="checkbox" value="${escapeHtml(pill.id)}" ${selected.has(pill.id) ? 'checked' : ''}>
            <span style="width:10px;height:10px;border-radius:50%;background:${escapeHtml(pill.color || '#7dd3fc')};display:inline-block"></span>
            <span>${escapeHtml(pill.label || 'Status Pill')}</span>
          </label>
        `).join('')}
      </div>
    `;
    panel.appendChild(modal);
    modal.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', () => {
        aggregatePill.sources = [...modal.querySelectorAll('input[type="checkbox"]:checked')].map(el => el.value);
        saveStatusPillConfig();
        onDone();
      });
    });
    modal.querySelector('#bgdSourceDone').addEventListener('click', () => {
      modal.remove();
      onDone();
    });
  }

  function openStatusCollectionsModal(statusPill, onDone) {
    const statusConfigDescriptor = getSourceStatusConfigDescriptorForHost();
    const discoverCollections = statusConfigDescriptor && statusConfigDescriptor.discoverCollections;
    if (!discoverCollections) return;
    const existing = panel.querySelector('.bgd-source-config-modal');
    if (existing) existing.remove();
    statusPill.collections = normalizeStatusPillCollections(statusPill.collections);
    const selected = new Set(statusPill.collections.map(collection => collection.url));
    const modal = document.createElement('div');
    modal.className = 'bgd-source-config-modal';
    modal.innerHTML = `
      <div class="bgd-status-config-head">
        <div class="bgd-status-config-title">
          <strong>Configure Collections</strong>
          <span>${escapeHtml(statusPill.label || 'Status Pill')}</span>
        </div>
        <button class="bgd-status-config-small" type="button" id="bgdCollectionsDone">Done</button>
      </div>
      <div class="bgd-source-list"><div class="bgd-source-empty">Loading public collections...</div></div>
      <div class="bgd-source-debug">Checking rendered collection table...</div>
    `;
    panel.appendChild(modal);

    function close() {
      modal.remove();
      onDone();
    }

    modal.querySelector('#bgdCollectionsDone').addEventListener('click', close);

    function updateDebugLine() {
      const debugEl = modal.querySelector('.bgd-source-debug');
      if (!debugEl) return;
      const debug = mobyGamesCollectionLastDebug || {};
      const names = Array.isArray(debug.names) && debug.names.length ? ` Found: ${debug.names.join(', ')}.` : '';
      const failures = Array.isArray(debug.failures) && debug.failures.length ? ` ${debug.failures.join(' ')}` : '';
      debugEl.textContent = `Rows detected: ${Number(debug.rowCount) || 0}.${names}${failures}`;
    }

    function syncSelection(collections) {
      const checkedUrls = new Set([...modal.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value));
      statusPill.collections = collections.filter(collection => checkedUrls.has(collection.url));
      saveStatusPillConfig();
      onDone();
    }

    discoverCollections().then(collections => {
      if (!panel.contains(modal)) return;
      const list = modal.querySelector('.bgd-source-list');
      updateDebugLine();
      if (!collections.length) {
        list.innerHTML = '<div class="bgd-source-empty">No public collections found after checking the rendered public collection page.</div>';
        return;
      }
      list.innerHTML = collections.map(collection => `
        <label class="bgd-source-choice">
          <input type="checkbox" value="${escapeHtml(collection.url)}" ${selected.has(collection.url) ? 'checked' : ''}>
          <span>${escapeHtml(collection.name)}</span>
          <span class="bgd-source-count">${collection.games}</span>
        </label>
      `).join('');
      list.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => syncSelection(collections));
      });
    }).catch(error => {
      if (!panel.contains(modal)) return;
      const list = modal.querySelector('.bgd-source-list');
      mobyGamesCollectionLastDebug = {
        message: 'Collection discovery failed.',
        rowCount: 0,
        names: [],
        failures: [error && error.message ? error.message : String(error)],
      };
      updateDebugLine();
      list.innerHTML = `<div class="bgd-source-empty">Could not load public collections: ${escapeHtml(error && error.message ? error.message : String(error))}</div>`;
    });
  }

  // ---------------------------------------------------------------------------
  // 4. File conversion
  // ---------------------------------------------------------------------------

  let applyingConverterSettings = false;

  function getConverterSettingsStorageKey(sourceId = getSourceDescriptorForHost().id) {
    return `bgdConverterSettings:${getSourceDescriptorById(sourceId).id}`;
  }

  function getDefaultConverterSettings() {
    return {
      source: 'csv',
      targets: ['json', 'html'],
      offlineCovers: false,
    };
  }

  function loadConverterSettings() {
    const defaults = getDefaultConverterSettings();
    try {
      const parsed = JSON.parse(storageGet(getConverterSettingsStorageKey(), '') || '{}');
      return {
        source: ['csv', 'json', 'html'].includes(parsed.source) ? parsed.source : defaults.source,
        targets: Array.isArray(parsed.targets)
          ? parsed.targets.filter(target => ['csv', 'json', 'html'].includes(target))
          : defaults.targets,
        offlineCovers: !!parsed.offlineCovers,
      };
    } catch (_) {
      return defaults;
    }
  }

  function saveConverterSettings() {
    if (!converterPanel || applyingConverterSettings) return;
    storageSet(getConverterSettingsStorageKey(), JSON.stringify({
      source: getConverterChoice('bgdConverterSource') || 'csv',
      targets: getConverterTargets(),
      offlineCovers: !!(converterPanel.querySelector('#bgdConverterOfflineCovers') || {}).checked,
    }));
  }

  function applyConverterSettings() {
    if (!converterPanel) return;
    const settings = loadConverterSettings();
    applyingConverterSettings = true;
    try {
      const sourceInput = converterPanel.querySelector(`input[name="bgdConverterSource"][value="${settings.source}"]`);
      if (sourceInput) sourceInput.checked = true;
      converterPanel.querySelectorAll('input[name="bgdConverterTarget"]').forEach(input => {
        input.checked = settings.targets.includes(input.value);
      });
      const offlineCovers = converterPanel.querySelector('#bgdConverterOfflineCovers');
      if (offlineCovers) offlineCovers.checked = !!settings.offlineCovers;
      syncConverterTargets();
    } finally {
      applyingConverterSettings = false;
    }
  }

  function getConverterChoice(name) {
    const el = converterPanel && converterPanel.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : '';
  }

  function getConverterTargets() {
    if (!converterPanel) return [];
    return [...converterPanel.querySelectorAll('input[name="bgdConverterTarget"]:checked:not(:disabled)')]
      .map(input => input.value);
  }

  function getConverterOfflineCoversChecked() {
    const input = converterPanel && converterPanel.querySelector('#bgdConverterOfflineCovers');
    return !!(input && input.checked && !input.disabled);
  }

  function converterAcceptFor(format) {
    if (format === 'csv') return '.csv,text/csv';
    if (format === 'json') return '.json,application/json';
    if (format === 'html') return '.html,.htm,text/html';
    return '.csv,.json,.html,.htm';
  }

  function getSourceIdFromExportFilename(filename = '') {
    const stem = String(filename || '').replace(/\.[^.]+$/, '').toLowerCase();
    return (Object.values(SOURCE_REGISTRY).find(source => {
      const suffix = source.export && source.export.filenameSuffix;
      return suffix && stem.endsWith(`-${String(suffix).toLowerCase()}`);
    }) || {}).id || '';
  }

  function getSourceIdFromExportUrl(value = '') {
    const text = String(value || '');
    if (!text) return '';
    return (Object.values(SOURCE_REGISTRY).find(source => {
      try {
        return source.match.hostRegex.test(new URL(text, location.href).hostname);
      } catch (_) {
        return false;
      }
    }) || {}).id || '';
  }

  function getSourceIdFromRawPayload(rawPayload) {
    if (!rawPayload || typeof rawPayload !== 'object') return '';
    if (rawPayload.sourceWebsite) {
      const normalizedWebsite = String(rawPayload.sourceWebsite || '').toLowerCase();
      return (Object.values(SOURCE_REGISTRY).find(source => source.sourceWebsite.toLowerCase() === normalizedWebsite) || {}).id || '';
    }
    const urls = [
      rawPayload.source,
      rawPayload.url,
      rawPayload.collection_url,
      rawPayload.category_url,
      ...((rawPayload.items || []).slice(0, 8).flatMap(item => [
        item && item.url,
        item && item.gameUrl,
        item && item.cover_url,
        item && item.collection_url,
        item && item.collectionUrl,
        item && item.category_url,
        item && item.categoryUrl,
      ])),
    ];
    for (const url of urls) {
      const sourceId = getSourceIdFromExportUrl(url);
      if (sourceId) return sourceId;
    }
    return '';
  }

  function parseRawConverterPayloadForDetection(text, format) {
    if (format === 'json') return JSON.parse(text);
    if (format !== 'html') return null;
    const doc = new DOMParser().parseFromString(String(text || ''), 'text/html');
    const payloadEl = doc.getElementById('payload');
    if (payloadEl && payloadEl.textContent) return JSON.parse(payloadEl.textContent);
    const match = String(text || '').match(/<script[^>]+id=["']payload["'][^>]*>([\s\S]*?)<\/script>/i);
    return match ? JSON.parse(match[1]) : null;
  }

  function detectCsvConverterSourceId(text) {
    const rows = parseCsvRows(text).filter(row => String(row[0] || '').trim()[0] !== '#');
    if (!rows.length) return '';
    const headers = rows[0].map(h => String(h || '').replace(/^\uFEFF/, '').trim().toLowerCase());
    const headerSet = new Set(headers);
    const has = name => headerSet.has(name);
    if (has('category') || has('category_url') || has('category url')) return 'howlongtobeat';
    if (has('collection') || has('collection_url') || has('collection url')
      || has('gameplay') || has('mobygames gameplay')
      || has('release_year') || has('release year')
      || has('full_release_date') || has('full release date')
      || has('mobygames platforms') || has('mobygames genres')
      || (has('name') && has('game url'))) {
      return 'mobygames';
    }
    if (has('game_id') || has('game id') || has('play_type') || has('play type')) return DEFAULT_SOURCE_ID;
    return '';
  }

  function detectConverterFileSourceId(text, format, filename = '') {
    const filenameSourceId = getSourceIdFromExportFilename(filename);
    if (format === 'csv') return detectCsvConverterSourceId(text) || filenameSourceId;
    try {
      return getSourceIdFromRawPayload(parseRawConverterPayloadForDetection(text, format)) || filenameSourceId;
    } catch (_) {
      return filenameSourceId;
    }
  }

  function validateConverterFileSource(text, format, filename, expectedSourceId) {
    const expected = getSourceDescriptorById(expectedSourceId);
    const detectedSourceId = detectConverterFileSourceId(text, format, filename);
    if (!detectedSourceId) {
      throw new Error(`Could not verify this file belongs to ${expected.sourceWebsite}. Use an export file created by the ${expected.sourceWebsite} exporter.`);
    }
    if (detectedSourceId !== expected.id) {
      const detected = getSourceDescriptorById(detectedSourceId);
      throw new Error(`This is a ${detected.sourceWebsite} export file. Use the File Converter on the ${detected.sourceWebsite} export screen.`);
    }
  }

  function positionConverterPanel() {
    if (!converterBtn || !converterPanel || converterPanel.hidden) return;
    const rect = converterBtn.getBoundingClientRect();
    const panelWidth = converterPanel.offsetWidth || 312;
    const panelHeight = converterPanel.offsetHeight || 166;
    const left = Math.max(10, Math.min(window.innerWidth - panelWidth - 10, rect.right - panelWidth));
    const top = Math.max(10, Math.min(window.innerHeight - panelHeight - 10, rect.bottom + 6));
    converterPanel.style.left = `${left}px`;
    converterPanel.style.top = `${top}px`;
  }

  function openConverterPanel() {
    if (!converterPanel || !converterBtn) return;
    syncConverterTargets();
    converterPanel.hidden = false;
    converterBtn.classList.add('open');
    positionConverterPanel();
  }

  function closeConverterPanel() {
    if (!converterPanel || !converterBtn) return;
    converterPanel.hidden = true;
    converterBtn.classList.remove('open');
  }


  function syncConverterOfflineCovers() {
    if (!converterPanel) return;
    const offlineCovers = converterPanel.querySelector('#bgdConverterOfflineCovers');
    const htmlTarget = converterPanel.querySelector('input[name="bgdConverterTarget"][value="html"]');
    if (!offlineCovers || !htmlTarget) return;
    const converterMode = getSourceDescriptorForHost().converterMode;
    const source = getSourceDescriptorById(converterMode);
    const supportsOfflineCovers = !!(source.media && source.media.offlineCovers && source.media.offlineCovers.enabled);
    const enabled = supportsOfflineCovers && htmlTarget.checked && !htmlTarget.disabled;
    offlineCovers.disabled = !enabled;
    if (!enabled) offlineCovers.checked = false;
  }

  function syncConverterTargets() {
    if (!converterPanel) return;
    const source = getConverterChoice('bgdConverterSource') || 'csv';
    const targets = [...converterPanel.querySelectorAll('input[name="bgdConverterTarget"]')];
    targets.forEach(input => {
      input.disabled = input.value === source;
      if (input.disabled) input.checked = false;
    });
    syncConverterOfflineCovers();
    if (converterFileInput) converterFileInput.accept = converterAcceptFor(source);
    saveConverterSettings();
  }

  function initFileConverter() {
    if (!converterBtn || !converterPanel || !converterRunBtn || !converterFileInput) return;

    converterBtn.addEventListener('click', event => {
      event.stopPropagation();
      converterPanel.hidden ? openConverterPanel() : closeConverterPanel();
    });
    if (converterCloseBtn) {
      converterCloseBtn.addEventListener('click', event => {
        event.stopPropagation();
        closeConverterPanel();
      });
    }
    converterPanel.addEventListener('click', event => event.stopPropagation());
    const closeConverterOnDocumentClick = () => closeConverterPanel();
    const positionConverterOnResize = () => positionConverterPanel();
    const positionConverterOnScroll = () => positionConverterPanel();
    document.addEventListener('click', closeConverterOnDocumentClick);
    window.addEventListener('resize', positionConverterOnResize);
    window.addEventListener('scroll', positionConverterOnScroll, true);
    addPanelCleanup(() => {
      document.removeEventListener('click', closeConverterOnDocumentClick);
      window.removeEventListener('resize', positionConverterOnResize);
      window.removeEventListener('scroll', positionConverterOnScroll, true);
    });
    applyConverterSettings();
    converterPanel.querySelectorAll('input[name="bgdConverterSource"]').forEach(input => {
      input.addEventListener('change', () => {
        syncConverterTargets();
        saveConverterSettings();
      });
    });
    converterPanel.querySelectorAll('input[name="bgdConverterTarget"]').forEach(input => {
      input.addEventListener('change', () => {
        syncConverterOfflineCovers();
        saveConverterSettings();
      });
    });
    const converterOfflineCovers = converterPanel.querySelector('#bgdConverterOfflineCovers');
    if (converterOfflineCovers) {
      converterOfflineCovers.addEventListener('change', saveConverterSettings);
    }
    syncConverterTargets();

    converterRunBtn.addEventListener('click', () => {
      const source = getConverterChoice('bgdConverterSource');
      const targets = getConverterTargets();
      if (!source || !targets.length) {
        alert('Please choose at least one export file type.');
        return;
      }
      converterFileInput.accept = converterAcceptFor(source);
      converterFileInput.value = '';
      converterFileInput.click();
    });

    converterFileInput.addEventListener('change', async () => {
      const file = converterFileInput.files && converterFileInput.files[0];
      if (!file) return;
      closeConverterPanel();
      const source = getConverterChoice('bgdConverterSource');
      const targets = getConverterTargets();
      const includeOfflineCovers = getConverterOfflineCoversChecked() && targets.includes('html');
      if (!targets.length) {
        alert('Please choose at least one export file type.');
        return;
      }

      if (includeOfflineCovers) {
        beginExportSession();
        addLog('Converting file with offline covers');
      }

      try {
        const text = await file.text();
        const converterMode = getSourceDescriptorForHost().converterMode;
        validateConverterFileSource(text, source, file.name, converterMode);
        const payload = parseConverterPayload(text, source, file.name, converterMode);
        const baseName = convertedBaseName(file.name, payload);
        let htmlPayload = payload;
        if (includeOfflineCovers) {
          const offlineCoverOptions = getSourceOfflineCoverOptions(converterMode);
          htmlPayload = payloadWithOfflineCovers(payload, await buildOfflineCoverMap(payload.items || [], offlineCoverOptions), offlineCoverOptions);
          checkExportCancelled();
        }
        targets.forEach(target => {
          const output = buildConverterOutput(target === 'html' ? htmlPayload : payload, target, converterMode);
          downloadText(`${baseName}.${output.extension}`, output.mime, output.content);
        });
        if (includeOfflineCovers) {
          setProgress(100);
          addLog('Conversion finished');
        }
      } catch (error) {
        if (isExportCancelledError(error)) {
          if (!exportStopMessageShown) showExportStoppedMessage();
        } else {
          console.error(error);
          alert(error && error.message ? error.message : String(error));
        }
      } finally {
        if (includeOfflineCovers) {
          finishExportSession();
        }
      }
    });

    syncConverterTargets();
  }

  initFileConverter();

  function setProgress(percent) {
    fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  function setProgressInRange(from, to, current, total) {
    if (!total || total < 1) return;
    setProgress(from + Math.round((current / total) * (to - from)));
  }

  function addLog(message, kind = 'info', updateId = null) {
    if (updateId) {
      const existing = logUpdateLines.get(updateId);
      if (existing) {
        existing.textContent = message;
        log.scrollTop = log.scrollHeight;
        return;
      }
    }
    const line = document.createElement('div');
    line.className = `bgd-log-line ${kind === 'error' ? 'is-error' : ''}`;
    line.textContent = message;
    if (updateId) line.dataset.updateId = updateId;
    log.appendChild(line);
    if (updateId) logUpdateLines.set(updateId, line);
    log.scrollTop = log.scrollHeight;
  }

  function removeLog(updateId) {
    const existing = logUpdateLines.get(updateId);
    if (!existing) return;
    existing.remove();
    logUpdateLines.delete(updateId);
  }

  function clearExportLog() {
    if (log) log.innerHTML = '';
    logUpdateLines = new Map();
  }

  function beginExportSession({ formatSignature = getFileFormatSignature(), progress = 2 } = {}) {
    panel.classList.add('is-active');
    exportTargetSlug = userSlug;
    exportInProgress = true;
    exportCancelRequested = false;
    exportPauseRequested = false;
    exportPauseResolver = null;
    exportPausedStartedAt = 0;
    exportPausedTotalMs = 0;
    exportPriorElapsedMs = 0;
    exportStopMessageShown = false;
    exportStartFileFormatSignature = formatSignature;
    updatePendingFileFormatNote();
    showRunControls();
    clearExportLog();
    setProgress(progress);
  }

  function finishExportSession() {
    exportInProgress = false;
    exportTargetSlug = '';
    exportCancelRequested = false;
    if (exportPauseRequested && exportPausedStartedAt) {
      exportPausedTotalMs += Date.now() - exportPausedStartedAt;
      exportPausedStartedAt = 0;
    }
    exportPauseRequested = false;
    if (exportPauseResolver) {
      const resolve = exportPauseResolver;
      exportPauseResolver = null;
      resolve();
    }
    removeLog('export-pause-progress');
    activeExportFetchControllers.clear();
    exportStartFileFormatSignature = '';
    updatePendingFileFormatNote();
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export';
    }
    hideRunControls();
  }

  function makeExportCancelledError() {
    const error = new Error('Export stopped by user.');
    error.name = 'ExportCancelledError';
    error.cancelledByUser = true;
    error.retryable = false;
    return error;
  }

  function isExportCancelledError(error) {
    return !!(error && (error.cancelledByUser || error.name === 'ExportCancelledError'));
  }

  function checkExportCancelled() {
    if (exportCancelRequested) throw makeExportCancelledError();
  }

  function syncRunControls() {
    if (!pauseExportBtn) return;
    pauseExportBtn.classList.toggle('is-resume', !!exportPauseRequested);
    pauseExportBtn.title = exportPauseRequested ? 'Resume export' : 'Pause export';
    pauseExportBtn.setAttribute('aria-label', pauseExportBtn.title);
  }

  function showRunControls() {
    if (!exportBtn || !runControls) return;
    runControls.style.removeProperty('--bgd-export-button-width');
    exportBtn.hidden = true;
    runControls.hidden = false;
    if (pauseExportBtn) pauseExportBtn.disabled = false;
    if (stopExportBtn) stopExportBtn.disabled = false;
    syncRunControls();
    syncMobyGamesConfigButtonDisabledState();
  }

  function hideRunControls() {
    if (!exportBtn || !runControls) return;
    runControls.hidden = true;
    exportBtn.hidden = false;
    if (pauseExportBtn) pauseExportBtn.disabled = false;
    if (stopExportBtn) stopExportBtn.disabled = false;
    syncRunControls();
    syncMobyGamesConfigButtonDisabledState();
  }

  function setExportPaused(paused) {
    if (!exportInProgress || exportCancelRequested) return;
    const shouldPause = !!paused;
    if (shouldPause === exportPauseRequested) return;
    exportPauseRequested = shouldPause;
    if (exportPauseRequested) {
      exportPausedStartedAt = Date.now();
      addLog('Export paused. Press Play to continue.', 'info', 'export-pause-progress');
    } else {
      if (exportPausedStartedAt) {
        exportPausedTotalMs += Date.now() - exportPausedStartedAt;
        exportPausedStartedAt = 0;
      }
      removeLog('export-pause-progress');
    }
    if (!exportPauseRequested && exportPauseResolver) {
      const resolve = exportPauseResolver;
      exportPauseResolver = null;
      resolve();
    }
    if (isMobyGamesHost()) {
      const state = loadMobyGamesExportState();
      if (state) saveMobyGamesExportState(state);
    }
    if (isHowLongToBeatHost()) {
      const state = loadHowLongToBeatExportState();
      if (state) saveHowLongToBeatExportState(state);
    }
    syncRunControls();
  }

  async function waitIfExportPaused() {
    checkExportCancelled();
    while (exportPauseRequested && !exportCancelRequested) {
      await new Promise(resolve => { exportPauseResolver = resolve; });
      checkExportCancelled();
    }
  }

  function showExportStoppedMessage() {
    clearExportLog();
    addLog('Export stopped by user.');
    setProgress(100);
    exportStopMessageShown = true;
  }

  function requestExportCancel() {
    if (!exportInProgress || exportCancelRequested) return;
    exportCancelRequested = true;
    if (exportPauseRequested && exportPausedStartedAt) {
      exportPausedTotalMs += Date.now() - exportPausedStartedAt;
      exportPausedStartedAt = 0;
    }
    exportPauseRequested = false;
    removeLog('export-pause-progress');
    if (exportPauseResolver) {
      const resolve = exportPauseResolver;
      exportPauseResolver = null;
      resolve();
    }
    if (pauseExportBtn) pauseExportBtn.disabled = true;
    if (stopExportBtn) stopExportBtn.disabled = true;
    syncRunControls();
    activeExportFetchControllers.forEach(controller => {
      try { controller.abort(); } catch (_) {}
    });
    showExportStoppedMessage();
  }

  function getActiveExportElapsedMs(startTime) {
    const currentPauseMs = exportPauseRequested && exportPausedStartedAt ? Date.now() - exportPausedStartedAt : 0;
    return Math.max(0, Date.now() - startTime - exportPausedTotalMs - currentPauseMs) + exportPriorElapsedMs;
  }

  function formatExportElapsedTime(startTime) {
    const totalSeconds = Math.max(0, Math.floor(getActiveExportElapsedMs(startTime) / 1000));
    if (totalSeconds > 60) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes} minute${minutes === 1 ? '' : 's'} ${seconds} second${seconds === 1 ? '' : 's'}`;
    }
    return `${totalSeconds} second${totalSeconds === 1 ? '' : 's'}`;
  }

  // ---------------------------------------------------------------------------
  // 5. Shared utilities
  // ---------------------------------------------------------------------------

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function decodeHtml(input = '') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = input;
    return textarea.value.replace(/\s+/g, ' ').trim();
  }

  function csvEscape(value) {
    const text = value == null ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function parseRating(text) {
    const match = String(text || '').match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function normalizeStatusToken(value) {
    return String(value || '')
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/[\s_\-:;.,()[\]{}'"!?\u3000\u30fb\u2026]+/g, '');
  }

  function normalizePlayType(value) {
    const token = normalizeStatusToken(value);
    if (!token) return null;
    return PLAY_TYPE_ALIASES[token] || null;
  }

  function safeFilePart(value) {
    return String(value).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'backloggd-user';
  }

  function storageGet(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  function savePendingNavMessage(message) {
    storageSet(PENDING_NAV_MESSAGE_KEY, message || '');
  }

  function flushPendingNavMessage() {
    const message = storageGet(PENDING_NAV_MESSAGE_KEY, '');
    if (!message) return;
    storageSet(PENDING_NAV_MESSAGE_KEY, '');
    if (panel) panel.classList.add('is-active');
    addLog(message);
  }

  function statusList(item) {
    return Array.isArray(item.statuses) && item.statuses.length ? item.statuses : [item.status];
  }

  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    const input = String(text || '').replace(/^\uFEFF/, '');
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (inQuotes) {
        if (ch === '"') {
          if (input[i + 1] === '"') {
            cell += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (ch !== '\r') {
        cell += ch;
      }
    }
    row.push(cell);
    rows.push(row);
    return rows.filter(r => r.some(c => String(c || '').trim() !== ''));
  }

  function normalizeLibraryStatus(value) {
    const playType = normalizePlayType(value);
    if (playType) return { status: 'played', play_type: playType };
    const token = normalizeStatusToken(value);
    const statusAliases = {
      playing: 'playing',
      nowplaying: 'playing',
      backlog: 'backlog',
      backlogged: 'backlog',
      wishlist: 'wishlist',
      wishlisted: 'wishlist',
      wish: 'wishlist',
      want: 'wishlist',
      wanted: 'wishlist',
    };
    return { status: statusAliases[token] || token || 'played', play_type: null };
  }

  function splitExportList(value) {
    return String(value || '')
      .split(';')
      .map(v => v.trim())
      .filter(Boolean);
  }

  const SHARED_EXPORT_PAYLOAD_FIELDS = [
    'sourceWebsite',
    'username',
    'source',
    'generated_at',
    'counts',
    'raw_counts',
    'include_genres',
    'include_platforms',
    'include_platforms226',
    'total',
    'items',
  ];

  const SHARED_EXPORT_ITEM_FIELDS = [
    'title',
    'url',
    'cover_url',
    'status',
    'statuses',
    'release_date',
    'genres',
    'platforms',
    'user_rating',
    'average_rating',
  ];

  function exportListFromValue(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    return splitExportList(value);
  }

  function normalizeAverageRatingValue(value) {
    if (value == null || value === '') return null;
    const rating = Number(value);
    if (!Number.isFinite(rating) || rating === 0) return null;
    return rating;
  }

  function normalizeSharedExportItem(rawItem, { defaultStatus = 'played' } = {}) {
    const item = { ...rawItem };
    const statuses = [...new Set(exportListFromValue(
      Array.isArray(item.statuses) && item.statuses.length ? item.statuses : item.status
    ))];
    const primaryStatus = item.status || statuses[0] || defaultStatus;

    item.title = item.title || item.name || '';
    item.url = item.url || item.gameUrl || '';
    item.cover_url = item.cover_url || item.coverUrl || '';
    item.status = primaryStatus;
    item.statuses = statuses.length ? statuses : [primaryStatus];
    item.release_date = item.release_date || item.fullReleaseDate || item.full_release_date || item.releaseYear || item.release_year || '';
    item.genres = exportListFromValue(item.genres);
    item.platforms = uniqueSortedLabels(exportListFromValue(item.platforms || (item.platform ? [item.platform] : [])));
    if (item.user_rating === undefined) item.user_rating = item.userRating == null ? null : item.userRating;
    item.average_rating = normalizeAverageRatingValue(item.average_rating === undefined ? item.averageRating : item.average_rating);
    return item;
  }

  function normalizeSharedExportPayload(rawPayload, options = {}) {
    const items = (rawPayload.items || []).map(item =>
      normalizeSharedExportItem(item, { defaultStatus: options.defaultStatus ?? 'played' })
    );
    const username = rawPayload.username || options.username || userSlug || 'library-user';
    const counts = rawPayload.counts && typeof rawPayload.counts === 'object'
      ? rawPayload.counts
      : buildCountsFromItems(items);
    return {
      ...rawPayload,
      sourceWebsite: rawPayload.sourceWebsite || options.sourceWebsite || getSourceWebsite(DEFAULT_SOURCE_ID),
      username,
      source: rawPayload.source || options.source || '',
      generated_at: rawPayload.generated_at || new Date().toISOString(),
      counts,
      raw_counts: rawPayload.raw_counts || counts,
      include_genres: rawPayload.include_genres !== undefined ? !!rawPayload.include_genres : items.some(item => item.genres.length),
      include_platforms: rawPayload.include_platforms !== undefined ? !!rawPayload.include_platforms : items.some(item => item.platforms.length),
      include_platforms226: !!rawPayload.include_platforms226,
      total: items.length,
      items,
    };
  }

  function currentHowLongToBeatUrlWithoutHash() {
    return `${location.origin}${location.pathname}${location.search}`;
  }

  function loadHowLongToBeatExportState() {
    const raw = storageGet(HLTB_EXPORT_STATE_KEY, '');
    if (!raw) return null;
    try {
      const state = JSON.parse(raw);
      return state && state.active ? state : null;
    } catch (_) {
      return null;
    }
  }

  function saveHowLongToBeatExportState(state) {
    if (!state) return;
    state.paused = !!exportPauseRequested;
    state.pausedTotalMs = exportPausedTotalMs;
    storageSet(HLTB_EXPORT_STATE_KEY, JSON.stringify(state));
  }

  function clearHowLongToBeatExportState() {
    storageSet(HLTB_EXPORT_STATE_KEY, '');
  }

  function getHowLongToBeatConfiguredCategoryMappings(config = statusPillConfig) {
    const mappings = [];
    (config.categories || []).forEach(category => {
      (category.pills || []).forEach(pill => {
        if (!pill || pill.kind !== 'status') return;
        normalizeStatusPillCollections(pill.collections).forEach(collection => {
          const normalized = normalizeHowLongToBeatCategory(collection);
          if (!normalized) return;
          mappings.push({
            statusId: pill.id,
            status: pill.label || 'Status Pill',
            statusColor: pill.color || '#7dd3fc',
            collection: normalized,
          });
        });
      });
    });
    const byKey = new Map();
    mappings.forEach(mapping => {
      byKey.set(`${mapping.statusId}|${mapping.collection.url}`, mapping);
    });
    return [...byKey.values()];
  }

  const HLTB_KNOWN_PLATFORMS = [
    'Xbox Series X/S', 'Xbox Series X', 'Xbox Series S', 'PlayStation 5', 'PlayStation 4',
    'PlayStation 3', 'PlayStation 2', 'PlayStation Portable', 'PlayStation Vita', 'PlayStation',
    'Nintendo Switch', 'Nintendo 3DS', 'Nintendo DS', 'Nintendo 64', 'Nintendo GameCube',
    'Game Boy Advance', 'Game Boy Color', 'Game Boy', 'Sega Mega Drive/Genesis',
    'Sega Master System', 'Sega Game Gear', 'Steam Deck', 'Xbox One', 'Xbox 360', 'Xbox',
    'PS Vita', 'PSP', 'PS5', 'PS4', 'PS3', 'PS2', 'PS1', 'Switch', 'GameCube',
    'Wii U', 'Wii', 'SNES', 'NES', '3DO', 'Arcade', 'Browser', 'Mobile', 'Android',
    'iOS', 'Mac', 'Linux', 'PC'
  ];

  function canonicalHowLongToBeatPlatform(platform) {
    const map = {
      Switch: 'Nintendo Switch',
      GameCube: 'Nintendo GameCube',
      PSP: 'PlayStation Portable',
      'PS Vita': 'PlayStation Vita',
      PS1: 'PlayStation',
      PS2: 'PlayStation 2',
      PS3: 'PlayStation 3',
      PS4: 'PlayStation 4',
      PS5: 'PlayStation 5',
    };
    return map[platform] || platform;
  }

  function detectHowLongToBeatKnownPlatform(text) {
    const source = String(text || '').trim().replace(/\s+/g, ' ');
    if (!source) return '';
    const platforms = [...HLTB_KNOWN_PLATFORMS].sort((a, b) => b.length - a.length);
    for (const platform of platforms) {
      const escaped = escapeRegExp(platform);
      const rx = new RegExp(`(^|\\b|\\s)${escaped}(\\b|\\s|$)`, 'i');
      if (rx.test(source)) return canonicalHowLongToBeatPlatform(platform);
    }
    return '';
  }

  function collectHowLongToBeatNearbyTitleText(titleLink, row) {
    const parts = [];
    let node = titleLink && titleLink.nextSibling;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        parts.push(node.innerText || node.getAttribute('title') || node.getAttribute('aria-label') || '');
      }
      node = node.nextSibling;
    }
    if (titleLink && titleLink.parentElement && row && row.contains(titleLink.parentElement)) {
      [...titleLink.parentElement.children].forEach(child => {
        if (child !== titleLink) parts.push(child.innerText || child.getAttribute('title') || child.getAttribute('aria-label') || '');
      });
    }
    return String(parts.join(' ')).trim().replace(/\s+/g, ' ');
  }

  function extractHowLongToBeatPlatformFromRow(titleLink, row, title) {
    if (!row) return '';
    const selectors = [
      '[class*="platform"]',
      '[class*="Platform"]',
      '[class*="console"]',
      '[class*="Console"]',
      '[class*="system"]',
      '[class*="System"]',
      '[data-platform]',
      '[title*="Platform"]',
      '[aria-label*="Platform"]',
    ];
    for (const selector of selectors) {
      const el = row.querySelector(selector);
      if (!el) continue;
      const value = String(
        el.getAttribute('data-platform')
        || el.getAttribute('title')
        || el.getAttribute('aria-label')
        || el.innerText
        || ''
      ).trim().replace(/\s+/g, ' ');
      if (!value || value.toLowerCase() === String(title || '').toLowerCase()) continue;
      return detectHowLongToBeatKnownPlatform(value) || value;
    }
    const nearTitlePlatform = detectHowLongToBeatKnownPlatform(collectHowLongToBeatNearbyTitleText(titleLink, row));
    if (nearTitlePlatform) return nearTitlePlatform;
    const rowText = String(row.innerText || row.textContent || '').trim().replace(/\s+/g, ' ');
    return detectHowLongToBeatKnownPlatform(rowText.replace(title, '')) || '';
  }

  function parseHowLongToBeatGamesDocument(doc, pageUrl, mapping) {
    const normalizeText = value => String(value || '').trim().replace(/\s+/g, ' ');
    const failures = [];
    const seen = new Set();
    const links = [...doc.querySelectorAll('a[href*="/game"]')];
    const games = [];
    links.forEach((link, index) => {
      const href = link.getAttribute('href') || '';
      if (!href || /\/game\/?$/i.test(href)) return;
      const gameUrl = new URL(href, pageUrl || location.href).href;
      const gamePath = new URL(gameUrl).pathname;
      if (!/^\/game\/[^/?#]+\/?$/i.test(gamePath)) return;
      if (seen.has(gameUrl)) return;
      seen.add(gameUrl);
      const row = link.closest('tr')
        || link.closest('[class*="row"]')
        || link.closest('[class*="list"]')
        || link.closest('[class*="game"]')
        || link.closest('li')
        || link.parentElement;
      const title = normalizeText(link.innerText || link.textContent || link.getAttribute('title'));
      if (!title) {
        failures.push(`Game link ${index + 1}: missing title text.`);
        return;
      }
      const platform = extractHowLongToBeatPlatformFromRow(link, row, title);
      games.push({
        name: title,
        title,
        platform,
        platforms: platform ? [platform] : [],
        category: mapping.collection.name,
        status: mapping.status,
        statusId: mapping.statusId,
        status_id: mapping.statusId,
        statusColor: mapping.statusColor,
        statuses: [mapping.status],
        statusIds: [mapping.statusId].filter(Boolean),
        status_ids: [mapping.statusId].filter(Boolean),
        category_url: mapping.collection.url,
        collection: mapping.collection.name,
        collection_url: mapping.collection.url,
        gameUrl,
        url: gameUrl,
        cover_url: '',
        genres: [],
        release_date: '',
        user_rating: null,
        average_rating: null,
      });
    });
    return {
      games,
      debug: {
        rowCount: games.length,
        linkCount: links.length,
        names: games.map(game => game.name),
        failures,
      },
    };
  }

  async function waitForHowLongToBeatGameList(timeoutMs = 60000) {
    let started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const pauseCheckStartedAt = Date.now();
      await waitIfExportPaused();
      started += Date.now() - pauseCheckStartedAt;
      const container = document.querySelector('#user_games');
      if (container && !container.querySelector('.loading_bar')) return true;
      if (container && container.querySelector('a[href*="/game"]')) return true;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    return false;
  }

  function getHowLongToBeatRowsSignature(mapping) {
    const parsed = parseHowLongToBeatGamesDocument(document, location.href, mapping);
    return (parsed.games || []).map(game => `${game.gameUrl}|${game.platform}`).join('||');
  }

  function getHowLongToBeatPageUrl(categoryUrl, page) {
    const url = new URL(categoryUrl, location.href);
    const parts = url.pathname.split('/').filter(Boolean);
    if (/^\d+$/.test(parts[parts.length - 1] || '')) {
      parts[parts.length - 1] = String(page);
    } else {
      parts.push(String(page));
    }
    url.pathname = `/${parts.join('/')}`;
    url.search = '';
    url.hash = '';
    return url.href;
  }

  function getHowLongToBeatStatusOrderMap(config) {
    return getMobyGamesStatusOrderMap(config);
  }

  function getHowLongToBeatItemIdentity(item) {
    return String(item && (item.url || item.gameUrl || item.title || item.name) || '').trim().toLowerCase();
  }

  function mergeHowLongToBeatItemsForExport(items, config) {
    const statusOrder = getHowLongToBeatStatusOrderMap(config);
    const byGame = new Map();
    function getStatusEntriesForItem(item) {
      const labels = Array.isArray(item.statuses) && item.statuses.length ? item.statuses : [item.status || 'Status Pill'];
      const ids = Array.isArray(item.statusIds) && item.statusIds.length
        ? item.statusIds
        : Array.isArray(item.status_ids) && item.status_ids.length
          ? item.status_ids
          : item.statusId || item.status_id
            ? [item.statusId || item.status_id]
            : [];
      return labels.map((label, index) => ({
        id: ids[index] || '',
        label: label || 'Status Pill',
        color: index === 0 ? item.statusColor || '' : '',
      }));
    }
    (Array.isArray(items) ? items : []).forEach(item => {
      const key = getHowLongToBeatItemIdentity(item);
      if (!key) return;
      const statusEntries = getStatusEntriesForItem(item);
      const categoryEntry = {
        name: item.category || item.collection || '',
        url: item.category_url || item.collection_url || '',
      };
      if (!byGame.has(key)) {
        byGame.set(key, {
          ...item,
          _statusEntries: statusEntries,
          _categoryEntries: [categoryEntry],
        });
        return;
      }
      const existing = byGame.get(key);
      existing._statusEntries.push(...statusEntries);
      existing._categoryEntries.push(categoryEntry);
      existing.platforms = uniqueSortedLabels([...(existing.platforms || []), ...(item.platforms || []), item.platform]);
    });
    return [...byGame.values()].map(item => {
      const statusEntries = mergeOrderedMobyGamesStatusEntries(item._statusEntries || [], statusOrder);
      const categoryEntries = [];
      const categoryKeys = new Set();
      (item._categoryEntries || []).forEach(category => {
        const key = category.url || category.name;
        if (!key || categoryKeys.has(key)) return;
        categoryKeys.add(key);
        categoryEntries.push(category);
      });
      const statuses = statusEntries.map(entry => entry.label).filter(Boolean);
      const statusIds = statusEntries.map(entry => entry.id).filter(Boolean);
      const categories = categoryEntries.map(entry => entry.name).filter(Boolean);
      const categoryUrls = categoryEntries.map(entry => entry.url).filter(Boolean);
      const primaryStatus = statusEntries[0] || {};
      const url = item.url || item.gameUrl || '';
      return {
        ...item,
        url,
        gameUrl: item.gameUrl || url,
        status: statuses[0] || item.status || '',
        statusId: primaryStatus.id || item.statusId || item.status_id || '',
        status_id: primaryStatus.id || item.status_id || item.statusId || '',
        statusColor: primaryStatus.color || item.statusColor || '',
        statuses,
        statusIds,
        status_ids: statusIds,
        category: categories.join('; ') || item.category || '',
        categories,
        category_url: categoryUrls[0] || item.category_url || '',
        categoryUrl: item.categoryUrl || categoryUrls[0] || item.category_url || '',
        categoryUrls,
        category_urls: categoryUrls,
        collection: categories.join('; ') || item.collection || item.category || '',
        collections: categories,
        collection_url: categoryUrls[0] || item.collection_url || item.category_url || '',
        collectionUrl: item.collectionUrl || categoryUrls[0] || item.collection_url || item.category_url || '',
        collectionUrls: categoryUrls,
        collection_urls: categoryUrls,
        platforms: uniqueSortedLabels(item.platforms || (item.platform ? [item.platform] : [])),
        _statusEntries: undefined,
        _categoryEntries: undefined,
      };
    });
  }

  function normalizeHowLongToBeatSharedExportItem(rawItem) {
    const sourceMeta = rawItem && rawItem.source_meta && typeof rawItem.source_meta === 'object'
      ? rawItem.source_meta
      : {};
    const item = normalizeSharedExportItem(rawItem, { defaultStatus: '' });
    const statuses = [...new Set(exportListFromValue(
      Array.isArray(rawItem.statuses) && rawItem.statuses.length ? rawItem.statuses : rawItem.status
    ))];
    const statusIds = [...new Set(exportListFromValue(
      Array.isArray(rawItem.statusIds) && rawItem.statusIds.length
        ? rawItem.statusIds
        : Array.isArray(rawItem.status_ids) && rawItem.status_ids.length
          ? rawItem.status_ids
          : rawItem.statusId || rawItem.status_id || sourceMeta.status_id || sourceMeta.status_ids
    ))];
    const categories = exportListFromValue(rawItem.categories || sourceMeta.categories || rawItem.category || rawItem.collection);
    const categoryUrls = exportListFromValue(rawItem.categoryUrls || rawItem.category_urls || sourceMeta.category_urls || rawItem.category_url || rawItem.collection_url);
    item.name = item.name || item.title || '';
    item.title = item.title || item.name;
    item.gameUrl = item.gameUrl || item.url || '';
    item.url = item.url || item.gameUrl;
    item.coverUrl = item.coverUrl || item.cover_url || '';
    item.cover_url = item.cover_url || item.coverUrl || '';
    item.status = statuses[0] || item.status || '';
    item.statusId = statusIds[0] || item.statusId || item.status_id || '';
    item.status_id = statusIds[0] || item.status_id || item.statusId || '';
    item.statuses = statuses.length ? statuses : (item.status ? [item.status] : []);
    item.statusIds = statusIds;
    item.status_ids = statusIds;
    item.category = item.category || sourceMeta.category || item.collection || categories[0] || '';
    item.categories = categories.length ? categories : (item.category ? [item.category] : []);
    item.category_url = item.category_url || item.categoryUrl || sourceMeta.category_url || item.collection_url || categoryUrls[0] || '';
    item.categoryUrl = item.categoryUrl || item.category_url;
    item.categoryUrls = categoryUrls.length ? categoryUrls : (item.category_url ? [item.category_url] : []);
    item.category_urls = item.categoryUrls;
    item.collection = item.collection || item.category;
    item.collections = item.categories;
    item.collection_url = item.collection_url || item.category_url;
    item.collectionUrl = item.collectionUrl || item.collection_url;
    item.collectionUrls = item.categoryUrls;
    item.collection_urls = item.categoryUrls;
    item.platforms = uniqueSortedLabels(item.platforms || (item.platform ? [item.platform] : []));
    item.genres = exportListFromValue(item.genres);
    item.release_date = item.release_date || '';
    item.user_rating = item.user_rating == null || item.user_rating === '' ? null : Number(item.user_rating);
    item.average_rating = normalizeAverageRatingValue(item.average_rating);
    item.source_meta = {
      ...sourceMeta,
      category: item.category,
      categories: item.categories,
      category_url: item.category_url,
      category_urls: item.categoryUrls,
      status_ids: item.statusIds,
      status_color: item.statusColor || sourceMeta.status_color || '',
    };
    return item;
  }

  function buildHowLongToBeatPayloadFromState(state) {
    const items = mergeHowLongToBeatItemsForExport(state.items || [], state.config || null)
      .map(item => normalizeHowLongToBeatSharedExportItem(item));
    return {
      sourceWebsite: getSourceWebsite('howlongtobeat'),
      username: state.username || userSlug,
      source: state.startUrl,
      generated_at: new Date().toISOString(),
      status_pill_config: state.config || null,
      categories: (state.mappings || []).map(mapping => ({
        name: mapping.collection.name,
        games: mapping.collection.games,
        url: mapping.collection.url,
        status: mapping.status,
      })),
      failed_categories: state.failures || [],
      enhanced_metadata_misses: state.enhancedMetadataMisses || [],
      enhanced_metadata_misses_by_field: state.enhancedMetadataMissesByField || {},
      enhanced_metadata_failures: state.enhancedMetadataFailures || [],
      total: items.length,
      items: items.sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base', numeric: true }) ||
        String(a.platform || '').localeCompare(String(b.platform || ''), undefined, { sensitivity: 'base', numeric: true })
      ),
    };
  }

  function getItemFieldValue(item, field) {
    if (!item) return undefined;
    if (item[field] !== undefined) return item[field];
    const sourceMeta = item.source_meta && typeof item.source_meta === 'object' ? item.source_meta : {};
    return sourceMeta[field];
  }

  function hasExportValue(value) {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== '';
  }

  function buildCanonicalSharedExportItem(sourceId, rawItem, { normalizeItem = normalizeSharedExportItem, defaultStatus = 'played' } = {}) {
    const descriptor = getSourceDescriptorById(sourceId);
    const item = normalizeItem(rawItem, { defaultStatus });
    const canonical = {};
    descriptor.fields.sharedItemFields.forEach(field => {
      canonical[field] = getItemFieldValue(item, field);
    });
    canonical.genres = exportListFromValue(canonical.genres);
    canonical.platforms = uniqueSortedLabels(exportListFromValue(canonical.platforms));
    canonical.statuses = exportListFromValue(canonical.statuses || canonical.status);
    if (!canonical.status && canonical.statuses.length) canonical.status = canonical.statuses[0];
    if (!canonical.statuses.length && canonical.status) canonical.statuses = [canonical.status];
    canonical.user_rating = canonical.user_rating == null || canonical.user_rating === '' ? null : Number(canonical.user_rating);
    canonical.average_rating = normalizeAverageRatingValue(canonical.average_rating);

    const sourceMeta = {};
    descriptor.fields.sourceMetaFields.forEach(field => {
      const value = getItemFieldValue(item, field);
      if (!hasExportValue(value)) return;
      sourceMeta[field] = Array.isArray(value) ? exportListFromValue(value) : value;
      if (descriptor.fields.preserveSourceMetaFieldsOnItems) canonical[field] = sourceMeta[field];
    });
    if (Object.keys(sourceMeta).length) canonical.source_meta = sourceMeta;
    return canonical;
  }

  function buildCanonicalSharedExportPayload(sourceId, rawPayload, options = {}) {
    const descriptor = getSourceDescriptorById(sourceId);
    const normalizeItem = options.normalizeItem || normalizeSharedExportItem;
    const defaultStatus = options.defaultStatus ?? 'played';
    const items = (rawPayload.items || []).map(item =>
      buildCanonicalSharedExportItem(descriptor.id, item, { normalizeItem, defaultStatus })
    );
    return normalizeSharedExportPayload({
      ...rawPayload,
      sourceWebsite: descriptor.sourceWebsite,
      items,
    }, {
      ...options,
      sourceWebsite: descriptor.sourceWebsite,
      defaultStatus,
    });
  }

  function buildSharedJson(payload, sourceId = DEFAULT_SOURCE_ID, options = {}) {
    return JSON.stringify(buildCanonicalSharedExportPayload(sourceId, payload, options), null, 2);
  }

  function buildCountsFromItems(items) {
    const counts = Object.fromEntries(STATUS_ORDER.map(status => [status, 0]));
    items.forEach(item => {
      const statuses = statusList(item);
      [...new Set(statuses.filter(Boolean))].forEach(status => {
        if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status] += 1;
      });
    });
    return counts;
  }

  function guessUsernameFromFilename(filename) {
    return guessUsernameFromFilenameForSource(DEFAULT_SOURCE_ID, filename);
  }

  function guessMobyGamesUsernameFromFilename(filename) {
    return guessUsernameFromFilenameForSource('mobygames', filename);
  }

  function guessHowLongToBeatUsernameFromFilename(filename) {
    return guessUsernameFromFilenameForSource('howlongtobeat', filename);
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function guessUsernameFromFilenameForSource(sourceId, filename) {
    const stem = String(filename || '').replace(/\.[^.]+$/, '');
    const descriptor = getSourceDescriptorById(sourceId);
    const suffix = escapeRegExp(descriptor.export.filenameSuffix);
    const match = stem.match(new RegExp(`^\\d{4}\\.\\d{2}\\.\\d{2}-(.+)-${suffix}$`, 'i'));
    return match ? match[1] : '';
  }

  function normalizeExportPayload(rawPayload, filename = '') {
    if (!rawPayload || typeof rawPayload !== 'object' || !Array.isArray(rawPayload.items)) {
      throw new Error('This file does not contain a Backloggd export payload.');
    }
    if (isSourceWebsite(rawPayload.sourceWebsite, 'mobygames')) {
      throw new Error(`This is a ${getSourceWebsite('mobygames')} export file. Use the File Converter on the ${getSourceWebsite('mobygames')} export screen.`);
    }
    if (isSourceWebsite(rawPayload.sourceWebsite, 'howlongtobeat')) {
      throw new Error(`This is a ${getSourceWebsite('howlongtobeat')} export file. Use the File Converter on the ${getSourceWebsite('howlongtobeat')} export screen.`);
    }
    const normalizedUsername = rawPayload.username || guessUsernameFromFilename(filename) || userSlug || 'backloggd-user';
    const items = rawPayload.items.map(rawItem => {
      const item = normalizeSharedExportItem(rawItem, { defaultStatus: 'played' });
      const primaryStatus = item.status || (Array.isArray(item.statuses) ? item.statuses[0] : '') || 'played';
      item.status = primaryStatus;
      item.statuses = Array.isArray(item.statuses) && item.statuses.length ? item.statuses : [primaryStatus];
      if (item.user_rating === undefined) item.user_rating = null;
      if (item.average_rating === undefined) item.average_rating = null;
      return item;
    });
    return normalizeSharedExportPayload({
      ...rawPayload,
      items,
    }, {
      sourceWebsite: getSourceWebsite(DEFAULT_SOURCE_ID),
      username: normalizedUsername,
      source: `${location.origin}/u/${encodeURIComponent(normalizedUsername)}/games/`,
      defaultStatus: 'played',
    });
  }

  function parseCsvExportPayload(text, filename = '') {
    const rows = parseCsvRows(text);
    if (rows.length < 2) throw new Error('The CSV file is empty or missing rows.');
    const headers = rows[0].map(h => String(h || '').replace(/^\uFEFF/, '').trim().toLowerCase());
    const headerIndex = new Map(headers.map((header, index) => [header, index]));
    if (!headerIndex.has('title')) throw new Error('The CSV file does not look like a Backloggd export.');
    const cell = (row, name) => {
      const index = headerIndex.get(name);
      return index == null ? '' : String(row[index] || '').trim();
    };
    const includeGenres = headerIndex.has('genres');
    const includePlatforms = headerIndex.has('platforms');
    const items = rows.slice(1).map(row => {
      const statusInfo = normalizeLibraryStatus(cell(row, 'status'));
      const item = {
        release_date: cell(row, 'release_date'),
        title: cell(row, 'title'),
        status: statusInfo.status,
        statuses: [statusInfo.status],
        average_rating: parseRating(cell(row, 'average_rating')),
        user_rating: parseRating(cell(row, 'user_rating')),
        game_id: cell(row, 'game_id'),
        url: cell(row, 'url'),
        cover_url: cell(row, 'cover_url'),
        play_type: statusInfo.play_type,
      };
      if (includeGenres) item.genres = splitExportList(cell(row, 'genres'));
      if (includePlatforms) item.platforms = splitExportList(cell(row, 'platforms'));
      return item;
    }).filter(item => item.title || item.url || item.game_id);
    return normalizeExportPayload({
      username: guessUsernameFromFilename(filename) || userSlug,
      source: `${location.origin}/u/${encodeURIComponent(guessUsernameFromFilename(filename) || userSlug || 'backloggd-user')}/games/`,
      generated_at: new Date().toISOString(),
      include_genres: includeGenres,
      include_platforms: includePlatforms,
      include_platforms226: false,
      items,
    }, filename);
  }

  function normalizeMobyGamesExportPayload(rawPayload, filename = '') {
    if (!rawPayload || typeof rawPayload !== 'object' || !Array.isArray(rawPayload.items)) {
      throw new Error('This file does not contain a MobyGames export payload.');
    }
    if (rawPayload.sourceWebsite && !isSourceWebsite(rawPayload.sourceWebsite, 'mobygames')) {
      const sourceName = sourceLabelForWebsite(rawPayload.sourceWebsite);
      throw new Error(`This is a ${sourceName} export file. Use the File Converter on the ${sourceName} export screen.`);
    }
    const normalizedUsername = rawPayload.username || guessMobyGamesUsernameFromFilename(filename) || userSlug || 'mobygames-user';
    const items = rawPayload.items.map(rawItem => {
      return normalizeMobyGamesSharedExportItem(rawItem);
    }).filter(item => item.name || item.gameUrl);
    if (!items.length) throw new Error('The MobyGames export does not contain any games.');
    return normalizeSharedExportPayload({
      ...rawPayload,
      sourceWebsite: getSourceWebsite('mobygames'),
      username: normalizedUsername,
      source: rawPayload.source || getMobyGamesCollectionRootUrl(location.href) || location.href,
      generated_at: rawPayload.generated_at || new Date().toISOString(),
      status_pill_config: rawPayload.status_pill_config || cloneStatusPillConfig(statusPillConfig),
      collections: Array.isArray(rawPayload.collections) ? rawPayload.collections : [],
      items,
    }, {
      sourceWebsite: getSourceWebsite('mobygames'),
      username: normalizedUsername,
      source: rawPayload.source || getMobyGamesCollectionRootUrl(location.href) || location.href,
      defaultStatus: '',
    });
  }

  function parseMobyGamesCsvExportPayload(text, filename = '') {
    const rows = parseCsvRows(text).filter(row => String(row[0] || '').trim()[0] !== '#');
    if (rows.length < 2) throw new Error('The CSV file is empty or missing rows.');
    const headers = rows[0].map(h => String(h || '').replace(/^\uFEFF/, '').trim().toLowerCase());
    const headerIndex = new Map(headers.map((header, index) => [header, index]));
    const hasCanonicalHeaders = headerIndex.has('title') && headerIndex.has('url');
    const hasLegacyHeaders = headerIndex.has('name') && headerIndex.has('game url');
    if (!hasCanonicalHeaders && !hasLegacyHeaders) {
      throw new Error('The CSV file does not look like a MobyGames export.');
    }
    const cell = (row, name) => {
      const index = headerIndex.get(name);
      return index == null ? '' : String(row[index] || '').trim();
    };
    const items = rows.slice(1).map(row => {
      const statuses = splitExportList(cell(row, 'status'));
      const statusIds = splitExportList(cell(row, 'status_ids'));
      const releaseYear = cell(row, 'release_year') || cell(row, 'release year');
      const userRating = parseRating(cell(row, 'user_rating') || cell(row, 'user rating'));
      const averageRating = parseRating(cell(row, 'average_rating') || cell(row, 'average rating'));
      const collectionUrl = cell(row, 'collection_url') || cell(row, 'collection url');
      const url = cell(row, 'url') || cell(row, 'game url');
      const coverUrl = cell(row, 'cover_url') || cell(row, 'cover url');
      const fullReleaseDate = cell(row, 'full_release_date') || cell(row, 'full release date') || cell(row, 'release_date') || cell(row, 'release date');
      return {
        title: cell(row, 'title') || cell(row, 'name'),
        release_date: cell(row, 'release_date') || cell(row, 'release date'),
        release_year: releaseYear,
        platform: cell(row, 'platform'),
        platforms: splitExportList(cell(row, 'platforms') || cell(row, 'mobygames platforms') || cell(row, 'platform')),
        genres: splitExportList(cell(row, 'genres') || cell(row, 'mobygames genres') || cell(row, 'genre')),
        gameplay: splitExportList(cell(row, 'gameplay') || cell(row, 'mobygames gameplay')),
        user_rating: userRating,
        collection: cell(row, 'collection'),
        status: statuses[0] || '',
        statuses,
        status_ids: statusIds,
        collection_url: collectionUrl,
        url,
        cover_url: coverUrl,
        full_release_date: fullReleaseDate,
        average_rating: averageRating,
      };
    });
    return normalizeMobyGamesExportPayload({
      username: guessMobyGamesUsernameFromFilename(filename) || userSlug,
      source: getMobyGamesCollectionRootUrl(location.href) || location.href,
      generated_at: new Date().toISOString(),
      items,
    }, filename);
  }

  function parseMobyGamesJsonExportPayload(text, filename = '') {
    return normalizeMobyGamesExportPayload(JSON.parse(text), filename);
  }

  function parseMobyGamesHtmlExportPayload(text, filename = '') {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const payloadEl = doc.getElementById('payload');
    if (payloadEl && payloadEl.textContent) return parseMobyGamesJsonExportPayload(payloadEl.textContent, filename);
    const match = String(text || '').match(/<script[^>]+id=["']payload["'][^>]*>([\s\S]*?)<\/script>/i);
    if (match) return parseMobyGamesJsonExportPayload(match[1], filename);
    throw new Error('The HTML file does not contain a MobyGames export payload.');
  }

  function normalizeHowLongToBeatExportPayload(rawPayload, filename = '') {
    if (!rawPayload || typeof rawPayload !== 'object' || !Array.isArray(rawPayload.items)) {
      throw new Error('This file does not contain a HowLongToBeat export payload.');
    }
    if (rawPayload.sourceWebsite && !isSourceWebsite(rawPayload.sourceWebsite, 'howlongtobeat')) {
      const sourceName = sourceLabelForWebsite(rawPayload.sourceWebsite);
      throw new Error(`This is a ${sourceName} export file. Use the File Converter on the ${sourceName} export screen.`);
    }
    const normalizedUsername = rawPayload.username || guessHowLongToBeatUsernameFromFilename(filename) || userSlug || 'howlongtobeat-user';
    const items = rawPayload.items.map(rawItem => normalizeHowLongToBeatSharedExportItem(rawItem)).filter(item => item.title || item.url);
    if (!items.length) throw new Error('The HowLongToBeat export does not contain any games.');
    const counts = rawPayload.counts && typeof rawPayload.counts === 'object'
      ? rawPayload.counts
      : buildCountsFromItems(items);
    return {
      ...rawPayload,
      sourceWebsite: getSourceWebsite('howlongtobeat'),
      username: normalizedUsername,
      source: rawPayload.source || getHowLongToBeatUserGamesRootUrl(location.href) || location.href,
      generated_at: rawPayload.generated_at || new Date().toISOString(),
      status_pill_config: rawPayload.status_pill_config || cloneStatusPillConfig(statusPillConfig),
      categories: Array.isArray(rawPayload.categories) ? rawPayload.categories : [],
      counts,
      raw_counts: rawPayload.raw_counts || counts,
      include_genres: rawPayload.include_genres !== undefined ? !!rawPayload.include_genres : items.some(item => item.genres.length),
      include_platforms: rawPayload.include_platforms !== undefined ? !!rawPayload.include_platforms : items.some(item => item.platforms.length),
      include_platforms226: !!rawPayload.include_platforms226,
      total: items.length,
      items,
    };
  }

  function parseHowLongToBeatCsvExportPayload(text, filename = '') {
    const rows = parseCsvRows(text).filter(row => String(row[0] || '').trim()[0] !== '#');
    if (rows.length < 2) throw new Error('The CSV file is empty or missing rows.');
    const headers = rows[0].map(h => String(h || '').replace(/^\uFEFF/, '').trim().toLowerCase());
    const headerIndex = new Map(headers.map((header, index) => [header, index]));
    if (!headerIndex.has('title') || !headerIndex.has('url')) {
      throw new Error('The CSV file does not look like a HowLongToBeat export.');
    }
    const cell = (row, name) => {
      const index = headerIndex.get(name);
      return index == null ? '' : String(row[index] || '').trim();
    };
    const items = rows.slice(1).map(row => {
      const statuses = splitExportList(cell(row, 'status'));
      const statusIds = splitExportList(cell(row, 'status_ids'));
      const category = cell(row, 'category');
      const categoryUrl = cell(row, 'category_url');
      const url = cell(row, 'url') || cell(row, 'game_id');
      const averageRating = normalizeAverageRatingValue(cell(row, 'average_rating') || cell(row, 'average rating'));
      const userRatingText = cell(row, 'user_rating') || cell(row, 'user rating');
      const userRating = userRatingText === '' ? null : Number(userRatingText);
      return {
        title: cell(row, 'title'),
        release_date: cell(row, 'release_date') || cell(row, 'release date'),
        genres: splitExportList(cell(row, 'genres') || cell(row, 'genre')),
        platform: cell(row, 'platform'),
        platforms: splitExportList(cell(row, 'platforms') || cell(row, 'platform')),
        status: statuses[0] || '',
        statuses,
        status_ids: statusIds,
        category,
        categories: splitExportList(category),
        category_url: categoryUrl,
        category_urls: splitExportList(categoryUrl),
        url,
        gameUrl: url,
        cover_url: cell(row, 'cover_url'),
        average_rating: averageRating,
        user_rating: Number.isFinite(userRating) ? userRating : null,
      };
    });
    return normalizeHowLongToBeatExportPayload({
      username: guessHowLongToBeatUsernameFromFilename(filename) || userSlug,
      source: getHowLongToBeatUserGamesRootUrl(location.href) || location.href,
      generated_at: new Date().toISOString(),
      items,
    }, filename);
  }

  function parseHowLongToBeatJsonExportPayload(text, filename = '') {
    return normalizeHowLongToBeatExportPayload(JSON.parse(text), filename);
  }

  function parseHowLongToBeatHtmlExportPayload(text, filename = '') {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const payloadEl = doc.getElementById('payload');
    if (payloadEl && payloadEl.textContent) return parseHowLongToBeatJsonExportPayload(payloadEl.textContent, filename);
    const match = String(text || '').match(/<script[^>]+id=["']payload["'][^>]*>([\s\S]*?)<\/script>/i);
    if (match) return parseHowLongToBeatJsonExportPayload(match[1], filename);
    throw new Error('The HTML file does not contain a HowLongToBeat export payload.');
  }

  function parseJsonExportPayload(text, filename = '') {
    return normalizeExportPayload(JSON.parse(text), filename);
  }

  function parseHtmlExportPayload(text, filename = '') {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const payloadEl = doc.getElementById('payload');
    if (payloadEl && payloadEl.textContent) return parseJsonExportPayload(payloadEl.textContent, filename);
    const match = String(text || '').match(/<script[^>]+id=["']payload["'][^>]*>([\s\S]*?)<\/script>/i);
    if (match) return parseJsonExportPayload(match[1], filename);
    throw new Error('The HTML file does not contain a Backloggd export payload.');
  }

  function parseBackloggdExportedPayload(text, format, filename = '') {
    if (format === 'csv') return parseCsvExportPayload(text, filename);
    if (format === 'json') return parseJsonExportPayload(text, filename);
    if (format === 'html') return parseHtmlExportPayload(text, filename);
    throw new Error('Unsupported source file type.');
  }

  function parseMobyGamesExportedPayload(text, format, filename = '') {
    if (format === 'csv') return parseMobyGamesCsvExportPayload(text, filename);
    if (format === 'json') return parseMobyGamesJsonExportPayload(text, filename);
    if (format === 'html') return parseMobyGamesHtmlExportPayload(text, filename);
    throw new Error('Unsupported source file type.');
  }

  function parseHowLongToBeatExportedPayload(text, format, filename = '') {
    if (format === 'csv') return parseHowLongToBeatCsvExportPayload(text, filename);
    if (format === 'json') return parseHowLongToBeatJsonExportPayload(text, filename);
    if (format === 'html') return parseHowLongToBeatHtmlExportPayload(text, filename);
    throw new Error('Unsupported source file type.');
  }

  function parseConverterPayload(text, format, filename = '', converterMode = 'backloggd') {
    return getSourceFormatDescriptor(converterMode).parseExportedPayload(text, format, filename);
  }

  function buildBackloggdConvertedExport(payload, format) {
    if (format === 'csv') return { extension: 'csv', mime: 'text/csv;charset=utf-8', content: buildCsv(payload) };
    if (format === 'json') return { extension: 'json', mime: 'application/json;charset=utf-8', content: buildSharedJson(payload, DEFAULT_SOURCE_ID) };
    if (format === 'html') return { extension: 'html', mime: 'text/html;charset=utf-8', content: buildHtml(payload) };
    throw new Error('Unsupported export file type.');
  }

  function buildMobyGamesConvertedExport(payload, format) {
    if (format === 'csv') return { extension: 'csv', mime: 'text/csv;charset=utf-8', content: buildMobyGamesCsv(payload) };
    if (format === 'json') return { extension: 'json', mime: 'application/json;charset=utf-8', content: buildMobyGamesJson(payload) };
    if (format === 'html') return { extension: 'html', mime: 'text/html;charset=utf-8', content: buildMobyGamesHtml(payload) };
    throw new Error('Unsupported export file type.');
  }

  function buildHowLongToBeatConvertedExport(payload, format) {
    if (format === 'csv') return { extension: 'csv', mime: 'text/csv;charset=utf-8', content: buildHowLongToBeatCsv(payload) };
    if (format === 'json') return { extension: 'json', mime: 'application/json;charset=utf-8', content: buildHowLongToBeatJson(payload) };
    if (format === 'html') return { extension: 'html', mime: 'text/html;charset=utf-8', content: buildHowLongToBeatHtml(payload) };
    throw new Error('Unsupported export file type.');
  }

  function buildConverterOutput(payload, format, converterMode = 'backloggd') {
    return getSourceFormatDescriptor(converterMode).buildConvertedExport(payload, format);
  }

  configureSourceDescriptor('backloggd', {
    formats: {
      id: SOURCE_REGISTRY.backloggd.id,
      sourceWebsite: getSourceWebsite(DEFAULT_SOURCE_ID),
      supportedFormats: ['csv', 'json', 'html'],
      parseExportedPayload: parseBackloggdExportedPayload,
      buildConvertedExport: buildBackloggdConvertedExport,
      buildCsv,
      buildJson: payload => buildSharedJson(payload, DEFAULT_SOURCE_ID),
      buildHtml,
    },
  });

  configureSourceDescriptor('mobygames', {
    formats: {
      id: SOURCE_REGISTRY.mobygames.id,
      sourceWebsite: getSourceWebsite('mobygames'),
      supportedFormats: ['csv', 'json', 'html'],
      parseExportedPayload: parseMobyGamesExportedPayload,
      buildConvertedExport: buildMobyGamesConvertedExport,
      buildCsv: buildMobyGamesCsv,
      buildJson: buildMobyGamesJson,
      buildHtml: buildMobyGamesHtml,
    },
  });

  configureSourceDescriptor('howlongtobeat', {
    formats: {
      id: SOURCE_REGISTRY.howlongtobeat.id,
      sourceWebsite: getSourceWebsite('howlongtobeat'),
      supportedFormats: ['csv', 'json', 'html'],
      parseExportedPayload: parseHowLongToBeatExportedPayload,
      buildConvertedExport: buildHowLongToBeatConvertedExport,
      buildCsv: buildHowLongToBeatCsv,
      buildJson: buildHowLongToBeatJson,
      buildHtml: buildHowLongToBeatHtml,
    },
  });

  function datePrefixForExport(date = new Date()) {
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  function libraryBaseName(source, username) {
    const descriptor = getSourceDescriptorById(source);
    const fallbackUser = `${descriptor.id}-user`;
    return `${datePrefixForExport()}-${safeFilePart(username || userSlug || fallbackUser)}-${descriptor.export.filenameSuffix}`;
  }

  function convertedBaseName(filename, payload) {
    const stem = String(filename || '').replace(/\.[^.]+$/, '');
    if (stem) return safeFilePart(stem);
    if (payload && payload.sourceWebsite) {
      return libraryBaseName(getSourceDescriptorByWebsite(payload.sourceWebsite).id, payload.username);
    }
    return libraryBaseName(DEFAULT_SOURCE_ID, payload && payload.username);
  }

  // ---------------------------------------------------------------------------
  // 6. Network and version checks
  // ---------------------------------------------------------------------------

  async function fetchHtml(url, options = {}) {
    const MAX_ATTEMPTS = options.maxAttempts || 3;
    const TIMEOUT_MS = options.timeoutMs || 20000;
    let lastError = null;

    function shouldRetry(error) {
      if (!error) return true;
      if (error.name === 'AbortError') return true;
      if (error.retryable === false) return false;
      if (typeof error.status === 'number') {
        return error.status === 408 || error.status === 429 || error.status >= 500;
      }
      return true;
    }

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      checkExportCancelled();
      await waitIfExportPaused();
      if (attempt > 0) {
        const base  = 1000 * Math.pow(2, attempt - 1);
        const jitter = base * 0.25 * (Math.random() * 2 - 1);
        await new Promise(resolve => setTimeout(resolve, Math.round(base + jitter)));
        checkExportCancelled();
        await waitIfExportPaused();
      }

      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      if (controller) activeExportFetchControllers.add(controller);
      const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
      try {
        const response = await fetch(url, {
          credentials: 'same-origin',
          signal: controller ? controller.signal : undefined,
        });
        checkExportCancelled();
        if (!response.ok) {
          const error = new Error(`${response.status} ${response.statusText} for ${url}`);
          error.status = response.status;
          error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
          throw error;
        }
        const text = await response.text();
        checkExportCancelled();
        return text;
      } catch (error) {
        if (exportCancelRequested) throw makeExportCancelledError();
        lastError = error;
        if (!shouldRetry(error) || attempt === MAX_ATTEMPTS - 1) break;
      } finally {
        if (timer) clearTimeout(timer);
        if (controller) activeExportFetchControllers.delete(controller);
      }
    }
    throw lastError;
  }

  function parseVersionParts(value) {
    const match = String(value || '').trim().match(/^v?\.?(\d+(?:\.\d+){1,3})$/i);
    if (!match) return null;
    return match[1].split('.').map(part => Number(part));
  }

  function compareVersionParts(a, b) {
    const maxLength = Math.max(a.length, b.length);
    for (let i = 0; i < maxLength; i += 1) {
      const left = a[i] || 0;
      const right = b[i] || 0;
      if (left !== right) return left > right ? 1 : -1;
    }
    return 0;
  }

  function findHighestVersionFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let highest = null;

    function addCandidate(value) {
      const parts = parseVersionParts(value);
      if (!parts) return;
      if (!highest || compareVersionParts(parts, highest) > 0) highest = parts;
    }

    for (const heading of doc.querySelectorAll('h1')) {
      addCandidate(heading.textContent);
    }

    for (const link of doc.querySelectorAll('a[href*="/releases/tag/"]')) {
      addCandidate(link.textContent);
      const href = link.getAttribute('href') || '';
      const tag = href.split('/').filter(Boolean).pop() || '';
      addCandidate(decodeURIComponent(tag));
    }

    const tagUrlRe = /\/releases\/tag\/([^"'<>\s?#]+)/gi;
    let match;
    while ((match = tagUrlRe.exec(html)) !== null) {
      addCandidate(decodeURIComponent(match[1]));
    }

    return highest;
  }

  function fetchReleasePageHtml(url, timeoutMs = 3500) {
    const request = typeof GM_xmlhttpRequest === 'function'
      ? GM_xmlhttpRequest
      : typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function'
        ? GM.xmlHttpRequest.bind(GM)
        : null;

    if (request) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error('Release version check timed out'));
        }, timeoutMs);

        request({
          method: 'GET',
          url,
          timeout: timeoutMs,
          onload: response => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (response.status < 200 || response.status >= 300) {
              reject(new Error(`Release version check failed: ${response.status}`));
              return;
            }
            resolve(response.responseText || '');
          },
          ontimeout: () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(new Error('Release version check timed out'));
          },
          onerror: () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(new Error('Release version check failed'));
          },
        });
      });
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    return fetch(url, { credentials: 'omit', signal: controller ? controller.signal : undefined }).then(response => {
      if (!response.ok) throw new Error(`Release version check failed: ${response.status}`);
      return response.text();
    }).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  async function checkLatestExporterVersion() {
    if (!versionNotice) return;
    try {
      const html = await fetchReleasePageHtml(EXPORTER_RELEASES_URL);
      const latest = findHighestVersionFromHtml(html);
      const current = parseVersionParts(EXPORTER_VERSION);
      if (latest && current && compareVersionParts(latest, current) > 0) {
        versionNotice.classList.add('is-visible');
        alignVersionNoticeToGithubButton();
      }
    } catch (_) {
      // Ignore network/CORS failures; the exporter should load normally without the notice.
    }
  }

  function alignVersionNoticeToGithubButton() {
    if (!panel || !versionNotice || !versionNotice.classList.contains('is-visible')) return;
    const filesLabel = panel.querySelector('.bgd-files-label');
    if (!filesLabel) return;
    const bgdTop = panel.querySelector('.bgd-top');
    if (!bgdTop) return;
    const containerRect = bgdTop.getBoundingClientRect();
    const filesRect = filesLabel.getBoundingClientRect();
    // Align bottom of notice bubble with bottom of FILES text, 3px right of the "S" in FILES
    const noticeHeight = versionNotice.offsetHeight || 20;
    const noticeTop = filesRect.bottom - containerRect.top - noticeHeight - 4;
    const filesText = filesLabel.querySelector('span');
    const filesTextRect = filesText ? filesText.getBoundingClientRect() : filesRect;
    const noticeLeft = filesTextRect.right - containerRect.left + 1;
    versionNotice.style.position = 'absolute';
    versionNotice.style.top = `${Math.round(noticeTop)}px`;
    versionNotice.style.left = `${Math.round(noticeLeft)}px`;
    versionNotice.style.right = 'auto';
  }

  // ---------------------------------------------------------------------------
  // 7. Backloggd scraping
  // ---------------------------------------------------------------------------

  function getMaxPage(doc) {
    let max = 1;
    for (const anchor of doc.querySelectorAll('a[href*="page="]')) {
      const parsed = new URL(anchor.getAttribute('href'), location.origin);
      const page = Number(parsed.searchParams.get('page'));
      if (Number.isFinite(page)) max = Math.max(max, page);
    }
    return max;
  }

  function resolveCardUrl(card) {
    const link = card.querySelector('a.cover-link');
    const href = link ? link.getAttribute('href') : '';
    return href ? new URL(href, location.origin).href : '';
  }

  function normalizeGameKey(row) {
    return row.url || row.game_id || row.title.toLocaleLowerCase();
  }

  function findReleaseDate(text) {
    const source = String(text || '').replace(/\s+/g, ' ').trim();
    if (TBD_RELEASE_RE.test(source)) return '';
    const fullDate = source.match(FULL_RELEASE_DATE_RE);
    if (fullDate) return fullDate[0].replace('Sept', 'Sep');
    const monthYear = source.match(MONTH_YEAR_RELEASE_RE);
    if (monthYear) return monthYear[0].replace('Sept', 'Sep');
    const yearOnly = source.match(YEAR_ONLY_RELEASE_RE);
    return yearOnly ? yearOnly[0] : '';
  }

  function isYearOnlyDate(value) {
    const v = String(value || '').trim();
    return YEAR_ONLY_RELEASE_RE.test(v) && !FULL_RELEASE_DATE_RE.test(v) && !MONTH_YEAR_RELEASE_RE.test(v);
  }

  function textWithoutGameCard(element) {
    const ignoredSelector = '.game-cover, .avg-rating, .game-text-centered, img, a.cover-link';
    const parts = [];
    const stack = [element];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.nodeValue || '');
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node !== element && node.matches(ignoredSelector)) continue;
      for (let i = node.childNodes.length - 1; i >= 0; i -= 1) {
        stack.push(node.childNodes[i]);
      }
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function findReleaseDateNearCard(card) {
    const holder = card.closest('.rating-hover') || card.parentElement || card;
    return findReleaseDate(textWithoutGameCard(holder));
  }

  function parseDetailReleaseDate(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let bestDate = '';
    for (const element of doc.querySelectorAll('a[href*="release_year:"]')) {
      const date = findReleaseDate(element.textContent);
      if (!date) continue;
      if (!bestDate || (isYearOnlyDate(bestDate) && !isYearOnlyDate(date))) bestDate = date;
    }
    if (bestDate) return bestDate;

    // Fallback: look for a release-status label ("Released", "Alpha", etc.) anywhere
    // in the DOM and read the date from the nearest sibling or parent anchor.
    // This is fully DOM-based and avoids fragile raw-string slicing.
    const STATUS_LABELS_RE = /^(?:Released|Alpha|Beta|Upcoming|Early Access)$/i;
    for (const node of doc.querySelectorAll('p, span, div, td, dt, dd, li')) {
      if (!STATUS_LABELS_RE.test(node.textContent.trim())) continue;
      // Search siblings and the parent element for an anchor with a date.
      const candidates = [
        ...(node.parentElement ? node.parentElement.querySelectorAll('a') : []),
        ...(node.nextElementSibling ? [node.nextElementSibling] : []),
      ];
      for (const el of candidates) {
        const date = findReleaseDate(el.textContent);
        if (date) return date;
      }
    }

    return '';
  }

  // Parses a page from the unified rating endpoint:
  //   /u/<user>/games/rating/type:played,playing,backlog,wishlist?page=N
  //
  // Each game card has a matching #preloaded-log-{gameId} div whose inner child
  // carries data-attributes that encode every status the game belongs to:
  //   data-is-playing - timestamp string (non-empty) when game is in Playing
  //   data-is-backlog - timestamp string (non-empty) when game is in Backlog
  //   data-is-wishlist - timestamp string (non-empty) when game is in Wishlist
  //   data-status-title - Played sub-status ("Completed", "Shelved", ...) or ""
  //
  // A non-empty data-is-playing / data-is-backlog / data-is-wishlist means the
  // game belongs to that status.  A game with none of those set (but present on
  // this page) is in the Played list.  data-status-title gives the Played
  // sub-status (play_type) only when present.
  //
  // The page also shows average ratings and the user's own rating via the
  // preloaded-log mechanism.
  function parseUnifiedPage(html, page, options = {}) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const container = doc.querySelector('#user-games-library-container') || doc;
    const rows = [];
    const forcedStatus = options.forcedStatus || null;

    for (const card of container.querySelectorAll('.game-cover[game_id]')) {
      const ownerDoc = card.ownerDocument || document;
      const holder   = card.closest('.rating-hover') || card.parentElement || card;
      const image    = card.querySelector('img');
      const titleEl  = card.querySelector('.game-text-centered');
      const ratingEl = holder.querySelector('.avg-rating');
      const ratingValue = parseRating(ratingEl ? ratingEl.textContent : '');

      // -- Derive statuses from data-attributes ---
      // These attributes live on the inner div inside #preloaded-log-{gameId}.
      // We locate the inner div via [data-log-id] which is always present on it.
      // A non-empty attribute value (a UTC timestamp string) means the game belongs
      // to that status.  The attributes are:
      //   data-is-play - non-empty when game is in the Played list
      //   data-is-playing - non-empty when game is currently Playing
      //   data-is-backlog - non-empty when game is in Backlog
      //   data-is-wishlist - non-empty when game is in Wishlist
      //   data-status-title - Played sub-status ("Completed", "Shelved", ...) or ""
      const gameId = card.getAttribute('game_id') || '';
      const logEl = gameId
        ? ownerDoc.querySelector(`#preloaded-log-${gameId} [data-log-id]`)
        : null;
      const isPlay     = (logEl ? logEl.getAttribute('data-is-play')     || '' : '').trim();
      const isPlaying  = (logEl ? logEl.getAttribute('data-is-playing')  || '' : '').trim();
      const isBacklog  = (logEl ? logEl.getAttribute('data-is-backlog')  || '' : '').trim();
      const isWishlist = (logEl ? logEl.getAttribute('data-is-wishlist') || '' : '').trim();
      // data-status-title is the Played sub-status string (or "" when absent).
      // Preserve original casing for label lookup; lowercase key used in PLAY_TYPE_LABELS.
      const statusTitleRaw = (logEl ? logEl.getAttribute('data-status-title') || '' : card.getAttribute('data-status-title') || '').trim();
      const statusTitle = normalizePlayType(statusTitleRaw);
      const hasStatusSignal = !!forcedStatus || !!(isPlay || statusTitleRaw || isPlaying || isBacklog || isWishlist);

      // Build the list of statuses this game belongs to.
      // Each flag is independent - a game can carry multiple statuses simultaneously.
      // Played is determined by data-is-play being non-empty OR by data-status-title
      // being set (sub-statuses only exist on played entries).
      const statuses = [];
      if (forcedStatus) {
        statuses.push(forcedStatus);
      } else {
        if (isPlay || statusTitleRaw) statuses.push('played');
        if (isPlaying)               statuses.push('playing');
        if (isBacklog)               statuses.push('backlog');
        if (isWishlist)              statuses.push('wishlist');
      }
      // Fallback: if no flag matched at all (logEl missing or all empty), the game
      // still appeared on this page so treat it as played.
      if (statuses.length === 0)  statuses.push('played');

      // Primary status = highest-priority entry in statuses array
      const primary = statuses.reduce((best, s) =>
        (STATUS_PRIORITY[s] ?? 99) < (STATUS_PRIORITY[best] ?? 99) ? s : best,
        statuses[0] || 'played'
      );

      // data_status_title: normalized value from Backloggd's data-status-title
      // attribute; this becomes the exported play_type later.
      const dataStatusTitle = statusTitle || parsePlayTypeFromCard(card, ownerDoc) || null;
      const userRating = parseUserRatingFromCard(card);
      const releaseDateFromCard = findReleaseDateNearCard(card);

      rows.push({
        status:   primary,
        statuses: statuses.length ? statuses : [primary],
        game_id:  card.getAttribute('game_id') || '',
        title:    decodeHtml(titleEl ? titleEl.textContent : image ? image.getAttribute('alt') : ''),
        url:      resolveCardUrl(card),
        cover_url: image ? image.getAttribute('src') || '' : '',
        average_rating:     ratingValue,
        user_rating_from_card: userRating,
        data_status_title:  dataStatusTitle,
        release_date_from_card: releaseDateFromCard,
        needs_status_fallback: !forcedStatus && !hasStatusSignal,
      });
    }

    return { rows, maxPage: getMaxPage(doc) };
  }

  function mergeReleaseDate(releaseByUrl, url, date) {
    if (!url || !date) return false;
    const current = releaseByUrl.get(url) || '';
    if (!current || (isYearOnlyDate(current) && !isYearOnlyDate(date))) {
      releaseByUrl.set(url, date);
      return true;
    }
    return false;
  }

  function mergeReleaseDates(releaseByUrl, sourceReleaseByUrl) {
    let added = 0;
    for (const [url, date] of sourceReleaseByUrl || []) {
      if (mergeReleaseDate(releaseByUrl, url, date)) added += 1;
    }
    return added;
  }

  function rowNeedsListReleaseDate(row, releaseByUrl) {
    if (!row || !row.url) return false;
    const date = releaseByUrl.get(row.url) || '';
    return !date || isYearOnlyDate(date);
  }

  function countRowsNeedingListReleaseDates(rows, releaseByUrl) {
    return rows.reduce((count, row) => count + (rowNeedsListReleaseDate(row, releaseByUrl) ? 1 : 0), 0);
  }

  async function collectReleaseDatesIfNeeded(label, rows, releaseByUrl, scraper) {
    const beforeMissing = countRowsNeedingListReleaseDates(rows, releaseByUrl);
    if (!beforeMissing) {
      addLog(`Release dates from ${label} skipped: already resolved`);
      return null;
    }
    const data = await scraper();
    const added = mergeReleaseDates(releaseByUrl, data && data.releaseByUrl);
    const afterMissing = countRowsNeedingListReleaseDates(rows, releaseByUrl);
    addLog(`Release dates from ${label}: ${added} added, ${afterMissing} still need fallback`);
    return data;
  }

  function parseReleasePage(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const container = doc.querySelector('#user-games-library-container') || doc;
    const urls = [];
    const releases = new Map();

    for (const card of container.querySelectorAll('.game-cover[game_id]')) {
      const url = resolveCardUrl(card);
      if (!url) continue;
      urls.push(url);
      const releaseDate = findReleaseDateNearCard(card);
      if (releaseDate) releases.set(url, releaseDate);
    }

    return {
      urls,
      releases,
      maxPage: getMaxPage(doc),
    };
  }

  function parseUserRatingFromCard(card) {
    // data-rating lives directly on the .game-cover card element itself.
    // It is on a scale of 0-10; divide by 2 to get the 0-5 user rating.
    const raw = parseInt(card.getAttribute('data-rating'), 10);
    if (Number.isFinite(raw) && raw > 0) return raw / 2;
    return null;
  }

  // Reads the play sub-status (Played/Completed/Retired/Shelved/Abandoned) from the
  // data-status-title attribute on the preloaded-log inner div for this game card.
  // ownerDoc is optional - when passed (from parseUnifiedPage) it avoids re-reading
  // card.ownerDocument on every call.
  function parsePlayTypeFromCard(card, ownerDoc) {
    const gameId = card.getAttribute('game_id');
    if (gameId) {
      const doc = ownerDoc || card.ownerDocument || document;
      const logDiv = doc.querySelector(`#preloaded-log-${gameId} [data-log-id]`);
      if (logDiv) {
        const raw = (logDiv.getAttribute('data-status-title') || '').trim();
        return normalizePlayType(raw);
      }
    }
    return null;
  }

  async function scrapeStatusBucket(status) {
    const targetSlug = getExportUserSlug();
    const base = `/u/${encodeURIComponent(targetSlug)}/games/rating:desc/type:${status}`;
    const releaseBase = `/u/${encodeURIComponent(targetSlug)}/games/release/type:${status}`;
    const releaseByUrl = new Map();
    const firstHtml = await fetchHtml(`${base}?page=1`);
    const firstParsed = parseUnifiedPage(firstHtml, 1, { forcedStatus: status });
    const rows = [...firstParsed.rows];
    const maxPage = firstParsed.maxPage;
    let prevUrlSet = new Set(firstParsed.rows.map(r => r.url));

    for (let page = 2; page <= maxPage; page += 1) {
      const html = await fetchHtml(`${base}?page=${page}`);
      const parsed = parseUnifiedPage(html, page, { forcedStatus: status });
      const urls = parsed.rows.map(r => r.url);
      if (isDuplicateUrlPage(urls, prevUrlSet)) break;
      prevUrlSet = new Set(urls);
      rows.push(...parsed.rows);
    }

    let releasePage = 1;
    let releaseMaxPage = Math.max(1, maxPage);
    while (releasePage <= releaseMaxPage) {
      const html = await fetchHtml(`${releaseBase}?page=${releasePage}`);
      const parsed = parseReleasePage(html);
      releaseMaxPage = Math.max(releaseMaxPage, parsed.maxPage);
      mergeReleaseDates(releaseByUrl, parsed.releases);
      releasePage += 1;
    }

    return { rows, releaseByUrl };
  }

  // Scrapes all four statuses in a single pass using the combined rating endpoint:
  //   /u/<user>/games/rating/type:played,playing,backlog,wishlist?page=N
  //
  // This collects all status rows and card-level ratings in one pass.
  //
  // Stop condition: when a page returns the exact same set of game URLs as the
  // previous page, we have wrapped around and can stop.
  async function scrapeAllStatuses() {
    const targetSlug = getExportUserSlug();
    const base = `/u/${encodeURIComponent(targetSlug)}/games/rating/type:${COMBINED_TYPE}`;

    addLog(`Reading library page 1\u2026`, 'info', 'lib-page-progress');
    const firstHtml   = await fetchHtml(`${base}?page=1`);
    const firstParsed = parseUnifiedPage(firstHtml, 1);
    let rows          = [...firstParsed.rows];
    const maxPage     = firstParsed.maxPage;

    if (maxPage > 1) addLog(`Reading library page 1 of ${maxPage}`, 'info', 'lib-page-progress');

    let prevUrlSet = new Set(firstParsed.rows.map(r => r.url));

    for (let page = 2; page <= maxPage; page += 1) {
      addLog(`Reading library page ${page} of ${maxPage}`, 'info', 'lib-page-progress');
      setProgressInRange(2, 36, page, maxPage);
      const html   = await fetchHtml(`${base}?page=${page}`);
      const parsed = parseUnifiedPage(html, page);

      // Duplicate-page guard (backloggd loops back on the last page):
      // compare sizes first (cheap), then check every URL for membership.
      const urls = parsed.rows.map(r => r.url);
      if (isDuplicateUrlPage(urls, prevUrlSet)) break;
      prevUrlSet = new Set(urls);

      rows.push(...parsed.rows);
    }

    const needsStatusFallback = !rows.length || rows.some(row => row.needs_status_fallback);
    let statusFallbackApplied = false;
    const statusFallbackReleaseByUrl = new Map();
    if (needsStatusFallback) {
      try {
        addLog('Status fallback: verifying language-neutral status buckets...', 'info', 'lib-page-progress');
        const bucketRows = [];
      for (const status of STATUS_ORDER) {
          addLog(`Status fallback: checking ${STATUS_LABELS[status]} bucket...`, 'info', 'lib-page-progress');
          const bucketData = await scrapeStatusBucket(status);
          bucketRows.push(...bucketData.rows);
          mergeReleaseDates(statusFallbackReleaseByUrl, bucketData.releaseByUrl);
        }
        if (bucketRows.length > 0) {
          rows = bucketRows;
          statusFallbackApplied = true;
          addLog(`Status fallback applied: ${bucketRows.length} status rows verified`);
          addLog(`Release dates from status fallback: ${statusFallbackReleaseByUrl.size} found`);
        }
      } catch (error) {
        if (isExportCancelledError(error)) throw error;
        addLog(`Status bucket verification failed; using combined scrape: ${error && error.message}`, 'error');
      }
    } else {
      addLog('Status fallback skipped: status data attributes already complete');
    }

    // Derive per-status raw counts from the selected rows (before dedup).
    const counts = {};
    for (const s of STATUS_ORDER) counts[s] = 0;
    for (const row of rows) {
      for (const s of statusList(row)) {
        if (s in counts) counts[s] += 1;
      }
    }
    for (const s of STATUS_ORDER) {
      addLog(`${STATUS_LABELS[s]} found: ${counts[s]}`);
    }

    return { rows, counts, statusFallbackApplied, statusFallbackReleaseByUrl };
  }

  function dedupeRows(rows) {
    const byGame = new Map();

    for (const row of rows) {
      const key = normalizeGameKey(row);
      const current = byGame.get(key);
      if (!current) {
        const initialStatuses = (row.statuses && row.statuses.length) ? [...row.statuses] : [row.status];
        byGame.set(key, { ...row, statuses: initialStatuses });
        continue;
      }
      // Merge all statuses from this occurrence (a game can carry multiple at once)
      for (const s of (row.statuses && row.statuses.length ? row.statuses : [row.status])) {
        if (!current.statuses.includes(s)) {
          current.statuses.push(s);
          // Keep highest-priority status as the primary
          const currentPriority = STATUS_PRIORITY[current.status] ?? 99;
          const nextPriority = STATUS_PRIORITY[s] ?? 99;
          if (nextPriority < currentPriority) {
            current.status = s;
          }
        }
      }
      // Merge user_rating_from_card if missing
      if (current.user_rating_from_card == null && row.user_rating_from_card != null) {
        current.user_rating_from_card = row.user_rating_from_card;
      }
      if (!current.release_date_from_card && row.release_date_from_card) {
        current.release_date_from_card = row.release_date_from_card;
      }
      if (row.needs_status_fallback) {
        current.needs_status_fallback = true;
      }
      // Merge data_status_title if missing
      if (!current.data_status_title && row.data_status_title) {
        current.data_status_title = row.data_status_title;
      }
    }

    return {
      rows: [...byGame.values()],
    };
  }

  function isDuplicateUrlPage(urls, prevUrlSet) {
    if (!prevUrlSet) return false;
    const urlSet = new Set(urls);
    return urlSet.size === prevUrlSet.size && urls.every(url => prevUrlSet.has(url));
  }

  async function scrapeReleaseFilteredPages({ pathForPage, onPage, shouldStopAfterPage = null, errorLabel }) {
    let page = 1;
    let maxPage = 1;
    let prevUrlSet = null;

    while (page <= maxPage) {
      checkExportCancelled();
      await waitIfExportPaused();
      let parsed;
      try {
        const html = await fetchHtml(pathForPage(page));
        parsed = parseReleasePage(html);
      } catch (error) {
        if (isExportCancelledError(error)) throw error;
        addLog(`${errorLabel} p${page} failed: ${error && error.message}`, 'error');
        break;
      }

      if (shouldStopAfterPage && shouldStopAfterPage(parsed, page)) break;
      onPage(parsed, page);

      if (parsed.urls.length === 0) break;
      if (isDuplicateUrlPage(parsed.urls, prevUrlSet)) break;
      prevUrlSet = new Set(parsed.urls);

      maxPage = Math.max(maxPage, parsed.maxPage);
      page += 1;
    }
  }

  function firstPageHasNoKnownOverlap(parsed, page, knownUrls) {
    return page === 1 &&
      knownUrls != null &&
      parsed.urls.length > 0 &&
      !parsed.urls.some(url => knownUrls.has(url));
  }

  function addUniqueLabelForUrls(labelsByUrl, urls, label, knownUrls = null) {
    let added = 0;
    for (const url of urls) {
      if (knownUrls != null && !knownUrls.has(url)) continue;
      if (!labelsByUrl.has(url)) labelsByUrl.set(url, []);
      if (!labelsByUrl.get(url).includes(label)) {
        labelsByUrl.get(url).push(label);
        added += 1;
      }
    }
    return added;
  }

  async function scrapeReleaseDates(expectedPages) {
    const releaseByUrl = new Map();
    let maxPage = expectedPages;

    for (let page = 1; page <= maxPage; page += 1) {
      checkExportCancelled();
      await waitIfExportPaused();
      try {
        addLog(`Reading release dates page ${page} of ${maxPage}`, 'info', 'release-dates-progress');
        setProgressInRange(38, 65, page, maxPage);
        const html = await fetchHtml(`/u/${encodeURIComponent(getExportUserSlug())}/games/release/type:${COMBINED_TYPE}?page=${page}`);
        const parsed = parseReleasePage(html);
        maxPage = Math.max(maxPage, parsed.maxPage);
        mergeReleaseDates(releaseByUrl, parsed.releases);
      } catch (error) {
        if (isExportCancelledError(error)) throw error;
        addLog(`Release dates unavailable on page ${page}; those rows will show blank dates`, 'error');
      }
    }

    return { releaseByUrl };
  }

  async function scrapePlayTypeFallback({ collectReleaseDates = false, knownUrls = null } = {}) {
    const playTypeByUrl = new Map();
    const releaseByUrl = new Map();

    for (const playType of PLAY_TYPE_ORDER) {
      const label = PLAY_TYPE_LABELS[playType];
      addLog(`Checking ${label} sub-status fallback...`, 'info', 'play-type-progress');

      await scrapeReleaseFilteredPages({
        pathForPage: page => `/u/${encodeURIComponent(getExportUserSlug())}/games/release/type:${COMBINED_TYPE};game_status:${playType}?page=${page}`,
        errorLabel: `${label} sub-status`,
        shouldStopAfterPage: (parsed, page) => {
          return firstPageHasNoKnownOverlap(parsed, page, knownUrls);
        },
        onPage: parsed => {
          if (collectReleaseDates) mergeReleaseDates(releaseByUrl, parsed.releases);
          for (const url of parsed.urls) {
            if (!knownUrls || knownUrls.has(url)) playTypeByUrl.set(url, playType);
          }
        },
      });
    }

    return { playTypeByUrl, releaseByUrl };
  }

  // Scrapes every genre across all statuses in a single pass per genre and builds:
  //   genresByUrl - Map<url, string[]>  genres for each game
  //   releaseByUrl - Map<url, string>    release dates collected as a side-effect
  //
  // Uses the combined type URL (played,playing,backlog,wishlist) so one page
  // sequence covers all statuses at once - no inner per-status loop needed.
  // Stop condition: when a page returns the exact same set of URLs as the
  // previous page, the site has looped back and we stop (same guard as
  // scrapeAllStatuses).
  //
  // knownUrls (optional Set<string>): when provided, a genre whose first page
  // returns no URLs that overlap with the user's library is skipped immediately.
  async function scrapeGenresAndReleaseDates({ collectReleaseDates = true, knownUrls = null } = {}) {
    const genresByUrl  = new Map();
    const releaseByUrl = new Map();
    let taggedCount = 0;

    for (let gi = 0; gi < GENRE_SLUGS.length; gi += 1) {
      const { label, slug } = GENRE_SLUGS[gi];
      addLog(`Genres ${gi + 1}/${GENRE_SLUGS.length}: ${label}`, 'info', 'genres-progress');
      setProgressInRange(42, 65, gi + 1, GENRE_SLUGS.length);

      await scrapeReleaseFilteredPages({
        pathForPage: page => `/u/${encodeURIComponent(getExportUserSlug())}/games/release/type:${COMBINED_TYPE};genre:${slug}?page=${page}`,
        errorLabel: `Genre ${label}`,
        shouldStopAfterPage: (parsed, page) => {
          return firstPageHasNoKnownOverlap(parsed, page, knownUrls);
        },
        onPage: parsed => {
          if (collectReleaseDates) mergeReleaseDates(releaseByUrl, parsed.releases);
          taggedCount += addUniqueLabelForUrls(genresByUrl, parsed.urls, label);
        },
      });
    }

    return { genresByUrl, releaseByUrl, scannedCount: GENRE_SLUGS.length, taggedUrlCount: genresByUrl.size, taggedCount };
  }

  // Scrapes all 50 platforms across all statuses in a single pass per platform.
  // Uses the same pagination stop-on-repeat logic as scrapeAllStatuses/scrapeGenresAndReleaseDates.
  // URL pattern: /u/<user>/games/release/type:played,playing,backlog,wishlist;release_platform:<slug>?page=N
  // When collectReleaseDates is true, release dates are collected as a side-effect (same pass).
  // Shared implementation for both platform-scraping passes.
  // slugList - array of { label, slug } entries to iterate (PLATFORM_SLUGS or ALL_PLATFORM_SLUGS)
  // logPrefix - human-readable prefix used in progress/error log messages (e.g. 'Platforms' or 'Platforms (226)')
  // progressKey - addLog dedup key passed as the third argument (e.g. 'platforms-progress')
  // knownUrls - optional Set<string> of game URLs already in the library; when provided,
  //               a platform whose first page has no overlap with the library is skipped.
  async function scrapeByPlatformList(slugList, logPrefix, progressKey, { collectReleaseDates = false, knownUrls = null } = {}) {
    const platformsByUrl = new Map();
    const releaseByUrl   = new Map();
    let taggedCount = 0;

    for (let pi = 0; pi < slugList.length; pi += 1) {
      const { label, slug } = slugList[pi];
      addLog(`${logPrefix} ${pi + 1}/${slugList.length}: ${label}`, 'info', progressKey);
      setProgressInRange(66, 82, pi + 1, slugList.length);

      await scrapeReleaseFilteredPages({
        pathForPage: page => `/u/${encodeURIComponent(getExportUserSlug())}/games/release/type:${COMBINED_TYPE};release_platform:${slug}?page=${page}`,
        errorLabel: `${logPrefix} ${label}`,
        shouldStopAfterPage: (parsed, page) => {
          return firstPageHasNoKnownOverlap(parsed, page, knownUrls);
        },
        onPage: parsed => {
          if (collectReleaseDates) mergeReleaseDates(releaseByUrl, parsed.releases);
          taggedCount += addUniqueLabelForUrls(platformsByUrl, parsed.urls, label);
        },
      });
    }

    return { platformsByUrl, releaseByUrl, scannedCount: slugList.length, taggedUrlCount: platformsByUrl.size, taggedCount };
  }

  async function scrapePlatforms(options = {}) {
    return scrapeByPlatformList(PLATFORM_SLUGS, 'Platforms', 'platforms-progress', options);
  }

  // Scrapes all 226 platforms (ALL_PLATFORM_SLUGS, sorted alphabetically).
  // When collectReleaseDates is true, release dates are collected as a side-effect (same pass).
  async function scrapePlatforms226(options = {}) {
    return scrapeByPlatformList(ALL_PLATFORM_SLUGS, 'Platforms (226)', 'platforms226-progress', options);
  }

  async function fetchMissingReleaseDates(rows, releaseByUrl) {
    // Qualify rows that need a detail-page fetch:
    //   - no entry at all in releaseByUrl (date was never found), OR
    //   - entry is an empty string (parsed as TBD / unparseable on primary pass), OR
    //   - entry is year-only (detail page may supply a more precise date)
    const missing = rows.filter(row =>
      row.url && (
        !releaseByUrl.has(row.url) ||
        !releaseByUrl.get(row.url) ||
        isYearOnlyDate(releaseByUrl.get(row.url))
      )
    );
    const detailReleaseByUrl = new Map();
    const failures = [];

    if (!missing.length) {
      addLog('Release dates: all resolved from primary pass, no detail-page fallback needed');
      return { detailReleaseByUrl, failures };
    }

    const missingCount  = missing.filter(r => !releaseByUrl.has(r.url) || !releaseByUrl.get(r.url)).length;
    const yearOnlyCount = missing.length - missingCount;
    addLog(`Fetching ${missing.length} release dates from game pages (${missingCount} missing, ${yearOnlyCount} year-only)`);

    let completed = 0;
    await mapWithConcurrency(missing, DETAIL_FETCH_CONCURRENCY, async row => {
      try {
        const html = await fetchHtml(row.url);
        const detailDate = parseDetailReleaseDate(html);
        const primaryDate = releaseByUrl.get(row.url) || '';

        if (detailDate) {
          const primaryIsYearOnly = isYearOnlyDate(primaryDate);
          const detailIsYearOnly  = isYearOnlyDate(detailDate);

          if (!primaryDate) {
            // Primary had nothing - any detail date is an improvement
            detailReleaseByUrl.set(row.url, detailDate);
          } else if (primaryIsYearOnly && !detailIsYearOnly) {
            // Primary was year-only; detail is more precise - upgrade
            detailReleaseByUrl.set(row.url, detailDate);
          }
          // Both year-only or primary already precise: keep primary, no-op
        } else {
          // Detail page also had no parseable date
          if (!primaryDate) failures.push(row.title);
          // If primaryDate exists (year-only), keep it - no failure logged
        }
      } catch (error) {
        if (isExportCancelledError(error)) throw error;
        // Network/parse error fetching the detail page.
        // Only count as a permanent failure when there is truly no date from
        // any source - including a year-only date already in releaseByUrl.
        // This must be the same condition used in the success branch (no primaryDate
        // AND no detailDate), so failure counts are consistent across scraping modes.
        const primaryDate = releaseByUrl.get(row.url) || '';
        if (!primaryDate && !detailReleaseByUrl.get(row.url)) failures.push(row.title);
      } finally {
        if (!exportCancelRequested) {
          completed += 1;
          addLog(`Detail date checks ${completed} of ${missing.length}`, 'info', 'detail-date-progress');
          setProgressInRange(88, 92, completed, missing.length);
        }
      }
    });

    if (failures.length) {
      addLog(`${failures.length} games have no release date after all sources`, 'error');
    }

    return { detailReleaseByUrl, failures };
  }

  async function mapWithConcurrency(items, limit, mapper) {
    let next = 0;

    async function worker() {
      while (next < items.length) {
        checkExportCancelled();
        await waitIfExportPaused();
        const index = next;
        next += 1;
        await mapper(items[index], index);
      }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  }

  // ---------------------------------------------------------------------------
  // 8. Output builders
  // ---------------------------------------------------------------------------

  function parseDateParts(str) {
    const s = String(str || '').trim();
    if (!s) return null;
    const MO = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
    // ISO: 2023-01-15
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return { year: +m[1], month: +m[2], day: +m[3] };
    // Full date: "Jan 15, 2023" / "January 15, 2023"
    m = s.match(/^(\w{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/i);
    if (m) { const mo = MO[m[1].slice(0,3).toLowerCase()]; if (mo) return { year: +m[3], month: mo, day: +m[2] }; }
    // Month-year: "Jan 2023" / "March 2024"
    m = s.match(/^(\w{3,9})\.?\s+(\d{4})$/i);
    if (m) { const mo = MO[m[1].slice(0,3).toLowerCase()]; if (mo) return { year: +m[2], month: mo, day: null }; }
    // Year only: "2023"
    m = s.match(/^(\d{4})$/);
    if (m) return { year: +m[1], month: null, day: null };
    return null;
  }

  function toSortableDate(label) {
    const parts = parseDateParts(label);
    if (parts) return Date.UTC(parts.year, (parts.month || 1) - 1, parts.day || 1);
    // Fallback to Date.parse (handles ISO strings etc.)
    const parsed = Date.parse(String(label || '').trim());
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  }

  function formatAbbreviatedReleaseDate(label) {
    const parts = parseDateParts(label);
    if (!parts) return String(label || '').trim();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (parts.month && parts.day) return `${months[parts.month - 1]} ${parts.day}, ${parts.year}`;
    if (parts.month) return `${months[parts.month - 1]} ${parts.year}`;
    return String(parts.year);
  }

  function buildCsv(payload) {
    // Column order: release_date, title, status, average_rating, [user_rating,] [genres,] [platforms,] game_id, url, cover_url
    // "page" column is omitted.
    // For played items, "status" uses the play sub-status (play_type) when available,
    // falling back to "Played" only when no sub-status is recorded.
    const headers = ['release_date', 'title', 'status', 'average_rating'];
    headers.push('user_rating');
    if (payload.include_genres)   headers.push('genres');
    if (payload.include_platforms) headers.push('platforms');
    headers.push('game_id', 'url', 'cover_url');

    function resolveStatus(item) {
      // For played items, show the play sub-status if available; otherwise "Played"
      if (item.status === 'played' && item.play_type) {
        return PLAY_TYPE_LABELS[item.play_type] || item.play_type;
      }
      return STATUS_LABELS[item.status] || item.status;
    }

    return [
      headers.join(','),
      ...payload.items.map(item => headers.map(h => {
        if (h === 'status')    return csvEscape(resolveStatus(item));
        if (h === 'genres')    return csvEscape((item.genres    || []).join('; '));
        if (h === 'platforms') return csvEscape((item.platforms || []).join('; '));
        if (h === 'average_rating') return csvEscape(normalizeAverageRatingValue(item.average_rating) ?? '');
        return csvEscape(item[h]);
      }).join(',')),
    ].join('\r\n');
  }

  function buildMobyGamesCsv(payload) {
    const headers = [
      'release_date',
      'title',
      'status',
      'average_rating',
      'user_rating',
      'genres',
      'gameplay',
      'platforms',
      'game_id',
      'url',
      'cover_url',
      'collection',
      'collection_url',
      'release_year',
      'full_release_date',
      'status_ids',
    ];
    const rows = payload.items.map(rawItem => {
      const item = normalizeMobyGamesSharedExportItem(rawItem);
      const releaseYear = String(mobyItemReleaseYear(item) || '');
      const fullReleaseDate = mobyItemFullReleaseDate(item);
      const releaseDate = formatAbbreviatedReleaseDate(fullReleaseDate) || releaseYear;
      const formattedFullReleaseDate = formatAbbreviatedReleaseDate(fullReleaseDate) || fullReleaseDate;
      const url = mobyItemUrl(item);
      return [
        releaseDate,
        item.title || item.name,
        (item.statuses && item.statuses.length ? item.statuses : [item.status]).filter(Boolean).join('; '),
        normalizeAverageRatingValue(item.average_rating == null ? item.averageRating : item.average_rating) ?? '',
        getMobyGamesUserRating(item),
        (item.genres || []).join('; '),
        (item.gameplay || []).join('; '),
        uniqueSortedLabels(item.platforms || (item.platform ? [item.platform] : [])).join('; '),
        url,
        url,
        mobyItemCoverUrl(item),
        item.collection,
        mobyItemCollectionUrl(item),
        releaseYear,
        formattedFullReleaseDate,
        (item.statusIds || item.status_ids || []).join('; '),
      ];
    });
    return [
      '# Exported from MobyGames',
      headers.join(','),
      ...rows.map(row => row.map(csvEscape).join(',')),
    ].join('\r\n');
  }

  function buildHowLongToBeatCsv(payload) {
    const headers = [
      'release_date',
      'title',
      'status',
      'average_rating',
      'user_rating',
      'genres',
      'platforms',
      'game_id',
      'url',
      'cover_url',
      'category',
      'category_url',
      'status_ids',
    ];
    const rows = (payload.items || []).map(rawItem => {
      const item = normalizeHowLongToBeatSharedExportItem(rawItem);
      const url = item.url || item.gameUrl || '';
      return [
        item.release_date || '',
        item.title || item.name,
        (item.statuses && item.statuses.length ? item.statuses : [item.status]).filter(Boolean).join('; '),
        normalizeAverageRatingValue(item.average_rating) ?? '',
        item.user_rating == null ? '' : item.user_rating,
        (item.genres || []).join('; '),
        uniqueSortedLabels(item.platforms || (item.platform ? [item.platform] : [])).join('; '),
        url,
        url,
        item.cover_url || '',
        (item.categories && item.categories.length ? item.categories : [item.category]).filter(Boolean).join('; '),
        (item.categoryUrls || item.category_urls || []).join('; ') || item.category_url || '',
        (item.statusIds || item.status_ids || []).join('; '),
      ];
    });
    return [
      '# Exported from HowLongToBeat',
      headers.join(','),
      ...rows.map(row => row.map(csvEscape).join(',')),
    ].join('\r\n');
  }

  function getMobyGamesUserRating(item) {
    if (!item) return null;
    const raw = item.userRating == null ? item.user_rating : item.userRating;
    if (raw == null || raw === '') return null;
    const rating = Number(raw);
    return Number.isFinite(rating) ? rating : null;
  }

  function mobyItemUrl(item) {
    return item ? item.url || item.gameUrl || '' : '';
  }

  function mobyItemCoverUrl(item) {
    return item ? item.cover_url || item.coverUrl || '' : '';
  }

  function mobyItemCollectionUrl(item) {
    return item ? item.collection_url || item.collectionUrl || '' : '';
  }

  function mobyItemReleaseYear(item) {
    return item ? item.release_year || item.releaseYear || '' : '';
  }

  function mobyItemFullReleaseDate(item) {
    return item ? item.full_release_date || item.fullReleaseDate || item.release_date || mobyItemReleaseYear(item) || '' : '';
  }

  function buildCanonicalMobyGamesJsonItem(item) {
    return buildCanonicalSharedExportItem('mobygames', item, {
      normalizeItem: normalizeMobyGamesSharedExportItem,
      defaultStatus: '',
    });
  }

  function buildMobyGamesJson(payload) {
    return buildSharedJson(payload, 'mobygames', {
      normalizeItem: normalizeMobyGamesSharedExportItem,
      defaultStatus: '',
    });
  }

  function buildHowLongToBeatJson(payload) {
    return buildSharedJson(payload, 'howlongtobeat', {
      normalizeItem: normalizeHowLongToBeatSharedExportItem,
      defaultStatus: '',
    });
  }

  function makeMobyGamesStatusToken(statusId, fallbackLabel) {
    const raw = String(statusId || fallbackLabel || 'status');
    const normalizedRaw = raw
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (/^moby-[a-z0-9-]+$/.test(normalizedRaw)) return normalizedRaw;
    const base = raw
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `moby-${base || 'status'}`;
  }

  function getMobyGamesMetadataTags(item) {
    const values = [
      ...(Array.isArray(item.genres) ? item.genres : []),
      ...(Array.isArray(item.gameplay) ? item.gameplay : []),
    ].map(value => String(value || '').trim().replace(/\s+/g, ' ')).filter(Boolean);
    return [...new Set(values)];
  }

  function normalizeMobyGamesGenreLabel(label) {
    return String(label || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/['\u2018\u2019]/g, '')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function colorForMobyGamesTag(label) {
    if (Object.prototype.hasOwnProperty.call(MOBYGAMES_GENRE_COLORS, label)) {
      return MOBYGAMES_GENRE_COLORS[label];
    }
    const wanted = normalizeMobyGamesGenreLabel(label);
    for (const [knownLabel, color] of Object.entries(MOBYGAMES_GENRE_COLORS)) {
      if (normalizeMobyGamesGenreLabel(knownLabel) === wanted) return color;
    }

    let hash = 0;
    const text = String(label || '');
    for (let i = 0; i < text.length; i += 1) hash = ((hash * 31) + text.charCodeAt(i)) >>> 0;
    const hue = Math.round((hash * 137.508) % 360);
    const saturation = 66 + (hash % 18);
    const lightness = 38 + ((hash >>> 4) % 12);
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }

  function buildMobyGamesViewerPayload(payload) {
    const config = cloneStatusPillConfig(payload.status_pill_config || makeDefaultStatusPillConfig());
    const selectedMappings = new Map();
    (payload.collections || []).forEach(collection => {
      const key = `${collection.url}|${collection.status}`;
      selectedMappings.set(key, collection);
    });

    const statusLabels = {};
    const statusPriority = {};
    const statusColors = {};
    const incomingStatusLabels = payload.status_labels && typeof payload.status_labels === 'object' ? payload.status_labels : {};
    const configuredCategories = (config.categories || []).map(category => {
      const pills = (category.pills || []).filter(Boolean).map((pill, index) => {
        if (pill.kind === 'aggregate') {
          return {
            ...pill,
            sources: Array.isArray(pill.sources) ? pill.sources.filter(Boolean) : [],
          };
        }
        const token = pill.source && pill.source.type === 'status' && /^moby-[a-z0-9-]+$/i.test(String(pill.source.value || ''))
          ? String(pill.source.value)
          : makeMobyGamesStatusToken(pill.id, pill.label);
        statusLabels[token] = pill.label || 'Status Pill';
        statusPriority[token] = Object.keys(statusPriority).length + index;
        statusColors[token] = pill.color || '#7dd3fc';
        const configuredCollections = normalizeStatusPillCollections(pill.collections);
        return {
          ...pill,
          source: { type: 'status', value: token },
          collections: configuredCollections.filter(collection =>
            selectedMappings.has(`${collection.url}|${pill.label || 'Status Pill'}`)
          ),
        };
      });
      return {
        ...category,
        pills,
      };
    }).filter(category => (category.pills || []).length);

    const collectionStatusTokenByKey = new Map();
    const statusPillById = new Map();
    configuredCategories.forEach(category => {
      (category.pills || []).forEach(pill => {
        const token = pill.source && pill.source.value;
        if (pill.id) statusPillById.set(pill.id, pill);
        normalizeStatusPillCollections(pill.collections).forEach(collection => {
          collectionStatusTokenByKey.set(`${collection.url}|${pill.label || 'Status Pill'}`, token);
        });
      });
    });

    const items = (payload.items || []).map((rawItem, index) => {
      const item = normalizeMobyGamesSharedExportItem(rawItem);
      const itemStatusLabels = Array.isArray(item.statuses) && item.statuses.length ? item.statuses : [item.status];
      const itemStatusIds = Array.isArray(item.statusIds) && item.statusIds.length
        ? item.statusIds
        : Array.isArray(item.status_ids) && item.status_ids.length
          ? item.status_ids
          : item.statusId || item.status_id
            ? [item.statusId || item.status_id]
            : [];
      const tokens = itemStatusLabels.map((label, statusIndex) => {
        const statusId = itemStatusIds[statusIndex] || '';
        const pill = statusId ? statusPillById.get(statusId) : null;
        const token = statusId
          ? makeMobyGamesStatusToken(statusId, label)
          : collectionStatusTokenByKey.get(`${mobyItemCollectionUrl(item)}|${label}`) || makeMobyGamesStatusToken(label, label);
        statusLabels[token] = statusLabels[token] || incomingStatusLabels[token] || incomingStatusLabels[label] || label || token;
        if (statusPriority[token] == null) statusPriority[token] = Object.keys(statusPriority).length;
        if (!statusColors[token]) statusColors[token] = (pill && pill.color) || (statusIndex === 0 ? item.statusColor : '') || '#7dd3fc';
        return token;
      }).filter(Boolean);
      const primaryToken = tokens[0] || makeMobyGamesStatusToken(item.status, item.status);
      statusLabels[primaryToken] = statusLabels[primaryToken] || incomingStatusLabels[primaryToken] || incomingStatusLabels[item.status] || item.status || primaryToken;
      if (statusPriority[primaryToken] == null) statusPriority[primaryToken] = Object.keys(statusPriority).length;
      if (!statusColors[primaryToken]) statusColors[primaryToken] = item.statusColor || '#7dd3fc';
      const releaseYear = String(mobyItemReleaseYear(item) || '');
      const fullReleaseDate = mobyItemFullReleaseDate(item);
      const releaseDate = formatAbbreviatedReleaseDate(fullReleaseDate) || releaseYear;
      const averageRating = item.average_rating == null ? item.averageRating : item.average_rating;
      const userRating = getMobyGamesUserRating(item);
      const platforms = uniqueSortedLabels(item.platforms || (item.platform ? [item.platform] : []));
      const url = mobyItemUrl(item);
      const sourceMeta = {
        ...(item.source_meta || {}),
        collection: item.collection || '',
        collection_url: mobyItemCollectionUrl(item),
        genres: Array.isArray(item.genres) ? item.genres : [],
        gameplay: Array.isArray(item.gameplay) ? item.gameplay : [],
        release_year: releaseYear,
        full_release_date: fullReleaseDate,
        status_ids: itemStatusIds,
      };
      return {
        status: primaryToken,
        statuses: tokens.length ? tokens : [primaryToken],
        statusIds: itemStatusIds,
        status_ids: itemStatusIds,
        game_id: url || `moby-${index}`,
        title: item.name || item.title || '',
        url,
        cover_url: mobyItemCoverUrl(item),
        cover_orientation: item.cover_orientation || item.coverOrientation || '',
        average_rating: normalizeAverageRatingValue(averageRating),
        user_rating: userRating,
        release_date: releaseDate,
        play_type: null,
        genres: getMobyGamesMetadataTags(item),
        platforms,
        source_meta: sourceMeta,
      };
    });

    const counts = {};
    items.forEach(item => {
      (item.statuses || [item.status]).forEach(status => {
        counts[status] = (counts[status] || 0) + 1;
      });
    });

    return {
      username: payload.username,
      sourceWebsite: payload.sourceWebsite || getSourceWebsite('mobygames'),
      source: payload.source,
      generated_at: payload.generated_at,
      counts,
      raw_counts: counts,
      include_genres: items.some(item => (item.genres || []).length),
      include_platforms: true,
      include_platforms226: false,
      mobygames_platform_labels: MOBYGAMES_PLATFORM_LABELS,
      mobygames_genre_labels: MOBYGAMES_GENRE_LABELS,
      genre_colors: Object.fromEntries([...new Set(items.flatMap(item => item.genres || []))].map(label => [label, colorForMobyGamesTag(label)])),
      status_pill_config: {
        categories: configuredCategories,
      },
      status_labels: statusLabels,
      status_priority: statusPriority,
      status_colors: statusColors,
      total: items.length,
      items,
    };
  }

  function buildMobyGamesHtml(payload) {
    return buildHtml(buildMobyGamesViewerPayload(payload));
  }

  function buildHowLongToBeatHtml(payload) {
    const normalizedItems = (payload.items || []).map(rawItem => normalizeHowLongToBeatSharedExportItem(rawItem));
    const viewerPayload = buildMobyGamesViewerPayload({
      ...payload,
      sourceWebsite: getSourceWebsite('howlongtobeat'),
      collections: Array.isArray(payload.categories) ? payload.categories : [],
      items: normalizedItems,
    });
    viewerPayload.sourceWebsite = getSourceWebsite('howlongtobeat');
    viewerPayload.mobygames_genre_labels = [];
    viewerPayload.howlongtobeat_category_labels = [...new Set(normalizedItems.flatMap(item => item.categories || (item.category ? [item.category] : [])))];
    viewerPayload.items = (viewerPayload.items || []).map((item, index) => {
      const source = normalizedItems[index] || {};
      return {
        ...item,
        source_meta: {
          ...(item.source_meta || {}),
          category: source.category || '',
          categories: source.categories || [],
          category_url: source.category_url || '',
          category_urls: source.categoryUrls || source.category_urls || [],
          status_ids: source.statusIds || source.status_ids || [],
          status_color: source.statusColor || '',
        },
      };
    });
    return buildHtml(viewerPayload);
  }

  function downloadText(filename, mimeType, content) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }


  const OFFLINE_COVER_WIDTH = 56;
  const OFFLINE_COVER_HEIGHT = 84;
  const OFFLINE_COVER_QUALITY = 0.78;

  function getGmXmlHttpRequest() {
    if (typeof GM_xmlhttpRequest === 'function') return GM_xmlhttpRequest;
    if (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') {
      return GM.xmlHttpRequest.bind(GM);
    }
    return null;
  }

  function fetchImageBlobWithGm(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const gmRequest = getGmXmlHttpRequest();
      if (!gmRequest) {
        reject(new Error('GM image request API is unavailable.'));
        return;
      }
      let settled = false;
      let request = null;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (request) activeExportFetchControllers.delete(request);
        fn(value);
      };
      const timer = setTimeout(() => {
        try { if (request) request.abort(); } catch (_) {}
        finish(reject, new Error(`Cover image request timed out for ${url}`));
      }, timeoutMs);

      request = gmRequest({
        method: 'GET',
        url,
        responseType: 'blob',
        timeout: timeoutMs,
        onload: response => {
          if (response.status >= 200 && response.status < 300 && response.response) {
            finish(resolve, response.response);
            return;
          }
          const error = new Error(`${response.status} ${response.statusText || 'Failed'} for ${url}`);
          error.status = response.status;
          finish(reject, error);
        },
        onerror: () => finish(reject, new Error(`Cover image request failed for ${url}`)),
        ontimeout: () => finish(reject, new Error(`Cover image request timed out for ${url}`)),
        onabort: () => finish(reject, makeExportCancelledError()),
      });
      if (request) activeExportFetchControllers.add(request);
    });
  }

  async function fetchImageBlob(url, options = {}) {
    const MAX_ATTEMPTS = options.maxAttempts || 2;
    const TIMEOUT_MS = options.timeoutMs || 15000;
    let lastError = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      checkExportCancelled();
      await waitIfExportPaused();
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 650 * attempt));
        checkExportCancelled();
        await waitIfExportPaused();
      }

      if (getGmXmlHttpRequest()) {
        try {
          const blob = await fetchImageBlobWithGm(url, TIMEOUT_MS);
          checkExportCancelled();
          return blob;
        } catch (error) {
          if (exportCancelRequested || isExportCancelledError(error)) throw makeExportCancelledError();
          lastError = error;
          if (attempt === MAX_ATTEMPTS - 1) break;
          continue;
        }
      }

      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      if (controller) activeExportFetchControllers.add(controller);
      const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
      try {
        const response = await fetch(url, {
          credentials: 'omit',
          mode: 'cors',
          signal: controller ? controller.signal : undefined,
        });
        checkExportCancelled();
        if (!response.ok) {
          const error = new Error(`${response.status} ${response.statusText} for ${url}`);
          error.status = response.status;
          throw error;
        }
        return await response.blob();
      } catch (error) {
        if (exportCancelRequested) throw makeExportCancelledError();
        lastError = error;
        if (attempt === MAX_ATTEMPTS - 1) break;
      } finally {
        if (timer) clearTimeout(timer);
        if (controller) activeExportFetchControllers.delete(controller);
      }
    }
    throw lastError;
  }

  function blobToImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Cover image could not be decoded.'));
      };
      image.src = url;
    });
  }

  function getOfflineCoverOrientation(image) {
    return image && image.naturalWidth > image.naturalHeight ? 'landscape' : 'portrait';
  }

  function getOfflineCoverThumbnailSize(image, options = {}) {
    if (options.preserveOrientation) {
      const orientation = getOfflineCoverOrientation(image);
      return {
        width: orientation === 'landscape' ? options.landscapeWidth : options.portraitWidth,
        height: orientation === 'landscape' ? options.landscapeHeight : options.portraitHeight,
        orientation,
      };
    }
    return {
      width: options.width || OFFLINE_COVER_WIDTH,
      height: options.height || OFFLINE_COVER_HEIGHT,
      orientation: 'portrait',
    };
  }

  function coverImageToThumbnailDataUrl(image, options = {}) {
    const size = getOfflineCoverThumbnailSize(image, options);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (options.resizeMode === 'stretch') {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    } else {
      const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
      const drawWidth = Math.ceil(image.naturalWidth * scale);
      const drawHeight = Math.ceil(image.naturalHeight * scale);
      const dx = Math.floor((canvas.width - drawWidth) / 2);
      const dy = Math.floor((canvas.height - drawHeight) / 2);
      ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
    }
    return canvas.toDataURL('image/jpeg', options.quality || OFFLINE_COVER_QUALITY);
  }

  function offlineCoverUrlForItem(item, options = {}) {
    const keys = options.coverUrlKeys || ['cover_url'];
    for (const key of keys) {
      if (item && item[key]) return item[key];
    }
    return '';
  }

  async function buildOfflineCoverMap(items, options = {}) {
    const coverEntries = items
      .map(item => offlineCoverUrlForItem(item, options))
      .filter(Boolean)
      .filter((url, index, arr) => arr.indexOf(url) === index);
    const coverByUrl = new Map();
    let failed = 0;

    for (let i = 0; i < coverEntries.length; i += 1) {
      const url = coverEntries[i];
      addLog(`Embedding offline covers ${i + 1} of ${coverEntries.length}`, 'info', 'offline-covers-progress');
      setProgressInRange(92, 99, i + 1, coverEntries.length);
      try {
        const blob = await fetchImageBlob(url);
        checkExportCancelled();
        await waitIfExportPaused();
        const image = await blobToImage(blob);
        const size = getOfflineCoverThumbnailSize(image, options);
        coverByUrl.set(url, {
          dataUrl: coverImageToThumbnailDataUrl(image, options),
          width: size.width,
          height: size.height,
          orientation: size.orientation,
        });
      } catch (error) {
        if (isExportCancelledError(error)) throw error;
        failed += 1;
      }
    }

    removeLog('offline-covers-progress');
    addLog(`Offline covers embedded: ${coverByUrl.size} of ${coverEntries.length}${failed ? ` (${failed} failed)` : ''}`);
    return coverByUrl;
  }

  function payloadWithOfflineCovers(payload, coverByUrl, options = {}) {
    const coverUrlKeys = options.coverUrlKeys || ['cover_url'];
    const originalCoverUrlKeys = options.originalCoverUrlKeys || ['original_cover_url'];
    const coverThumbnailSize = options.preserveOrientation
      ? {
          portrait: {
            width: options.portraitWidth,
            height: options.portraitHeight,
          },
          landscape: {
            width: options.landscapeWidth,
            height: options.landscapeHeight,
          },
        }
      : {
          width: OFFLINE_COVER_WIDTH,
          height: OFFLINE_COVER_HEIGHT,
        };
    return {
      ...payload,
      offline_covers: true,
      cover_thumbnail_size: coverThumbnailSize,
      items: payload.items.map(item => {
        const coverUrl = offlineCoverUrlForItem(item, options);
        const embeddedCover = coverByUrl.get(coverUrl);
        if (!embeddedCover) return item;
        const embeddedUrl = typeof embeddedCover === 'string' ? embeddedCover : embeddedCover.dataUrl;
        const nextItem = { ...item };
        coverUrlKeys.forEach(key => {
          if (key in nextItem || key === coverUrlKeys[0]) nextItem[key] = embeddedUrl;
        });
        originalCoverUrlKeys.forEach(key => {
          if (key in nextItem || key === originalCoverUrlKeys[0]) nextItem[key] = nextItem[key] || coverUrl;
        });
        if (options.preserveOrientation && typeof embeddedCover !== 'string') {
          nextItem.cover_orientation = embeddedCover.orientation;
          if ('coverOrientation' in nextItem) nextItem.coverOrientation = embeddedCover.orientation;
        }
        return nextItem;
      }),
    };
  }
  function escapeJsonForHtml(json) {
    return json.replace(/<\/script>/gi, '<\\/script>');
  }

  // ---------------------------------------------------------------------------
  // 9. Generated HTML viewer
  // ---------------------------------------------------------------------------

  function buildViewerCss({ genreColorCss, tableWidths }) {
    return `    :root {
 --ink: #0f1a2e;
 --muted: #556070;
 --panel: rgba(235,238,245,0.90);
 --panel-soft: rgba(225,230,240,0.80);
 --control: #e8ecf3;
 --thead: rgba(218,224,234,0.98);
 --page-start: #dde3ec;
 --page-end: #ccd4e0;
 --row-hover: rgba(47,141,247,0.08);
 --shadow: rgba(23,32,51,0.14);
 --line: rgba(23,32,51,0.18);
 --played: ${STATUS_COLORS.played};
 --playing: ${STATUS_COLORS.playing};
 --backlog: ${STATUS_COLORS.backlog};
 --wishlist: ${STATUS_COLORS.wishlist};
 --pt-played: ${PLAY_TYPE_COLORS.played};
 --pt-completed: ${PLAY_TYPE_COLORS.completed};
 --pt-retired: ${PLAY_TYPE_COLORS.retired};
 --pt-shelved: ${PLAY_TYPE_COLORS.shelved};
 --pt-abandoned: ${PLAY_TYPE_COLORS.abandoned};
    }
    body.black {
 --ink: #f4f7fb;
 --muted: #a4b4ca;
 --panel: rgba(7,11,20,0.90);
 --panel-soft: rgba(16,23,38,0.84);
 --control: #070b13;
 --thead: rgba(9,13,22,0.96);
 --page-start: #000;
 --page-end: #070a12;
 --row-hover: rgba(125,211,252,0.09);
 --shadow: rgba(0,0,0,0.48);
 --line: rgba(190,210,235,0.20);
    }
    * { box-sizing: border-box; }
    html { min-height: 100%; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background-color: var(--page-start);
      background-image:
        radial-gradient(circle at 13% 4%, rgba(47,141,247,0.22), transparent 30%),
        radial-gradient(circle at 74% 0%, rgba(155,108,255,0.18), transparent 27%),
        radial-gradient(circle at 88% 18%, rgba(255,157,46,0.11), transparent 24%),
        radial-gradient(circle at 28% 94%, rgba(31,191,117,0.12), transparent 30%);
      background-attachment: fixed;
      background-size: cover;
    }
    .shell { max-width: 1480px; margin: 0 auto; padding: 28px 18px 44px; }
    .hero {
      display: grid;
      gap: 18px;
      padding: 22px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--panel);
      box-shadow: 0 18px 50px var(--shadow);
      backdrop-filter: blur(14px);
    }
    .head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 16px; }
    .head-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 10px; }
    h1 { margin: 0; font-size: clamp(15px, 2vw, 27px); line-height: 1; letter-spacing: 0; }
    .sub { margin: 8px 0 0; color: var(--muted); }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    body.backloggd .stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    body.backloggd.show-play-types .stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    /* -- Overflow-aware wrapping for status pills --- */
    /* Applied by JS when stat text overflows at current width */
    .stats.stats-wrap { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    body.backloggd.show-play-types .stats.stats-wrap { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    /* When sub-pill text (sub-name) is clipping, shrink font further */
    .stat-sub-pill.sub-pill-compact .sub-name { font-size: 9px; }
    .stat-sub-pill.sub-pill-compact .sub-num  { font-size: 11px; }
    .stat-sub-pill.sub-pill-compact .sub-pill-header { font-size: 8px; }
    .stat-sub-pill.sub-pill-compact .sub-pill-total  { font-size: 11px; }
    /* Enable container queries on each sub-pill so text can scale fluidly */
    .stat-sub-pill { container-type: inline-size; }
    /* The two sub-pill boxes each take one column slot */
    .stat-sub-pill { }
    /* The played group takes the same slot as the played button */
    .stat { padding: 13px 15px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel-soft); color: var(--ink); cursor: pointer; text-align: left; font: inherit; transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease; min-height: 100px; }
    .stat[data-status-filter="played"] { box-shadow: inset 3px 0 0 var(--played); }
    .stat[data-status-filter="playing"] { box-shadow: inset 3px 0 0 var(--playing); }
    .stat[data-status-filter="backlog"] { box-shadow: inset 3px 0 0 var(--backlog); }
    .stat[data-status-filter="wishlist"] { box-shadow: inset 3px 0 0 var(--wishlist); }
    .stat:hover { transform: translateY(-1px); border-color: rgba(125,211,252,0.55); }
    .stat.active { border-color: rgba(125,211,252,0.82); box-shadow: 0 0 0 3px rgba(125,211,252,0.14), inset 3px 0 0 rgba(125,211,252,0.88), inset 0 1px 0 rgba(255,255,255,0.10); }
    .stat span { display: block; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    .stat strong { display: block; margin-top: 5px; font-size: 22px; }
    /* -- Genre filter bar --- */
    .genre-bar {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--panel-soft);
      overflow: hidden;
      min-width: 0;
    }
    .genre-bar-controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .genre-bar-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      color: var(--muted);
      white-space: nowrap;
      margin-right: 2px;
    }
    .genre-show-all {
      padding: 5px 13px;
      border: 1.5px solid var(--line);
      border-radius: 999px;
      background: var(--control);
      color: var(--ink);
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: border-color 0.13s, background 0.13s, transform 0.12s;
    }
    .genre-show-all:hover { border-color: rgba(125,211,252,0.7); background: rgba(125,211,252,0.10); transform: translateY(-1px); }
    .genre-match-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px 5px 9px;
      border: 1.5px solid var(--line);
      border-radius: 999px;
      background: var(--control);
      color: var(--muted);
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: border-color 0.13s, background 0.13s, color 0.13s, transform 0.12s;
    }
    .genre-match-btn:hover { transform: translateY(-1px); border-color: rgba(125,211,252,0.55); }
    .genre-match-btn .filter-vis-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      border: 2px solid var(--muted);
      background: transparent;
      flex-shrink: 0;
      transition: border-color 0.13s, background 0.13s;
    }
    .genre-match-btn.active {
      border-color: rgba(47,141,247,0.65);
      background: rgba(47,141,247,0.11);
      color: #2f8df7;
    }
    .genre-match-btn.active .filter-vis-dot {
      border-color: #2f8df7;
      background: #2f8df7;
    }
    .genre-substat-toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 13px;
      border: 1.5px solid var(--line);
      border-radius: 999px;
      background: var(--control);
      color: var(--ink);
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      user-select: none;
      transition: border-color 0.13s, background 0.13s, transform 0.12s;
      margin-left: auto;
    }
    .genre-substat-toggle:hover { border-color: rgba(125,211,252,0.7); background: rgba(125,211,252,0.10); transform: translateY(-1px); }
    .genre-substat-toggle input[type="checkbox"] { appearance: none; -webkit-appearance: none; position: relative; width: 13px; height: 13px; border: 1px solid rgba(234,244,255,0.55); border-radius: 3px; background: rgba(255,255,255,0.95); cursor: pointer; flex-shrink: 0; }
    .genre-substat-toggle input[type="checkbox"]::after { content: ''; position: absolute; left: 3px; top: 1px; width: 3px; height: 7px; border: solid #082033; border-width: 0 2px 2px 0; opacity: 0; transform: rotate(45deg); }
    .genre-substat-toggle input[type="checkbox"]:checked { border-color: rgba(214,63,140,0.9); background: #d63f8c; }
    .genre-substat-toggle input[type="checkbox"]:checked::after { opacity: 1; }
    /* -- Genre counter pills (Games Displayed / Genres Displayed) --- */
    .genre-spacer-pills {
      display: none;
    }
    .genre-counter-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px 4px 8px;
      border: none;
      border-radius: 8px;
      background: color-mix(in srgb, var(--ink) 8%, transparent);
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      user-select: none;
      flex-shrink: 0;
    }
    .genre-counter-pill-label {
      color: var(--muted);
      letter-spacing: 0.03em;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      white-space: nowrap;
    }
    .genre-counter-pill-num {
      color: var(--ink);
      font-variant-numeric: tabular-nums;
      font-size: 13px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .genre-counter-pill-of {
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
    }
    /* -- Genre big pill - single pill wrapping all sub-pills --- */
    /* -- Genre pill grid - rectangular pills that fill rows evenly --- */
    /* The outer wrapper becomes a CSS grid whose row count JS controls via
 --genre-rows. Each visible pill is a flex item that grows to fill the
       available width so every row is flush left-to-right. */
    .genre-btn-wrap {
      display: block;
      width: 100%;
    }
    /* #genreSinglePill is the pill grid itself. */
    .genre-pill-grid {
      display: flex;
      flex-wrap: wrap;
      width: 100%;
      gap: 0;
      /* JS sets --genre-rows and --genre-pill-fs. Pills use intrinsic height
         so long MobyGames labels can wrap without being clipped. */
 --genre-row-h: auto;
 --genre-rows: 3;
 --genre-pill-fs: 13px;
      max-height: none;
      overflow: visible;
      align-content: flex-start;
      /* No container border - each pill carries its own full border.
         Adjacent pill borders collapse via negative margins. */
      border-radius: 0;
    }
    body.show-genre-emojis .genre-pill-grid {
 --genre-row-h: auto;
 --genre-rows: 3;
    }
    /* Each pill: flex-grow so they stretch to fill the row width.
       flex-basis is set by JS to (100% / pillsPerRow) so they distribute evenly. */
    .genre-pill-grid .genre-btn {
 --gc: #888;
 --pill-border: color-mix(in srgb, var(--gc) 22%, var(--line));
      flex-grow: 1;
      flex-shrink: 1;
      /* flex-basis set by JS per render */
      /* Last-row pills get their own wider flex-basis set by JS; no global cap needed. */
      min-width: 0;
      min-height: 36px;
      height: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      position: relative;
      /* at least 2px between text/counter and the left/right border edges */
      padding: 7px 10px;
      border-radius: 0;
      border: none;
      /* box-shadow draws all four border sides on the pill itself.
         Unlike CSS border + negative margins, box-shadow:
           - is never clipped by parent overflow:hidden, so top and left
             borders always render on every pill including edge pills.
           - does not participate in the box model, so no negative margins
             are needed and no borders get doubled or clipped.
         The inset spread-radius shadows give a 0.5px-equivalent visual
         weight that matches the original 1px border appearance.
         Adjacent pill shadows overlap each other naturally, so the grid
         looks like a clean grid with single-pixel dividers on all sides. */
      box-shadow: none;
      background: color-mix(in srgb, var(--gc) 10%, transparent);
      color: var(--gc);
      font: inherit;
      font-size: var(--genre-pill-fs, 13px);
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.03em;
      transition: background 0.14s, color 0.14s, box-shadow 0.14s;
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
    }
    .genre-pill-grid .genre-btn::after {
      content: "";
      position: absolute;
      inset: 0;
      border: 1px solid var(--pill-border);
      pointer-events: none;
    }
    .genre-pill-grid .genre-btn:hover {
      background: color-mix(in srgb, var(--gc) 22%, transparent);
      transform: none;
    }
    .genre-pill-grid .genre-btn.active {
 --pill-border: color-mix(in srgb, var(--gc) 60%, transparent);
      background: var(--gc);
      color: #fff;
    }
    body.black .genre-pill-grid .genre-btn { color: color-mix(in srgb, var(--gc) 90%, #fff); }
    body.black .genre-pill-grid .genre-btn.active { color: #fff; }
    .genre-pill-grid .genre-btn .genre-name {
      flex: 1 1 auto;
      min-width: 0;
      max-width: 100%;
      display: block;
      line-height: 1.18;
      overflow-wrap: anywhere;
      word-break: normal;
      white-space: normal;
      text-align: center;
    }
    .genre-pill-grid .genre-btn .genre-count {
      flex: 0 0 auto;
      align-self: center;
      min-width: 22px;
      max-width: 100%;
      padding: 2px 7px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--gc) 18%, transparent);
      color: inherit;
      font-size: 11px;
      font-weight: 800;
      line-height: 1.15;
      font-variant-numeric: tabular-nums;
      text-align: center;
      white-space: nowrap;
    }
    .genre-pill-grid .genre-btn.active .genre-count {
      background: rgba(255,255,255,0.28);
      color: #fff;
    }
    body.show-genre-emojis .genre-pill-grid .genre-btn {
      min-height: 44px;
    }
    @media (max-width: 620px) {
      .genre-pill-grid .genre-btn {
        align-items: stretch;
        flex-direction: column;
        gap: 5px;
        padding: 7px 8px;
      }
      .genre-pill-grid .genre-btn .genre-name {
        flex: 0 1 auto;
      }
      .genre-pill-grid .genre-btn .genre-count {
        align-self: center;
      }
    }
    body.backloggd .genre-pill-grid {
      --genre-row-h: 36px;
      --genre-rows: 3;
      --genre-pill-fs: 13px;
      max-height: calc(var(--genre-row-h) * var(--genre-rows));
      overflow: hidden;
    }
    body.backloggd.show-genre-emojis .genre-pill-grid {
      --genre-row-h: 44px;
      --genre-rows: 3;
    }
    body.backloggd .genre-pill-grid .genre-btn {
      height: var(--genre-row-h);
      min-height: 0;
      gap: 4px;
      padding: 0 10px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    body.backloggd .genre-pill-grid .genre-btn .genre-name {
      display: inline-flex;
      align-items: center;
      flex: 0 1 auto;
      min-width: 0;
      line-height: 1;
      overflow: hidden;
      overflow-wrap: normal;
      white-space: nowrap;
      text-overflow: ellipsis;
      text-align: left;
    }
    body.backloggd .genre-pill-grid .genre-btn .genre-count {
      flex: 0 0 auto;
      min-width: 0;
      padding: 0;
      border-radius: 0;
      background: transparent;
      color: inherit;
      font-size: inherit;
      line-height: 1;
    }
    body.backloggd.show-genre-emojis .genre-pill-grid .genre-btn {
      min-height: 0;
    }
    @media (max-width: 620px) {
      body.backloggd .genre-pill-grid .genre-btn {
        align-items: center;
        flex-direction: row;
        gap: 4px;
        padding: 0 10px;
      }
    }
    /* Genre buttons used elsewhere (outside the grid) */
    .genre-btn {
 --gc: #888;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 7px 15px;
      border: 2px solid color-mix(in srgb, var(--gc) 55%, transparent);
      border-radius: 0;
      background: color-mix(in srgb, var(--gc) 12%, transparent);
      color: var(--gc);
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.03em;
      transition: background 0.14s, border-color 0.14s, color 0.14s, transform 0.12s, box-shadow 0.14s;
    }
    .genre-btn .genre-emoji { display: none; }
    .genre-btn .genre-name {
      display: inline-flex;
      align-items: center;
      min-width: 0;
      line-height: 1;
    }
    body.show-genre-emojis .genre-btn .genre-emoji {
      display: inline-flex;
      align-items: center;
      line-height: 1;
      flex-shrink: 0;
    }
    .genre-btn:hover { background: color-mix(in srgb, var(--gc) 22%, transparent); transform: translateY(-1px); }
    .genre-btn.active {
      background: var(--gc);
      border-color: var(--gc);
      color: #fff;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--gc) 30%, transparent), 0 4px 14px color-mix(in srgb, var(--gc) 35%, transparent);
    }
    body.black .genre-btn { color: color-mix(in srgb, var(--gc) 90%, #fff); }
    body.black .genre-btn.active { color: #fff; }
    /* Genre tags inside each game row - column mode (default) */
    .genre-tags { display: flex; flex-wrap: wrap; gap: 5px; align-content: flex-start; }
    .genre-col { vertical-align: middle; max-width: 220px; }
    /* In "below" (legacy) mode, genre col hides and tags appear under title */
    .genre-tag {
 --gc: #888;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 4px 10px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--gc) 15%, transparent);
      border: 1.5px solid color-mix(in srgb, var(--gc) 45%, transparent);
      color: var(--gc);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition: background 0.13s, border-color 0.13s, box-shadow 0.13s, transform 0.12s;
      white-space: nowrap;
    }
    .genre-tag .genre-emoji { display: none; }
    body.show-genre-emojis .genre-tag .genre-emoji { display: inline; }
    .genre-tag:hover { background: color-mix(in srgb, var(--gc) 28%, transparent); transform: translateY(-1px); }
    .genre-tag.active {
      background: var(--gc);
      border-color: var(--gc);
      color: #fff;
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--gc) 28%, transparent);
    }
    body.black .genre-tag { color: color-mix(in srgb, var(--gc) 88%, #fff); }
    body.black .genre-tag.active { color: #fff; }
    /* Per-genre colour injection */
    ${genreColorCss}
    /* -- Platform chips --- */
    /* Design: compact rectangular chips with a left-side accent tick and */
    /* cool monochromatic slate palette - visually distinct from the round */
    /* colourful genre pills. */
    .platform-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 3px 4px;
      margin-top: 5px;
    }
    .platform-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      height: 17px;
      padding: 0 6px 0 4px;
      border-radius: 3px;
      border-left: 2px solid rgba(148,163,184,0.70);
      background: rgba(148,163,184,0.13);
      color: rgba(220,232,245,0.92);
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.04em;
      white-space: nowrap;
      line-height: 1;
      cursor: pointer;
      user-select: none;
      text-shadow: 0 0 8px rgba(148,163,184,0.40);
      transition: background 0.12s, border-color 0.12s, color 0.12s, box-shadow 0.12s;
    }
    body.black .platform-chip {
      border-left-color: rgba(148,163,184,0.55);
      background: rgba(148,163,184,0.10);
      color: rgba(200,218,236,0.88);
    }
    .platform-chip::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.65;
      flex-shrink: 0;
    }
    .platform-chip:hover {
      background: rgba(125,211,252,0.18);
      border-left-color: rgba(125,211,252,0.80);
      color: #e0f2fe;
      text-shadow: 0 0 10px rgba(125,211,252,0.45);
    }
    .platform-chip.active {
      background: rgba(125,211,252,0.22);
      border-left-color: #7dd3fc;
      color: #f0f9ff;
      box-shadow: 0 0 0 1px rgba(125,211,252,0.35);
      text-shadow: 0 0 10px rgba(125,211,252,0.55);
    }
    body.black .platform-chip:hover,
    body.black .platform-chip.active {
      background: rgba(125,211,252,0.15);
      border-left-color: rgba(125,211,252,0.70);
      color: #e0f2fe;
    }
    tr:hover .platform-chip {
      background: rgba(148,163,184,0.18);
      border-left-color: rgba(148,163,184,0.90);
      color: rgba(220,235,250,1.0);
    }
    tr:hover .platform-chip.active {
      background: rgba(125,211,252,0.25);
      border-left-color: #7dd3fc;
      color: #f0f9ff;
    }
    body.black tr:hover .platform-chip {
      background: rgba(148,163,184,0.15);
      color: rgba(210,228,245,1.0);
    }
    /* Platform search bar */
    .platform-search-wrap {
      display: none;
      flex-direction: column;
      gap: 8px;
      padding: 10px 14px 12px;
      margin-top: 10px;
      border-radius: 10px;
      background: rgba(125,211,252,0.06);
      border: 1px solid rgba(125,211,252,0.20);
      overflow: hidden;
      min-width: 0;
    }
    .platform-search-wrap.visible { display: flex; }
    .platform-search-controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .platform-search-input-wrap {
      position: relative;
      flex: 0 1 240px;
      min-width: 120px;
    }
    .genre-search-input-wrap {
      margin-right: 2px;
    }
    .platform-search-input {
      width: 100%;
      padding: 6px 34px 6px 10px;
      border: 1px solid rgba(125,211,252,0.35);
      border-radius: 8px;
      background: rgba(7,11,20,0.55);
      color: #e0f2fe;
      font: inherit;
      font-size: 12px;
      outline: none;
      transition: border-color 0.13s;
    }
    .platform-search-input:focus { border-color: rgba(125,211,252,0.70); }
    .platform-search-input::placeholder { color: rgba(125,211,252,0.45); }
    .platform-search-clear {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      padding: 2px 5px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: rgba(125,211,252,0.55);
      font: inherit;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      transition: color 0.12s, background 0.12s;
      white-space: nowrap;
      line-height: 1;
    }
    .platform-search-clear:hover { color: #e0f2fe; background: rgba(125,211,252,0.12); }
    .platform-match-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px 5px 9px;
      border: 1.5px solid var(--line);
      border-radius: 999px;
      background: var(--control);
      color: var(--muted);
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: border-color 0.13s, background 0.13s, color 0.13s, transform 0.12s;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .platform-match-btn:hover { transform: translateY(-1px); border-color: rgba(125,211,252,0.55); }
    .platform-match-btn .filter-vis-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      border: 2px solid var(--muted);
      background: transparent;
      flex-shrink: 0;
      transition: border-color 0.13s, background 0.13s;
    }
    .platform-match-btn.active {
      border-color: rgba(47,141,247,0.65);
      background: rgba(47,141,247,0.11);
      color: #2f8df7;
    }
    .platform-match-btn.active .filter-vis-dot {
      border-color: #2f8df7;
      background: #2f8df7;
    }
    .platform-show-all-btn.active {
      border-color: rgba(125,211,252,0.65);
      background: rgba(125,211,252,0.13);
      color: #7dd3fc;
    }
    .platform-show-all-btn.active .filter-vis-dot {
      border-color: #7dd3fc;
      background: #7dd3fc;
    }
    .platform-match-btn:disabled,
    .platform-show-all-btn:disabled {
      cursor: not-allowed;
      opacity: 0.42;
      filter: grayscale(0.5);
    }
    .platform-match-btn:disabled .filter-vis-dot,
    .platform-show-all-btn:disabled .filter-vis-dot {
      border-color: var(--muted);
      background: transparent;
    }
    /* Platform search results grid */
    .platform-search-results {
      display: none;
    }
    .platform-search-results.visible {
      display: flex;
      flex-wrap: wrap;
      gap: 0;
      border-radius: 0;
      overflow: hidden;
    }
    .platform-result-btn {
 --platform-result-line: rgba(125,211,252,0.15);
      flex-grow: 1;
      flex-shrink: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      position: relative;
      gap: 5px;
      height: 30px;
      padding: 0 8px;
      border: none;
      box-shadow: none;
      background: rgba(125,211,252,0.05);
      color: rgba(200,225,245,0.85);
      font: inherit;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.12s, color 0.12s, box-shadow 0.12s;
    }
    .platform-result-btn::after {
      content: "";
      position: absolute;
      inset: 0;
      border: 1px solid var(--platform-result-line);
      pointer-events: none;
    }
    .platform-result-btn:hover { background: rgba(125,211,252,0.14); color: #e0f2fe; }
    .platform-result-btn.active {
      background: rgba(125,211,252,0.22);
      color: #f0f9ff;
    }
    .platform-result-check {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 12px;
      height: 16px;
      font-size: 10px;
      line-height: 1;
      opacity: 0.7;
      flex-shrink: 0;
    }
    .platform-result-btn.active .platform-result-check { opacity: 1; color: #7dd3fc; }
    .platform-result-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 5px;
      min-width: 18px;
      height: 16px;
      border-radius: 8px;
      background: rgba(125,211,252,0.18);
      color: rgba(200,225,245,0.75);
      font-size: 9px;
      font-weight: 700;
      line-height: 1;
      text-align: center;
      flex-shrink: 0;
      transition: background 0.12s, color 0.12s;
    }
    .platform-result-btn.active .platform-result-count {
      background: rgba(125,211,252,0.32);
      color: #bae6fd;
    }
    .platform-result-btn[data-pcount="0"] .platform-result-count {
      background: rgba(125,211,252,0.10);
      color: rgba(200,225,245,0.52);
    }
    .platform-result-btn[data-pcount="0"] {
      cursor: default;
      opacity: 0.45;
      pointer-events: none;
    }
    .platform-search-results .genre-btn.platform-result-btn {
      --platform-result-line: color-mix(in srgb, var(--gc) 22%, var(--line));
      background: color-mix(in srgb, var(--gc) 10%, transparent);
      color: var(--gc);
    }
    .platform-search-results .genre-btn.platform-result-btn::after {
      border-color: var(--platform-result-line);
    }
    .platform-search-results .genre-btn.platform-result-btn:hover {
      background: color-mix(in srgb, var(--gc) 22%, transparent);
      color: var(--gc);
    }
    .platform-search-results .genre-btn.platform-result-btn.active {
      --platform-result-line: color-mix(in srgb, var(--gc) 60%, transparent);
      background: var(--gc);
      color: #fff;
    }
    .platform-search-results .genre-btn.platform-result-btn[data-pcount="0"] {
      --platform-result-line: rgba(125,211,252,0.15);
      background: rgba(125,211,252,0.05);
      color: rgba(200,225,245,0.85);
      cursor: default;
      opacity: 0.45;
      pointer-events: none;
    }
    .platform-search-results .genre-btn.platform-result-btn[data-pcount="0"] .genre-count {
      background: rgba(125,211,252,0.10);
      color: rgba(200,225,245,0.52);
    }
    /* Active platform filter banner */
    .platform-filter-bar {
      display: none;
      flex-direction: column;
      gap: 6px;
      padding: 8px 14px;
      margin-top: 10px;
      border-radius: 8px;
      background: rgba(125,211,252,0.10);
      border: 1px solid rgba(125,211,252,0.28);
      font-size: 12px;
      color: #7dd3fc;
      font-weight: 700;
    }
    .platform-filter-bar.visible { display: flex; }
    .platform-filter-bar-inner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .platform-filter-bar-label {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: rgba(125,211,252,0.75);
      white-space: nowrap;
      margin-right: 2px;
    }
    .platform-filter-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border: 1px solid rgba(125,211,252,0.40);
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      color: #e0f2fe;
      background: rgba(125,211,252,0.12);
      cursor: pointer;
      transition: background 0.12s;
      user-select: none;
    }
    .platform-filter-pill:hover { background: rgba(125,211,252,0.22); }
    .platform-filter-pill.active { background: rgba(125,211,252,0.28); color: #f0f9ff; }
    .platform-filter-clear {
      padding: 2px 8px;
      border: 1px solid rgba(125,211,252,0.45);
      border-radius: 5px;
      background: transparent;
      color: #7dd3fc;
      font: inherit;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.12s, color 0.12s;
      white-space: nowrap;
      flex-shrink: 0;
      margin-left: 2px;
    }
    .platform-filter-clear:hover { background: rgba(125,211,252,0.15); color: #e0f2fe; }
    /* -- Toolbar --- */
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-top: 18px;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--panel);
      box-shadow: 0 18px 50px var(--shadow);
    }
    .toolbar-search { flex: 1 1 180px; min-width: 120px; position: relative; }
    input[type="search"] {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      color: var(--ink);
      font: inherit;
      background: var(--control);
      outline: none;
    }
    .toolbar-search input[type="search"] { padding-right: 56px; }
    .search-clear-btn {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      padding: 3px 8px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: color 0.12s, border-color 0.12s, background 0.12s;
      white-space: nowrap;
      display: none;
    }
    .search-clear-btn.visible { display: inline-flex; align-items: center; }
    .search-clear-btn:hover { color: var(--ink); border-color: rgba(125,211,252,0.6); background: rgba(125,211,252,0.08); }
    label.toggle {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 13px;
      border: 1.5px solid var(--line);
      border-radius: 999px;
      background: var(--control);
      white-space: nowrap;
      color: var(--ink);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      user-select: none;
      transition: border-color 0.13s, background 0.13s;
    }
    label.toggle:hover { border-color: rgba(125,211,252,0.6); background: rgba(125,211,252,0.07); }
    label.toggle input[type="checkbox"] { appearance: none; -webkit-appearance: none; position: relative; width: 15px; height: 15px; border: 1px solid rgba(234,244,255,0.55); border-radius: 3px; background: rgba(255,255,255,0.95); cursor: pointer; flex-shrink: 0; }
    label.toggle input[type="checkbox"]::after { content: ''; position: absolute; left: 4px; top: 1px; width: 4px; height: 8px; border: solid #082033; border-width: 0 2px 2px 0; opacity: 0; transform: rotate(45deg); }
    label.toggle input[type="checkbox"]:checked { border-color: rgba(47,141,247,0.92); background: #2f8df7; }
    label.toggle input[type="checkbox"]:checked::after { opacity: 1; }
    .genre-substat-toggle-tb input[type="checkbox"]:checked { border-color: rgba(214,63,140,0.9); background: #d63f8c; }
    .table-wrap { margin-top: 18px; overflow-x: auto; overflow-y: visible; border: 1px solid var(--line); border-radius: 18px; background: var(--panel); box-shadow: 0 18px 50px var(--shadow); outline: none; }
    .table-wrap:focus-visible { box-shadow: 0 18px 50px var(--shadow), 0 0 0 2px rgba(125,211,252,0.55); }
    .table-wrap.is-middle-panning { cursor: grabbing; user-select: none; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th[data-sort="title"] { width: ${tableWidths.title}%; }
    th.genre-col { width: ${tableWidths.genre}%; }
    th[data-sort="status"] { width: ${tableWidths.status}%; text-align: center; }
    th.rating-col,
    th.user-rating-col { width: ${tableWidths.rating}%; text-align: center; }
    th.user-rating-col { width: ${tableWidths.userRating}%; }
    th.release-col { width: ${tableWidths.release}%; }
    th {
      position: sticky; top: 0; z-index: 2;
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      background: var(--thead);
      color: var(--muted);
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    th[data-sort] {
      cursor: pointer;
      user-select: none;
      transition: color 0.13s, background 0.13s;
    }
    th[data-sort]:hover {
      color: var(--ink);
      background: color-mix(in srgb, var(--thead) 75%, rgba(47,141,247,0.2));
    }
    .th-label {
      display: inline-block;
      text-align: left;
      vertical-align: middle;
    }
    .th-line {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
    }
    th.rating-col .th-label,
    th.user-rating-col .th-label {
      text-align: center;
    }
    th.rating-col .th-line,
    th.user-rating-col .th-line {
      justify-content: center;
    }
    /* Sort indicator - uses a dedicated inline element so it never wraps */
    th[data-sort] .sort-arrow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 6px;
      width: 18px;
      height: 18px;
      border-radius: 4px;
      font-size: 12px;
      opacity: 0.45;
      background: rgba(125,211,252,0.10);
      vertical-align: middle;
    }
    th[data-sort]:hover .sort-arrow { opacity: 0.75; background: rgba(47,141,247,0.15); }
    th[data-sort].sort-asc .sort-arrow,
    th[data-sort].sort-desc .sort-arrow {
      opacity: 1;
      color: #2f8df7;
      background: rgba(47,141,247,0.18);
    }
    th[data-sort].sort-asc, th[data-sort].sort-desc { color: #2f8df7; }
    /* Genre count badge inside filter-bar buttons */
    .genre-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      align-self: center;
      min-width: 20px;
      padding: 1px 5px;
      margin-left: 0;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
      line-height: 1;
      background: rgba(0,0,0,0.18);
      color: inherit;
      letter-spacing: 0;
      flex-shrink: 0;
    }
    .genre-btn.active .genre-count { background: rgba(255,255,255,0.28); }
    /* -- Date filter --- */
    .date-filter {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--control);
    }
    .date-filter-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      white-space: nowrap;
    }
    .date-filter input[type="number"] {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel-soft);
      color: var(--ink);
      font: inherit;
      font-size: 13px;
      padding: 5px 7px;
      outline: none;
      transition: border-color 0.13s;
 -moz-appearance: textfield;
    }
    .date-filter input[type="number"]::-webkit-inner-spin-button,
    .date-filter input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    .date-filter input[type="number"]:focus { border-color: rgba(47,141,247,0.6); }
    .date-filter input[type="number"].df-year  { width: 62px; }
    .date-filter input[type="number"].df-month { width: 44px; }
    .date-filter input[type="number"].df-day   { width: 40px; }
    .date-filter-sep { color: var(--muted); font-size: 13px; font-weight: 700; }
    .date-filter-clear {
      padding: 3px 8px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: color 0.12s, border-color 0.12s;
    }
    .date-filter-clear:hover { color: var(--ink); border-color: rgba(125,211,252,0.6); }
    td { padding: 12px 14px; border-bottom: 1px solid var(--line); vertical-align: middle; }
    th.release-col,
    td.release-col { padding-left: 8px; padding-right: 8px; }
    tr { cursor: default; }
    td.game-col { cursor: pointer; }
    tbody tr:hover { background: var(--row-hover); }
    .game { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .cover { width: 48px; height: 72px; object-fit: cover; border-radius: 10px; background: #dde4ee; box-shadow: 0 8px 20px rgba(23,32,51,0.14); flex: 0 0 auto; }
    body.mobygames .cover { object-fit: fill; object-position: center; }
    body.mobygames .moby-cover-frame { display: block; overflow: hidden; background-color: #dde4ee; background-position: center; background-repeat: no-repeat; background-size: 100% 100%; }
    body.mobygames .moby-cover-probe { display: block; width: 100%; height: 100%; opacity: 0; pointer-events: none; }
    body.mobygames .cover.cover-landscape { width: 72px; height: 48px; }
    body.mobygames .cover.cover-portrait { width: 48px; height: 72px; }
    .cover.hidden { display: none; }
    .title { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .url { margin-top: 3px; color: var(--muted); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pill { display: inline-flex; justify-content: center; min-width: 86px; padding: 7px 11px; border-radius: 999px; color: #fff; font-size: 13px; font-weight: 800; cursor: pointer; user-select: none; transition: box-shadow 0.14s; }
    .pill:hover { box-shadow: 0 0 0 1.5px rgba(255,255,255,0.40); }
    .pill.pill-filter-active { box-shadow: 0 0 0 2px rgba(255,255,255,0.90); }
    .pill.pill-filter-active:hover { box-shadow: 0 0 0 2px #fff; }
    td:has(.pill) { display: table-cell; }
    .status-pills { display: flex; flex-direction: column; align-items: center; gap: 5px; }
    .played { background: var(--played); }
    .playing { background: var(--playing); }
    .backlog { background: var(--backlog); }
    .wishlist { background: var(--wishlist); }
    .pt-played    { background: var(--pt-played); }
    .pt-completed { background: var(--pt-completed); }
    .pt-retired   { background: var(--pt-retired); }
    .pt-shelved   { background: var(--pt-shelved); }
    .pt-abandoned { background: var(--pt-abandoned); }
    .pt-pill { display: inline-flex; }
    .pill-played-main { display: none; }
    body.backloggd .pt-pill { display: none; }
    body.backloggd .pill-played-main { display: inline-flex; }
    body.backloggd.show-play-types .pt-pill { display: inline-flex; }
    body.backloggd.show-play-types .pill-played-main { display: none; }
    /* -- Played sub-status big pills --- */
    .stat-played-group {
      display: contents;
      gap: 10px;
      grid-column: span 2;
    }
    body.backloggd .stat-played-group { display: none; }
    body.backloggd.show-play-types .stat-played-group { display: contents; }
    /* Each big pill */
    .stat-sub-pill {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--panel-soft);
      overflow: hidden;
      min-width: 0;
      height: 100px;
      display: flex;
      flex-direction: column;
    }
    /* -- Sub-pill header (acts as one equal flex slice) --- */
    .sub-pill-header {
      /* joins the same flex column as .stat-sub - each gets an equal share */
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 10px;
      border-bottom: 1px solid var(--line);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .sub-pill-header-btn {
      width: 100%;
      text-align: left;
      background: transparent;
      border-left: none;
      border-right: none;
      border-top: none;
      font: inherit;
      cursor: pointer;
      transition: background 0.13s ease, color 0.13s ease;
    }
    .sub-pill-header-btn:hover { background: var(--row-hover); color: var(--ink); }
    .sub-pill-header-btn.active { background: color-mix(in srgb, var(--played) 12%, transparent); color: var(--played); }
    .sub-pill-header-btn.queue-active { background: color-mix(in srgb, var(--playing) 12%, transparent); color: var(--playing); }
    .sub-pill-total {
      font-weight: 800;
      color: var(--ink);
      letter-spacing: 0;
      text-transform: none;
      /* inherits font-size from the pill-scoped rule below */
    }
    /* -- .sub-pill-rows dissolves so its children join the pill's flex -- */
    .sub-pill-rows {
      display: contents;
    }
    /* -- Each sub-row is one equal flex slice --- */
    .stat-sub {
      padding: 0 8px 0 9px;
      border-left: 3px solid var(--sub-color, #888);
      cursor: pointer;
      text-align: left;
      font: inherit;
      color: var(--ink);
      background: transparent;
      border-top: none;
      border-right: none;
      border-bottom: 1px solid var(--line);
      transition: background 0.13s ease;
      display: flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      overflow: hidden;
      flex: 1;
      min-height: 0;
    }
    .stat-sub:last-child { border-bottom: none; }
    .stat-sub:hover { background: var(--row-hover); }
    .stat-sub.active { background: color-mix(in srgb, var(--sub-color, #888) 10%, transparent); }
    .stat-sub .sub-name {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stat-sub .sub-num {
      font-size: 14px;
      font-weight: 800;
      color: var(--ink);
      flex-shrink: 0;
    }
    .stat-sub .sub-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--sub-color, #888);
      flex-shrink: 0;
    }
    /* Tighten horizontal padding when pill is very narrow */
    @container (max-width: 110px) {
      .stat-sub { padding: 0 4px 0 6px; gap: 3px; }
      .stat-sub .sub-dot { width: 5px; height: 5px; }
    }
    /* -- Per-pill text sizing (Played pills: 3 rows = ~33px each -> bigger text) */
    /* Full-size defaults - identical to the original values */
    .stat-sub-pill-a .sub-pill-header,
    .stat-sub-pill-b .sub-pill-header { font-size: 11px; }
    .stat-sub-pill-a .sub-pill-total,
    .stat-sub-pill-b .sub-pill-total  { font-size: 15px; }
    .stat-sub-pill-a .sub-name,
    .stat-sub-pill-b .sub-name        { font-size: 13px; }
    .stat-sub-pill-a .sub-num,
    .stat-sub-pill-b .sub-num         { font-size: 16px; }
    .stat-sub-pill-a .sub-dot,
    .stat-sub-pill-b .sub-dot         { width: 8px; height: 8px; }
    /* -- Queue pill text sizing (header + 3 rows = 4 slices = 25px each) */
    .stat-queue-pill .sub-pill-header { font-size: 10px; }
    .stat-queue-pill .sub-pill-total  { font-size: 13px; }
    .stat-queue-pill .sub-name        { font-size: 11px; }
    .stat-queue-pill .sub-num         { font-size: 14px; }
    .stat-queue-pill .sub-dot         { width: 7px; height: 7px; }
    /* -- Shrink text when a pill's own width gets tight (container queries) */
    @container (max-width: 130px) {
      .stat-sub-pill-a .sub-pill-header,
      .stat-sub-pill-b .sub-pill-header { font-size: 9px; }
      .stat-sub-pill-a .sub-pill-total,
      .stat-sub-pill-b .sub-pill-total  { font-size: 12px; }
      .stat-sub-pill-a .sub-name,
      .stat-sub-pill-b .sub-name        { font-size: 10px; }
      .stat-sub-pill-a .sub-num,
      .stat-sub-pill-b .sub-num         { font-size: 13px; }
      .stat-queue-pill .sub-pill-header { font-size: 8px; }
      .stat-queue-pill .sub-pill-total  { font-size: 11px; }
      .stat-queue-pill .sub-name        { font-size: 9px; }
      .stat-queue-pill .sub-num         { font-size: 11px; }
    }
    @container (max-width: 100px) {
      .stat-sub-pill-a .sub-pill-header,
      .stat-sub-pill-b .sub-pill-header { font-size: 8px; }
      .stat-sub-pill-a .sub-pill-total,
      .stat-sub-pill-b .sub-pill-total  { font-size: 10px; }
      .stat-sub-pill-a .sub-name,
      .stat-sub-pill-b .sub-name        { font-size: 8px; }
      .stat-sub-pill-a .sub-num,
      .stat-sub-pill-b .sub-num         { font-size: 11px; }
      .stat-queue-pill .sub-pill-header { font-size: 7px; }
      .stat-queue-pill .sub-pill-total  { font-size: 9px; }
      .stat-queue-pill .sub-name        { font-size: 7px; }
      .stat-queue-pill .sub-num         { font-size: 9px; }
    }
    /* -- Total stat --- */
    .stat-total-main { display: flex; flex-direction: column; }
    .stat-played-total-badge { display: none; }
    body.mobygames .stat[data-status-filter=\"played\"] { display: none; }
    body.backloggd.show-play-types .stat[data-status-filter=\"played\"] { display: none; }
    /* -- Configured status pill typography (HLTB & MobyGames): match Backloggd sub-status pill sizing --- */
    body.mobygames .stat-config-pill .sub-pill-header { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
    body.mobygames .stat-config-pill .sub-pill-total  { font-size: 15px; font-weight: 800; letter-spacing: 0; text-transform: none; }
    body.mobygames .stat-config-pill .sub-name        { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    body.mobygames .stat-config-pill .sub-num         { font-size: 16px; font-weight: 800; }
    body.mobygames .stat-config-pill .sub-dot         { width: 8px; height: 8px; }
    @container (max-width: 130px) {
      body.mobygames .stat-config-pill .sub-pill-header { font-size: 9px; }
      body.mobygames .stat-config-pill .sub-pill-total  { font-size: 12px; }
      body.mobygames .stat-config-pill .sub-name        { font-size: 10px; }
      body.mobygames .stat-config-pill .sub-num         { font-size: 13px; }
    }
    @container (max-width: 100px) {
      body.mobygames .stat-config-pill .sub-pill-header { font-size: 8px; }
      body.mobygames .stat-config-pill .sub-pill-total  { font-size: 10px; }
      body.mobygames .stat-config-pill .sub-name        { font-size: 8px; }
      body.mobygames .stat-config-pill .sub-num         { font-size: 11px; }
    }
    /* -- Hide empty-filter controls in HLTB exports only --- */
    body.howlongtobeat #genreShowEmpty    { display: none !important; }
    body.howlongtobeat #platformShowEmpty { display: none !important; }
    .num { font-variant-numeric: tabular-nums; font-weight: 800; }
    .rating-col,
    .user-rating-col { text-align: center; }
    .release-col { text-align: right; }
    th.release-col { text-align: center; }
    td.release-col { white-space: nowrap; }
    .user-rating-col { display: none; }
    body.has-user-ratings .user-rating-col { display: table-cell; }
    .hidden { display: none !important; }
    .empty { display: none; padding: 28px; color: var(--muted); text-align: center; }
    .empty.visible { display: block; }
    @media (max-width: 980px) {
      .toolbar { flex-wrap: wrap; }
      .toolbar-search { flex: 1 1 100%; }
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      table { min-width: 920px; }
    }
    @media (max-width: 640px) {
      .shell { padding: 14px 10px 28px; }
      .hero, .toolbar { padding: 14px; }
      .cover { width: 42px; height: 63px; }
      body.mobygames .cover.cover-landscape { width: 63px; height: 42px; }
      body.mobygames .cover.cover-portrait { width: 42px; height: 63px; }
      .title { white-space: normal; }
    }
    /* -- Column visibility: hidden states --- */
    body.hide-col-genres .genre-col { display: none !important; }
    body.hide-col-genres th.genre-col { display: none !important; }
    body.hide-col-status td:has(.status-pills) { display: none !important; }
    body.hide-col-status th[data-sort="status"] { display: none !important; }
    body.hide-col-avg-rating .rating-col { display: none !important; }
    body.hide-col-user-rating .user-rating-col { display: none !important; }
    body.hide-col-release-date .release-col { display: none !important; }
    body.hide-col-link .url { display: none !important; }
    body.hide-col-platforms .platform-chips { display: none !important; }
    /* -- Filter visibility toggle buttons (Genres / Platforms) --- */
    .filter-toggle-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .filter-toggle-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      white-space: nowrap;
    }
    .filter-vis-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px 5px 9px;
      border: 1.5px solid var(--line);
      border-radius: 999px;
      background: var(--control);
      color: var(--muted);
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: border-color 0.13s, background 0.13s, color 0.13s, transform 0.12s;
      white-space: nowrap;
    }
    .filter-vis-btn:hover { transform: translateY(-1px); border-color: rgba(125,211,252,0.55); }
    .filter-vis-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      border: 2px solid var(--muted);
      background: transparent;
      flex-shrink: 0;
      transition: border-color 0.13s, background 0.13s;
    }
    .filter-vis-btn.active {
      border-color: rgba(47,141,247,0.65);
      background: rgba(47,141,247,0.11);
      color: #2f8df7;
    }
    .filter-vis-btn.active .filter-vis-dot {
      border-color: #2f8df7;
      background: #2f8df7;
    }
    /* -- Columns picker wrap --- */
    .col-picker-wrap {
      position: relative;
    }
    .col-picker-btn {
      padding: 6px 13px;
      border: 1.5px solid var(--line);
      border-radius: 999px;
      background: var(--control);
      color: var(--ink);
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: border-color 0.13s, background 0.13s, transform 0.12s;
      min-height: calc(15px + 12px + 1.5px * 2);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .col-picker-btn::after {
      content: "";
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-top: 5px solid currentColor;
      opacity: 0.78;
      transform: translateY(1px);
      transition: transform 0.13s ease, opacity 0.13s ease;
    }
    .col-picker-btn:hover { border-color: rgba(125,211,252,0.7); background: rgba(125,211,252,0.10); transform: translateY(-1px); }
    .col-picker-btn.open { border-color: rgba(47,141,247,0.7); background: rgba(47,141,247,0.10); color: #2f8df7; }
    .col-picker-btn.open::after { opacity: 1; transform: translateY(0) rotate(180deg); }
    .col-picker-panel {
      position: absolute;
      top: calc(100% + 7px);
      right: 0;
      z-index: 9999;
      min-width: 230px;
      padding: 10px 14px 12px;
      border: 1.5px solid var(--line);
      border-radius: 12px;
      background: var(--panel);
      box-shadow: 0 10px 36px var(--shadow);
      backdrop-filter: blur(12px);
    }
    .col-picker-panel[hidden] { display: none; }
    .col-picker-close {
      position: absolute;
      top: 7px;
      right: 8px;
      width: 22px;
      height: 22px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s, color 0.12s;
      padding: 0;
    }
    .col-picker-close:hover { background: rgba(125,211,252,0.15); color: var(--ink); }
    .col-picker-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 10px;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid var(--line);
    }
    .col-picker-row:first-of-type { margin-top: 0; padding-top: 0; border-top: none; }
    .col-picker-row.no-sep { border-top: none; margin-top: 0; padding-top: 2px; }
    .col-picker-chk {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      font-weight: 600;
      color: var(--ink);
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      padding: 2px 0;
    }
    .col-picker-chk input[type="checkbox"] {
      appearance: none;
      -webkit-appearance: none;
      position: relative;
      width: 13px;
      height: 13px;
      border: 1px solid rgba(234,244,255,0.55);
      border-radius: 3px;
      background: rgba(255,255,255,0.95);
      cursor: pointer;
      flex-shrink: 0;
    }
    .col-picker-chk input[type="checkbox"]::after {
      content: '';
      position: absolute;
      left: 3px;
      top: 1px;
      width: 3px;
      height: 7px;
      border: solid #082033;
      border-width: 0 2px 2px 0;
      opacity: 0;
      transform: rotate(45deg);
    }
    .col-picker-chk input[type="checkbox"]:checked {
      border-color: rgba(125,211,252,0.98);
      background: #7dd3fc;
    }
    .col-picker-chk input[type="checkbox"]:checked::after {
      opacity: 1;
    }
    /* -- Light-mode overrides --- */
    /* Genre count badge: in light mode the inherited --gc colour is often too
       light to read on the semi-dark badge background. Force white text. */
    body:not(.black) .genre-count {
      background: rgba(0,0,0,0.30);
      color: #fff;
    }
    body:not(.black) .genre-btn.active .genre-count {
      background: rgba(0,0,0,0.22);
      color: #fff;
    }
    /* Platform search input: was styled for dark mode only */
    body:not(.black) .platform-search-input {
      background: var(--control);
      color: var(--ink);
      border-color: var(--line);
    }
    body:not(.black) .platform-search-input::placeholder {
      color: var(--muted);
    }
    body:not(.black) .platform-search-input:focus {
      border-color: rgba(47,141,247,0.60);
    }
    /* Platform search results grid: was hardcoded to dark palette */
    body:not(.black) .platform-result-btn {
 --platform-result-line: var(--line);
      background: color-mix(in srgb, var(--ink) 4%, transparent);
      color: var(--ink);
    }
    body:not(.black) .platform-result-btn:hover {
      background: color-mix(in srgb, var(--ink) 10%, transparent);
      color: var(--ink);
    }
    body:not(.black) .platform-result-btn.active {
      background: rgba(47,141,247,0.13);
      color: var(--ink);
    }
    body:not(.black) .platform-result-check {
      color: var(--muted);
    }
    body:not(.black) .platform-result-btn.active .platform-result-check {
      color: #2f8df7;
    }
    /* Platform chips below game titles: were invisible in light mode */
    body:not(.black) .platform-chip {
      color: #334155;
      background: rgba(71,85,105,0.10);
      border-left-color: rgba(71,85,105,0.50);
      text-shadow: none;
    }
    body:not(.black) .platform-chip:hover {
      background: rgba(47,141,247,0.10);
      border-left-color: rgba(47,141,247,0.55);
      color: #1e3a5f;
      text-shadow: none;
    }
    body:not(.black) .platform-chip.active {
      background: rgba(47,141,247,0.14);
      border-left-color: #2f8df7;
      color: #0f2e5c;
      text-shadow: none;
      box-shadow: 0 0 0 1px rgba(47,141,247,0.22);
    }
    body:not(.black) tr:hover .platform-chip {
      background: rgba(71,85,105,0.15);
      border-left-color: rgba(71,85,105,0.70);
      color: #1e293b;
    }
    body:not(.black) tr:hover .platform-chip.active {
      background: rgba(47,141,247,0.18);
      border-left-color: #2f8df7;
      color: #0f2e5c;
    }
    /* -- Platform result-count badges: light-mode fixes ---
       Base dark styles use a translucent sky-blue bg + near-white text,
       which both become invisible on the light panel background. */
    body:not(.black) .platform-result-count {
      background: rgba(47,141,247,0.14);
      color: #1e3a5f;
    }
    body:not(.black) .platform-result-btn:hover .platform-result-count {
      background: rgba(47,141,247,0.20);
      color: #0f2e5c;
    }
    body:not(.black) .platform-result-btn.active .platform-result-count {
      background: rgba(47,141,247,0.22);
      color: #0f2e5c;
    }
    /* "Empty Platforms" state: data-pcount="0" reduces opacity to 0.38
       which kills contrast in light mode. Override to a subtler but still
       readable treatment without relying on opacity alone. */
    body:not(.black) .platform-result-btn[data-pcount="0"] .platform-result-count {
      opacity: 1;
      background: rgba(71,85,105,0.12);
      color: rgba(51,65,85,0.65);
    }
    body:not(.black) .platform-search-results .genre-btn.platform-result-btn {
      --platform-result-line: color-mix(in srgb, var(--gc) 28%, rgba(47,141,247,0.18));
      background: color-mix(in srgb, var(--gc) 9%, transparent);
      color: var(--gc);
    }
    body:not(.black) .platform-search-results .genre-btn.platform-result-btn:hover {
      background: color-mix(in srgb, var(--gc) 18%, transparent);
      color: var(--gc);
    }
    body:not(.black) .platform-search-results .genre-btn.platform-result-btn.active {
      background: var(--gc);
      color: #fff;
    }
    body:not(.black) .platform-search-results .genre-btn.platform-result-btn[data-pcount="0"] {
      --platform-result-line: rgba(47,141,247,0.18);
      background: rgba(47,141,247,0.045);
      color: rgba(30,58,95,0.82);
    }
    body:not(.black) .platform-search-results .genre-btn.platform-result-btn[data-pcount="0"] .genre-count {
      opacity: 1;
      background: rgba(71,85,105,0.12);
      color: rgba(51,65,85,0.65);
    }
    /* -- Active-filter banner pills: were hardcoded to dark palette --- */
    body:not(.black) .platform-filter-pill {
      border-color: rgba(47,141,247,0.40);
      color: #1e3a5f;
      background: rgba(47,141,247,0.10);
    }
    body:not(.black) .platform-filter-pill:hover {
      background: rgba(47,141,247,0.18);
      color: #0f2e5c;
    }
    body:not(.black) .platform-filter-pill.active {
      background: rgba(47,141,247,0.22);
      color: #0f2e5c;
    }
    body:not(.black) .platform-filter-bar {
      background: rgba(47,141,247,0.07);
      border-color: rgba(47,141,247,0.25);
      color: #1e3a5f;
    }
    body:not(.black) .platform-filter-bar-label {
      color: rgba(47,141,247,0.80);
    }
    body:not(.black) .platform-filter-clear {
      border-color: rgba(47,141,247,0.40);
      color: #2f6db5;
    }
    body:not(.black) .platform-filter-clear:hover {
      background: rgba(47,141,247,0.12);
      color: #0f2e5c;
    }
`;
  }

  function getStatusPillConfigForPayload(payload) {
    return payload && payload.status_pill_config && Array.isArray(payload.status_pill_config.categories)
      ? payload.status_pill_config
      : null;
  }

  function countForConfiguredStatusPill(pill, payload, playTypeCounts) {
    if (!pill) return 0;
    const statusId = String(pill.id || '').trim();
    if (statusId && Array.isArray(payload.items)) {
      const statusIdCount = payload.items.filter(item => {
        const sourceMeta = item.source_meta && typeof item.source_meta === 'object' ? item.source_meta : {};
        const ids = Array.isArray(item.statusIds) && item.statusIds.length
          ? item.statusIds
          : Array.isArray(item.status_ids) && item.status_ids.length
            ? item.status_ids
            : Array.isArray(sourceMeta.status_ids) && sourceMeta.status_ids.length
              ? sourceMeta.status_ids
            : item.statusId || item.status_id
              ? [item.statusId || item.status_id]
              : [];
        return ids.map(id => String(id || '').trim()).includes(statusId);
      }).length;
      if (statusIdCount) return statusIdCount;
    }
    if (!pill.source) return 0;
    if (pill.source.type === 'play_type') return playTypeCounts[pill.source.value] || 0;
    if (pill.source.type === 'status') return (payload.counts && payload.counts[pill.source.value]) || 0;
    return 0;
  }

  function buildConfiguredStatusStatsHtml(config, payload, playTypeCounts) {
    const statusPills = new Map();
    (config.categories || []).forEach(category => {
      (category.pills || []).forEach(pill => {
        if (pill.kind === 'status') statusPills.set(pill.id, pill);
      });
    });
    const countForPill = pill => {
      if (!pill) return 0;
      if (pill.kind === 'aggregate') {
        return (pill.sources || []).reduce((sum, id) => sum + countForPill(statusPills.get(id)), 0);
      }
      return countForConfiguredStatusPill(pill, payload, playTypeCounts);
    };
    const attrsForPill = pill => {
      return '';
    };
    return (config.categories || []).map((category, categoryIndex) => `
        <div class="stat-sub-pill stat-config-pill" data-status-category="${escapeHtml(category.id || `cat-${categoryIndex}`)}">
          ${(category.pills || []).map(pill => {
            if (pill.kind === 'aggregate') {
              const sourceIds = (pill.sources || []).join(',');
              return `<button class="sub-pill-header sub-pill-header-btn" type="button" data-aggregate-sources="${escapeHtml(sourceIds)}">${escapeHtml(pill.label || 'Aggregate Pill')} <span class="sub-pill-total">${countForPill(pill)}</span></button>`;
            }
            return `<button class="stat-sub" type="button" data-config-status-id="${escapeHtml(pill.id)}"${attrsForPill(pill)} style="--sub-color:${escapeHtml(pill.color || '#7dd3fc')}"><span class="sub-dot"></span><span class="sub-name">${escapeHtml(pill.label || 'Status Pill')}</span><span class="sub-num">${countForPill(pill)}</span></button>`;
          }).join('\n          ')}
        </div>`).join('\n');
  }

  function buildViewerHeroHtml({ payload, generated, genreBarHtml, platformFilterHtml, playTypeCounts, playedTotal, queueTotal }) {
    const statusPillConfigForPayload = getStatusPillConfigForPayload(payload);
    const sourceName = sourceLabelForWebsite(payload.sourceWebsite);
    const isHowLongToBeatViewer = isSourceWebsite(payload.sourceWebsite, 'howlongtobeat');
    const isMobyGamesViewer = isSourceWebsite(payload.sourceWebsite, 'mobygames') || isHowLongToBeatViewer;
    const statsHtml = statusPillConfigForPayload
      ? `${isMobyGamesViewer ? `<button class="stat active" type="button" data-status-filter="all"><span>Total</span><strong>${payload.total}</strong></button>` : ''}${buildConfiguredStatusStatsHtml(statusPillConfigForPayload, payload, playTypeCounts)}`
      : `
        <button class="stat active" type="button" data-status-filter="all"><span>Total</span><strong>${payload.total}</strong></button>
        <button class="stat" type="button" data-status-filter="played"><span>Played</span><strong>${payload.counts.played || 0}</strong></button>
        <div class="stat-played-group" id="statPlayedGroup">
          <div class="stat-sub-pill stat-sub-pill-a">
            <button class="sub-pill-header sub-pill-header-btn" type="button" id="playedTotalBtn" title="Show all Played games (clear sub-status filter)">Played Total <span class="sub-pill-total">${playedTotal}</span></button>
            <div class="sub-pill-rows">
              ${['played','completed'].map(pt => `<button class="stat-sub" type="button" data-play-type="${pt}" style="--sub-color:${PLAY_TYPE_COLORS[pt]}"><span class="sub-dot"></span><span class="sub-name">${PLAY_TYPE_LABELS[pt]}</span><span class="sub-num">${playTypeCounts[pt] || 0}</span></button>`).join('\n              ')}
            </div>
          </div>
          <div class="stat-sub-pill stat-sub-pill-b">
            <div class="sub-pill-rows">
              ${['retired','shelved','abandoned'].map(pt => `<button class="stat-sub" type="button" data-play-type="${pt}" style="--sub-color:${PLAY_TYPE_COLORS[pt]}"><span class="sub-dot"></span><span class="sub-name">${PLAY_TYPE_LABELS[pt]}</span><span class="sub-num">${playTypeCounts[pt] || 0}</span></button>`).join('\n              ')}
            </div>
          </div>
        </div>
        <div class="stat-sub-pill stat-queue-pill">
          <button class="sub-pill-header sub-pill-header-btn" type="button" id="queueTotalBtn" title="Show all Playing, Backlog &amp; Wishlist games">Queue <span class="sub-pill-total">${queueTotal}</span></button>
          <div class="sub-pill-rows">
            <button class="stat-sub" type="button" data-status-filter="playing" style="--sub-color:${STATUS_COLORS.playing}"><span class="sub-dot"></span><span class="sub-name">Playing</span><span class="sub-num">${payload.counts.playing || 0}</span></button>
            <button class="stat-sub" type="button" data-status-filter="backlog" style="--sub-color:${STATUS_COLORS.backlog}"><span class="sub-dot"></span><span class="sub-name">Backlog</span><span class="sub-num">${payload.counts.backlog || 0}</span></button>
            <button class="stat-sub" type="button" data-status-filter="wishlist" style="--sub-color:${STATUS_COLORS.wishlist}"><span class="sub-dot"></span><span class="sub-name">Wishlist</span><span class="sub-num">${payload.counts.wishlist || 0}</span></button>
          </div>
        </div>`;
    return `<section class="hero">
      <div class="head">
        <div>
          <h1>${escapeHtml(payload.username)}'s ${sourceName} Library</h1>
          <p class="sub">Generated ${generated}. Click a game to open it on ${sourceName}.</p>
        </div>
        <div class="head-actions">
          ${isMobyGamesViewer ? '' : '<label class="toggle genre-substat-toggle-tb"><input id="playSubStatuses" type="checkbox"> Played Sub-Statuses</label>'}
          <label class="toggle"><input id="statusFilterCounter" type="checkbox"> Filtered Status Counts</label>
          <label class="toggle"><input id="lightMode" type="checkbox"> Light Mode</label>
          <p class="sub" id="countLabel"></p>
        </div>
      </div>
      <div class="stats" id="stats">
${statsHtml}
      </div>
      ${genreBarHtml}
      ${platformFilterHtml}
    </section>`;
  }

  function buildViewerBodyHtml({ heroHtml, toolbarHtml, tableHtml }) {
    return `
</head>
<body>
  <main class="shell">
    ${heroHtml}
    ${toolbarHtml}
    ${tableHtml}
  </main>
`;
  }

  function buildViewerScript({ payload, statusLabelsJson, statusColorsJson = '{}', playTypeLabelsJson, playTypeColorsJson, tableWidths, playTypeCounts, queueTotal, statusPriority = STATUS_PRIORITY }) {
    return `    const STATUS_LABELS = ${statusLabelsJson};
    const STATUS_COLORS_MAP = ${statusColorsJson};
    const PLAY_TYPE_LABELS_MAP = ${playTypeLabelsJson};
    const PLAY_TYPE_COLORS_MAP = ${playTypeColorsJson};
    const TABLE_WIDTHS = ${escapeJsonForHtml(JSON.stringify(tableWidths))};
    const PLAY_TYPE_COUNTS_ORIG = ${escapeJsonForHtml(JSON.stringify(playTypeCounts))};
    const QUEUE_TOTAL_ORIG = ${queueTotal};
    const payload = JSON.parse(document.getElementById('payload').textContent);
    const MOBYGAMES_GENRE_LABELS = payload.mobygames_genre_labels || [];
    const MOBYGAMES_SOURCE_WEBSITE = ${escapeJsonForHtml(JSON.stringify(getSourceWebsite('mobygames')))};
    const HLTB_SOURCE_WEBSITE = ${escapeJsonForHtml(JSON.stringify(getSourceWebsite('howlongtobeat')))};
    const IS_MOBYGAMES_SOURCE_VIEWER = payload.sourceWebsite === MOBYGAMES_SOURCE_WEBSITE;
    const IS_HLTB_VIEWER = payload.sourceWebsite === HLTB_SOURCE_WEBSITE;
    const IS_MOBYGAMES_VIEWER = IS_MOBYGAMES_SOURCE_VIEWER || IS_HLTB_VIEWER;
    document.body.classList.toggle('mobygames', IS_MOBYGAMES_VIEWER);
    document.body.classList.toggle('howlongtobeat', IS_HLTB_VIEWER);
    document.body.classList.toggle('backloggd', !IS_MOBYGAMES_VIEWER);
    const STATUS_PILL_CONFIG = payload.status_pill_config || null;
    const rowsTbody = document.getElementById('rows');
    const tableWrap = document.getElementById('tableWrap');
    const empty = document.getElementById('empty');
    const search = document.getElementById('search');
    const coversChk = document.getElementById('covers');
    const lightMode = document.getElementById('lightMode');
    const genreEmojisChk = document.getElementById('genreEmojis');
    const countLabel = document.getElementById('countLabel');
    const playSubStatusesChk = document.getElementById('playSubStatuses');
    const genreBarBtns = [...document.querySelectorAll('.genre-btn')];
    const genreSearchInput = document.getElementById('genreSearchInput');
    const genreSearchClear = document.getElementById('genreSearchClear');
    const genreShowAllBtn = document.getElementById('genreShowAll');
    const genreShowEmptyBtn = document.getElementById('genreShowEmpty');
    const genreMatchBtn = document.getElementById('genreMatchAll');
    const genreFilterBar = document.getElementById('genreFilterBar');
    const genreFilterPills = document.getElementById('genreFilterPills');
    const genreFilterClear = document.getElementById('genreFilterClear');
    const gamesDisplayedNum = document.getElementById('gamesDisplayedNum');
    const genresDisplayedNum = document.getElementById('genresDisplayedNum');
    const platformFilterBar = document.getElementById('platformFilterBar');
    const platformFilterPills = document.getElementById('platformFilterPills');
    const platformFilterClear = document.getElementById('platformFilterClear');
    const platformSearchInput = document.getElementById('platformSearchInput');
    const platformSearchClear = document.getElementById('platformSearchClear');
    const platformSearchResults = document.getElementById('platformSearchResults');
    const platformMatchAllBtn = document.getElementById('platformMatchAll');
    const platformShowAllBtn = document.getElementById('platformShowAll');
    const platformShowEmptyBtn = document.getElementById('platformShowEmpty');
    const filtersGenresBtn = document.getElementById('filtersGenresBtn');
    const filtersPlatformsBtn = document.getElementById('filtersPlatformsBtn');
    const gamesDisplayedPlatformNum = document.getElementById('gamesDisplayedPlatformNum');
    const platformsDisplayedNum = document.getElementById('platformsDisplayedNum');
    const platformsDisplayedTotal = document.getElementById('platformsDisplayedTotal');
    const statusFilterCounterChk = document.getElementById('statusFilterCounter');
    const playedTotalBtn = document.getElementById('playedTotalBtn');
    const queueTotalBtn  = document.getElementById('queueTotalBtn');
    const statButtons = [...document.querySelectorAll('[data-status-filter]')];
    const playTypeButtons = [...document.querySelectorAll('[data-play-type]')];
    const thSorts = [...document.querySelectorAll('th[data-sort]')];
    const dfYear  = document.getElementById('dfYear');
    const dfMonth = document.getElementById('dfMonth');
    const dfDay   = document.getElementById('dfDay');
    const dfClear = document.getElementById('dfClear');
    const STATUS_PRIORITY = ${escapeJsonForHtml(JSON.stringify(statusPriority))};
    const statusOrderIndex = s => STATUS_PRIORITY[s] ?? 99;

    function tableCanScrollX() {
      return tableWrap && tableWrap.scrollWidth > tableWrap.clientWidth + 1;
    }

    function isTypingTarget(target) {
      const el = target && target.nodeType === 1 ? target : null;
      if (!el) return false;
      return !!el.closest('input, textarea, select, button, [contenteditable="true"]');
    }

    document.addEventListener('keydown', ev => {
      if (!tableCanScrollX() || isTypingTarget(ev.target) || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      const step = Math.max(80, Math.floor(tableWrap.clientWidth * 0.18));
      if (ev.key === 'ArrowLeft') {
        tableWrap.scrollBy({ left: -step, behavior: 'smooth' });
        ev.preventDefault();
      } else if (ev.key === 'ArrowRight') {
        tableWrap.scrollBy({ left: step, behavior: 'smooth' });
        ev.preventDefault();
      }
    });

    if (tableWrap) {
      let middlePan = null;
      tableWrap.addEventListener('mousedown', ev => {
        if (ev.button !== 1 || !tableCanScrollX()) return;
        middlePan = { x: ev.clientX, left: tableWrap.scrollLeft };
        tableWrap.classList.add('is-middle-panning');
        tableWrap.focus({ preventScroll: true });
        ev.preventDefault();
      });
      tableWrap.addEventListener('auxclick', ev => {
        if (ev.button === 1) ev.preventDefault();
      });
      window.addEventListener('mousemove', ev => {
        if (!middlePan) return;
        tableWrap.scrollLeft = middlePan.left - (ev.clientX - middlePan.x);
        ev.preventDefault();
      });
      window.addEventListener('mouseup', ev => {
        if (ev.button !== 1 || !middlePan) return;
        middlePan = null;
        tableWrap.classList.remove('is-middle-panning');
        ev.preventDefault();
      });
      window.addEventListener('blur', () => {
        middlePan = null;
        tableWrap.classList.remove('is-middle-panning');
      });
    }

    // -- Genre emoji map (from exporter) ---
    const GENRE_EMOJIS = ${JSON.stringify(GENRE_EMOJIS)};

    // -- Full known platform label list (from exporter) ---
    // Includes ALL platforms in the scanned set, not just those with exported
    // games. Used so the search bar can surface platforms with a count of 0.
    const BACKLOGGD_KNOWN_PLATFORM_LABELS = ${JSON.stringify(
      (payload.include_platforms226 ? ALL_PLATFORM_SLUGS : PLATFORM_SLUGS).map(p => p.label)
    )};
    const ALL_KNOWN_PLATFORM_LABELS = IS_MOBYGAMES_SOURCE_VIEWER || IS_HLTB_VIEWER
      ? (payload.mobygames_platform_labels || [])
      : BACKLOGGD_KNOWN_PLATFORM_LABELS;

    // -- Genre pill grid layout ---
    // Distributes visible genre pills across rows as a rectangle.
    //
    // Default (wide screen): start at 3 rows, then add rows as needed so
    // MobyGames' longer genre/gameplay labels can wrap inside their pills.
    // Pill height is intrinsic; the grid is never height-clipped.
    //
    // Minimum padding guarantee: each pill has horizontal padding, so there is
    // visible breathing room between text/counter and the border edges.
    // Guard token: each call to updateGenrePillRows cancels any in-flight rAF
    // adjustment loop from a prior call, preventing stacked loops that cause
    // the flashing/reshaping effect when the emoji toggle or render() fires
    // while a previous adjustment chain is still running.
    let _genrePillAdjToken = 0;

    function updateGenrePillRows(grid, visibleCount, { checkOverflow = true } = {}) {
      if (!grid) return 0;

      // Cancel any in-flight adjustment loop
      _genrePillAdjToken++;
      const myToken = _genrePillAdjToken;

      if (visibleCount === 0) { grid.style.display = 'none'; return 0; }
      grid.style.display = '';

      if (!IS_MOBYGAMES_VIEWER) {
        const emojisOn = document.body.classList.contains('show-genre-emojis');
        const baseRowH  = emojisOn ? 44 : 36;
        const containerW = grid.parentElement ? grid.parentElement.offsetWidth : 600;

        const minPillW = emojisOn ? 108 : 90;
        const maxRows  = 6;
        let rows = 3;

        while (rows < maxRows) {
          const pillsPerRowAtRows = Math.ceil(visibleCount / rows);
          if (containerW / pillsPerRowAtRows >= minPillW) break;
          rows++;
        }

        const pillsPerRow = Math.ceil(visibleCount / rows);
        const pillW = containerW / pillsPerRow;
        const comfortW = emojisOn ? 130 : 110;
        const minFontPx = emojisOn ? 9 : 10;
        const maxFontPx = 13;
        let fontSize;
        if (pillW >= comfortW) {
          fontSize = maxFontPx;
        } else {
          const t = Math.max(0, Math.min(1, (pillW - minPillW) / (comfortW - minPillW)));
          fontSize = Math.round(minFontPx + t * (maxFontPx - minFontPx));
        }

        grid.style.setProperty('--genre-rows', rows);
        grid.style.setProperty('--genre-row-h', baseRowH + 'px');
        grid.style.setProperty('--genre-pill-fs', fontSize + 'px');

        const lastRowCount = visibleCount % pillsPerRow || pillsPerRow;
        const basisPct     = (100 / pillsPerRow).toFixed(4) + '%';
        const lastBasisPct = (100 / lastRowCount).toFixed(4) + '%';
        const allBtns = grid.querySelectorAll('.genre-btn');
        let visibleIndex = 0;
        allBtns.forEach(btn => {
          if (btn.style.display === 'none') {
            btn.style.flexBasis = '0';
          } else {
            const isLastRow = visibleIndex >= visibleCount - lastRowCount;
            btn.style.flexBasis = isLastRow ? lastBasisPct : basisPct;
            visibleIndex++;
          }
        });

        function gridWidthForPPR(ppr) {
          if (ppr >= 4) return '100%';
          if (ppr === 3) return '50%';
          if (ppr === 2) return '25%';
          return (100 / 6).toFixed(4) + '%';
        }
        grid.style.width = gridWidthForPPR(pillsPerRow);
        if (!checkOverflow) return pillsPerRow;

        function hasAnyOverflow() {
          let overflow = false;
          grid.querySelectorAll('.genre-btn').forEach(btn => {
            if (btn.style.display === 'none') return;
            if (btn.scrollWidth > btn.clientWidth + 1) overflow = true;
          });
          return overflow;
        }

        let currentRows = rows;
        let currentFs   = fontSize;

        function applyRows(r) {
          const ppr = Math.ceil(visibleCount / r);
          const bp  = (100 / ppr).toFixed(4) + '%';
          const lastCount = visibleCount % ppr || ppr;
          const lastBp    = (100 / lastCount).toFixed(4) + '%';
          grid.style.setProperty('--genre-rows', r);
          grid.style.setProperty('--genre-row-h', baseRowH + 'px');
          grid.style.width = gridWidthForPPR(ppr);
          let vi = 0;
          allBtns.forEach(btn => {
            if (btn.style.display === 'none') {
              btn.style.flexBasis = '0';
            } else {
              const isLast = vi >= visibleCount - lastCount;
              btn.style.flexBasis = isLast ? lastBp : bp;
              vi++;
            }
          });
        }

        function checkStep() {
          if (myToken !== _genrePillAdjToken) return;
          if (!hasAnyOverflow()) return;

          if (currentRows < maxRows) {
            currentRows = Math.min(currentRows + 1, maxRows);
            applyRows(currentRows);
            requestAnimationFrame(() => requestAnimationFrame(checkStep));
          } else if (currentFs > 9) {
            currentFs = Math.max(9, currentFs - 1);
            grid.style.setProperty('--genre-pill-fs', currentFs + 'px');
            requestAnimationFrame(() => requestAnimationFrame(checkStep));
          }
        }

        requestAnimationFrame(() => requestAnimationFrame(checkStep));
        return pillsPerRow;
      }

      const emojisOn = document.body.classList.contains('show-genre-emojis');
      const containerW = grid.parentElement ? grid.parentElement.offsetWidth : 600;

      // Determine the ideal number of rows starting from 3 and expanding as
      // needed so that every pill is at least minPillW pixels wide.
      // MobyGames labels are often much longer than Backloggd genre names, so
      // the minimum aims for comfortable wrapping instead of one-line fitting.
      const minPillW = emojisOn ? 148 : 132;
      const maxRows  = 8;
      let rows = 3;        // always start at 3 rows

      // Keep increasing rows until every pill is at least minPillW wide, or
      // we hit the maximum. This is the "shrink -> more rows" behaviour.
      while (rows < maxRows) {
        const pillsPerRowAtRows = Math.ceil(visibleCount / rows);
        if (containerW / pillsPerRowAtRows >= minPillW) break;
        rows++;
      }

      const pillsPerRow = Math.ceil(visibleCount / rows);

      // No global max-width cap. Instead, last-row pills get their own flex-basis
      // so they naturally expand to fill the full container width.

      // Scale font size down slightly on narrow containers. Wrapping handles
      // long labels; this only keeps dense mobile layouts from feeling cramped.
      const pillW = containerW / pillsPerRow;
      const comfortW = emojisOn ? 170 : 150;
      const minFontPx = 11;
      const maxFontPx = 13;
      let fontSize;
      if (pillW >= comfortW) {
        fontSize = maxFontPx;
      } else {
        // Linearly interpolate between minFontPx and maxFontPx
        const t = Math.max(0, Math.min(1, (pillW - minPillW) / (comfortW - minPillW)));
        fontSize = Math.round(minFontPx + t * (maxFontPx - minFontPx));
      }

      // Set CSS vars for row planning and font size. Row height remains auto
      // so wrapped labels expand the pill instead of being clipped.
      grid.style.setProperty('--genre-rows', rows);
      grid.style.setProperty('--genre-row-h', 'auto');
      grid.style.setProperty('--genre-pill-fs', fontSize + 'px');

      // Set flex-basis on each visible pill so they fill the row.
      // Last-row pills get a wider basis (100% / lastRowCount) so they expand
      // to fill the full container width, keeping the rectangle shape.
      const lastRowCount = visibleCount % pillsPerRow || pillsPerRow;
      const basisPct     = (100 / pillsPerRow).toFixed(4) + '%';
      const lastBasisPct = (100 / lastRowCount).toFixed(4) + '%';
      const allBtns = grid.querySelectorAll('.genre-btn');
      let visibleIndex = 0;
      allBtns.forEach(btn => {
        if (btn.style.display === 'none') {
          btn.style.flexBasis = '0';
        } else {
          const isLastRow = visibleIndex >= visibleCount - lastRowCount;
          btn.style.flexBasis = isLastRow ? lastBasisPct : basisPct;
          visibleIndex++;
        }
      });

      // Constrain the grid width only when there are a few pills visible, but
      // keep enough room for long labels to wrap with a separated count badge.
      //   4+ pills/row -> 100% (full width, default appearance)
      //   3  pills/row -> 72%
      //   2  pills/row -> 58%
      //   1  pill /row -> 42%
      // Last-row pills still expand to fill the (now narrower) grid, so the
      // overall pill block retains its rectangle shape.
      function gridWidthForPPR(ppr) {
        if (ppr >= 4) return '100%';
        if (ppr === 3) return '72%';
        if (ppr === 2) return '58%';
        return '42%';
      }
      grid.style.width = gridWidthForPPR(pillsPerRow);
      if (!checkOverflow) return pillsPerRow;

      // -- Post-layout overflow check ---
      // Wrapped text should fit naturally. This catches pathological cases
      // such as very long unbroken scraped labels and gives them more width or
      // a slightly smaller font.
      function hasAnyOverflow() {
        let overflow = false;
        grid.querySelectorAll('.genre-btn').forEach(btn => {
          if (btn.style.display === 'none') return;
          const label = btn.querySelector('.genre-name');
          const count = btn.querySelector('.genre-count');
          if (btn.scrollWidth > btn.clientWidth + 1) overflow = true;
          if (label && label.scrollWidth > label.clientWidth + 1) overflow = true;
          if (count && count.scrollWidth > count.clientWidth + 1) overflow = true;
        });
        return overflow;
      }

      // Mutable state shared across the rAF chain
      let currentRows = rows;
      let currentFs   = fontSize;

      function applyRows(r) {
        const ppr = Math.ceil(visibleCount / r);
        const bp  = (100 / ppr).toFixed(4) + '%';
        const lastCount = visibleCount % ppr || ppr;
        const lastBp    = (100 / lastCount).toFixed(4) + '%';
        grid.style.setProperty('--genre-rows', r);
        grid.style.setProperty('--genre-row-h', 'auto');
        // Keep grid width consistent with the pillsPerRow-based cap.
        grid.style.width = gridWidthForPPR(ppr);
        let vi = 0;
        allBtns.forEach(btn => {
          if (btn.style.display === 'none') {
            btn.style.flexBasis = '0';
          } else {
            const isLast = vi >= visibleCount - lastCount;
            btn.style.flexBasis = isLast ? lastBp : bp;
            vi++;
          }
        });
      }

      function checkStep() {
        // Bail out if a newer call to updateGenrePillRows has superseded us
        if (myToken !== _genrePillAdjToken) return;
        if (!hasAnyOverflow()) return; // all clear

        if (currentRows < maxRows) {
          // Remedy 1: widen pills by using one more row
          currentRows = Math.min(currentRows + 1, maxRows);
          applyRows(currentRows);
          requestAnimationFrame(() => requestAnimationFrame(checkStep));
        } else if (currentFs > 9) {
          // Remedy 2: shrink label font by 1 px
          currentFs = Math.max(9, currentFs - 1);
          grid.style.setProperty('--genre-pill-fs', currentFs + 'px');
          requestAnimationFrame(() => requestAnimationFrame(checkStep));
        }
        // else: nothing more we can do - accept best-effort layout
      }

      requestAnimationFrame(() => requestAnimationFrame(checkStep));
      return pillsPerRow;
    }

    // -- State ---
    let sortKey = 'title';
    let sortDir = 'asc';
    let statusFilter = 'all';
    let playTypeFilter = null;  // null = no play_type filter active
    let aggregateSourceFilter = null; // array of configured status-pill ids
    let activeGenres = new Set();
    let matchAll = true;   // AND mode by default
    let query = '';
    let dateFilter = { year: null, month: null, day: null };
    let activePlatforms = new Set();  // supports multiple platform filters
    let platformMatchAll = false;  // false = OR (any), true = AND (all)
    let genreCountMap = new Map(); // genre slug -> count used for MobyGames pill badges
    let platformCountMap = new Map(); // platform label -> count used for pill badges (context-dependent, see render())
    // Static total counts across the entire exported dataset - computed once, never changes.
    // Used for platform pill badges when "Show All" is active and "Match Selected" is OFF,
    // so selecting pills doesn't cause other counters to recalculate.
    const platformTotalCountMap = new Map();
    payload.items.forEach(item => {
      (item.platforms || []).forEach(p => {
        platformTotalCountMap.set(p, (platformTotalCountMap.get(p) || 0) + 1);
      });
    });
    const exportedPlatformLabels = [...platformTotalCountMap.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const allKnownPlatformLabels = (IS_MOBYGAMES_SOURCE_VIEWER
      ? [...new Set(ALL_KNOWN_PLATFORM_LABELS)]
      : IS_HLTB_VIEWER
        ? [...new Set(exportedPlatformLabels)]
      : [...new Set([...ALL_KNOWN_PLATFORM_LABELS, ...exportedPlatformLabels])])
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    let platformShowingAll = false;    // true while "Show All" pill grid is open
    let platformShowingEmpty = false;  // true while "Empty Platforms" pill grid is open
    const mobyGenreLabelBySlug = new Map();
    const exportedMobyGenreLabels = [...new Set(payload.items.flatMap(item => item.genres || []))]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const allKnownMobyGenreLabels = [...new Set(IS_HLTB_VIEWER ? exportedMobyGenreLabels : [...MOBYGAMES_GENRE_LABELS, ...exportedMobyGenreLabels])]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    allKnownMobyGenreLabels.forEach(label => mobyGenreLabelBySlug.set(genreSlug(label), label));
    let genreShowingAll = false;    // true while MobyGames "Show All" genre pill grid is open
    let genreShowingEmpty = false;  // true while MobyGames "Empty Genres" pill grid is open
    let statusFilterCounterMode = true;

    // -- localStorage helpers ---
    function lsGet(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
    }
    function lsSet(key, val) {
      try { localStorage.setItem(key, val); } catch (e) {}
    }

    // -- Normalisation ---
    function normalizeTitle(value) {
      return String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase();
    }
    function genreSlug(label) {
      return label.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    }

    // -- Date parsing ---
    const parseDateParts = ${parseDateParts.toString()};
    const toSortableDate = ${toSortableDate.toString()};
    function releaseYearFallback(releaseDate) {
      const m = String(releaseDate || '').match(/\\b(19|20)\\d{2}\\b/);
      return m ? Number(m[0]) : null;
    }
    function dateMatchesFilter(releaseDate, f) {
      if (!f.year && !f.month && !f.day) return true;
      const parts = parseDateParts(releaseDate);
      if (!parts) {
        if (f.year && !f.month && !f.day) return releaseYearFallback(releaseDate) === f.year;
        return false;
      }
      if (f.year && parts.year !== f.year) {
        if (!(f.month || f.day) && releaseYearFallback(releaseDate) === f.year) return true;
        return false;
      }
      if (f.month && parts.month !== f.month) return false;
      if (f.day   && parts.day   !== f.day)   return false;
      return true;
    }

    // -- Item prep ---
    const items = payload.items.map(item => {
      const statusesList = Array.isArray(item.statuses) && item.statuses.length ? item.statuses : [item.status];
      const platformList = item.platforms || [];
      return {
        ...item,
        statusesList,
        platformSet: new Set(platformList),
        sortedPlatforms: [...platformList].sort((a, b) => a.localeCompare(b)),
        titleKey: normalizeTitle(item.title),
        releaseSort: toSortableDate(item.release_date),
        ratingSort: item.average_rating == null ? null : Number(item.average_rating),
        userRatingSort: item.user_rating == null ? null : Number(item.user_rating),
        statusSort: STATUS_PRIORITY[item.status] ?? 99,
        genreSlugSet: new Set((item.genres || []).map(g => genreSlug(g))),
      };
    });

    // -- Sorting ---
    function compare(a, b) {
      let left = a.titleKey, right = b.titleKey;
      if (sortKey === 'release_date') { left = a.releaseSort; right = b.releaseSort; }
      else if (sortKey === 'status') { left = a.statusSort; right = b.statusSort; }
      else if (sortKey === 'average_rating') {
        if (a.ratingSort == null && b.ratingSort == null) return a.titleKey.localeCompare(b.titleKey, undefined, { sensitivity: 'base', numeric: true });
        if (a.ratingSort == null) return 1; if (b.ratingSort == null) return -1;
        left = a.ratingSort; right = b.ratingSort;
      } else if (sortKey === 'user_rating') {
        if (a.userRatingSort == null && b.userRatingSort == null) return a.titleKey.localeCompare(b.titleKey, undefined, { sensitivity: 'base', numeric: true });
        if (a.userRatingSort == null) return 1; if (b.userRatingSort == null) return -1;
        left = a.userRatingSort; right = b.userRatingSort;
      }
      if (left < right) return sortDir === 'asc' ? -1 : 1;
      if (left > right) return sortDir === 'asc' ? 1 : -1;
      return a.titleKey.localeCompare(b.titleKey, undefined, { sensitivity: 'base', numeric: true });
    }

    function setSort(key) {
      if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortKey = key; sortDir = (key === 'release_date' || key === 'average_rating' || key === 'user_rating') ? 'desc' : 'asc'; }
      thSorts.forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        const arrow = th.querySelector('.sort-arrow');
        if (th.dataset.sort === sortKey) {
          th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
          if (arrow) arrow.textContent = sortDir === 'asc' ? '\u2191' : '\u2193';
        } else {
          if (arrow) arrow.textContent = '\u21c5';
        }
      });
      lsSet('bgdSortKey', sortKey);
      lsSet('bgdSortDir', sortDir);
      scheduleRender();
    }

    // -- Genre filter helpers ---
    function genreSearchQuery() {
      return genreSearchInput ? normalizeTitle(genreSearchInput.value.trim()) : '';
    }

    function currentGenreButtons() {
      return [...document.querySelectorAll('.genre-btn')];
    }

    function genreButtonMatchesSearch(btn, q = genreSearchQuery()) {
      if (!q) return true;
      const label = btn.dataset.genreLabel || btn.textContent || '';
      return normalizeTitle(label).includes(q);
    }

    function genreLabelForSlug(slug) {
      const btn = currentGenreButtons().find(entry => entry.dataset.genre === slug);
      if (IS_MOBYGAMES_VIEWER && mobyGenreLabelBySlug.has(slug)) return mobyGenreLabelBySlug.get(slug);
      return (btn && btn.dataset.genreLabel) || slug;
    }

    function syncGenreShowAllState() {
      if (!genreShowAllBtn) return;
      genreShowAllBtn.classList.toggle('active', genreShowingAll);
      const dot = genreShowAllBtn.querySelector('.filter-vis-dot');
      if (dot) {
        dot.style.borderColor = '';
        dot.style.background = '';
      }
    }

    function syncGenreShowEmptyState() {
      if (!genreShowEmptyBtn) return;
      genreShowEmptyBtn.classList.toggle('active', genreShowingEmpty);
      const dot = genreShowEmptyBtn.querySelector('.filter-vis-dot');
      if (dot) {
        dot.style.borderColor = '';
        dot.style.background = '';
      }
    }

    function makeMobyGenreButton(label, flexBasis) {
      const slug = genreSlug(label);
      const count = genreCountMap.get(slug) || 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'genre-btn platform-result-btn' + (activeGenres.has(slug) ? ' active' : '');
      btn.style.flexBasis = flexBasis;
      btn.dataset.genre = slug;
      btn.dataset.genreLabel = label;
      btn.dataset.pcount = count;
      btn.dataset.genreBaseVisible = count > 0 ? '1' : '0';
      const check = document.createElement('span');
      check.className = 'platform-result-check';
      check.textContent = activeGenres.has(slug) ? '\u2713' : '\u25cb';
      btn.appendChild(check);
      btn.appendChild(document.createTextNode(label));
      const countBadge = document.createElement('span');
      countBadge.className = 'platform-result-count genre-count';
      countBadge.textContent = count;
      btn.appendChild(countBadge);
      btn.addEventListener('click', () => {
        if ((genreCountMap.get(slug) || 0) === 0) return;
        setGenreFilter(slug, !activeGenres.has(slug));
      });
      return btn;
    }

    function syncMobyGenreDisplayedCounter(count) {
      if (!IS_MOBYGAMES_VIEWER || !genresDisplayedNum) return;
      genresDisplayedNum.textContent = count;
    }

    function getMobyGenreModeLabels() {
      const q = genreSearchQuery();
      if (q) return allKnownMobyGenreLabels.filter(label => normalizeTitle(label).includes(q));
      if (genreShowingEmpty && !IS_HLTB_VIEWER) return allKnownMobyGenreLabels.filter(label => (genreCountMap.get(genreSlug(label)) || 0) === 0);
      return allKnownMobyGenreLabels.filter(label => (genreCountMap.get(genreSlug(label)) || 0) > 0);
    }

    function renderPillGridInto(container, labels, makeButton) {
      const n = labels.length;
      const { cols } = computePillGridLayout(n);
      const basisPct = (100 / cols).toFixed(4) + '%';
      const lastRowCount = n % cols || cols;
      const lastBasisPct = (100 / lastRowCount).toFixed(4) + '%';
      const widthPct = pillGridWidthPct(cols);
      container.style.width = widthPct === 100 ? '' : widthPct.toFixed(4) + '%';
      labels.forEach((label, i) => {
        const flexBasis = i >= n - lastRowCount ? lastBasisPct : basisPct;
        container.appendChild(makeButton(label, flexBasis));
      });
    }

    function renderMobyGenrePillGrid(labels) {
      const grid = document.getElementById('genreSinglePill');
      if (!grid) return;
      grid.innerHTML = '';
      if (!labels.length) {
        grid.classList.remove('platform-search-results', 'visible');
        grid.style.width = '';
        return;
      }
      grid.classList.add('platform-search-results', 'visible');
      renderPillGridInto(grid, labels, makeMobyGenreButton);
    }

    function renderMobyGenreModePills() {
      if (!IS_MOBYGAMES_VIEWER) return false;
      const availableLabels = getMobyGenreModeLabels();
      const renderedLabels = (!genreSearchQuery() && !genreShowingAll && !genreShowingEmpty) ? [] : availableLabels;
      renderMobyGenrePillGrid(renderedLabels);
      syncMobyGenreDisplayedCounter(availableLabels.length);
      return true;
    }

    function syncGenreSearchResults() {
      if (!genreSearchInput) return;
      if (IS_MOBYGAMES_VIEWER && renderMobyGenreModePills()) {
        if (genreSearchClear) genreSearchClear.style.display = genreSearchQuery() ? '' : 'none';
        return;
      }
      const q = genreSearchQuery();
      if (genreSearchClear) genreSearchClear.style.display = q ? '' : 'none';
      let visibleCount = 0;
      currentGenreButtons().forEach(btn => {
        const baseVisible = btn.dataset.genreBaseVisible !== '0';
        const matches = genreButtonMatchesSearch(btn, q) && (q ? true : baseVisible);
        btn.style.display = matches ? '' : 'none';
        btn.style.flexBasis = matches ? '' : '0';
        if (matches) visibleCount++;
      });
      updateGenrePillRows(document.getElementById('genreSinglePill'), visibleCount);
    }

    function syncGenreUI() {
      currentGenreButtons().forEach(btn => {
        const active = activeGenres.has(btn.dataset.genre);
        btn.classList.toggle('active', active);
        const check = btn.querySelector('.platform-result-check');
        if (check) check.textContent = active ? '\u2713' : '\u25cb';
      });
      document.querySelectorAll('.genre-tag').forEach(tag => tag.classList.toggle('active', activeGenres.has(tag.dataset.genre)));
      if (genreMatchBtn) genreMatchBtn.classList.toggle('active', matchAll);
      if (IS_MOBYGAMES_VIEWER) {
        syncGenreShowAllState();
        syncGenreShowEmptyState();
      }
      if (genreFilterBar) {
        genreFilterBar.classList.toggle('visible', activeGenres.size > 0);
        if (genreFilterPills && activeGenres.size > 0) {
          genreFilterPills.innerHTML = '';
          [...activeGenres].sort((a, b) => genreLabelForSlug(a).localeCompare(genreLabelForSlug(b), undefined, { sensitivity: 'base' })).forEach(g => {
            const pill = document.createElement('span');
            pill.className = 'platform-filter-pill active';
            pill.textContent = genreLabelForSlug(g);
            pill.addEventListener('click', () => { activeGenres.delete(g); syncGenreUI(); syncGenreSearchResults(); scheduleRender(); });
            genreFilterPills.appendChild(pill);
          });
        } else if (genreFilterPills) {
          genreFilterPills.innerHTML = '';
        }
      }
    }

    function setGenreFilter(slug, on) {
      if (IS_MOBYGAMES_VIEWER && on && (genreCountMap.get(slug) || 0) === 0) return;
      if (on) activeGenres.add(slug); else activeGenres.delete(slug);
      syncGenreUI();
      syncGenreSearchResults();
      scheduleRender();
    }

    function clearGenres() {
      activeGenres.clear();
      syncGenreUI();
      syncGenreSearchResults();
      scheduleRender();
    }

    // -- Platform filter helpers ---
    function syncPlatformUI() {
      document.querySelectorAll('.platform-chip').forEach(chip => {
        chip.classList.toggle('active', activePlatforms.has(chip.dataset.platform));
      });
      if (platformFilterBar) {
        platformFilterBar.classList.toggle('visible', activePlatforms.size > 0);
        if (platformFilterPills && activePlatforms.size > 0) {
          platformFilterPills.innerHTML = '';
          [...activePlatforms].sort().forEach(p => {
            const pill = document.createElement('span');
            pill.className = 'platform-filter-pill' + (activePlatforms.has(p) ? ' active' : '');
            pill.textContent = p;
            pill.addEventListener('click', () => { activePlatforms.delete(p); syncPlatformUI(); scheduleRender(); if (platformShowingAll) renderAllPlatformPills(); else if (platformShowingEmpty) renderEmptyPlatformPills(); else syncPlatformSearchResults(); });
            platformFilterPills.appendChild(pill);
          });
        } else if (platformFilterPills) {
          platformFilterPills.innerHTML = '';
        }
      }
      // Sync search results checkmarks
      syncPlatformSearchResults();
      // Sync match button
      if (platformMatchAllBtn) platformMatchAllBtn.classList.toggle('active', platformMatchAll);
    }

    // Update count badges on already-rendered platform result buttons
    function updatePlatformPillCounts() {
      if (!platformSearchResults) return;
      // When Show All or Show Empty is active, fully re-render the pill grid so that
      // pills whose counters have dropped to 0 are removed (not left visible with a 0
      // badge). This covers all filter types: Genre, Status, Played Sub Status, or any
      // combination. The search-query exception is handled inside each render function:
      // matching pills remain visible even at count 0.
      if (platformShowingAll) { renderAllPlatformPills(); return; }
      if (platformShowingEmpty) { renderEmptyPlatformPills(); return; }
      // For the search-results view, patch counts in place (no visibility change needed
      // here - the search bar exception is already built into syncPlatformSearchResults).
      platformSearchResults.querySelectorAll('.platform-result-btn').forEach(btn => {
        const p = btn.dataset.platformLabel;
        if (!p) return;
        const count = platformCountMap.get(p) || 0;
        btn.dataset.pcount = count;
        const countEl = btn.querySelector('.platform-result-count');
        if (countEl) countEl.textContent = count;
      });
    }

    // -- Platform pill button factory ---
    // Creates a single .platform-result-btn element with check-mark, label,
    // count badge, and click handler.  onAfterToggle() is called after the
    // active-set is updated so each caller can re-render its own pill grid.
    function makePlatformButton(p, flexBasis, onAfterToggle) {
      const count = platformCountMap.get(p) || 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'platform-result-btn' + (activePlatforms.has(p) ? ' active' : '');
      btn.style.flexBasis = flexBasis;
      btn.dataset.platformLabel = p;
      btn.dataset.pcount = count;
      const check = document.createElement('span');
      check.className = 'platform-result-check';
      check.textContent = activePlatforms.has(p) ? '\u2713' : '\u25cb';
      btn.appendChild(check);
      btn.appendChild(document.createTextNode(p));
      const countBadge = document.createElement('span');
      countBadge.className = 'platform-result-count';
      countBadge.textContent = count;
      btn.appendChild(countBadge);
      btn.addEventListener('click', () => {
        if ((platformCountMap.get(p) || 0) === 0) return;
        if (activePlatforms.has(p)) activePlatforms.delete(p);
        else activePlatforms.add(p);
        syncPlatformUI();
        scheduleRender();
        if (onAfterToggle) onAfterToggle();
      });
      return btn;
    }

    function computePillGridLayout(n) {
      if (n < 5) return { rows: 1, cols: n };
      if (n <= 10) return { rows: 2, cols: Math.ceil(n / 2) };
      if (n <= 15) return { rows: 3, cols: Math.ceil(n / 3) };
      if (n <= 20) return { rows: 4, cols: Math.ceil(n / 4) };
      const rows = Math.ceil(Math.sqrt(n * 0.6));
      return { rows, cols: Math.ceil(n / rows) };
    }

    function pillGridWidthPct(cols) {
      if (cols === 3) return 50;
      if (cols === 2) return 25;
      if (cols === 1) return 100 / 6;
      return 100;
    }

    function renderPlatformPillGrid(labels, onAfterToggle) {
      renderPillGridInto(platformSearchResults, labels, (p, flexBasis) => makePlatformButton(p, flexBasis, onAfterToggle));
    }

    // Build/update the search results grid based on current input
    function syncPlatformSearchResults() {
      if (platformShowingAll) { renderAllPlatformPills(); return; }
      if (platformShowingEmpty) { renderEmptyPlatformPills(); return; }
      if (!platformSearchResults || !platformSearchInput) return;
      const q = platformSearchInput.value.trim().toLowerCase();
      if (q.length < 1) {
        platformSearchResults.classList.remove('visible');
        platformSearchResults.innerHTML = '';
        platformSearchResults.style.width = '';
        return;
      }
      // When a search query is active, search across ALL known platform labels
      // (including those with zero exported games) so users can discover every
      // platform that was scanned, even if no games were exported for it.
      const matches = allKnownPlatformLabels.filter(p => p.toLowerCase().includes(q));
      if (matches.length === 0) {
        platformSearchResults.classList.remove('visible');
        platformSearchResults.innerHTML = '';
        platformSearchResults.style.width = '';
        return;
      }
      platformSearchResults.classList.add('visible');
      platformSearchResults.innerHTML = '';

      renderPlatformPillGrid(matches, null);
    }

    function setPlatformFilter(platform) {
      if ((platformCountMap.get(platform) || 0) === 0) return;
      if (activePlatforms.has(platform)) activePlatforms.delete(platform);
      else activePlatforms.add(platform);
      syncPlatformUI();
      scheduleRender();
    }

    // -- Build a genre tag element ---
    function syncStatusControls() {
      const activeStatus = playTypeFilter === null ? statusFilter : 'played';
      statButtons.forEach(b => b.classList.toggle('active', b.dataset.statusFilter === activeStatus));
      playTypeButtons.forEach(b => b.classList.toggle('active', b.dataset.playType === playTypeFilter));
      document.querySelectorAll('[data-aggregate-sources]').forEach(btn => {
        const ids = String(btn.dataset.aggregateSources || '').split(',').filter(Boolean);
        btn.classList.toggle('active', !!aggregateSourceFilter && ids.join('|') === aggregateSourceFilter.join('|'));
      });
      document.querySelectorAll('[data-config-status-id]').forEach(btn => {
        btn.classList.toggle('active', !!aggregateSourceFilter && aggregateSourceFilter.length === 1 && aggregateSourceFilter[0] === btn.dataset.configStatusId);
      });
    }

    function clearPlayedAndQueueHighlights() {
      if (playedTotalBtn) playedTotalBtn.classList.remove('active');
      if (queueTotalBtn) queueTotalBtn.classList.remove('queue-active');
    }

    function clearNonStatusFilters() {
      activeGenres.clear();
      syncGenreUI();
      if (genreSearchInput) genreSearchInput.value = '';
      if (genreSearchClear) genreSearchClear.style.display = 'none';
      syncGenreSearchResults();
      activePlatforms.clear();
      syncPlatformUI();
      if (platformSearchInput) platformSearchInput.value = '';
      if (platformSearchClear) platformSearchClear.style.display = 'none';
      syncPlatformSearchResults();
      clearDateFilter({ render: false });
      if (search) search.value = '';
      query = '';
      if (searchClearBtn) searchClearBtn.classList.remove('visible');
    }

    function setPlayTypeFilter(pt, { toggle = false, clearOtherFilters = false } = {}) {
      if (clearOtherFilters) clearNonStatusFilters();
      aggregateSourceFilter = null;
      playTypeFilter = toggle && playTypeFilter === pt ? null : pt;
      statusFilter = playTypeFilter === null ? 'all' : 'played';
      clearPlayedAndQueueHighlights();
      syncStatusControls();
      scheduleRender();
    }

    function setStatusFilter(nextStatus, { toggle = false, resetTagsOnAll = false, clearOtherFilters = false } = {}) {
      if (clearOtherFilters) clearNonStatusFilters();
      aggregateSourceFilter = null;
      statusFilter = toggle && statusFilter === nextStatus && playTypeFilter === null ? 'all' : nextStatus;
      if (statusFilter !== 'played') playTypeFilter = null;
      clearPlayedAndQueueHighlights();
      syncStatusControls();
      if (statusFilter === 'all' && resetTagsOnAll) {
        clearNonStatusFilters();
      }
      scheduleRender();
    }

    function setPlayedTotalFilter() {
      if (!statusFilterCounterMode) clearNonStatusFilters();
      aggregateSourceFilter = null;
      statusFilter = 'played';
      playTypeFilter = null;
      syncStatusControls();
      if (queueTotalBtn) queueTotalBtn.classList.remove('queue-active');
      if (playedTotalBtn) playedTotalBtn.classList.add('active');
      scheduleRender();
    }

    function setQueueFilter() {
      if (!statusFilterCounterMode) clearNonStatusFilters();
      aggregateSourceFilter = null;
      statusFilter = 'queue';
      playTypeFilter = null;
      statButtons.forEach(b => b.classList.remove('active'));
      playTypeButtons.forEach(b => b.classList.remove('active'));
      if (playedTotalBtn) playedTotalBtn.classList.remove('active');
      if (queueTotalBtn) queueTotalBtn.classList.add('queue-active');
      scheduleRender();
    }

    function setAggregateSourceFilter(sourceIds) {
      if (!statusFilterCounterMode) clearNonStatusFilters();
      aggregateSourceFilter = Array.isArray(sourceIds) && sourceIds.length ? sourceIds : null;
      statusFilter = 'all';
      playTypeFilter = null;
      statButtons.forEach(b => b.classList.remove('active'));
      playTypeButtons.forEach(b => b.classList.remove('active'));
      if (playedTotalBtn) playedTotalBtn.classList.remove('active');
      if (queueTotalBtn) queueTotalBtn.classList.remove('queue-active');
      document.querySelectorAll('[data-aggregate-sources]').forEach(btn => {
        const ids = String(btn.dataset.aggregateSources || '').split(',').filter(Boolean);
        btn.classList.toggle('active', !!aggregateSourceFilter && ids.join('|') === aggregateSourceFilter.join('|'));
      });
      document.querySelectorAll('[data-config-status-id]').forEach(btn => {
        btn.classList.toggle('active', !!aggregateSourceFilter && aggregateSourceFilter.length === 1 && aggregateSourceFilter[0] === btn.dataset.configStatusId);
      });
      scheduleRender();
    }

    function handleTableAction(target) {
      const genreTag = target.closest('.genre-tag');
      if (genreTag) {
        setGenreFilter(genreTag.dataset.genre, !activeGenres.has(genreTag.dataset.genre));
        return true;
      }
      const platformChip = target.closest('.platform-chip');
      if (platformChip) {
        setPlatformFilter(platformChip.dataset.platform);
        return true;
      }
      const playTypePill = target.closest('[data-row-play-type]');
      if (playTypePill) {
        setPlayTypeFilter(playTypePill.dataset.rowPlayType, { toggle: true, clearOtherFilters: !statusFilterCounterMode });
        return true;
      }
      const statusPill = target.closest('[data-row-status]');
      if (statusPill) {
        setStatusFilter(statusPill.dataset.rowStatus, { toggle: true, clearOtherFilters: !statusFilterCounterMode });
        return true;
      }
      const gameCell = target.closest('.game-col');
      if (gameCell && gameCell.dataset.url) {
        window.open(gameCell.dataset.url, '_blank', 'noopener');
        return true;
      }
      return false;
    }

    rowsTbody.addEventListener('click', e => {
      if (handleTableAction(e.target)) e.stopPropagation();
    });

    rowsTbody.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const gameCell = ev.target.closest('.game-col');
      if (!gameCell || !gameCell.dataset.url) return;
      ev.preventDefault();
      window.open(gameCell.dataset.url, '_blank', 'noopener');
    });
    function makeTag(g) {
      const slug = genreSlug(g);
      const tag = document.createElement('span');
      tag.className = 'genre-tag' + (activeGenres.has(slug) ? ' active' : '');
      tag.dataset.genre = slug;
      // emoji span (hidden/shown by body class)
      const emojiSpan = document.createElement('span');
      emojiSpan.className = 'genre-emoji';
      emojiSpan.textContent = (GENRE_EMOJIS[g] || '') + ' ';
      tag.appendChild(emojiSpan);
      tag.appendChild(document.createTextNode(g));
      return tag;
    }

    function itemStatuses(item) {
      return item.statusesList || item.statuses || [item.status];
    }

    function configuredStatusPillById(id) {
      if (!STATUS_PILL_CONFIG || !Array.isArray(STATUS_PILL_CONFIG.categories)) return null;
      for (const category of STATUS_PILL_CONFIG.categories) {
        for (const pill of (category.pills || [])) {
          if (pill.kind === 'status' && pill.id === id) return pill;
        }
      }
      return null;
    }

    function itemMatchesConfiguredStatusPill(item, id) {
      const pill = configuredStatusPillById(id);
      if (!pill) return false;
      if (itemStatusIds(item).includes(id)) return true;
      if (!pill.source) return false;
      const statuses = itemStatuses(item);
      if (pill.source.type === 'play_type') {
        return statuses.includes('played') && (item.play_type || null) === pill.source.value;
      }
      if (pill.source.type === 'status') return statuses.includes(pill.source.value);
      return false;
    }

    function matchesStatusFilter(item) {
      if (aggregateSourceFilter && aggregateSourceFilter.length) {
        return aggregateSourceFilter.some(id => itemMatchesConfiguredStatusPill(item, id));
      }
      const statuses = itemStatuses(item);
      if (statusFilter === 'queue') return ['playing','backlog','wishlist'].some(s => statuses.includes(s));
      return statusFilter === 'all' || statuses.includes(statusFilter);
    }

    function matchesPlayTypeFilter(item) {
      if (playTypeFilter === null) return true;
      const statuses = itemStatuses(item);
      return statuses.includes('played') && (item.play_type || null) === playTypeFilter;
    }

    function matchesSearchAndDate(item) {
      if (query && !item.titleKey.includes(query)) return false;
      return dateMatchesFilter(item.release_date, dateFilter);
    }

    function matchesPlatformFilter(item) {
      if (activePlatforms.size === 0) return true;
      const itemPlatformSet = item.platformSet || new Set(item.platforms || []);
      if (platformMatchAll) {
        for (const p of activePlatforms) {
          if (!itemPlatformSet.has(p)) return false;
        }
        return true;
      }
      for (const p of activePlatforms) {
        if (itemPlatformSet.has(p)) return true;
      }
      return false;
    }

    function matchesGenreFilter(item) {
      if (activeGenres.size === 0) return true;
      const itemGenreSlugs = item.genreSlugSet || new Set((item.genres || []).map(g => genreSlug(g)));
      if (matchAll) {
        for (const g of activeGenres) {
          if (!itemGenreSlugs.has(g)) return false;
        }
        return true;
      }
      for (const g of activeGenres) {
        if (itemGenreSlugs.has(g)) return true;
      }
      return false;
    }

    function matchesCoreFilters(item, { includeGenres = false, includePlatforms = true } = {}) {
      if (!matchesStatusFilter(item)) return false;
      if (!matchesPlayTypeFilter(item)) return false;
      if (!matchesSearchAndDate(item)) return false;
      if (includeGenres && !matchesGenreFilter(item)) return false;
      if (includePlatforms && !matchesPlatformFilter(item)) return false;
      return true;
    }

    function itemStatusIds(item) {
      const sourceMeta = item.source_meta && typeof item.source_meta === 'object' ? item.source_meta : {};
      const raw = Array.isArray(item.statusIds) && item.statusIds.length
        ? item.statusIds
        : Array.isArray(item.status_ids) && item.status_ids.length
          ? item.status_ids
          : Array.isArray(sourceMeta.status_ids) && sourceMeta.status_ids.length
            ? sourceMeta.status_ids
          : item.statusId || item.status_id
            ? [item.statusId || item.status_id]
            : [];
      return [...new Set(raw.map(id => String(id || '').trim()).filter(Boolean))];
    }

    function countStatusIdsInPool(pool) {
      const counts = {};
      for (const item of pool) {
        itemStatusIds(item).forEach(id => {
          counts[id] = (counts[id] || 0) + 1;
        });
      }
      return counts;
    }

    function countForConfiguredPillId(id, statusCounts, playTypeCounts, statusIdCounts = {}) {
      const pill = configuredStatusPillById(id);
      if (!pill) return 0;
      if (statusIdCounts[id]) return statusIdCounts[id] || 0;
      if (!pill.source) return 0;
      if (pill.source.type === 'play_type') return playTypeCounts[pill.source.value] || 0;
      if (pill.source.type === 'status') return statusCounts[pill.source.value] || 0;
      return 0;
    }

    function updateConfiguredAggregateCounters(statusCounts, playTypeCounts, statusIdCounts = {}) {
      document.querySelectorAll('[data-aggregate-sources]').forEach(btn => {
        const ids = String(btn.dataset.aggregateSources || '').split(',').filter(Boolean);
        const total = ids.reduce((sum, id) => sum + countForConfiguredPillId(id, statusCounts, playTypeCounts, statusIdCounts), 0);
        const totalEl = btn.querySelector('.sub-pill-total');
        if (totalEl) totalEl.textContent = total;
      });
    }

    function updateConfiguredStatusCounters(statusIdCounts = {}) {
      document.querySelectorAll('[data-config-status-id]').forEach(btn => {
        const subNum = btn.querySelector('.sub-num');
        if (subNum) subNum.textContent = statusIdCounts[btn.dataset.configStatusId] || 0;
      });
    }

    function applyMobyGamesCoverOrientation(coverEl, orientation) {
      if (!IS_MOBYGAMES_VIEWER || !coverEl) return;
      const normalized = String(orientation || '').toLowerCase();
      coverEl.classList.remove('cover-landscape', 'cover-portrait');
      coverEl.classList.add(normalized === 'landscape' ? 'cover-landscape' : 'cover-portrait');
    }

    function detectMobyGamesCoverOrientation(img, item, coverEl = img) {
      if (!IS_MOBYGAMES_VIEWER || !img) return;
      applyMobyGamesCoverOrientation(coverEl, item.cover_orientation || item.coverOrientation || '');
      const classifyFromImage = () => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        applyMobyGamesCoverOrientation(coverEl, img.naturalWidth > img.naturalHeight ? 'landscape' : 'portrait');
      };
      if (img.complete) classifyFromImage();
      img.addEventListener('load', classifyFromImage, { once: true });
    }

    function mobyGamesCoverBackgroundUrl(url) {
      return 'url("' + String(url || '').replace(/["\\\\\\n\\r]/g, match => '\\\\' + match) + '")';
    }

    function createRow(item) {
        const tr = document.createElement('tr');
        const titleTd = document.createElement('td');
        titleTd.className = 'game-col';
        titleTd.tabIndex = 0;
        titleTd.setAttribute('role', 'link');
        titleTd.dataset.url = item.url;
        const game = document.createElement('div');
        game.className = 'game';
        const coverEl = IS_MOBYGAMES_VIEWER ? document.createElement('span') : document.createElement('img');
        coverEl.className = IS_MOBYGAMES_VIEWER ? 'cover moby-cover-frame' : 'cover';
        let img = coverEl;
        if (IS_MOBYGAMES_VIEWER) {
          coverEl.style.backgroundImage = mobyGamesCoverBackgroundUrl(item.cover_url || '');
          img = document.createElement('img');
          img.className = 'moby-cover-probe';
          img.alt = '';
          img.loading = 'lazy';
          img.src = item.cover_url || '';
          coverEl.appendChild(img);
          detectMobyGamesCoverOrientation(img, item, coverEl);
        } else {
          img.alt = ''; img.loading = 'lazy'; img.src = item.cover_url || '';
        }
        const text = document.createElement('div');
        text.style.minWidth = '0';
        const titleDiv = document.createElement('div');
        titleDiv.className = 'title';
        titleDiv.textContent = item.title;
        const urlDiv = document.createElement('div');
        urlDiv.className = 'url';
        urlDiv.textContent = item.url.replace(/^https?:\\/\\/(?:www\\.)?backloggd\\.com/, 'backloggd.com');
        text.append(titleDiv, urlDiv);

        if (payload.include_platforms && item.platforms && item.platforms.length) {
          const chips = document.createElement('div');
          chips.className = 'platform-chips';
          item.sortedPlatforms.forEach(p => {
            const chip = document.createElement('span');
            chip.className = 'platform-chip';
            chip.dataset.platform = p;
            chip.textContent = p;
            chips.appendChild(chip);
          });
          text.appendChild(chips);
        }

        game.append(coverEl, text);
        titleTd.appendChild(game);

        const genreTd = document.createElement('td');
        genreTd.className = 'genre-col';
        if (payload.include_genres && item.genres && item.genres.length) {
          const wrap = document.createElement('div');
          wrap.className = 'genre-tags';
          item.genres.forEach(g => wrap.appendChild(makeTag(g)));
          genreTd.appendChild(wrap);
        }

        const statusTd = document.createElement('td');
        const sortedStatuses = [...itemStatuses(item)].sort(
          (a, b) => statusOrderIndex(a) - statusOrderIndex(b)
        );
        const statusPillsWrap = document.createElement('div');
        statusPillsWrap.className = 'status-pills';

        if (item.play_type && itemStatuses(item).includes('played')) {
          const ptPill = document.createElement('span');
          ptPill.className = 'pill pt-pill pt-' + item.play_type;
          ptPill.style.background = PLAY_TYPE_COLORS_MAP[item.play_type] || '#888';
          ptPill.textContent = PLAY_TYPE_LABELS_MAP[item.play_type] || item.play_type;
          ptPill.dataset.rowPlayType = item.play_type;
          statusPillsWrap.appendChild(ptPill);
        }

        sortedStatuses.forEach(s => {
          const pillEl = document.createElement('span');
          pillEl.className = 'pill ' + s + (s === 'played' ? ' pill-played-main' : '');
          pillEl.textContent = STATUS_LABELS[s] || s;
          pillEl.dataset.rowStatus = s;
          if (STATUS_COLORS_MAP[s]) pillEl.style.background = STATUS_COLORS_MAP[s];
          statusPillsWrap.appendChild(pillEl);
        });

        statusTd.appendChild(statusPillsWrap);
        const ratingTd = document.createElement('td');
        ratingTd.className = 'rating-col num';
        ratingTd.textContent = item.average_rating == null ? '-' : Number(item.average_rating).toFixed(1);
        const userRatingTd = document.createElement('td');
        userRatingTd.className = 'user-rating-col num';
        userRatingTd.textContent = item.user_rating == null ? '-' : Number(item.user_rating).toFixed(1);
        const releaseTd = document.createElement('td');
        releaseTd.className = 'release-col';
        releaseTd.textContent = item.release_date || '-';

        tr.append(titleTd);
        if (payload.include_genres) tr.appendChild(genreTd);
        tr.append(statusTd, ratingTd);
        tr.appendChild(userRatingTd);
        tr.appendChild(releaseTd);
        tr._bgdCoverImg = coverEl;
        tr._bgdGenreTags = [...tr.querySelectorAll('.genre-tag')];
        tr._bgdPlatformChips = [...tr.querySelectorAll('.platform-chip')];
        tr._bgdPlayTypePills = [...tr.querySelectorAll('[data-row-play-type]')];
        tr._bgdStatusPills = [...tr.querySelectorAll('[data-row-status]')];
        return tr;
    }

    function updateRowState(tr) {
      if (tr._bgdCoverImg) tr._bgdCoverImg.classList.toggle('hidden', !coversChk.checked);
      tr._bgdGenreTags.forEach(tag => {
        tag.classList.toggle('active', activeGenres.has(tag.dataset.genre));
      });
      tr._bgdPlatformChips.forEach(chip => {
        chip.classList.toggle('active', activePlatforms.has(chip.dataset.platform));
      });
      tr._bgdPlayTypePills.forEach(pill => {
        const active = playTypeFilter === pill.dataset.rowPlayType;
        const label = PLAY_TYPE_LABELS_MAP[pill.dataset.rowPlayType] || pill.dataset.rowPlayType;
        pill.classList.toggle('pill-filter-active', active);
        pill.title = (active ? 'Clear filter' : 'Filter by ') + label;
      });
      tr._bgdStatusPills.forEach(pill => {
        const active = statusFilter === pill.dataset.rowStatus && playTypeFilter === null;
        const label = STATUS_LABELS[pill.dataset.rowStatus] || pill.dataset.rowStatus;
        pill.classList.toggle('pill-filter-active', active);
        pill.title = (active ? 'Clear filter' : 'Filter by ') + label;
      });
    }

    function renderRows(rows) {
      const fragment = document.createDocumentFragment();
      for (const item of rows) {
        const tr = item._bgdRow || (item._bgdRow = createRow(item));
        updateRowState(tr);
        fragment.appendChild(tr);
      }
      rowsTbody.replaceChildren(fragment);
    }
    // -- Main render ---
    function render() {
      // Base filter: status, play type (Played Sub Status), search query, date, and platforms.
      // Used to compute genre pill counts/visibility in OR (match-any) mode.
      // IMPORTANT: playTypeFilter (Played Sub Status) is now treated identically to statusFilter
      // for platform counter recalculation purposes - both are applied to all code paths.
      const preGenreVisible = items.filter(item => matchesCoreFilters(item));
      const visible = preGenreVisible.filter(matchesGenreFilter).sort(compare);
      countLabel.textContent = visible.length + ' of ' + payload.total + ' games';
      empty.classList.toggle('visible', visible.length === 0);
      renderRows(visible);

      // -- Update genre pill counts and visibility ---
      // In AND (matchAll) mode the pool is the fully-filtered visible set, so
      // each pill shows how many of the current results share that genre.
      // In OR (match-any) mode the pool ignores the genre filter entirely, so
      // every genre with at least one game in the base-filtered set stays visible.
      if (genreBarBtns.length || IS_MOBYGAMES_VIEWER) {
        const genrePool = (!matchAll && activeGenres.size > 0) ? preGenreVisible : visible;
        const nextGenreCountMap = new Map();
        const genreSearch = genreSearchQuery();
        for (const item of genrePool) {
          for (const g of (item.genres || [])) {
            const slug = genreSlug(g);
            nextGenreCountMap.set(slug, (nextGenreCountMap.get(slug) || 0) + 1);
          }
        }
        genreCountMap = nextGenreCountMap;
        let visibleSubPillCount = 0;
        if (IS_MOBYGAMES_VIEWER) {
          renderMobyGenreModePills();
          visibleSubPillCount = getMobyGenreModeLabels().length;
        } else {
          genreBarBtns.forEach(btn => {
            const slug = btn.dataset.genre;
            const count = genreCountMap.get(slug) || 0;
            const countEl = btn.querySelector('.genre-count');
            if (countEl) countEl.textContent = count;
            const baseVisible = count > 0;
            btn.dataset.genreBaseVisible = baseVisible ? '1' : '0';
            const show = genreButtonMatchesSearch(btn, genreSearch) && (genreSearch ? true : baseVisible);
            btn.style.display = show ? '' : 'none';
            btn.style.flexBasis = show ? '' : '0'; // reset; updateGenrePillRows will set properly
            if (show) visibleSubPillCount++;
          });
          // Update pill grid layout
          const singlePill = document.getElementById('genreSinglePill');
          if (singlePill) {
            updateGenrePillRows(singlePill, visibleSubPillCount);
          }
        }
        // Update Genres Displayed counter (sub-pills with count > 0)
        if (genresDisplayedNum) genresDisplayedNum.textContent = visibleSubPillCount;
      }
      // -- Update info pills ---
      if (gamesDisplayedNum) gamesDisplayedNum.textContent = visible.length;
      // Update platform counter pills
      if (gamesDisplayedPlatformNum) gamesDisplayedPlatformNum.textContent = visible.length;
      if (platformsDisplayedNum) {
        // Count distinct platform labels that appear in any currently visible game
        const visiblePlatformSet = new Set();
        for (const item of visible) {
          for (const p of (item.platforms || [])) visiblePlatformSet.add(p);
        }
        platformsDisplayedNum.textContent = visiblePlatformSet.size;
      }
      // Rebuild platformCountMap.
      // When "Show All" is active AND "Match Selected" is OFF, calculate platform counts
      // from items that pass all filters (status, play_type, date, search, genre) EXCEPT
      // platform filters. This ensures platform pill counters respond correctly to Genre,
      // Status, AND Played Sub Status filter changes while maintaining OR-filter stability
      // (counters don't narrow as platforms are selected/deselected).
      // In all other cases (Match Selected ON, or Show All inactive) use the live
      // visible set so counters reflect what is currently filtered.
      platformCountMap.clear();
      if (platformShowingAll && !platformMatchAll) {
        // Calculate platform counts from items passing all filters except platform filters.
        // This preserves the "Show All" OR-mode behavior while responding to Genre/Status/PlayType changes.
          // Genre filter: include genre filtering in the count pool (same as Status and PlayType)
          // Do NOT filter by platform here - we're counting all platforms
        items.filter(item => matchesCoreFilters(item, { includeGenres: true, includePlatforms: false })).forEach(item => {
          (item.platforms || []).forEach(p => {
            platformCountMap.set(p, (platformCountMap.get(p) || 0) + 1);
          });
        });
      } else {
        // When Match Selected is ON or Show All is inactive, use the fully-visible set
        // (which is already filtered by statusFilter, playTypeFilter, activeGenres, etc.)
        visible.forEach(item => {
          (item.platforms || []).forEach(p => {
            platformCountMap.set(p, (platformCountMap.get(p) || 0) + 1);
          });
        });
      }
      // Push counts into any currently-rendered platform pills
      updatePlatformPillCounts();

      // -- Status Filter Counter: update stat button numbers ---
      if (statusFilterCounterMode) {
        // When Genre and/or Platform filters are active, recalculate Status and Sub Status
        // counters from the subset of items that pass those filters - ignoring status,
        // playType, search, and date filters so every status/sub-status button always
        // remains visible and its count represents how many of its games survive the
        // current Genre + Platform selection.
        //
        // When no Genre or Platform filters are active the filtered pool equals the full
        // payload, so counts fall back to the original values automatically.
        // Build the counting pool from non-status filters. Status/play-type
        // filters are ignored so every status pill remains available as a
        // counter for the current date/search/genre/platform selection.
        const statusCountPool = items.filter(item =>
          matchesSearchAndDate(item) &&
          matchesGenreFilter(item) &&
          matchesPlatformFilter(item)
        );
        // Derive per-status and per-play_type counts from the pool.
        // A game with multiple statuses is counted in each applicable bucket.
        const _statusCounts = {};
        const _ptCounts = {};
        const _statusIdCounts = countStatusIdsInPool(statusCountPool);
        let _queueTotal = 0;
        for (const item of statusCountPool) {
          const statuses = itemStatuses(item);
          statuses.forEach(s => {
            _statusCounts[s] = (_statusCounts[s] || 0) + 1;
          });
          if (statuses.includes('played') && item.play_type) {
            _ptCounts[item.play_type] = (_ptCounts[item.play_type] || 0) + 1;
          }
          if (statuses.includes('playing') || statuses.includes('backlog') || statuses.includes('wishlist')) _queueTotal += 1;
        }

        // Total button: games currently visible (all active filters applied)
        const totalBtn = document.querySelector('[data-status-filter="all"]');
        if (totalBtn) {
          const strong = totalBtn.querySelector('strong');
          if (strong) strong.textContent = visible.length;
        }
        // Main status buttons (played / playing / backlog / wishlist)
        ['played','playing','backlog','wishlist'].forEach(s => {
          const btn = document.querySelector('[data-status-filter="' + s + '"]');
          if (btn) { const strong = btn.querySelector('strong'); if (strong) strong.textContent = _statusCounts[s] || 0; }
        });
        // Sub Status (play_type) buttons inside the Played sub-pill
        document.querySelectorAll('[data-play-type]').forEach(btn => {
          const pt = btn.dataset.playType;
          const subNum = btn.querySelector('.sub-num');
          if (subNum) subNum.textContent = _ptCounts[pt] || 0;
        });
        // Played Total header and Queue total header
        if (playedTotalBtn) { const subTotal = playedTotalBtn.querySelector('.sub-pill-total'); if (subTotal) subTotal.textContent = _statusCounts['played'] || 0; }
        if (queueTotalBtn) { const subTotal = queueTotalBtn.querySelector('.sub-pill-total'); if (subTotal) subTotal.textContent = _queueTotal; }
        // Playing / Backlog / Wishlist sub-num spans inside the Queue pill
        document.querySelectorAll('[data-status-filter="playing"],[data-status-filter="backlog"],[data-status-filter="wishlist"]').forEach(btn => {
          const s = btn.dataset.statusFilter;
          const subNum = btn.querySelector('.sub-num');
          if (subNum) subNum.textContent = _statusCounts[s] || 0;
        });
        updateConfiguredStatusCounters(_statusIdCounts);
        updateConfiguredAggregateCounters(_statusCounts, _ptCounts, _statusIdCounts);
      } else {
        // Status Filter Counter OFF: restore all counters to original payload values
        const totalBtn = document.querySelector('[data-status-filter="all"]');
        if (totalBtn) { const strong = totalBtn.querySelector('strong'); if (strong) strong.textContent = payload.total; }
        ['played','playing','backlog','wishlist'].forEach(s => {
          const btn = document.querySelector('[data-status-filter="' + s + '"]');
          if (btn) { const strong = btn.querySelector('strong'); if (strong) strong.textContent = payload.counts[s] || 0; }
        });
        document.querySelectorAll('[data-play-type]').forEach(btn => {
          const pt = btn.dataset.playType;
          const subNum = btn.querySelector('.sub-num');
          if (subNum) subNum.textContent = PLAY_TYPE_COUNTS_ORIG[pt] || 0;
        });
        if (playedTotalBtn) { const subTotal = playedTotalBtn.querySelector('.sub-pill-total'); if (subTotal) subTotal.textContent = payload.counts.played || 0; }
        if (queueTotalBtn) { const subTotal = queueTotalBtn.querySelector('.sub-pill-total'); if (subTotal) subTotal.textContent = QUEUE_TOTAL_ORIG; }
        document.querySelectorAll('[data-status-filter="playing"],[data-status-filter="backlog"],[data-status-filter="wishlist"]').forEach(btn => {
          const s = btn.dataset.statusFilter;
          const subNum = btn.querySelector('.sub-num');
          if (subNum) subNum.textContent = payload.counts[s] || 0;
        });
        const originalStatusIdCounts = countStatusIdsInPool(items);
        updateConfiguredStatusCounters(originalStatusIdCounts);
        updateConfiguredAggregateCounters(payload.counts || {}, PLAY_TYPE_COUNTS_ORIG, originalStatusIdCounts);
      }
    }

    // -- Checkbox state: save + restore ---
    let renderRaf = 0;
    function scheduleRender() {
      if (renderRaf) return;
      renderRaf = requestAnimationFrame(() => {
        renderRaf = 0;
        render();
      });
    }

    function applyCheckbox(el, key, defaultOn, onFn) {
      if (!el) return;
      const stored = lsGet(key, null);
      el.checked = stored !== null ? stored === '1' : defaultOn;
      onFn(el.checked);
      el.addEventListener('change', () => { onFn(el.checked); lsSet(key, el.checked ? '1' : '0'); });
    }

    function updateTableColumnWidths() {
      const titleTh = document.querySelector('th[data-sort="title"]');
      if (!titleTh) return;
      const visible = {
        genre: payload.include_genres && !document.body.classList.contains('hide-col-genres'),
        status: !document.body.classList.contains('hide-col-status'),
        rating: !document.body.classList.contains('hide-col-avg-rating'),
        userRating: !document.body.classList.contains('hide-col-user-rating'),
        release: !document.body.classList.contains('hide-col-release-date'),
      };
      let fixed = 0;
      for (const key of ['genre', 'status', 'rating', 'userRating', 'release']) {
        if (visible[key]) fixed += TABLE_WIDTHS[key] || 0;
      }
      titleTh.style.width = Math.max(0, 100 - fixed) + '%';
      const widthTargets = [
        ['genre', 'th.genre-col'],
        ['status', 'th[data-sort="status"]'],
        ['rating', 'th.rating-col'],
        ['userRating', 'th.user-rating-col'],
        ['release', 'th.release-col'],
      ];
      for (const [key, selector] of widthTargets) {
        const th = document.querySelector(selector);
        if (th) th.style.width = (TABLE_WIDTHS[key] || 0) + '%';
      }
    }

    // -- Apply has-user-ratings body class ---
    document.body.classList.add('has-user-ratings');

    function setBlackMode(on) {
      document.body.classList.toggle('black', on);
      lsSet('bgdBlackMode', on ? '1' : '0');
    }
    // lightMode checkbox: checked = light (not black). Default = dark (unchecked).
    {
      const stored = lsGet('bgdBlackMode', null);
      lightMode.checked = stored !== null ? stored === '0' : false;
      setBlackMode(!lightMode.checked);
      lightMode.addEventListener('change', () => setBlackMode(!lightMode.checked));
    }

    applyCheckbox(coversChk, 'bgdCovers', true, () => scheduleRender());

    // -- Columns picker ---
    (function initColPicker() {
      const btn   = document.getElementById('colPickerBtn');
      const panel = document.getElementById('colPickerPanel');
      const closeBtn = document.getElementById('colPickerClose');
      if (!btn || !panel) return;

      function openPanel() { panel.hidden = false; btn.classList.add('open'); }
      function closePanel() { panel.hidden = true; btn.classList.remove('open'); }

      btn.addEventListener('click', e => {
        e.stopPropagation();
        panel.hidden ? openPanel() : closePanel();
      });
      closeBtn.addEventListener('click', e => { e.stopPropagation(); closePanel(); });
      document.addEventListener('click', e => {
        if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) closePanel();
      });

      // Each column checkbox: id -> { bodyClass, default }
      const cols = [
        { id: 'colLink',        cls: 'hide-col-link',         def: true },
        { id: 'colPlatforms',   cls: 'hide-col-platforms',    def: true },
        { id: 'colGenres',      cls: 'hide-col-genres',       def: true },
        { id: 'colStatus',      cls: 'hide-col-status',       def: true },
        { id: 'colAvgRating',   cls: 'hide-col-avg-rating',   def: true },
        { id: 'colUserRating',  cls: 'hide-col-user-rating',  def: !IS_HLTB_VIEWER },
        { id: 'colReleaseDate', cls: 'hide-col-release-date', def: true },
      ];

      cols.forEach(({ id, cls, def }) => {
        const el = document.getElementById(id);
        if (!el) return;
        // Restore from localStorage
        const stored = lsGet('bgdCol_' + id, null);
        el.checked = stored !== null ? stored === '1' : def;
        document.body.classList.toggle(cls, !el.checked);
        el.addEventListener('change', () => {
          document.body.classList.toggle(cls, !el.checked);
          lsSet('bgdCol_' + id, el.checked ? '1' : '0');
          updateTableColumnWidths();
        });
      });
      updateTableColumnWidths();
    })();
    if (IS_MOBYGAMES_VIEWER) {
      document.body.classList.remove('show-genre-emojis');
    } else {
      applyCheckbox(genreEmojisChk, 'bgdGenreEmojis', false, on => {
        document.body.classList.toggle('show-genre-emojis', on);
        // Re-run render so pill grid recalculates rows + flex-basis for emoji/non-emoji mode
        scheduleRender();
      });
    }

    // -- Restore sort ---
    const savedSortKey = lsGet('bgdSortKey', 'title');
    const savedSortDir = lsGet('bgdSortDir', 'asc');
    sortKey = savedSortKey; sortDir = savedSortDir;
    thSorts.forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      const arrow = th.querySelector('.sort-arrow');
      if (th.dataset.sort === sortKey) {
        th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
        if (arrow) arrow.textContent = sortDir === 'asc' ? '\u2191' : '\u2193';
      } else {
        if (arrow) arrow.textContent = '\u21c5';
      }
    });

    // -- Date filter events ---
    function readBoundedNumber(input, min, max, requiredLength = null) {
      if (!input || !input.value) return null;
      const raw = input.value.trim();
      if (requiredLength && raw.length < requiredLength) return null;
      if (!/^\\d+$/.test(raw)) return null;
      const value = Number(raw);
      return value >= min && value <= max ? value : null;
    }

    function readDateFilter() {
      dateFilter.year  = readBoundedNumber(dfYear, 1970, 2099, 4);
      dateFilter.month = readBoundedNumber(dfMonth, 1, 12);
      dateFilter.day   = readBoundedNumber(dfDay, 1, 31);
    }

    function clearDateFilter({ render = true } = {}) {
      if (dfYear)  dfYear.value  = '';
      if (dfMonth) dfMonth.value = '';
      if (dfDay)   dfDay.value   = '';
      readDateFilter();
      if (render) scheduleRender();
    }

    if (dfYear)  dfYear.addEventListener('input',  () => { readDateFilter(); scheduleRender(); });
    if (dfMonth) dfMonth.addEventListener('input', () => { readDateFilter(); scheduleRender(); });
    if (dfDay)   dfDay.addEventListener('input',   () => { readDateFilter(); scheduleRender(); });
    if (dfClear) dfClear.addEventListener('click', () => clearDateFilter());

    // -- Match-all state ---
    matchAll = lsGet('bgdMatchAll', '1') !== '0';
    if (genreMatchBtn) {
      genreMatchBtn.classList.toggle('active', matchAll);
      genreMatchBtn.addEventListener('click', () => {
        matchAll = !matchAll;
        genreMatchBtn.classList.toggle('active', matchAll);
        lsSet('bgdMatchAll', matchAll ? '1' : '0');
        scheduleRender();
      });
    }

    // -- Show All button ---
    if (genreShowAllBtn) genreShowAllBtn.addEventListener('click', () => {
      if (!IS_MOBYGAMES_VIEWER) {
        clearGenres();
        return;
      }
      genreShowingAll = !genreShowingAll;
      if (genreShowingAll) genreShowingEmpty = false;
      lsSet('bgdMobyGenreShowAll', genreShowingAll ? '1' : '0');
      syncGenreShowAllState();
      syncGenreShowEmptyState();
      renderMobyGenreModePills();
    });

    // -- Genre Show Empty button ---
    if (genreShowEmptyBtn) {
      if (IS_HLTB_VIEWER) genreShowEmptyBtn.hidden = true;
      genreShowEmptyBtn.addEventListener('click', () => {
        if (IS_HLTB_VIEWER) return;
        genreShowingEmpty = !genreShowingEmpty;
        if (genreShowingEmpty) genreShowingAll = false;
        lsSet('bgdMobyGenreShowAll', genreShowingAll ? '1' : '0');
        syncGenreShowAllState();
        syncGenreShowEmptyState();
        renderMobyGenreModePills();
      });
    }

    // -- Genre filter clear ---
    if (genreFilterClear) genreFilterClear.addEventListener('click', clearGenres);

    // -- Platform filter clear ---
    if (platformFilterClear) platformFilterClear.addEventListener('click', () => {
      activePlatforms.clear();
      syncPlatformUI();
      scheduleRender();
      // After clearing, restore the pill grid to its full default state
      if (platformShowingAll) renderAllPlatformPills();
      else if (platformShowingEmpty) renderEmptyPlatformPills();
    });

    // -- Platform search bar events ---
    if (platformSearchInput) {
      platformSearchInput.addEventListener('input', () => {
        if (platformSearchClear) {
          platformSearchClear.style.display = platformSearchInput.value ? '' : 'none';
        }
        syncPlatformSearchResults();
      });
    }
    if (platformSearchClear) {
      platformSearchClear.style.display = 'none';
      platformSearchClear.addEventListener('click', () => {
        if (platformSearchInput) platformSearchInput.value = '';
        platformSearchClear.style.display = 'none';
        syncPlatformSearchResults();
      });
    }
    if (platformMatchAllBtn) {
      platformMatchAllBtn.classList.toggle('active', platformMatchAll);
      platformMatchAllBtn.addEventListener('click', () => {
        platformMatchAll = !platformMatchAll;
        platformMatchAllBtn.classList.toggle('active', platformMatchAll);
        lsSet('bgdPlatformMatchAll', platformMatchAll ? '1' : '0');
        scheduleRender();
      });
    }

    // -- Platform Show All button ---

    function syncPlatformShowAllState() {
      if (!platformShowAllBtn) return;
      platformShowAllBtn.classList.toggle('active', platformShowingAll);
      const dot = platformShowAllBtn.querySelector('.filter-vis-dot');
      if (dot) {
        dot.style.borderColor = '';
        dot.style.background = '';
      }
    }

    function renderPlatformModePills(mode) {
      if (!platformSearchResults) return;
      const isAllMode = mode === 'all';
      const isActive = isAllMode ? platformShowingAll : platformShowingEmpty;
      if (!isActive) {
        platformSearchResults.classList.remove('visible');
        platformSearchResults.innerHTML = '';
        platformSearchResults.style.width = '';
        syncPlatformSearchResults();
        return;
      }

      const q = platformSearchInput ? platformSearchInput.value.trim().toLowerCase() : '';
      let labels;
      if (isAllMode) {
        labels = q.length > 0
          ? allKnownPlatformLabels.filter(p => p.toLowerCase().includes(q))
          : exportedPlatformLabels.filter(p => (platformCountMap.get(p) || 0) > 0);
      } else {
        labels = allKnownPlatformLabels.filter(p => (platformCountMap.get(p) || 0) === 0);
        if (q.length > 0) labels = labels.filter(p => p.toLowerCase().includes(q));
      }

      if (labels.length === 0) {
        platformSearchResults.classList.remove('visible');
        platformSearchResults.innerHTML = '';
        platformSearchResults.style.width = '';
        return;
      }

      platformSearchResults.classList.add('visible');
      platformSearchResults.innerHTML = '';
      renderPlatformPillGrid(labels, () => {
        if (isAllMode && platformShowingAll) renderAllPlatformPills();
        else if (!isAllMode && platformShowingEmpty) renderEmptyPlatformPills();
      });
    }

    function renderAllPlatformPills() {
      renderPlatformModePills('all');
    }

    if (platformShowAllBtn) {
      platformShowAllBtn.addEventListener('click', () => {
        platformShowingAll = !platformShowingAll;
        if (platformShowingAll) { platformShowingEmpty = false; syncPlatformShowEmptyState(); }
        lsSet('bgdPlatformShowAll', platformShowingAll ? '1' : '0');
        syncPlatformShowAllState();
        renderAllPlatformPills();
      });
    }

    // -- Platform Show Empty button ---

    function syncPlatformShowEmptyState() {
      if (!platformShowEmptyBtn) return;
      platformShowEmptyBtn.classList.toggle('active', platformShowingEmpty);
      const dot = platformShowEmptyBtn.querySelector('.filter-vis-dot');
      if (dot) {
        dot.style.borderColor = '';
        dot.style.background = '';
      }
    }

    function renderEmptyPlatformPills() {
      renderPlatformModePills('empty');
    }

    if (platformShowEmptyBtn) {
      if (IS_HLTB_VIEWER) platformShowEmptyBtn.hidden = true;
      platformShowEmptyBtn.addEventListener('click', () => {
        if (IS_HLTB_VIEWER) return;
        platformShowingEmpty = !platformShowingEmpty;
        if (platformShowingEmpty) {
          platformShowingAll = false;
          lsSet('bgdPlatformShowAll', '0');
          syncPlatformShowAllState();
        }
        syncPlatformShowEmptyState();
        renderEmptyPlatformPills();
      });
    }

    // -- Filter visibility toggle (Genres / Platforms) ---
    // MobyGames Genre Show All persistence
    if (IS_MOBYGAMES_VIEWER) {
      const storedGSA = lsGet('bgdMobyGenreShowAll', null);
      if (storedGSA !== null) {
        genreShowingAll = storedGSA === '1';
        if (genreShowingAll) genreShowingEmpty = false;
        syncGenreShowAllState();
        renderMobyGenreModePills();
      }
    }

    // Platform Show All persistence
    {
      const storedPSA = lsGet('bgdPlatformShowAll', null);
      if (storedPSA !== null) {
        platformShowingAll = storedPSA === '1';
        if (platformShowingAll) platformShowingEmpty = false;
        syncPlatformShowAllState();
        renderAllPlatformPills();
      }
    }

    (function initFilterVisToggles() {
      const genreSection = document.getElementById('genreBar');
      const platformSection = document.getElementById('platformSearchWrap');

      function applyGenresVis(on) {
        if (genreSection) genreSection.style.display = on ? '' : 'none';
        if (filtersGenresBtn) filtersGenresBtn.classList.toggle('active', on);
        lsSet('bgdFilterGenresVis', on ? '1' : '0');
      }
      function applyPlatformsVis(on) {
        if (platformSection) platformSection.style.display = on ? '' : 'none';
        if (filtersPlatformsBtn) filtersPlatformsBtn.classList.toggle('active', on);
        lsSet('bgdFilterPlatformsVis', on ? '1' : '0');
      }

      // Restore from localStorage (default: both on)
      const storedG = lsGet('bgdFilterGenresVis', '1');
      const storedP = lsGet('bgdFilterPlatformsVis', '1');
      applyGenresVis(storedG !== '0');
      applyPlatformsVis(storedP !== '0');

      if (filtersGenresBtn) filtersGenresBtn.addEventListener('click', () => {
        const nowOn = !filtersGenresBtn.classList.contains('active');
        applyGenresVis(nowOn);
      });
      if (filtersPlatformsBtn) filtersPlatformsBtn.addEventListener('click', () => {
        const nowOn = !filtersPlatformsBtn.classList.contains('active');
        applyPlatformsVis(nowOn);
      });

      // Initialize Platforms Displayed total: always show the full scan size (50 or 226),
      // not the number of platform labels that actually appear in the exported data.
      if (platformsDisplayedTotal) {
        platformsDisplayedTotal.textContent = IS_HLTB_VIEWER
          ? exportedPlatformLabels.length
          : IS_MOBYGAMES_VIEWER
          ? ALL_KNOWN_PLATFORM_LABELS.length
          : (payload.include_platforms226 ? ${ALL_PLATFORM_SLUGS.length} : ${PLATFORM_SLUGS.length});
      }
    })();

    // Restore platform match-all from localStorage
    {
      const storedPMA = lsGet('bgdPlatformMatchAll', null);
      if (storedPMA !== null) {
        platformMatchAll = storedPMA === '1';
        if (platformMatchAllBtn) platformMatchAllBtn.classList.toggle('active', platformMatchAll);
      }
    }

    // -- Title search clear button ---
    const searchClearBtn = document.getElementById('searchClearBtn');
    if (search && searchClearBtn) {
      search.addEventListener('input', () => {
        query = normalizeTitle(search.value.trim());
        searchClearBtn.classList.toggle('visible', search.value.length > 0);
        scheduleRender();
      });
      searchClearBtn.addEventListener('click', () => {
        search.value = '';
        query = '';
        searchClearBtn.classList.remove('visible');
        scheduleRender();
      });
    }

    // -- Genre bar buttons ---
    genreBarBtns.forEach(btn => btn.addEventListener('click', () => setGenreFilter(btn.dataset.genre, !activeGenres.has(btn.dataset.genre))));
    if (genreSearchInput) {
      if (genreSearchClear) genreSearchClear.style.display = 'none';
      genreSearchInput.addEventListener('input', syncGenreSearchResults);
      if (genreSearchClear) {
        genreSearchClear.addEventListener('click', () => {
          genreSearchInput.value = '';
          syncGenreSearchResults();
        });
      }
    }

    // -- Played sub-statuses toggle ---
    function applyPlaySubStatuses(on) {
      document.body.classList.toggle('show-play-types', on);
      if (!on && playTypeFilter !== null) {
        setStatusFilter('all');
      }
    }
    if (playSubStatusesChk) {
      const storedPSS = lsGet('bgdPlaySubStatuses', null);
      playSubStatusesChk.checked = storedPSS !== null ? storedPSS === '1' : true;
      applyPlaySubStatuses(playSubStatusesChk.checked);
      playSubStatusesChk.addEventListener('change', () => {
        lsSet('bgdPlaySubStatuses', playSubStatusesChk.checked ? '1' : '0');
        applyPlaySubStatuses(playSubStatusesChk.checked);
      });
    }

    // -- Status Filter Counter toggle ---
    if (statusFilterCounterChk) {
      const storedSFC = lsGet('bgdStatusFilterCounter', null);
      statusFilterCounterMode = storedSFC !== null ? storedSFC === '1' : true;
      statusFilterCounterChk.checked = statusFilterCounterMode;
      statusFilterCounterChk.addEventListener('change', () => {
        statusFilterCounterMode = statusFilterCounterChk.checked;
        lsSet('bgdStatusFilterCounter', statusFilterCounterMode ? '1' : '0');
        scheduleRender();
      });
    }

    // -- Played Total button (reset sub-status filter -> show all Played) --
    if (playedTotalBtn) {
      playedTotalBtn.addEventListener('click', setPlayedTotalFilter);
    }

    // -- Queue Total button (show Playing + Backlog + Wishlist) ---
    if (queueTotalBtn) {
      queueTotalBtn.addEventListener('click', setQueueFilter);
    }

    document.querySelectorAll('[data-aggregate-sources]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sourceIds = String(btn.dataset.aggregateSources || '').split(',').filter(Boolean);
        setAggregateSourceFilter(sourceIds);
      });
    });

    // -- Play type buttons ---
    playTypeButtons.forEach(btn => btn.addEventListener('click', () => {
      setPlayTypeFilter(btn.dataset.playType, { toggle: statusFilterCounterMode && btn.classList.contains('active'), clearOtherFilters: !statusFilterCounterMode });
    }));

    document.querySelectorAll('[data-config-status-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        setAggregateSourceFilter([btn.dataset.configStatusId]);
      });
    });

    // Status filter ---
    statButtons.forEach(btn => btn.addEventListener('click', () => {
      const nextStatus = btn.dataset.statusFilter;
      setStatusFilter(nextStatus, { resetTagsOnAll: nextStatus === 'all', clearOtherFilters: !statusFilterCounterMode });
    }));

    // Column sort via th click ---
    thSorts.forEach(th => th.addEventListener('click', () => setSort(th.dataset.sort)));

    render();

    // -- ResizeObserver: reflow pill grid when container width changes ---
    // This handles window resize (pills redistribute between rows automatically).
    // IMPORTANT: we only react to WIDTH changes. Height changes are caused by
    // updateGenrePillRows itself (via --genre-rows / max-height adjustments) and
    // must be ignored - reacting to them creates a feedback loop that makes the
    // pills shake/flash continuously at intermediate window sizes.
    const genreGrid = document.getElementById('genreSinglePill');
    if (!IS_MOBYGAMES_VIEWER && genreGrid && typeof ResizeObserver !== 'undefined') {
      let _roFrame = 0;
      let _roIdleTimer = null;
      let _lastGenreW = -1;
      function visibleGenreCount() {
        let vc = 0;
        genreGrid.querySelectorAll('.genre-btn').forEach(b => { if (b.style.display !== 'none') vc++; });
        return vc;
      }
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          // Round to nearest pixel to ignore sub-pixel jitter
          const newW = Math.round(entry.contentRect.width);
          if (newW === _lastGenreW) return; // height-only change - skip
          _lastGenreW = newW;
          if (!_roFrame) {
            _roFrame = requestAnimationFrame(() => {
              _roFrame = 0;
              updateGenrePillRows(genreGrid, visibleGenreCount(), { checkOverflow: false });
            });
          }
          clearTimeout(_roIdleTimer);
          _roIdleTimer = setTimeout(() => {
            updateGenrePillRows(genreGrid, visibleGenreCount(), { checkOverflow: true });
          }, 180);
        }
      });
      ro.observe(genreGrid.parentElement || genreGrid);
    }

    // -- ResizeObserver: detect status & sub-status pill text overflow ---
    // Switches .stats to a 2-column (2-row) layout when any stat button text
    // is truncated, and restores 3/4-column when there is enough room again.
    // Also adds .sub-pill-compact to sub-pills whose sub-name text is clipped.
    const statsGrid = document.getElementById('stats');
    if (statsGrid && typeof ResizeObserver !== 'undefined') {
      function updateStatsLayout() {
        // -- Main stat buttons ---
        // Test in 3-col (or 4-col) mode first: temporarily remove wrap class
        statsGrid.classList.remove('stats-wrap');
        // Force a reflow so the browser recalculates layout without wrap
        void statsGrid.offsetWidth;

        let needsWrap = false;
        statsGrid.querySelectorAll('.stat').forEach(btn => {
          if (btn.offsetParent === null) return; // skip hidden buttons
          // The text label lives in the <span> child
          const span = btn.querySelector('span');
          if (span && span.scrollWidth > span.clientWidth + 2) needsWrap = true;
          // Also check the button itself
          if (btn.scrollWidth > btn.clientWidth + 2) needsWrap = true;
        });

        if (needsWrap) statsGrid.classList.add('stats-wrap');

        // -- Sub-status pills ---
        // For each sub-pill, check if any .sub-name or .sub-num is overflowing.
        statsGrid.querySelectorAll('.stat-sub-pill').forEach(pill => {
          pill.classList.remove('sub-pill-compact');
          void pill.offsetWidth;
          let subOverflow = false;
          pill.querySelectorAll('.sub-name, .sub-num, .sub-pill-header').forEach(el => {
            if (el.scrollWidth > el.clientWidth + 2) subOverflow = true;
          });
          if (subOverflow) pill.classList.add('sub-pill-compact');
        });
      }

      let statsFrame = 0;
      let statsIdleTimer = null;
      const statsRo = new ResizeObserver(() => {
        if (!statsFrame) {
          statsFrame = requestAnimationFrame(() => {
            statsFrame = 0;
            updateStatsLayout();
          });
        }
        clearTimeout(statsIdleTimer);
        statsIdleTimer = setTimeout(updateStatsLayout, 180);
      });
      statsRo.observe(statsGrid);
      // Also run once immediately after first render
      requestAnimationFrame(updateStatsLayout);
    }
`;
  }

  function buildViewerGenreBarHtml({ hasGenres, allGenres, allGenresSorted, genreCounts, isMobyGamesViewer, genreDisplayedTotal }) {
    return hasGenres && allGenres.length ? `
      <div class="genre-bar" id="genreBar">
        <div class="genre-bar-controls">
          ${isMobyGamesViewer ? `<div class="platform-search-input-wrap genre-search-input-wrap">
            <input class="platform-search-input" id="genreSearchInput" type="text" placeholder="Search genre..." autocomplete="off">
            <button class="platform-search-clear" id="genreSearchClear" type="button">Clear</button>
          </div>` : '<span class="genre-bar-label">Genres</span>'}
          <button class="genre-show-all${isMobyGamesViewer ? ' platform-match-btn platform-show-all-btn' : ''}" type="button" id="genreShowAll"${isMobyGamesViewer ? ' title="Show all genre pills"' : ''}>${isMobyGamesViewer ? '<span class="filter-vis-dot"></span>' : ''}Show All</button>
          ${isMobyGamesViewer ? '<button class="platform-match-btn platform-show-all-btn" type="button" id="genreShowEmpty" title="Show only genres with zero games"><span class="filter-vis-dot"></span>Empty Genres</button>' : ''}
          <button class="genre-match-btn active" type="button" id="genreMatchAll" title="When on: games must match ALL selected genres. When off: any one genre is enough."><span class="filter-vis-dot"></span>Match Selected</button>
          <span class="genre-spacer-pills" aria-hidden="true"></span>
          <span class="genre-counter-pill" id="gamesDisplayedPill" title="Games currently shown">
            <span class="genre-counter-pill-label">Games Displayed</span><span class="genre-counter-pill-num" id="gamesDisplayedNum">0</span>
          </span>
          <span class="genre-counter-pill" id="genresDisplayedPill" title="Active genre filters">
            <span class="genre-counter-pill-label">Genres Displayed</span><span class="genre-counter-pill-num" id="genresDisplayedNum">0</span><span class="genre-counter-pill-of">of</span><span class="genre-counter-pill-num">${genreDisplayedTotal}</span>
          </span>
          <span style="flex:1"></span>
        </div>
        <div class="genre-btn-wrap" id="genreBtnWrap">
          <div class="${isMobyGamesViewer ? 'platform-search-results' : 'genre-pill-grid'}" id="genreSinglePill">
            ${isMobyGamesViewer ? '' : allGenresSorted.map(g => {
              const safe = g.replace(/[^a-z0-9]/gi, '-').toLowerCase();
              const emoji = escapeHtml(GENRE_EMOJIS[g] || '');
              const count = genreCounts[g] || 0;
              return `<button class="genre-btn" type="button" data-genre="${safe}" data-genre-label="${escapeHtml(g)}" data-genre-emoji="${emoji}"><span class="genre-emoji">${emoji}</span><span class="genre-name">${escapeHtml(g)}</span><span class="genre-count">${count}</span></button>`;
            }).join('')}
          </div>
        </div>
        ${isMobyGamesViewer ? `<div class="platform-filter-bar" id="genreFilterBar">
          <div class="platform-filter-bar-inner" id="genreFilterBarInner">
            <span class="platform-filter-bar-label">Filtered by Genre</span>
            <span id="genreFilterPills"></span>
            <button class="platform-filter-clear" type="button" id="genreFilterClear">Clear filter</button>
          </div>
        </div>` : ''}
      </div>` : ``;
  }

  function buildViewerPlatformFilterHtml({ hasPlatforms }) {
    return hasPlatforms ? `
      <div class="platform-search-wrap visible" id="platformSearchWrap">
        <div class="platform-search-controls">
          <div class="platform-search-input-wrap">
            <input class="platform-search-input" id="platformSearchInput" type="text" placeholder="Search platform..." autocomplete="off">
            <button class="platform-search-clear" id="platformSearchClear" type="button">Clear</button>
          </div>
          <button class="platform-match-btn platform-show-all-btn" type="button" id="platformShowAll" title="Show all platform pills"><span class="filter-vis-dot"></span>Show All</button>
          <button class="platform-match-btn platform-show-all-btn" type="button" id="platformShowEmpty" title="Show only platforms with zero games"><span class="filter-vis-dot"></span>Empty Platforms</button>
          <button class="platform-match-btn" type="button" id="platformMatchAll" title="When on: games must have ALL selected platforms. When off: any one platform is enough."><span class="filter-vis-dot"></span>Match Selected</button>
          <span class="genre-spacer-pills" aria-hidden="true"></span>
          <span class="genre-counter-pill" id="gamesDisplayedPlatformPill" title="Games currently shown">
            <span class="genre-counter-pill-label">Games Displayed</span><span class="genre-counter-pill-num" id="gamesDisplayedPlatformNum">0</span>
          </span>
          <span class="genre-counter-pill" id="platformsDisplayedPill" title="Platform filters shown">
            <span class="genre-counter-pill-label">Platforms Displayed</span><span class="genre-counter-pill-num" id="platformsDisplayedNum">0</span><span class="genre-counter-pill-of">of</span><span class="genre-counter-pill-num" id="platformsDisplayedTotal">0</span>
          </span>
        </div>
        <div class="platform-search-results" id="platformSearchResults"></div>
        <div class="platform-filter-bar" id="platformFilterBar">
          <div class="platform-filter-bar-inner" id="platformFilterBarInner">
            <span class="platform-filter-bar-label">Filtered by platform:</span>
            <span id="platformFilterPills"></span>
            <button class="platform-filter-clear" type="button" id="platformFilterClear">Clear filter</button>
          </div>
        </div>
      </div>` : '';
  }

  function buildViewerToolbarHtml({ hasGenres, hasPlatforms, isMobyGamesViewer }) {
    return `<section class="toolbar">
      <div class="toolbar-search">
        <input id="search" type="search" placeholder="Search by title...">
        <button class="search-clear-btn" id="searchClearBtn" type="button">Clear</button>
      </div>
      <div class="date-filter">
        <input class="df-year"  type="number" id="dfYear"  placeholder="Year"  min="1970" max="2099">
        <span class="date-filter-sep">/</span>
        <input class="df-month" type="number" id="dfMonth" placeholder="Mo"    min="1"    max="12">
        <span class="date-filter-sep">/</span>
        <input class="df-day"   type="number" id="dfDay"   placeholder="Day"   min="1"    max="31">
        <button class="date-filter-clear" type="button" id="dfClear">Clear</button>
      </div>
      ${hasGenres || hasPlatforms ? `<div class="filter-toggle-group">
        <span class="filter-toggle-label">Filters:</span>
        ${hasGenres ? '<button class="filter-vis-btn active" type="button" id="filtersGenresBtn"><span class="filter-vis-dot"></span>Genres</button>' : ''}
        ${hasPlatforms ? '<button class="filter-vis-btn active" type="button" id="filtersPlatformsBtn"><span class="filter-vis-dot"></span>Platforms</button>' : ''}
      </div>` : ''}
      <div class="col-picker-wrap" id="colPickerWrap">
        <button class="col-picker-btn" type="button" id="colPickerBtn">Columns</button>
        <div class="col-picker-panel" id="colPickerPanel" hidden>
          <button class="col-picker-close" type="button" id="colPickerClose" aria-label="Close">x</button>
          <div class="col-picker-row">
            <label class="col-picker-chk"><input type="checkbox" id="covers" checked> Covers</label>
            <label class="col-picker-chk"><input type="checkbox" id="colLink" checked> Links</label>
          </div>
          ${hasGenres ? `<div class="col-picker-row no-sep">
            <label class="col-picker-chk"><input type="checkbox" id="colGenres" checked> Genres</label>
            ${isMobyGamesViewer ? '' : '<label class="col-picker-chk"><input type="checkbox" id="genreEmojis"> Emoji</label>'}
          </div>` : ''}
          ${hasPlatforms ? `<div class="col-picker-row no-sep">
            <label class="col-picker-chk"><input type="checkbox" id="colPlatforms" checked> Platforms</label>
            <label class="col-picker-chk"><input type="checkbox" id="colStatus" checked> Status</label>
          </div>` : `<div class="col-picker-row no-sep">
            <label class="col-picker-chk"><input type="checkbox" id="colStatus" checked> Status</label>
          </div>`}
          <div class="col-picker-row">
            <label class="col-picker-chk"><input type="checkbox" id="colAvgRating" checked> Average Rating</label>
            <label class="col-picker-chk"><input type="checkbox" id="colUserRating" checked> User Rating</label>
          </div>
          <div class="col-picker-row">
            <label class="col-picker-chk"><input type="checkbox" id="colReleaseDate" checked> Release Date</label>
          </div>
        </div>
      </div>
    </section>`;
  }

  function buildViewerTableHtml({ hasGenres }) {
    return `<section class="table-wrap" id="tableWrap" tabindex="0">
      <table>
        <thead>
          <tr>
            <th data-sort="title">Game <span class="sort-arrow">\u21c5</span></th>
            ${hasGenres ? '<th class="genre-col">Genres</th>' : ''}
            <th data-sort="status">Status <span class="sort-arrow">\u21c5</span></th>
            <th class="rating-col" data-sort="average_rating"><span class="th-label">Average<br><span class="th-line">Rating <span class="sort-arrow">\u21c5</span></span></span></th>
            <th class="user-rating-col" data-sort="user_rating"><span class="th-label">User<br><span class="th-line">Rating <span class="sort-arrow">\u21c5</span></span></span></th>
            <th class="release-col" data-sort="release_date"><span class="th-label">Release<br><span class="th-line">Date <span class="sort-arrow">\u21c5</span></span></span></th>
          </tr>
        </thead>
        <tbody id="rows"></tbody>
      </table>
      <div class="empty" id="empty">No games match that search.</div>
    </section>`;
  }

  function buildViewerDocumentHtml({ payload, data, viewerCss, viewerBody, viewerScript }) {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(payload.username)} ${escapeHtml(sourceLabelForWebsite(payload.sourceWebsite))} Library</title>
  <style>
${viewerCss}
  </style>${viewerBody}  <script id="payload" type="application/json">${data}</script>
  <script>
${viewerScript}  </script>
</body>
</html>`;
  }

  function buildHtml(payload) {
    payload = {
      ...payload,
      items: (payload.items || []).map(item => ({
        ...item,
        average_rating: normalizeAverageRatingValue(item.average_rating == null ? item.averageRating : item.average_rating),
      })),
    };
    // Build genre colour CSS rules embedded in the page
    const genreColors = payload.genre_colors || GENRE_COLORS;
    const genreColorCss = Object.entries(genreColors).map(([label, color]) => {
      const safe = label.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      return `.genre-tag[data-genre="${safe}"],.genre-btn[data-genre="${safe}"]{--gc:${color};}`;
    }).join('\n    ');

    const data = escapeJsonForHtml(JSON.stringify(payload));
    const generated = escapeHtml(new Date(payload.generated_at).toLocaleString());
    const hasGenres = payload.include_genres;
    const hasPlatforms = payload.include_platforms;
    const statusLabelsJson = escapeJsonForHtml(JSON.stringify({ ...STATUS_LABELS, ...(payload.status_labels || {}) }));
    const statusColorsJson = escapeJsonForHtml(JSON.stringify(payload.status_colors || {}));
    const playTypeLabelsJson = escapeJsonForHtml(JSON.stringify(PLAY_TYPE_LABELS));
    const playTypeColorsJson = escapeJsonForHtml(JSON.stringify(PLAY_TYPE_COLORS));
    const tableWidths = {
      genre: hasGenres ? 18 : 0,
      status: 10,
      rating: 8,
      userRating: 8,
      release: 9,
    };
    tableWidths.title = 100 - tableWidths.genre - tableWidths.status - tableWidths.rating - tableWidths.userRating - tableWidths.release;

    // Collect all genres present in the data. MobyGames exports use the exact
    // scraped genre/gameplay values; Backloggd keeps the established genre list.
    const isHowLongToBeatViewer = isSourceWebsite(payload.sourceWebsite, 'howlongtobeat');
    const isMobyGamesViewer = isSourceWebsite(payload.sourceWebsite, 'mobygames') || isHowLongToBeatViewer;
    const allGenres = isMobyGamesViewer
      ? [...new Set(payload.items.flatMap(item => item.genres || []))]
      : GENRE_SLUGS.map(g => g.label).filter(label =>
        payload.items.some(item => (item.genres || []).includes(label))
      );

    // Count games per genre at build time
    const genreCounts = {};
    for (const item of payload.items) {
      for (const g of (item.genres || [])) {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      }
    }

    // Count games per play_type at build time - count any game where played is one of its statuses
    const playTypeCounts = {};
    for (const item of payload.items) {
      if (statusList(item).includes('played') && item.play_type) {
        playTypeCounts[item.play_type] = (playTypeCounts[item.play_type] || 0) + 1;
      }
    }
    // "Played Total" in the sub-pill header = same as the main Played status count
    const playedTotal = payload.counts.played || 0;
    // "Queue Total" = unique games with at least one queue status (playing/backlog/wishlist).
    // We count unique items rather than summing the three status counts, because a game can
    // carry more than one queue status simultaneously and would otherwise be counted twice.
    const queueTotal = payload.items.filter(item =>
      ['playing','backlog','wishlist'].some(s => statusList(item).includes(s))
    ).length;

    // Sort genres alphabetically for grouping
    const allGenresSorted = [...allGenres].sort((a, b) => a.localeCompare(b));
    const genreDisplayedTotal = isMobyGamesViewer && !isHowLongToBeatViewer
      ? new Set([...MOBYGAMES_GENRE_LABELS, ...allGenres]).size
      : allGenres.length;

    const genreBarHtml = buildViewerGenreBarHtml({
      hasGenres,
      allGenres,
      allGenresSorted,
      genreCounts,
      isMobyGamesViewer,
      genreDisplayedTotal,
    });
    const platformFilterHtml = buildViewerPlatformFilterHtml({ hasPlatforms });
    const toolbarHtml = buildViewerToolbarHtml({ hasGenres, hasPlatforms, isMobyGamesViewer });
    const tableHtml = buildViewerTableHtml({ hasGenres });
    const heroHtml = buildViewerHeroHtml({
      payload,
      generated,
      genreBarHtml,
      platformFilterHtml,
      playTypeCounts,
      playedTotal,
      queueTotal,
    });

    const viewerCss = buildViewerCss({ genreColorCss, tableWidths });
    const viewerBody = buildViewerBodyHtml({
      heroHtml,
      toolbarHtml,
      tableHtml,
    });
    const viewerScript = buildViewerScript({
      payload,
      statusLabelsJson,
      statusColorsJson,
      playTypeLabelsJson,
      playTypeColorsJson,
      tableWidths,
      playTypeCounts,
      queueTotal,
      statusPriority: { ...STATUS_PRIORITY, ...(payload.status_priority || {}) },
    });

    return buildViewerDocumentHtml({ payload, data, viewerCss, viewerBody, viewerScript });
  }

  function buildBackloggdPayloadFromRows({
    rows,
    targetSlug,
    counts,
    dedupedCounts,
    releaseByUrl,
    detailReleaseData,
    genresByUrl,
    platformsByUrl,
    includeGenres = false,
    includePlatforms = false,
    includePlatforms226 = false,
  }) {
    const items = rows.map(row => {
      // Prefer detail-page date when it exists (it was only stored when it
      // is a genuine upgrade over the primary - i.e. primary was missing or
      // year-only and detail supplied a more precise value).
      const releaseDate = detailReleaseData.detailReleaseByUrl.get(row.url) || releaseByUrl.get(row.url) || '';
      const item = {
        status: row.status,
        statuses: statusList(row),
        game_id: row.game_id,
        title: row.title,
        url: row.url,
        cover_url: row.cover_url,
        average_rating: normalizeAverageRatingValue(row.average_rating),
        release_date: releaseDate,
        play_type: row.data_status_title || null,
        _title_sort: row.title.toLocaleLowerCase(),
      };
      item.user_rating = row.user_rating_from_card ?? null;
      if (includeGenres) item.genres = genresByUrl.get(row.url) || [];
      if (includePlatforms || includePlatforms226) item.platforms = platformsByUrl.get(row.url) || [];
      return item;
    }).sort((a, b) => a._title_sort.localeCompare(b._title_sort)).map(item => {
      delete item._title_sort;
      return item;
    });

    return {
      sourceWebsite: getSourceWebsite(DEFAULT_SOURCE_ID),
      username: targetSlug,
      source: `${location.origin}/u/${encodeURIComponent(targetSlug)}/games/`,
      generated_at: new Date().toISOString(),
      counts: dedupedCounts,
      raw_counts: counts,
      release_dates_missing: detailReleaseData.failures.length,
      include_genres: includeGenres,
      include_platforms: includePlatforms || includePlatforms226,
      include_platforms226: !!includePlatforms226,
      status_pill_config: null,
      total: items.length,
      items,
    };
  }

  // ---------------------------------------------------------------------------
  // 10. Export orchestration
  // ---------------------------------------------------------------------------

  async function runExport({ includeGenres = false, includePlatforms = false, includePlatforms226 = false, includeOfflineCovers = false } = {}) {
    beginExportSession();
    const exportStartedAt = Date.now();

    try {
      const modeLabel = [
        includeGenres ? 'genres' : '',
        includeOfflineCovers ? 'offline covers' : '',
        includePlatforms ? 'platforms (50)' : '',
        includePlatforms226 ? 'platforms (226)' : '',
      ].filter(Boolean).join(' + ');
      const targetSlug = getExportUserSlug();
      addLog(`Starting export for ${targetSlug}${modeLabel ? ` [+ ${modeLabel}]` : ''}`);

      // -- Single unified scrape pass for all four statuses ---
      // The combined rating endpoint returns played/playing/backlog/wishlist in
      // one page sequence, with per-game status flags and user ratings embedded.
      const { rows, counts, statusFallbackApplied, statusFallbackReleaseByUrl } = await scrapeAllStatuses();
      checkExportCancelled();
      setProgress(38);

      const deduped = dedupeRows(rows);
      const dedupedCounts = Object.fromEntries(STATUS_ORDER.map(status => [status, deduped.rows.filter(item => statusList(item).includes(status)).length]));

      addLog('Using average ratings already shown on library cards');
      addLog('Using user ratings already shown on library cards');
      addLog(`Total unique games after dedup: ${deduped.rows.length}`);
      const estimatedReleasePages = Math.max(1, Math.ceil(deduped.rows.length / 40));

      // Build a Set of all known game URLs for early-bail in genre/platform scraping.
      const knownUrls = new Set(deduped.rows.map(r => r.url).filter(Boolean));

      let releaseByUrl = new Map();
      mergeReleaseDates(releaseByUrl, statusFallbackReleaseByUrl);
      for (const row of deduped.rows) {
        mergeReleaseDate(releaseByUrl, row.url, row.release_date_from_card);
      }
      let genresByUrl = new Map();
      let platformsByUrl = new Map();
      let rowsNeedingListReleaseDates = countRowsNeedingListReleaseDates(deduped.rows, releaseByUrl);

      if (statusFallbackApplied) {
        addLog(`Release dates from status fallback available: ${releaseByUrl.size} found`);
      }

      const needsSubStatusFallback = deduped.rows.some(row =>
        row.url &&
        statusList(row).includes('played') &&
        !row.data_status_title
      );

      if (needsSubStatusFallback) {
        const playTypeFallback = await scrapePlayTypeFallback({
          collectReleaseDates: rowsNeedingListReleaseDates > 0,
          knownUrls,
        });
        checkExportCancelled();
        let filledPlayTypes = 0;
        for (const row of deduped.rows) {
          if (!row.data_status_title && row.url && playTypeFallback.playTypeByUrl.has(row.url)) {
            row.data_status_title = playTypeFallback.playTypeByUrl.get(row.url);
            filledPlayTypes += 1;
          }
        }
        if (filledPlayTypes > 0) {
          addLog(`Played sub-status fallback filled ${filledPlayTypes} games`);
        }
        if (playTypeFallback.releaseByUrl.size) {
          const added = mergeReleaseDates(releaseByUrl, playTypeFallback.releaseByUrl);
          addLog(`Release dates from sub-status fallback: ${added} added`);
          rowsNeedingListReleaseDates = countRowsNeedingListReleaseDates(deduped.rows, releaseByUrl);
        }
      } else {
        addLog('Played sub-status fallback skipped: data-status-title already complete');
      }

      if (includeGenres) {
        setProgress(42);
        const collectGenreReleaseDates = rowsNeedingListReleaseDates > 0;
        const genreData = await scrapeGenresAndReleaseDates({
          collectReleaseDates: collectGenreReleaseDates,
          knownUrls,
        });
        checkExportCancelled();
        const added = mergeReleaseDates(releaseByUrl, genreData.releaseByUrl);
        genresByUrl  = genreData.genresByUrl;
        addLog(`Genres complete: ${genreData.scannedCount}/${GENRE_SLUGS.length} checked; ${genreData.taggedUrlCount} games tagged; ${genreData.taggedCount} total genre tags`);
        if (collectGenreReleaseDates) {
          addLog(`Release dates from genres pass: ${added} added`);
          rowsNeedingListReleaseDates = countRowsNeedingListReleaseDates(deduped.rows, releaseByUrl);
        } else {
          addLog('Release dates from genres pass skipped: already resolved');
        }
        setProgress(65);
      } else {
        // No genres - perform the basic release-date pass (only when no platform
        // tag was selected, since platforms will own the release dates instead).
        setProgress(65);
      }

      if (includePlatforms226) {
        setProgress(66);
        const platformData = await scrapePlatforms226({
          collectReleaseDates: rowsNeedingListReleaseDates > 0,
          knownUrls,
        });
        checkExportCancelled();
        platformsByUrl = platformData.platformsByUrl;
        addLog(`Platforms (226) complete: ${platformData.scannedCount}/${ALL_PLATFORM_SLUGS.length} checked; ${platformData.taggedUrlCount} games tagged; ${platformData.taggedCount} total platform tags`);
        if (platformData.releaseByUrl.size) {
          const added = mergeReleaseDates(releaseByUrl, platformData.releaseByUrl);
          addLog(`Release dates from platforms (226) pass: ${added} added`);
          rowsNeedingListReleaseDates = countRowsNeedingListReleaseDates(deduped.rows, releaseByUrl);
        }
        setProgress(82);
      } else if (includePlatforms) {
        setProgress(66);
        const platformData = await scrapePlatforms({
          collectReleaseDates: rowsNeedingListReleaseDates > 0,
          knownUrls,
        });
        checkExportCancelled();
        platformsByUrl = platformData.platformsByUrl;
        addLog(`Platforms (50) complete: ${platformData.scannedCount}/${PLATFORM_SLUGS.length} checked; ${platformData.taggedUrlCount} games tagged; ${platformData.taggedCount} total platform tags`);
        if (platformData.releaseByUrl.size) {
          const added = mergeReleaseDates(releaseByUrl, platformData.releaseByUrl);
          addLog(`Release dates from platforms (50) pass: ${added} added`);
          rowsNeedingListReleaseDates = countRowsNeedingListReleaseDates(deduped.rows, releaseByUrl);
        }
        setProgress(82);
      }

      const enrichmentReleasePassRan = includeGenres || includePlatforms || includePlatforms226;
      if (enrichmentReleasePassRan) {
        addLog('Release dates from basic pass skipped: already covered by selected genre/platform pass');
      } else {
        await collectReleaseDatesIfNeeded('basic pass', deduped.rows, releaseByUrl, () =>
          scrapeReleaseDates(estimatedReleasePages)
        );
        checkExportCancelled();
      }

      const detailReleaseData = await fetchMissingReleaseDates(deduped.rows, releaseByUrl);
      checkExportCancelled();
      const totalResolved = deduped.rows.filter(row => {
        const d = detailReleaseData.detailReleaseByUrl.get(row.url) || releaseByUrl.get(row.url) || '';
        return !!d;
      }).length;
      addLog(`Release dates resolved: ${totalResolved} of ${deduped.rows.length} games (${detailReleaseData.detailReleaseByUrl.size} from detail fallback)`);
      setProgress(88);

      const payload = buildBackloggdPayloadFromRows({
        rows: deduped.rows,
        targetSlug,
        counts,
        dedupedCounts,
        releaseByUrl,
        detailReleaseData,
        genresByUrl,
        platformsByUrl,
        includeGenres,
        includePlatforms,
        includePlatforms226,
      });

      const finalFormats = getSelectedFileFormats();
      const formatDownload = prepareFormatsForDownload(finalFormats);
      if (!formatDownload.canDownload) {
        setProgress(100);
        addLog(`Finished: ${payload.items.length} games scraped`);
        addLog(`Export took ${formatExportElapsedTime(exportStartedAt)}`);
        return;
      }

      await downloadBackloggdPayload(payload, finalFormats, targetSlug, { includeOfflineCovers });
      setProgress(100);
      addLog(`Finished: ${payload.items.length} games exported`);
      addLog(`Export took ${formatExportElapsedTime(exportStartedAt)}`);
    } catch (error) {
      if (isExportCancelledError(error)) {
        if (!exportStopMessageShown) showExportStoppedMessage();
      } else {
        console.error(error);
        addLog(error && error.message ? error.message : String(error), 'error');
      }
      setProgress(100);
    } finally {
      finishExportSession();
    }
  }

  async function runMobyGamesExport({ includeEnhancedMetadata = false, includeOfflineCovers = false } = {}) {
    beginExportSession();
    const exportStartedAt = Date.now();

    try {
      const collectionUrl = getMobyGamesCollectionRootUrl(location.href);
      if (collectionUrl && !isMobyGamesCollectionRootPage(location.href)) {
        savePendingNavMessage('Navigated to the correct page. Continue with configurations or exporting.');
        location.href = collectionUrl;
        return;
      }
      const targetSlug = getExportUserSlug();
      const targetDisplayName = getMobyGamesDisplayNameFromDocument() || targetSlug;
      const configAtExport = normalizeStatusPillConfig(cloneStatusPillConfig(statusPillConfig));
      const selectedMappings = getMobyGamesConfiguredCollectionMappings(configAtExport);
      const modeLabel = [
        includeEnhancedMetadata ? '+genres, full release dates, all platforms' : '',
        includeOfflineCovers ? 'offline covers' : '',
      ].filter(Boolean).join(' + ');
      const modeSuffix = modeLabel
        ? (modeLabel.startsWith('+') ? ` [${modeLabel}]` : ` [+ ${modeLabel}]`)
        : '';
      addLog(`Starting MobyGames export for ${targetSlug}${modeSuffix}`);
      if (!selectedMappings.length) {
        addLog('No MobyGames collections are assigned in the status pill configuration.', 'error');
        alert(`Please assign at least one ${getSourceWebsite('mobygames')} source to a status pill in the Configuration menu before exporting.`);
        setProgress(100);
        return;
      }

      selectedMappings.forEach(mapping => {
        addLog(`Selected: ${mapping.collection.name} -> ${mapping.status}`);
      });
      setProgress(15);
      const state = {
        active: true,
        phase: 'scrape',
        startUrl: currentMobyGamesUrlWithoutHash(),
        username: targetDisplayName,
        userSlug: targetSlug,
        config: cloneStatusPillConfig(configAtExport),
        formats: getSelectedFileFormats(),
        mappings: selectedMappings,
        currentIndex: 0,
        items: [],
        failures: [],
        collectionCounts: [],
        includeEnhancedMetadata: !!includeEnhancedMetadata,
        includeOfflineCovers: !!includeOfflineCovers,
        enhancedMetadataComplete: false,
        enhancedMetadataMisses: [],
        enhancedMetadataMissesByField: {},
        enhancedMetadataFailures: [],
        startedAt: exportStartedAt,
      };
      saveMobyGamesExportState(state);
      addLog(`Opening ${selectedMappings[0].collection.name} collection page...`);
      location.href = selectedMappings[0].collection.url;
    } catch (error) {
      if (isExportCancelledError(error)) {
        if (!exportStopMessageShown) showExportStoppedMessage();
      } else {
        console.error(error);
        addLog(error && error.message ? error.message : String(error), 'error');
      }
      setProgress(100);
    } finally {
      if (loadMobyGamesExportState()) return;
      finishExportSession();
    }
  }

  function buildHowLongToBeatCachedExportState(configAtExport, selectedMappings, { includeEnhancedMetadata = false, includeOfflineCovers = false, startedAt = Date.now() } = {}) {
    if (!hltbPreflightData || !Array.isArray(hltbPreflightData.items)) return null;
    const mappingsByUrl = new Map();
    selectedMappings.forEach(mapping => {
      const list = mappingsByUrl.get(mapping.collection.url) || [];
      list.push(mapping);
      mappingsByUrl.set(mapping.collection.url, list);
    });
    const items = [];
    (hltbPreflightData.items || []).forEach(item => {
      const mappings = mappingsByUrl.get(item.category_url || item.collection_url || '');
      if (!mappings || !mappings.length) return;
      mappings.forEach(mapping => {
        items.push({
          ...item,
          category: mapping.collection.name,
          category_url: mapping.collection.url,
          collection: mapping.collection.name,
          collection_url: mapping.collection.url,
          status: mapping.status,
          statusId: mapping.statusId,
          status_id: mapping.statusId,
          statusColor: mapping.statusColor,
          statuses: [mapping.status],
          statusIds: [mapping.statusId].filter(Boolean),
          status_ids: [mapping.statusId].filter(Boolean),
        });
      });
    });
    const categoryCounts = selectedMappings.map(mapping => ({
      category: mapping.collection.name,
      status: mapping.status,
      count: items.filter(item => item.category_url === mapping.collection.url && item.statusId === mapping.statusId).length,
    }));
    return {
      active: true,
      phase: 'finalize',
      startUrl: hltbPreflightData.startUrl || currentHowLongToBeatUrlWithoutHash(),
      username: hltbPreflightData.username || getExportUserSlug(),
      userSlug: hltbPreflightData.username || getExportUserSlug(),
      config: cloneStatusPillConfig(configAtExport),
      formats: getSelectedFileFormats(),
      mappings: selectedMappings,
      currentIndex: 0,
      currentPage: 1,
      pageSignatures: [],
      items,
      failures: [],
      categoryCounts,
      includeEnhancedMetadata: !!includeEnhancedMetadata,
      includeOfflineCovers: !!includeOfflineCovers,
      enhancedMetadataComplete: false,
      enhancedMetadataMisses: [],
      enhancedMetadataMissesByField: {},
      enhancedMetadataFailures: [],
      startedAt,
      priorElapsedMs: hltbPreflightData.preflightElapsedMs || 0,
    };
  }

  async function runHowLongToBeatExport({ includeEnhancedMetadata = false, includeOfflineCovers = false } = {}) {
    beginExportSession();
    const exportStartedAt = Date.now();

    try {
      const gamesRootUrl = getHowLongToBeatUserGamesRootUrl(location.href);
      if (gamesRootUrl && !isHowLongToBeatUserGamesRootPage(location.href)) {
        savePendingNavMessage('Navigated to the correct page. Continue with configurations or exporting.');
        location.href = gamesRootUrl;
        return;
      }
      const targetSlug = getExportUserSlug();
      const configAtExport = normalizeStatusPillConfig(cloneStatusPillConfig(statusPillConfig));
      const selectedMappings = getHowLongToBeatConfiguredCategoryMappings(configAtExport);
      const modeLabel = [
        includeEnhancedMetadata ? '+metadata' : '',
        includeOfflineCovers ? 'offline covers' : '',
      ].filter(Boolean).join(' + ');
      const modeSuffix = modeLabel
        ? (modeLabel.startsWith('+') ? ` [${modeLabel}]` : ` [+ ${modeLabel}]`)
        : '';
      addLog(`Starting HowLongToBeat export for ${targetSlug}${modeSuffix}`);
      if (!selectedMappings.length) {
        addLog('No HowLongToBeat categories are assigned in the status pill configuration.', 'error');
        alert(`Please assign at least one ${getSourceWebsite('howlongtobeat')} source to a status pill in the Configuration menu before exporting.`);
        setProgress(100);
        return;
      }

      selectedMappings.forEach(mapping => {
        addLog(`Selected: ${mapping.collection.name} -> ${mapping.status}`);
      });
      setProgress(15);
      const cachedState = buildHowLongToBeatCachedExportState(configAtExport, selectedMappings, {
        includeEnhancedMetadata,
        includeOfflineCovers,
        startedAt: exportStartedAt,
      });
      if (cachedState && cachedState.items.length) {
        addLog(`Using cached HowLongToBeat basic scrape: ${cachedState.items.length} games`);
        saveHowLongToBeatExportState(cachedState);
        await resumeHowLongToBeatExportIfNeeded();
        return;
      }
      const state = {
        active: true,
        phase: 'scrape',
        startUrl: currentHowLongToBeatUrlWithoutHash(),
        username: targetSlug,
        userSlug: targetSlug,
        config: cloneStatusPillConfig(configAtExport),
        formats: getSelectedFileFormats(),
        mappings: selectedMappings,
        currentIndex: 0,
        currentPage: 1,
        pageSignatures: [],
        items: [],
        failures: [],
        categoryCounts: [],
        includeEnhancedMetadata: !!includeEnhancedMetadata,
        includeOfflineCovers: !!includeOfflineCovers,
        enhancedMetadataComplete: false,
        enhancedMetadataMisses: [],
        enhancedMetadataMissesByField: {},
        enhancedMetadataFailures: [],
        startedAt: exportStartedAt,
      };
      saveHowLongToBeatExportState(state);
      addLog(`Opening ${selectedMappings[0].collection.name} category page...`);
      location.href = getHowLongToBeatPageUrl(selectedMappings[0].collection.url, 1);
    } catch (error) {
      if (isExportCancelledError(error)) {
        if (!exportStopMessageShown) showExportStoppedMessage();
      } else {
        console.error(error);
        addLog(error && error.message ? error.message : String(error), 'error');
      }
      setProgress(100);
    } finally {
      if (loadHowLongToBeatExportState()) return;
      finishExportSession();
    }
  }

  function getBackloggdExportOptionsFromControls() {
    return {
      includeGenres: chkGenres && chkGenres.checked,
      includeOfflineCovers: chkOfflineCovers && chkOfflineCovers.checked,
      includePlatforms: chkPlatforms && chkPlatforms.checked,
      includePlatforms226: chkPlatforms226 && chkPlatforms226.checked,
    };
  }

  function getMobyGamesExportOptionsFromControls() {
    return {
      includeEnhancedMetadata: chkGenres && chkGenres.checked,
      includeOfflineCovers: chkOfflineCovers && chkOfflineCovers.checked,
    };
  }

  function getHowLongToBeatExportOptionsFromControls() {
    return {
      includeEnhancedMetadata: chkGenres && chkGenres.checked,
      includeOfflineCovers: chkOfflineCovers && chkOfflineCovers.checked,
    };
  }

  configureSourceDescriptor('backloggd', {
    runtime: {
      id: SOURCE_REGISTRY.backloggd.id,
      getOptionsFromControls: getBackloggdExportOptionsFromControls,
      runExport,
      resumeExport: null,
      clearExportState: null,
    },
  });

  configureSourceDescriptor('mobygames', {
    runtime: {
      id: SOURCE_REGISTRY.mobygames.id,
      getOptionsFromControls: getMobyGamesExportOptionsFromControls,
      runExport: runMobyGamesExport,
      resumeExport: resumeMobyGamesExportIfNeeded,
      clearExportState: clearMobyGamesExportState,
    },
  });

  configureSourceDescriptor('howlongtobeat', {
    runtime: {
      id: SOURCE_REGISTRY.howlongtobeat.id,
      getOptionsFromControls: getHowLongToBeatExportOptionsFromControls,
      runExport: runHowLongToBeatExport,
      resumeExport: resumeHowLongToBeatExportIfNeeded,
      clearExportState: clearHowLongToBeatExportState,
    },
  });

  // Download only the selected file types
  async function runExportWithOptions() {
    const startFormats = getSelectedFileFormats();
    if (!getFileFormatLabels(startFormats).length) {
      alert('Please select at least one file format (CSV, JSON, or HTML).');
      return;
    }
    const runtime = getSourceRuntimeDescriptorForHost();
    await runtime.runExport(runtime.getOptionsFromControls());
  }

  const EXPORTER_DIAGNOSTIC_CHECK_GROUPS = {
    payload: [
      'moby-json-canonical-fields',
      'moby-json-source-meta',
      'moby-normalization-legacy-field-compatibility',
      'moby-normalization-source-meta-canonical-preference',
      'moby-accessor-fallbacks',
      'moby-merge-accessor-identity',
      'moby-html-canonical-fields',
      'moby-csv-header-order',
      'backloggd-shared-counts',
      'backloggd-html-canonical-fields',
      'backloggd-payload-builder',
      'hltb-category-discovery',
      'hltb-game-parser',
      'hltb-pagination-signature',
      'hltb-advanced-game-page-parser',
      'hltb-normalization-merge',
      'hltb-output-builders',
      'shared-json-contract',
    ],
    descriptors: [
      'runtime-descriptor-host-routing',
      'runtime-descriptor-export-functions',
      'format-descriptor-supported-formats',
      'format-descriptor-builder-functions',
      'adapter-descriptor-identity',
      'adapter-descriptor-file-routing',
      'adapter-descriptor-shared-fields',
      'adapter-descriptor-source-meta-fields',
      'adapter-descriptor-ui-status-config',
      'adapter-descriptor-offline-cover-options',
      'hltb-descriptor-runtime-format',
    ],
  };

  function parseViewerPayloadFromHtmlForDiagnostics(html, label) {
    const match = String(html || '').match(/<script id="payload" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) throw new Error(`${label} HTML did not embed a viewer payload.`);
    return JSON.parse(match[1].replace(/<\\\/script>/gi, '</script>'));
  }

  // Passive diagnostics for payload shape and descriptor wiring.
  function runExporterDiagnostics() {
    const mobyPayload = {
      sourceWebsite: getSourceWebsite('mobygames'),
      username: 'tester',
      source: 'https://www.mobygames.com/user/1/tester/collection/',
      generated_at: '2026-01-02T03:04:05.000Z',
      items: [{
        name: 'Example Game',
        gameUrl: 'https://www.mobygames.com/game/example-game/',
        coverUrl: 'https://cdn.example.test/cover.jpg',
        statuses: ['Finished'],
        statusIds: ['status-finished'],
        collection: 'Finished',
        collectionUrl: 'https://www.mobygames.com/user/1/tester/collection/finished/',
        releaseYear: 2024,
        fullReleaseDate: 'Jan 15, 2024',
        genres: ['Action'],
        gameplay: ['Arcade'],
        platforms: ['Windows'],
        userRating: 4,
        averageRating: 3.8,
      }],
    };
    const jsonPayload = JSON.parse(buildMobyGamesJson(mobyPayload));
    const jsonItem = jsonPayload.items[0];
    const forbiddenJsonFields = ['name', 'gameUrl', 'coverUrl', 'collectionUrl', 'releaseYear', 'fullReleaseDate', 'userRating', 'averageRating'];
    const leakedFields = forbiddenJsonFields.filter(field => Object.prototype.hasOwnProperty.call(jsonItem, field));
    if (leakedFields.length) throw new Error(`MobyGames JSON leaked legacy fields: ${leakedFields.join(', ')}`);
    if (jsonItem.title !== 'Example Game') throw new Error('MobyGames JSON did not preserve title.');
    if (jsonItem.url !== mobyPayload.items[0].gameUrl) throw new Error('MobyGames JSON did not map url.');
    if (jsonItem.cover_url !== mobyPayload.items[0].coverUrl) throw new Error('MobyGames JSON did not map cover_url.');
    if (!jsonItem.source_meta || jsonItem.source_meta.collection !== 'Finished') throw new Error('MobyGames JSON source_meta is missing collection.');
    if (!Array.isArray(jsonItem.source_meta.gameplay) || jsonItem.source_meta.gameplay[0] !== 'Arcade') throw new Error('MobyGames JSON source_meta is missing gameplay.');

    const sharedJsonPayload = JSON.parse(buildSharedJson({
      sourceWebsite: getSourceWebsite(DEFAULT_SOURCE_ID),
      username: 'tester',
      source: 'https://backloggd.com/u/tester/games/',
      items: [{
        title: 'Shared Contract Game',
        url: 'https://backloggd.com/games/shared-contract-game/',
        cover_url: 'https://cdn.example.test/shared-contract-cover.jpg',
        status: 'played',
        statuses: ['played'],
        release_date: '2024',
        genres: ['Action'],
        platforms: ['Windows PC'],
        game_id: 'shared-contract-1',
        play_type: 'completed',
      }],
    }, DEFAULT_SOURCE_ID));
    const sharedJsonItem = sharedJsonPayload.items[0];
    if (sharedJsonItem.title !== 'Shared Contract Game' || sharedJsonItem.url !== 'https://backloggd.com/games/shared-contract-game/') {
      throw new Error('Shared JSON contract did not preserve canonical item fields.');
    }
    if (!sharedJsonItem.source_meta || sharedJsonItem.source_meta.game_id !== 'shared-contract-1' || sharedJsonItem.source_meta.play_type !== 'completed') {
      throw new Error('Shared JSON contract did not preserve source-specific item metadata.');
    }

    const mixedMobyItem = normalizeMobyGamesSharedExportItem({
      name: 'Legacy Field Game',
      gameUrl: 'https://www.mobygames.com/game/legacy-field-game/',
      coverUrl: 'https://cdn.example.test/legacy-cover.jpg',
      collectionUrl: 'https://www.mobygames.com/user/1/tester/collection/legacy/',
      releaseYear: 1999,
      fullReleaseDate: 'Feb 20, 1999',
      userRating: 3.5,
      averageRating: 4.2,
      source_meta: {
        collection: 'Legacy Collection',
        gameplay: ['Puzzle'],
        status_ids: ['legacy-status'],
      },
    });
    if (mixedMobyItem.url !== 'https://www.mobygames.com/game/legacy-field-game/') throw new Error('MobyGames normalization did not map legacy gameUrl to url.');
    if (mixedMobyItem.cover_url !== 'https://cdn.example.test/legacy-cover.jpg') throw new Error('MobyGames normalization did not map legacy coverUrl to cover_url.');
    if (mixedMobyItem.collection_url !== 'https://www.mobygames.com/user/1/tester/collection/legacy/') throw new Error('MobyGames normalization did not map legacy collectionUrl to collection_url.');
    if (mixedMobyItem.release_year !== 1999) throw new Error('MobyGames normalization did not map legacy releaseYear to release_year.');
    if (mixedMobyItem.full_release_date !== 'Feb 20, 1999') throw new Error('MobyGames normalization did not map legacy fullReleaseDate to full_release_date.');
    if (mixedMobyItem.user_rating !== 3.5) throw new Error('MobyGames normalization did not map legacy userRating to user_rating.');
    if (mixedMobyItem.average_rating !== 4.2) throw new Error('MobyGames normalization did not map legacy averageRating to average_rating.');
    if (!mixedMobyItem.source_meta || mixedMobyItem.source_meta.collection_url !== mixedMobyItem.collection_url) {
      throw new Error('MobyGames normalization did not preserve collection_url in source_meta.');
    }
    if (!Array.isArray(mixedMobyItem.source_meta.gameplay) || mixedMobyItem.source_meta.gameplay[0] !== 'Puzzle') {
      throw new Error('MobyGames normalization did not preserve source_meta gameplay.');
    }
    const canonicalSourceMetaItem = normalizeMobyGamesSharedExportItem({
      title: 'Canonical Source Meta Game',
      collectionUrl: 'https://www.mobygames.com/user/1/tester/collection/legacy-source-meta/',
      collection_url: 'https://www.mobygames.com/user/1/tester/collection/canonical-source-meta/',
      releaseYear: 1998,
      release_year: 1999,
      fullReleaseDate: 'Jan 1, 1998',
      full_release_date: 'Jan 2, 1999',
    });
    if (canonicalSourceMetaItem.source_meta.collection_url !== 'https://www.mobygames.com/user/1/tester/collection/canonical-source-meta/') {
      throw new Error('MobyGames normalization source_meta did not prefer canonical collection_url.');
    }
    if (canonicalSourceMetaItem.source_meta.release_year !== 1999) {
      throw new Error('MobyGames normalization source_meta did not prefer canonical release_year.');
    }
    if (canonicalSourceMetaItem.source_meta.full_release_date !== 'Jan 2, 1999') {
      throw new Error('MobyGames normalization source_meta did not prefer canonical full_release_date.');
    }

    const canonicalAccessorItem = {
      url: 'https://www.mobygames.com/game/canonical-accessor-game/',
      cover_url: 'https://cdn.example.test/canonical-cover.jpg',
      collection_url: 'https://www.mobygames.com/user/1/tester/collection/canonical/',
      release_year: 2001,
      full_release_date: 'Mar 3, 2001',
    };
    if (mobyItemUrl(canonicalAccessorItem) !== canonicalAccessorItem.url) throw new Error('MobyGames url accessor did not prefer canonical url.');
    if (mobyItemCoverUrl(canonicalAccessorItem) !== canonicalAccessorItem.cover_url) throw new Error('MobyGames cover accessor did not prefer canonical cover_url.');
    if (mobyItemCollectionUrl(canonicalAccessorItem) !== canonicalAccessorItem.collection_url) throw new Error('MobyGames collection accessor did not prefer canonical collection_url.');
    if (mobyItemReleaseYear(canonicalAccessorItem) !== canonicalAccessorItem.release_year) throw new Error('MobyGames release year accessor did not prefer canonical release_year.');
    if (mobyItemFullReleaseDate(canonicalAccessorItem) !== canonicalAccessorItem.full_release_date) throw new Error('MobyGames full release date accessor did not prefer canonical full_release_date.');
    const legacyAccessorItem = {
      gameUrl: 'https://www.mobygames.com/game/legacy-accessor-game/',
      coverUrl: 'https://cdn.example.test/legacy-accessor-cover.jpg',
      collectionUrl: 'https://www.mobygames.com/user/1/tester/collection/legacy-accessor/',
      releaseYear: 2002,
      fullReleaseDate: 'Apr 4, 2002',
    };
    if (mobyItemUrl(legacyAccessorItem) !== legacyAccessorItem.gameUrl) throw new Error('MobyGames url accessor did not fall back to legacy gameUrl.');
    if (mobyItemCoverUrl(legacyAccessorItem) !== legacyAccessorItem.coverUrl) throw new Error('MobyGames cover accessor did not fall back to legacy coverUrl.');
    if (mobyItemCollectionUrl(legacyAccessorItem) !== legacyAccessorItem.collectionUrl) throw new Error('MobyGames collection accessor did not fall back to legacy collectionUrl.');
    if (mobyItemReleaseYear(legacyAccessorItem) !== legacyAccessorItem.releaseYear) throw new Error('MobyGames release year accessor did not fall back to legacy releaseYear.');
    if (mobyItemFullReleaseDate(legacyAccessorItem) !== legacyAccessorItem.fullReleaseDate) throw new Error('MobyGames full release date accessor did not fall back to legacy fullReleaseDate.');

    const mergedAccessorItems = mergeMobyGamesItemsForExport([
      {
        title: 'Accessor Merge Game',
        url: 'https://www.mobygames.com/game/accessor-merge-game/',
        cover_url: 'https://cdn.example.test/accessor-canonical-cover.jpg',
        collection: 'Finished',
        collection_url: 'https://www.mobygames.com/user/1/tester/collection/finished/',
        release_year: 2005,
        full_release_date: 'May 5, 2005',
        status: 'Finished',
        status_id: 'finished',
        statuses: ['Finished'],
        status_ids: ['finished'],
      },
      {
        name: 'Accessor Merge Game',
        gameUrl: 'https://www.mobygames.com/game/accessor-merge-game/',
        coverUrl: 'https://cdn.example.test/accessor-legacy-cover.jpg',
        collection: 'Wishlist',
        collectionUrl: 'https://www.mobygames.com/user/1/tester/collection/wishlist/',
        status: 'Wishlist',
        statusId: 'wishlist',
        statuses: ['Wishlist'],
        statusIds: ['wishlist'],
      },
    ], null);
    if (mergedAccessorItems.length !== 1) throw new Error('MobyGames merge did not combine canonical url and legacy gameUrl items.');
    const mergedAccessorItem = mergedAccessorItems[0];
    if (mergedAccessorItem.url !== 'https://www.mobygames.com/game/accessor-merge-game/') {
      throw new Error('MobyGames merge output did not preserve canonical url.');
    }
    if (mergedAccessorItem.cover_url !== 'https://cdn.example.test/accessor-canonical-cover.jpg') {
      throw new Error('MobyGames merge output did not preserve canonical cover_url.');
    }
    if (mergedAccessorItem.collection_url !== 'https://www.mobygames.com/user/1/tester/collection/finished/') {
      throw new Error('MobyGames merge output did not preserve canonical collection_url.');
    }
    if (mergedAccessorItem.release_year !== 2005) {
      throw new Error('MobyGames merge output did not preserve canonical release_year.');
    }
    if (mergedAccessorItem.full_release_date !== 'May 5, 2005') {
      throw new Error('MobyGames merge output did not preserve canonical full_release_date.');
    }
    if (!mergedAccessorItem.statuses.includes('Finished') || !mergedAccessorItem.statuses.includes('Wishlist')) {
      throw new Error('MobyGames merge did not preserve statuses from canonical and legacy URL items.');
    }
    if (!mergedAccessorItem.collection_urls.includes('https://www.mobygames.com/user/1/tester/collection/finished/')
      || !mergedAccessorItem.collection_urls.includes('https://www.mobygames.com/user/1/tester/collection/wishlist/')) {
      throw new Error('MobyGames merge did not preserve collection URLs from canonical and legacy URL items.');
    }
    if (mobyItemCoverUrl(mergedAccessorItem) !== 'https://cdn.example.test/accessor-canonical-cover.jpg') {
      throw new Error('MobyGames merge did not preserve canonical cover URL.');
    }

    const html = buildMobyGamesHtml(mobyPayload);
    const htmlPayload = parseViewerPayloadFromHtmlForDiagnostics(html, 'MobyGames');
    const htmlItem = htmlPayload.items && htmlPayload.items[0];
    if (!htmlItem) throw new Error('MobyGames HTML payload is missing an item.');
    const leakedHtmlFields = forbiddenJsonFields.filter(field => Object.prototype.hasOwnProperty.call(htmlItem, field));
    if (leakedHtmlFields.length) throw new Error(`MobyGames HTML payload leaked legacy fields: ${leakedHtmlFields.join(', ')}`);
    if (htmlItem.title !== 'Example Game') throw new Error('MobyGames HTML payload did not preserve title.');
    if (htmlItem.url !== mobyPayload.items[0].gameUrl) throw new Error('MobyGames HTML payload did not map url.');
    if (htmlItem.cover_url !== mobyPayload.items[0].coverUrl) throw new Error('MobyGames HTML payload did not map cover_url.');
    if (!htmlItem.source_meta || htmlItem.source_meta.collection !== 'Finished') throw new Error('MobyGames HTML payload source_meta is missing collection.');

    const csv = buildMobyGamesCsv(mobyPayload);
    const header = csv.split(/\r?\n/).find(line => line && line[0] !== '#');
    const expectedHeader = 'release_date,title,status,average_rating,user_rating,genres,gameplay,platforms,game_id,url,cover_url,collection,collection_url,release_year,full_release_date,status_ids';
    if (header !== expectedHeader) throw new Error('MobyGames CSV header order is not unified.');

    const backloggdPayload = normalizeSharedExportPayload({
      username: 'tester',
      sourceWebsite: getSourceWebsite(DEFAULT_SOURCE_ID),
      items: [{
        title: 'Backloggd Game',
        status: 'played',
        url: 'https://backloggd.com/games/backloggd-game/',
        cover_url: 'https://cdn.example.test/backloggd-cover.jpg',
        release_date: '2024',
        genres: ['Action'],
        platforms: ['Windows PC'],
      }],
    }, { sourceWebsite: getSourceWebsite(DEFAULT_SOURCE_ID), username: 'tester', defaultStatus: 'played' });
    if (backloggdPayload.total !== 1 || backloggdPayload.counts.played !== 1) {
      throw new Error('Backloggd shared payload normalization failed counts/total.');
    }
    const backloggdHtml = buildHtml(backloggdPayload);
    const backloggdHtmlPayload = parseViewerPayloadFromHtmlForDiagnostics(backloggdHtml, 'Backloggd');
    const backloggdHtmlItem = backloggdHtmlPayload.items && backloggdHtmlPayload.items[0];
    if (!backloggdHtmlItem) throw new Error('Backloggd HTML payload is missing an item.');
    const leakedBackloggdHtmlFields = forbiddenJsonFields.filter(field => Object.prototype.hasOwnProperty.call(backloggdHtmlItem, field));
    if (leakedBackloggdHtmlFields.length) throw new Error(`Backloggd HTML payload leaked legacy fields: ${leakedBackloggdHtmlFields.join(', ')}`);
    if (backloggdHtmlItem.title !== 'Backloggd Game') throw new Error('Backloggd HTML payload did not preserve title.');
    if (backloggdHtmlItem.url !== 'https://backloggd.com/games/backloggd-game/') throw new Error('Backloggd HTML payload did not preserve url.');
    if (backloggdHtmlItem.cover_url !== 'https://cdn.example.test/backloggd-cover.jpg') throw new Error('Backloggd HTML payload did not preserve cover_url.');
    if (backloggdHtmlItem.release_date !== '2024') throw new Error('Backloggd HTML payload did not preserve release_date.');

    const builtBackloggdPayload = buildBackloggdPayloadFromRows({
      rows: [{
        status: 'played',
        statuses: ['played'],
        game_id: 'bgd-1',
        title: 'Backloggd Builder Game',
        url: 'https://backloggd.com/games/backloggd-builder-game/',
        cover_url: 'https://cdn.example.test/builder-cover.jpg',
        average_rating: 3.5,
        user_rating_from_card: 4,
        data_status_title: 'completed',
      }],
      targetSlug: 'tester',
      counts: { played: 1, playing: 0, backlog: 0, wishlist: 0 },
      dedupedCounts: { played: 1, playing: 0, backlog: 0, wishlist: 0 },
      releaseByUrl: new Map([['https://backloggd.com/games/backloggd-builder-game/', '2024']]),
      detailReleaseData: {
        detailReleaseByUrl: new Map([['https://backloggd.com/games/backloggd-builder-game/', 'Jan 15, 2024']]),
        failures: [],
      },
      genresByUrl: new Map([['https://backloggd.com/games/backloggd-builder-game/', ['Action']]]),
      platformsByUrl: new Map([['https://backloggd.com/games/backloggd-builder-game/', ['Windows PC']]]),
      includeGenres: true,
      includePlatforms: true,
    });
    const builtBackloggdItem = builtBackloggdPayload.items[0];
    if (builtBackloggdPayload.total !== 1 || builtBackloggdPayload.counts.played !== 1) {
      throw new Error('Backloggd payload builder failed counts/total.');
    }
    if (builtBackloggdItem.release_date !== 'Jan 15, 2024') {
      throw new Error('Backloggd payload builder did not prefer detail release date.');
    }
    if (!builtBackloggdItem.genres.includes('Action') || !builtBackloggdItem.platforms.includes('Windows PC')) {
      throw new Error('Backloggd payload builder did not attach genres/platforms.');
    }

    const hltbNavDoc = new DOMParser().parseFromString(`
      <ul>
        <li style="display:list-item" class="UserGamesForm-module__abc__user_games_nav back_dark">Playing</li>
        <li style="display:list-item" class="UserGamesForm-module__abc__user_games_nav back_dark">Backlog</li>
        <li style="display:none" class="UserGamesForm-module__abc__user_games_nav back_dark">Played</li>
        <li style="display:list-item" class="UserGamesForm-module__abc__user_games_nav back_purple">Complete<span class="mobile_hide_inline">d</span></li>
        <li style="display:list-item" class="UserGamesForm-module__abc__user_games_nav back_purple">On Hold</li>
        <li class="UserGamesForm-module__abc__user_games_nav UserGamesForm-module__abc__user_games_opt desktop_hide shadow_box">Options</li>
      </ul>
    `, 'text/html');
    const hltbCategories = parseHowLongToBeatCategoriesDocument(hltbNavDoc);
    if (hltbCategories.map(category => category.name).join('|') !== 'Playing|Backlog|Replays|Completed|Retired|On Hold') {
      throw new Error('HowLongToBeat category discovery did not preserve default/custom category names.');
    }
    if (!hltbCategories.some(category => category.url === 'https://howlongtobeat.com/user/tester/games/completed/1')) {
      throw new Error('HowLongToBeat category discovery did not build the expected Completed URL.');
    }
    if (!hltbCategories.some(category => category.name === 'On Hold' && category.url === 'https://howlongtobeat.com/user/tester/games/custom/1')) {
      throw new Error('HowLongToBeat category discovery did not map the first custom category to the custom route.');
    }

    const hltbMapping = {
      statusId: 'completed',
      status: 'Completed',
      statusColor: '#1fbf75',
      collection: { name: 'Completed', url: 'https://howlongtobeat.com/user/tester/games/completed/1', games: 0 },
    };
    const hltbGamesDoc = new DOMParser().parseFromString(`
      <div id="user_games">
        <a href="https://howlongtobeat.com/user/tester/games/completed/1">Game</a>
        <div class="game-row">
          <a href="/game/123">Example HLTB Game</a>
          <span class="platform">PC</span>
        </div>
        <div class="game-row">
          <a href="https://howlongtobeat.com/game/456">Console HLTB Game</a>
          <span aria-label="Platform">Nintendo Switch</span>
        </div>
      </div>
    `, 'text/html');
    const hltbParsed = parseHowLongToBeatGamesDocument(hltbGamesDoc, 'https://howlongtobeat.com/user/tester/games/completed/1', hltbMapping);
    if (hltbParsed.games.length !== 2 || hltbParsed.games[0].title !== 'Example HLTB Game' || hltbParsed.games[0].platform !== 'PC') {
      throw new Error('HowLongToBeat game parser did not extract title/platform rows.');
    }
    if (hltbParsed.games[0].url !== 'https://howlongtobeat.com/game/123') {
      throw new Error('HowLongToBeat game parser did not normalize game URLs.');
    }
    const hltbSignature = hltbParsed.games.map(game => `${game.gameUrl}|${game.platform}`).join('||');
    if (!hltbSignature || ![hltbSignature].includes(hltbSignature)) {
      throw new Error('HowLongToBeat pagination signature check failed.');
    }

    const hltbDetailData = {
      props: {
        pageProps: {
          pageMetadata: {
            image: 'https://howlongtobeat.com/games/example.jpg?width=250',
          },
          game: {
            data: {
              game: [{
                profile_platform: 'PC, Nintendo Switch',
                profile_genre: 'Action, RPG',
                release_world: '2007-01-20',
                release_na: '2007-02-10',
                release_eu: '0000-00-00',
                release_jp: '2008-03-01',
                review_score: 84,
              }],
            },
          },
        },
      },
    };
    const hltbDetailDoc = new DOMParser().parseFromString(`
      <html><head>
        <meta property="og:image" content="https://howlongtobeat.com/games/fallback.jpg?width=120">
      </head><body>
        <ul class="profile_details"><li>84% Rating</li></ul>
        <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(hltbDetailData)}</script>
      </body></html>
    `, 'text/html');
    const hltbDetails = extractHowLongToBeatGamePageDetails(hltbDetailDoc, 'https://howlongtobeat.com/game/123');
    if (hltbDetails.gamePagePlatforms !== 'PC, Nintendo Switch') throw new Error('HowLongToBeat advanced parser did not extract game-page platforms.');
    if (hltbDetails.gamePageRating !== 4.2) throw new Error('HowLongToBeat advanced parser did not convert percent rating to 0-5 scale.');
    if (hltbDetails.releaseDate !== 'Jan 20, 2007') throw new Error('HowLongToBeat advanced parser did not format earliest release date.');
    if (!hltbDetails.genres.includes('Action') || !hltbDetails.genres.includes('RPG')) throw new Error('HowLongToBeat advanced parser did not split genres.');
    if (hltbDetails.coverUrl !== 'https://howlongtobeat.com/games/example.jpg') throw new Error('HowLongToBeat advanced parser did not strip cover width.');
    const hltbPartialReleaseDoc = new DOMParser().parseFromString(`
      <div class="GameSummary-module__profile_info"><strong>EU:</strong> <br>1988</div>
      <div class="GameSummary-module__profile_info"><strong>JP:</strong> <br>February 1988</div>
    `, 'text/html');
    const hltbPartialReleaseDetails = extractHowLongToBeatGamePageDetails(hltbPartialReleaseDoc, 'https://howlongtobeat.com/game/789');
    if (hltbPartialReleaseDetails.releaseDate !== 'Feb 1988') throw new Error('HowLongToBeat advanced parser did not prefer earliest month/year partial release date.');
    const hltbEarlierYearReleaseDoc = new DOMParser().parseFromString(`
      <div class="GameSummary-module__profile_info"><strong>EU:</strong> <br>1987</div>
      <div class="GameSummary-module__profile_info"><strong>JP:</strong> <br>February 1988</div>
    `, 'text/html');
    const hltbEarlierYearReleaseDetails = extractHowLongToBeatGamePageDetails(hltbEarlierYearReleaseDoc, 'https://howlongtobeat.com/game/790');
    if (hltbEarlierYearReleaseDetails.releaseDate !== '1987') throw new Error('HowLongToBeat advanced parser did not prefer an earlier year over a later month/year release date.');

    const hltbConfig = cloneStatusPillConfig(makeDefaultStatusPillConfig());
    hltbConfig.categories[0].pills[1].collections = [{ name: 'Completed', url: 'https://howlongtobeat.com/user/tester/games/completed/1', games: 0 }];
    hltbConfig.categories[0].pills[2].collections = [{ name: 'Retired', url: 'https://howlongtobeat.com/user/tester/games/retired/1', games: 0 }];
    const hltbMerged = mergeHowLongToBeatItemsForExport([
      hltbParsed.games[0],
      {
        ...hltbParsed.games[0],
        status: 'Retired',
        statuses: ['Retired'],
        statusId: 'retired',
        status_id: 'retired',
        statusIds: ['retired'],
        status_ids: ['retired'],
        category: 'Retired',
        category_url: 'https://howlongtobeat.com/user/tester/games/retired/1',
        collection: 'Retired',
        collection_url: 'https://howlongtobeat.com/user/tester/games/retired/1',
      },
    ], hltbConfig);
    if (hltbMerged.length !== 1 || hltbMerged[0].statuses.length !== 2 || hltbMerged[0].category_urls.length !== 2) {
      throw new Error('HowLongToBeat merge did not preserve multiple statuses/categories for one game.');
    }
    const hltbPayload = {
      sourceWebsite: getSourceWebsite('howlongtobeat'),
      username: 'tester',
      source: 'https://howlongtobeat.com/user/tester/games/completed/1',
      generated_at: '2026-01-02T03:04:05.000Z',
      status_pill_config: hltbConfig,
      categories: [{ name: 'Completed', url: 'https://howlongtobeat.com/user/tester/games/completed/1', status: 'Completed' }],
      items: hltbMerged,
    };
    const hltbJsonPayload = JSON.parse(buildHowLongToBeatJson(hltbPayload));
    const hltbJsonItem = hltbJsonPayload.items[0];
    if (hltbJsonPayload.sourceWebsite !== getSourceWebsite('howlongtobeat') || hltbJsonItem.title !== 'Example HLTB Game') {
      throw new Error('HowLongToBeat JSON builder did not preserve source identity/title.');
    }
    if (!hltbJsonItem.source_meta || hltbJsonItem.source_meta.category !== 'Completed; Retired') {
      throw new Error('HowLongToBeat JSON source_meta is missing category data.');
    }
    const hltbHtml = buildHowLongToBeatHtml(hltbPayload);
    const hltbHtmlPayload = parseViewerPayloadFromHtmlForDiagnostics(hltbHtml, 'HowLongToBeat');
    if (hltbHtmlPayload.sourceWebsite !== getSourceWebsite('howlongtobeat') || !hltbHtmlPayload.status_pill_config) {
      throw new Error('HowLongToBeat HTML builder did not preserve source identity/status config.');
    }
    if (!hltbHtmlPayload.items[0].source_meta || hltbHtmlPayload.items[0].source_meta.category !== 'Completed; Retired') {
      throw new Error('HowLongToBeat HTML builder did not preserve category source_meta.');
    }
    const hltbHtmlDoc = new DOMParser().parseFromString(hltbHtml, 'text/html');
    const completedConfigCount = hltbHtmlDoc.querySelector('[data-config-status-id="completed"] .sub-num');
    const retiredConfigCount = hltbHtmlDoc.querySelector('[data-config-status-id="retired"] .sub-num');
    if (!completedConfigCount || completedConfigCount.textContent !== '1' || !retiredConfigCount || retiredConfigCount.textContent !== '1') {
      throw new Error('HowLongToBeat HTML configured status pill counts did not use exported status ids.');
    }
    const hltbCsvHeader = buildHowLongToBeatCsv(hltbPayload).split(/\r?\n/).find(line => line && line[0] !== '#');
    if (hltbCsvHeader !== 'release_date,title,status,average_rating,user_rating,genres,platforms,game_id,url,cover_url,category,category_url,status_ids') {
      throw new Error('HowLongToBeat CSV header order is not unified.');
    }
    const hltbConvertedCsvPayload = parseHowLongToBeatCsvExportPayload([
      '# Exported from HowLongToBeat',
      'release_date,title,status,average_rating,user_rating,genres,platforms,game_id,url,cover_url,category,category_url,status_ids',
      '2024,CSV HLTB Game,Completed,4.1,3.5,Action; RPG,PC,https://howlongtobeat.com/game/999,https://howlongtobeat.com/game/999,https://cdn.example.test/hltb.jpg,Completed,https://howlongtobeat.com/user/tester/games/completed/1,completed',
    ].join('\n'), 'tester-howlongtobeat-library.csv');
    const hltbConvertedHtmlPayload = parseViewerPayloadFromHtmlForDiagnostics(buildHowLongToBeatHtml(hltbConvertedCsvPayload), 'HowLongToBeat converted CSV');
    const hltbConvertedItem = hltbConvertedHtmlPayload.items && hltbConvertedHtmlPayload.items[0];
    if (!hltbConvertedItem || !hltbConvertedItem.genres.includes('Action') || !hltbConvertedItem.genres.includes('RPG') || !hltbConvertedHtmlPayload.include_genres) {
      throw new Error('HowLongToBeat CSV to HTML conversion did not preserve genres.');
    }
    if (hltbConvertedItem.average_rating !== 4.1 || hltbConvertedItem.user_rating !== 3.5) {
      throw new Error('HowLongToBeat CSV conversion did not preserve ratings.');
    }

    if (getSourceRuntimeDescriptorForHost('www.mobygames.com').id !== SOURCE_REGISTRY.mobygames.id) {
      throw new Error('Runtime descriptor did not identify MobyGames host.');
    }
    if (getSourceRuntimeDescriptorForHost('howlongtobeat.com').id !== SOURCE_REGISTRY.howlongtobeat.id) {
      throw new Error('Runtime descriptor did not identify HowLongToBeat host.');
    }
    if (getSourceRuntimeDescriptorForHost('backloggd.com').id !== SOURCE_REGISTRY.backloggd.id) {
      throw new Error('Runtime descriptor did not identify Backloggd host.');
    }
    if (SOURCE_REGISTRY.mobygames.runtime.runExport !== runMobyGamesExport) {
      throw new Error('MobyGames runtime descriptor is not mapped to MobyGames export.');
    }
    if (SOURCE_REGISTRY.howlongtobeat.runtime.runExport !== runHowLongToBeatExport) {
      throw new Error('HowLongToBeat runtime descriptor is not mapped to HowLongToBeat export.');
    }
    if (SOURCE_REGISTRY.backloggd.runtime.runExport !== runExport) {
      throw new Error('Backloggd runtime descriptor is not mapped to Backloggd export.');
    }

    const expectedFormats = ['csv', 'json', 'html'];
    const backloggdFormatDescriptor = getSourceFormatDescriptor('backloggd');
    const mobyGamesFormatDescriptor = getSourceFormatDescriptor('mobygames');
    const hltbFormatDescriptor = getSourceFormatDescriptor('howlongtobeat');
    if (backloggdFormatDescriptor.id !== SOURCE_REGISTRY.backloggd.id) {
      throw new Error('Format descriptor did not identify Backloggd mode.');
    }
    if (mobyGamesFormatDescriptor.id !== SOURCE_REGISTRY.mobygames.id) {
      throw new Error('Format descriptor did not identify MobyGames mode.');
    }
    if (hltbFormatDescriptor.id !== SOURCE_REGISTRY.howlongtobeat.id) {
      throw new Error('Format descriptor did not identify HowLongToBeat mode.');
    }
    if (!expectedFormats.every(format => backloggdFormatDescriptor.supportedFormats.includes(format))) {
      throw new Error('Backloggd format descriptor is missing a supported export format.');
    }
    if (!expectedFormats.every(format => mobyGamesFormatDescriptor.supportedFormats.includes(format))) {
      throw new Error('MobyGames format descriptor is missing a supported export format.');
    }
    if (!expectedFormats.every(format => hltbFormatDescriptor.supportedFormats.includes(format))) {
      throw new Error('HowLongToBeat format descriptor is missing a supported export format.');
    }
    if (backloggdFormatDescriptor.buildCsv !== buildCsv || backloggdFormatDescriptor.buildHtml !== buildHtml) {
      throw new Error('Backloggd format descriptor builder mapping is incorrect.');
    }
    if (mobyGamesFormatDescriptor.buildCsv !== buildMobyGamesCsv || mobyGamesFormatDescriptor.buildJson !== buildMobyGamesJson || mobyGamesFormatDescriptor.buildHtml !== buildMobyGamesHtml) {
      throw new Error('MobyGames format descriptor builder mapping is incorrect.');
    }
    if (hltbFormatDescriptor.buildCsv !== buildHowLongToBeatCsv || hltbFormatDescriptor.buildJson !== buildHowLongToBeatJson || hltbFormatDescriptor.buildHtml !== buildHowLongToBeatHtml) {
      throw new Error('HowLongToBeat format descriptor builder mapping is incorrect.');
    }

    const backloggdAdapterDescriptor = SOURCE_REGISTRY.backloggd;
    const mobyGamesAdapterDescriptor = SOURCE_REGISTRY.mobygames;
    const hltbAdapterDescriptor = SOURCE_REGISTRY.howlongtobeat;
    if (backloggdAdapterDescriptor.id !== 'backloggd' || backloggdAdapterDescriptor.label !== 'Backloggd' || backloggdAdapterDescriptor.sourceWebsite !== 'Backloggd') {
      throw new Error('Backloggd adapter descriptor identity fields are incorrect.');
    }
    if (mobyGamesAdapterDescriptor.id !== 'mobygames' || mobyGamesAdapterDescriptor.label !== 'MobyGames' || mobyGamesAdapterDescriptor.sourceWebsite !== 'MobyGames') {
      throw new Error('MobyGames adapter descriptor identity fields are incorrect.');
    }
    if (hltbAdapterDescriptor.id !== 'howlongtobeat' || hltbAdapterDescriptor.label !== 'HowLongToBeat' || hltbAdapterDescriptor.sourceWebsite !== 'HowLongToBeat') {
      throw new Error('HowLongToBeat adapter descriptor identity fields are incorrect.');
    }
    if (backloggdAdapterDescriptor.match.hostPattern !== 'backloggd.com' || backloggdAdapterDescriptor.export.filenameSuffix !== 'backloggd-library') {
      throw new Error('Backloggd adapter descriptor host/filename fields are incorrect.');
    }
    if (mobyGamesAdapterDescriptor.match.hostPattern !== 'mobygames.com' || mobyGamesAdapterDescriptor.export.filenameSuffix !== 'mobygames-library') {
      throw new Error('MobyGames adapter descriptor host/filename fields are incorrect.');
    }
    if (hltbAdapterDescriptor.match.hostPattern !== 'howlongtobeat.com' || hltbAdapterDescriptor.export.filenameSuffix !== 'howlongtobeat-library') {
      throw new Error('HowLongToBeat adapter descriptor host/filename fields are incorrect.');
    }
    const expectedSharedItemFields = ['title', 'url', 'cover_url', 'status', 'statuses', 'release_date', 'genres', 'platforms', 'user_rating', 'average_rating'];
    if (!expectedSharedItemFields.every(field => backloggdAdapterDescriptor.fields.sharedItemFields.includes(field))) {
      throw new Error('Backloggd adapter descriptor is missing shared item fields.');
    }
    if (!expectedSharedItemFields.every(field => mobyGamesAdapterDescriptor.fields.sharedItemFields.includes(field))) {
      throw new Error('MobyGames adapter descriptor is missing shared item fields.');
    }
    if (!expectedSharedItemFields.every(field => hltbAdapterDescriptor.fields.sharedItemFields.includes(field))) {
      throw new Error('HowLongToBeat adapter descriptor is missing shared item fields.');
    }
    const expectedMobyGamesSourceMetaFields = ['collection', 'collections', 'collection_url', 'collection_urls', 'gameplay', 'release_year', 'full_release_date', 'status_ids', 'status_color'];
    if (!expectedMobyGamesSourceMetaFields.every(field => mobyGamesAdapterDescriptor.fields.sourceMetaFields.includes(field))) {
      throw new Error('MobyGames adapter descriptor is missing source_meta fields.');
    }
    const expectedHowLongToBeatSourceMetaFields = ['category', 'categories', 'category_url', 'category_urls', 'status_ids', 'status_color'];
    if (!expectedHowLongToBeatSourceMetaFields.every(field => hltbAdapterDescriptor.fields.sourceMetaFields.includes(field))) {
      throw new Error('HowLongToBeat adapter descriptor is missing source_meta fields.');
    }
    const expectedBackloggdSourceMetaFields = ['game_id', 'play_type'];
    if (!expectedBackloggdSourceMetaFields.every(field => backloggdAdapterDescriptor.fields.sourceMetaFields.includes(field))) {
      throw new Error('Backloggd adapter descriptor is missing source_meta fields.');
    }
    if (backloggdAdapterDescriptor.ui.hasStatusConfiguration || !backloggdAdapterDescriptor.ui.platformOptions || backloggdAdapterDescriptor.ui.metadataLabel !== 'Genres') {
      throw new Error('Backloggd UI descriptor fields are incorrect.');
    }
    if (!mobyGamesAdapterDescriptor.ui.hasStatusConfiguration || mobyGamesAdapterDescriptor.ui.platformOptions || mobyGamesAdapterDescriptor.ui.metadataLabel !== 'Advanced') {
      throw new Error('MobyGames UI descriptor fields are incorrect.');
    }
    if (!hltbAdapterDescriptor.ui.hasStatusConfiguration || hltbAdapterDescriptor.ui.platformOptions || hltbAdapterDescriptor.ui.metadataLabel !== 'Advanced') {
      throw new Error('HowLongToBeat UI descriptor fields are incorrect.');
    }
    if (!mobyGamesAdapterDescriptor.statusConfig || mobyGamesAdapterDescriptor.statusConfig.storageKey !== STATUS_PILL_CONFIG_STORAGE_KEY) {
      throw new Error('MobyGames statusConfig descriptor is not configured.');
    }
    if (!hltbAdapterDescriptor.statusConfig || hltbAdapterDescriptor.statusConfig.storageKey !== HLTB_STATUS_PILL_CONFIG_STORAGE_KEY) {
      throw new Error('HowLongToBeat statusConfig descriptor is not configured.');
    }
    const hltbOfflineCoverOptions = getSourceOfflineCoverOptions('howlongtobeat');
    if (!hltbAdapterDescriptor.media || !hltbAdapterDescriptor.media.offlineCovers || !hltbAdapterDescriptor.media.offlineCovers.enabled) {
      throw new Error('HowLongToBeat offline cover descriptor is not configured.');
    }
    if (!Array.isArray(hltbOfflineCoverOptions.coverUrlKeys) || !hltbOfflineCoverOptions.coverUrlKeys.includes('coverUrl')) {
      throw new Error('HowLongToBeat offline cover options are incorrect.');
    }
    if (!backloggdAdapterDescriptor.media || !backloggdAdapterDescriptor.media.offlineCovers || !backloggdAdapterDescriptor.media.offlineCovers.enabled) {
      throw new Error('Backloggd offline cover descriptor is not configured.');
    }
    const mobyOfflineCoverOptions = getSourceOfflineCoverOptions('mobygames');
    if (!mobyGamesAdapterDescriptor.media || !mobyGamesAdapterDescriptor.media.offlineCovers || !mobyGamesAdapterDescriptor.media.offlineCovers.enabled) {
      throw new Error('MobyGames offline cover descriptor is not configured.');
    }
    if (!Array.isArray(mobyOfflineCoverOptions.coverUrlKeys) || !mobyOfflineCoverOptions.coverUrlKeys.includes('coverUrl') || !mobyOfflineCoverOptions.preserveOrientation) {
      throw new Error('MobyGames offline cover options are incorrect.');
    }

    const payloadChecks = EXPORTER_DIAGNOSTIC_CHECK_GROUPS.payload;
    const descriptorChecks = EXPORTER_DIAGNOSTIC_CHECK_GROUPS.descriptors;
    return {
      passed: true,
      checks: payloadChecks.concat(descriptorChecks),
      checkGroups: {
        payload: payloadChecks,
        descriptors: descriptorChecks,
      },
    };
  }

  function runExporterDiagnosticsFromButton() {
    if (!ENABLE_EXPORTER_DIAGNOSTICS || !diagnosticsBtn) return;
    const originalText = diagnosticsBtn.textContent;
    const summaryLogId = 'exporter-diagnostics-summary';
    const payloadLogId = 'exporter-diagnostics-payload';
    const descriptorLogId = 'exporter-diagnostics-descriptors';
    const fallbackLogId = 'exporter-diagnostics-fallback';
    const failureLogId = 'exporter-diagnostics-failure';
    diagnosticsBtn.disabled = true;
    diagnosticsBtn.textContent = 'Running';
    try {
      const result = runExporterDiagnostics();
      const checks = Array.isArray(result && result.checks) ? result.checks : [];
      const payloadChecks = Array.isArray(result && result.checkGroups && result.checkGroups.payload) ? result.checkGroups.payload : [];
      const descriptorChecks = Array.isArray(result && result.checkGroups && result.checkGroups.descriptors) ? result.checkGroups.descriptors : [];
      const message = `Exporter diagnostics passed${checks.length ? ` (${checks.length} checks)` : ''}.`;
      if (panel) panel.classList.add('is-active');
      if (log) {
        removeLog(failureLogId);
        addLog(message, 'info', summaryLogId);
        if (payloadChecks.length) addLog(`Exporter payload checks passed: ${payloadChecks.join(', ')}`, 'info', payloadLogId);
        if (descriptorChecks.length) addLog(`Exporter descriptor checks passed: ${descriptorChecks.join(', ')}`, 'info', descriptorLogId);
        if (!payloadChecks.length && !descriptorChecks.length && checks.length) addLog(`Passed checks: ${checks.join(', ')}`, 'info', fallbackLogId);
      }
      diagnosticsBtn.textContent = 'Passed';
    } catch (error) {
      const detail = error && error.message ? error.message : String(error);
      const message = `Exporter diagnostics failed: ${detail}`;
      console.error(error);
      if (panel) panel.classList.add('is-active');
      if (log) addLog(message, 'error', failureLogId);
      diagnosticsBtn.textContent = 'Failed';
    } finally {
      diagnosticsBtn.disabled = false;
      setTimeout(() => {
        if (diagnosticsBtn) diagnosticsBtn.textContent = originalText;
      }, 1600);
    }
  }

  function buildExporterTestHooks() {
    return {
      parsers: {
        parseMobyGamesOverviewPage,
        parseMobyGamesOverviewDocument,
        parseMobyGamesCollectionGamesPage,
        parseHowLongToBeatCategoriesDocument,
        parseHowLongToBeatGamesDocument,
        extractHowLongToBeatGamePageDetails,
        parseHowLongToBeatGamePage,
      },
      payload: {
        mergeMobyGamesItemsForExport,
        mergeHowLongToBeatItemsForExport,
        normalizeSharedExportItem,
        normalizeSharedExportPayload,
        buildCanonicalSharedExportItem,
        buildCanonicalSharedExportPayload,
        buildSharedJson,
        normalizeMobyGamesSharedExportItem,
        normalizeHowLongToBeatSharedExportItem,
        buildBackloggdPayloadFromRows,
        buildCanonicalMobyGamesJsonItem,
      },
      descriptors: {
        sources: SOURCE_REGISTRY,
        getSourceDescriptorForHost,
        getSourceUiDescriptorForHost,
        getSourceStatusConfigDescriptorForHost,
        getSourceOfflineCoverOptions,
        getSourceFormatDescriptor,
        getSourceRuntimeDescriptorForHost,
      },
      builders: {
        buildMobyGamesCsv,
        buildMobyGamesJson,
        buildMobyGamesHtml,
        buildHowLongToBeatCsv,
        buildHowLongToBeatJson,
        buildHowLongToBeatHtml,
      },
      diagnostics: {
        runExporterDiagnostics,
        checkGroups: EXPORTER_DIAGNOSTIC_CHECK_GROUPS,
      },
      parseMobyGamesOverviewPage,
      parseMobyGamesOverviewDocument,
      parseMobyGamesCollectionGamesPage,
      parseHowLongToBeatCategoriesDocument,
      parseHowLongToBeatGamesDocument,
      extractHowLongToBeatGamePageDetails,
      parseHowLongToBeatGamePage,
      mergeMobyGamesItemsForExport,
      mergeHowLongToBeatItemsForExport,
      normalizeSharedExportItem,
      normalizeSharedExportPayload,
      buildCanonicalSharedExportItem,
      buildCanonicalSharedExportPayload,
      buildSharedJson,
      normalizeMobyGamesSharedExportItem,
      normalizeHowLongToBeatSharedExportItem,
      buildBackloggdPayloadFromRows,
      buildCanonicalMobyGamesJsonItem,
      sourceRegistry: SOURCE_REGISTRY,
      getSourceDescriptorForHost,
      getSourceUiDescriptorForHost,
      getSourceStatusConfigDescriptorForHost,
      getSourceOfflineCoverOptions,
      getSourceFormatDescriptor,
      getSourceRuntimeDescriptorForHost,
      buildMobyGamesCsv,
      buildMobyGamesJson,
      buildMobyGamesHtml,
      buildHowLongToBeatCsv,
      buildHowLongToBeatJson,
      buildHowLongToBeatHtml,
      runExporterDiagnostics,
    };
  }

  if (window.__BGD_EXPORTER_ENABLE_TEST_HOOKS__) {
    window.__BGD_EXPORTER_TEST_HOOKS__ = buildExporterTestHooks();
  }

  exportBtn.addEventListener('click', runExportWithOptions);
  if (diagnosticsBtn) diagnosticsBtn.addEventListener('click', runExporterDiagnosticsFromButton);
  const sourceUi = getSourceUiDescriptorForHost();
  const sourceRuntime = getSourceRuntimeDescriptorForHost();
  if (sourceUi.hasStatusConfiguration && configBtn) configBtn.addEventListener('click', () => {
    if (exportInProgress) {
      flashMobyGamesConfigDisabled();
      return;
    }
    openSourceStatusConfiguration();
  });
  if (pauseExportBtn) pauseExportBtn.addEventListener('click', () => setExportPaused(!exportPauseRequested));
  if (stopExportBtn) stopExportBtn.addEventListener('click', () => {
    if (sourceRuntime.clearExportState) sourceRuntime.clearExportState();
    requestExportCancel();
  });
  if (sourceRuntime.resumeExport) {
    setTimeout(() => {
      flushPendingNavMessage();
      sourceRuntime.resumeExport();
    }, 0);
  } else {
    setTimeout(() => {
      flushPendingNavMessage();
    }, 0);
  }
  } // end initPanel()
})();