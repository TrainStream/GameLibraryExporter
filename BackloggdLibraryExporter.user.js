// ==UserScript==
// @name         Backloggd Library Exporter
// @namespace    https://backloggd.com/
// @version      1.0.0
// @description  Export any Backloggd user's libraries as HTML, CSV, and JSON.
// @author       TrainStream
// Written with Codex and Claude assistance.
// @match        https://backloggd.com/*
// @match        https://www.backloggd.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      github.com
// @connect      images.igdb.com
// @updateURL    https://github.com/TrainStream/BackloggdLibraryExporter/raw/refs/heads/main/BackloggdLibraryExporter.meta.js
// @downloadURL  https://github.com/TrainStream/BackloggdLibraryExporter/raw/refs/heads/main/BackloggdLibraryExporter.user.js
// ==/UserScript==

(function () {
  'use strict';

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

  const FULL_RELEASE_DATE_RE =
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2},\s+\d{4}\b/i;
  const MONTH_YEAR_RELEASE_RE =
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{4}\b/i;
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

  const EXPORTER_ID = 'bgd-exporter-root';
  const EXPORTER_VERSION = '1.0.0';
  const EXPORTER_RELEASES_URL = 'https://github.com/TrainStream/BackloggdLibraryExporter/releases';
  // Maximum number of game detail pages fetched in parallel when resolving
  // missing release dates.  Increase cautiously - higher values may trigger
  // rate-limiting on Backloggd's servers.
  const DETAIL_FETCH_CONCURRENCY = 3;

  function getUserSlug() {
    const match = location.pathname.match(/^\/u\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]) : '';
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
  let panel, minimizeBtn, exportBtn, runControls, pauseExportBtn, stopExportBtn,
      chkCsv, chkJson, chkHtml, fileChangeNote, versionNotice,
      converterBtn, converterPanel, converterCloseBtn, converterRunBtn, converterFileInput,
      chkGenres, chkOfflineCovers, chkPlatforms, chkPlatforms226, log, fill;
  let logUpdateLines = new Map();
  let panelCleanupFns = [];
  let exportInProgress = false;
  let exportCancelRequested = false;
  let exportPauseRequested = false;
  let exportPauseResolver = null;
  let exportPausedStartedAt = 0;
  let exportPausedTotalMs = 0;
  let exportStopMessageShown = false;
  const activeExportFetchControllers = new Set();
  let exportStartFileFormatSignature = '';
  let fileChangeNoteTimer = null;

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
    const root = panel || document.getElementById(EXPORTER_ID);
    if (removeDom && root) root.remove();
    panel = null;
  }

  function onNavigate() {
    const slug = getUserSlug();

    if (!slug) {
      // Navigated away from a /u/* page - tear down the panel if present.
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
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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

      #${EXPORTER_ID} .bgd-title strong {
        display: block;
        font-size: 13px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #b9e6ff;
      }

      #${EXPORTER_ID} .bgd-title span {
        display: block;
        margin-top: 3px;
        color: rgba(234, 244, 255, 0.72);
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #${EXPORTER_ID} .bgd-window-controls {
        display: flex;
        align-items: stretch;
        gap: 8px;
        flex-shrink: 0;
      }

      #${EXPORTER_ID} .bgd-minimize-button {
        border: 1px solid rgba(125, 211, 252, 0.38);
        border-radius: 10px;
        width: 34px;
        min-width: 34px;
        padding: 0;
        color: #b9e6ff;
        cursor: pointer;
        font-weight: 900;
        font-size: 18px;
        line-height: 1;
        background: rgba(125, 211, 252, 0.10);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
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

      #${EXPORTER_ID} .bgd-export-button {
        border: 0;
        border-radius: 10px;
        padding: 0 20px;
        color: #06101f;
        cursor: pointer;
        font-weight: 800;
        font-size: 13px;
        text-align: center;
        background: linear-gradient(135deg, #7dd3fc, #a7f3d0 55%, #fef08a);
        box-shadow: 0 0 0 1px rgba(255,255,255,0.28), 0 8px 22px rgba(47, 141, 247, 0.30);
        transition: transform 0.16s ease, filter 0.16s ease, opacity 0.16s ease;
        line-height: 1;
        white-space: nowrap;
        flex-shrink: 0;
        align-self: stretch;
        min-width: 68px;
      }

      #${EXPORTER_ID} .bgd-run-controls {
        display: flex;
        align-self: stretch;
        flex-shrink: 0;
        min-width: 68px;
        width: var(--bgd-export-button-width, 68px);
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

      #${EXPORTER_ID} .bgd-version-notice {
        display: none;
        position: absolute;
        top: 54px;
        right: 14px;
        z-index: 2;
        width: 152px;
        max-width: calc(100% - 28px);
        box-sizing: border-box;
        padding: 4px 7px;
        border: 1px solid rgba(253, 224, 71, 0.42);
        border-radius: 8px;
        background: rgba(253, 224, 71, 0.12);
        color: rgba(253, 224, 71, 0.98);
        font-size: 12px;
        font-weight: 900;
        line-height: 1.15;
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 8px 24px rgba(253, 224, 71, 0.14);
        pointer-events: none;
      }

      #${EXPORTER_ID} .bgd-version-notice.is-visible {
        display: block;
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
      }

      #${EXPORTER_ID} .bgd-checks-row {
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      #${EXPORTER_ID} .bgd-col-label {
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.10em;
        text-transform: uppercase;
        color: rgba(125, 211, 252, 0.7);
        padding-bottom: 3px;
        border-bottom: 1px solid rgba(125, 211, 252, 0.18);
        margin-bottom: 3px;
      }

      #${EXPORTER_ID} .bgd-chk-items {
        display: flex;
        flex-wrap: nowrap;
        gap: 3px 6px;
        align-items: center;
      }

      #${EXPORTER_ID} .bgd-tag-lines {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      #${EXPORTER_ID} .bgd-tag-line {
        display: flex;
        flex-wrap: nowrap;
        gap: 3px 6px;
        align-items: center;
      }

      #${EXPORTER_ID} .bgd-file-format-items {
        position: relative;
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
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        user-select: none;
        padding: 1px 0;
        white-space: nowrap;
      }

      #${EXPORTER_ID} .bgd-chk input[type="checkbox"] {
        accent-color: #7dd3fc;
        width: 14px;
        height: 14px;
        cursor: pointer;
        flex-shrink: 0;
      }

      #${EXPORTER_ID} .bgd-chk-basic {
        color: rgba(167,243,208,0.9);
        cursor: default;
        pointer-events: none;
      }

      #${EXPORTER_ID} .bgd-chk-basic input[type="checkbox"] {
        accent-color: #a78bfa;
        cursor: default;
      }

      #${EXPORTER_ID} .bgd-chk-opt {
        color: rgba(167,243,208,0.9);
      }

      #${EXPORTER_ID} .bgd-converter-button {
        margin-left: auto;
        border: 1px solid rgba(167, 243, 208, 0.42);
        border-radius: 8px;
        height: 24px;
        padding: 0 11px;
        color: rgba(234, 244, 255, 0.92);
        cursor: pointer;
        font-size: 11px;
        font-weight: 900;
        line-height: 1;
        white-space: nowrap;
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
        accent-color: #7dd3fc;
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
        border-color: rgba(125, 211, 252, 0.7);
        background: rgba(125, 211, 252, 0.16);
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
        background: linear-gradient(90deg, #2f8df7, #9b6cff, #1fbf75);
        transition: width 0.24s ease;
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
      #${EXPORTER_ID}.is-minimized .bgd-converter-panel,
      #${EXPORTER_ID}.is-minimized .bgd-actions,
      #${EXPORTER_ID}.is-minimized .bgd-progress {
        display: none !important;
      }

      #${EXPORTER_ID}.is-minimized .bgd-window-controls {
        display: block;
      }

      #${EXPORTER_ID}.is-minimized .bgd-minimize-button {
        width: 34px;
        height: 34px;
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
    const root = document.createElement('div');
    root.id = EXPORTER_ID;
    root.innerHTML = `
      <div class="bgd-panel">
        <div class="bgd-top">
          <div class="bgd-top-row">
            <div class="bgd-title">
              <strong>Library Export</strong>
              <span>/u/${escapeHtml(userSlug)}</span>
            </div>
            <div class="bgd-window-controls">
              <a class="bgd-github-button" href="${EXPORTER_RELEASES_URL}" target="_blank" rel="noopener noreferrer" title="Open exporter releases on GitHub" aria-label="Open exporter releases on GitHub">
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.64 7.64 0 0 1 8 3.87c.68 0 1.36.09 2 .26 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"></path>
                </svg>
              </a>
              <button class="bgd-minimize-button" type="button" id="bgdMinimizeBtn" title="Minimize exporter" aria-label="Minimize exporter">-</button>
              <button class="bgd-export-button" type="button" id="bgdExportBtn">Export</button>
              <div class="bgd-run-controls" id="bgdRunControls" hidden>
                <button class="bgd-run-control-button" type="button" id="bgdPauseExportBtn" title="Pause export" aria-label="Pause export">⏸</button>
                <button class="bgd-run-control-button" type="button" id="bgdStopExportBtn" title="Stop export" aria-label="Stop export">■</button>
              </div>
            </div>
          </div>
          <div class="bgd-version-notice" id="bgdVersionNotice">New version available!</div>
          <div class="bgd-actions">
            <div class="bgd-checks">
              <div class="bgd-checks-row">
                <div class="bgd-col-label">Files</div>
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
                    <label class="bgd-chk bgd-chk-opt"><input type="checkbox" id="bgdChkGenres"> Genres</label>
                    <label class="bgd-chk bgd-chk-opt"><input type="checkbox" id="bgdChkOfflineCovers"> Offline Covers</label>
                  </div>
                  <div class="bgd-tag-line">
                    <label class="bgd-chk bgd-chk-opt"><input type="checkbox" id="bgdChkPlatforms"> Platforms (50)</label>
                    <label class="bgd-chk bgd-chk-opt"><input type="checkbox" id="bgdChkPlatforms226"> Platforms (226)</label>
                  </div>
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
  exportBtn      = panel.querySelector('#bgdExportBtn');
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
    if (!panel || !minimizeBtn) return;
    panel.classList.toggle('is-minimized', isMinimized);
    if (isMinimized) closeConverterPanel();
    minimizeBtn.textContent = isMinimized ? '+' : '-';
    minimizeBtn.title = isMinimized ? 'Expand exporter' : 'Minimize exporter';
    minimizeBtn.setAttribute('aria-label', minimizeBtn.title);
    storageSet('bgdExporterMinimized', isMinimized ? '1' : '0');
  }

  if (minimizeBtn) {
    setPanelMinimized(storageGet('bgdExporterMinimized', '0') === '1');
    minimizeBtn.addEventListener('click', () => {
      setPanelMinimized(!panel.classList.contains('is-minimized'));
    });
  }
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
  chkPlatforms.addEventListener('change', () => enforcePlatformScanCheckboxes('basic'));
  chkPlatforms226.addEventListener('change', () => enforcePlatformScanCheckboxes('full'));

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
  })();

  [chkCsv, chkJson, chkHtml].forEach(el => {
    if (el) el.addEventListener('change', updatePendingFileFormatNote);
  });

  // ---------------------------------------------------------------------------
  // 4. File conversion
  // ---------------------------------------------------------------------------

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
    const enabled = htmlTarget.checked && !htmlTarget.disabled;
    offlineCovers.disabled = !enabled;
    if (!enabled) offlineCovers.checked = false;
  }
  function syncConverterTargets() {
    if (!converterPanel) return;
    const source = getConverterChoice('bgdConverterSource') || 'csv';
    const targets = [...converterPanel.querySelectorAll('input[name="bgdConverterTarget"]')];
    targets.forEach(input => {
      input.disabled = input.value === source;
      input.checked = !input.disabled;
    });
    syncConverterOfflineCovers();
    if (converterFileInput) converterFileInput.accept = converterAcceptFor(source);
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
    converterPanel.querySelectorAll('input[name="bgdConverterSource"]').forEach(input => {
      input.addEventListener('change', syncConverterTargets);
    });
    converterPanel.querySelectorAll('input[name="bgdConverterTarget"]').forEach(input => {
      input.addEventListener('change', syncConverterOfflineCovers);
    });
    syncConverterOfflineCovers();

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
        panel.classList.add('is-active');
        exportInProgress = true;
        exportCancelRequested = false;
        exportPauseRequested = false;
        exportPauseResolver = null;
        exportPausedStartedAt = 0;
        exportPausedTotalMs = 0;
        exportStopMessageShown = false;
        clearExportLog();
        setProgress(2);
        showRunControls();
        addLog('Converting file with offline covers');
      }

      try {
        const text = await file.text();
        const payload = parseExportedPayload(text, source, file.name);
        const baseName = convertedBaseName(file.name, payload);
        let htmlPayload = payload;
        if (includeOfflineCovers) {
          htmlPayload = payloadWithOfflineCovers(payload, await buildOfflineCoverMap(payload.items || []));
          checkExportCancelled();
        }
        targets.forEach(target => {
          const output = buildConvertedExport(target === 'html' ? htmlPayload : payload, target);
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
          exportInProgress = false;
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
          hideRunControls();
        }
      }
    });

    syncConverterTargets();
  }

  initFileConverter();

  function setProgress(percent) {
    fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
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
    pauseExportBtn.textContent = exportPauseRequested ? '▶' : '⏸';
    pauseExportBtn.title = exportPauseRequested ? 'Resume export' : 'Pause export';
    pauseExportBtn.setAttribute('aria-label', pauseExportBtn.title);
  }

  function showRunControls() {
    if (!exportBtn || !runControls) return;
    const width = Math.max(68, Math.ceil(exportBtn.getBoundingClientRect().width || 68));
    runControls.style.setProperty('--bgd-export-button-width', `${width}px`);
    exportBtn.hidden = true;
    runControls.hidden = false;
    if (pauseExportBtn) pauseExportBtn.disabled = false;
    if (stopExportBtn) stopExportBtn.disabled = false;
    syncRunControls();
  }

  function hideRunControls() {
    if (!exportBtn || !runControls) return;
    runControls.hidden = true;
    exportBtn.hidden = false;
    if (pauseExportBtn) pauseExportBtn.disabled = false;
    if (stopExportBtn) stopExportBtn.disabled = false;
    syncRunControls();
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
    return Math.max(0, Date.now() - startTime - exportPausedTotalMs - currentPauseMs);
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
    const stem = String(filename || '').replace(/\.[^.]+$/, '');
    const match = stem.match(/^\d{4}\.\d{2}\.\d{2}-(.+)-backloggd-library$/i);
    return match ? match[1] : '';
  }

  function normalizeExportPayload(rawPayload, filename = '') {
    if (!rawPayload || typeof rawPayload !== 'object' || !Array.isArray(rawPayload.items)) {
      throw new Error('This file does not contain a Backloggd export payload.');
    }
    const normalizedUsername = rawPayload.username || guessUsernameFromFilename(filename) || userSlug || 'backloggd-user';
    const items = rawPayload.items.map(rawItem => {
      const item = { ...rawItem };
      const primaryStatus = item.status || (Array.isArray(item.statuses) ? item.statuses[0] : '') || 'played';
      item.status = primaryStatus;
      item.statuses = Array.isArray(item.statuses) && item.statuses.length ? item.statuses : [primaryStatus];
      if (item.user_rating === undefined) item.user_rating = null;
      if (item.average_rating === undefined) item.average_rating = null;
      return item;
    });
    const counts = rawPayload.counts && typeof rawPayload.counts === 'object' ? rawPayload.counts : buildCountsFromItems(items);
    return {
      ...rawPayload,
      username: normalizedUsername,
      source: rawPayload.source || `${location.origin}/u/${encodeURIComponent(normalizedUsername)}/games/`,
      generated_at: rawPayload.generated_at || new Date().toISOString(),
      counts,
      raw_counts: rawPayload.raw_counts || counts,
      include_genres: rawPayload.include_genres !== undefined ? !!rawPayload.include_genres : items.some(item => Array.isArray(item.genres) && item.genres.length),
      include_platforms: rawPayload.include_platforms !== undefined ? !!rawPayload.include_platforms : items.some(item => Array.isArray(item.platforms) && item.platforms.length),
      include_platforms226: !!rawPayload.include_platforms226,
      total: items.length,
      items,
    };
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

  function parseExportedPayload(text, format, filename = '') {
    if (format === 'csv') return parseCsvExportPayload(text, filename);
    if (format === 'json') return parseJsonExportPayload(text, filename);
    if (format === 'html') return parseHtmlExportPayload(text, filename);
    throw new Error('Unsupported source file type.');
  }

  function buildConvertedExport(payload, format) {
    if (format === 'csv') return { extension: 'csv', mime: 'text/csv;charset=utf-8', content: buildCsv(payload) };
    if (format === 'json') return { extension: 'json', mime: 'application/json;charset=utf-8', content: JSON.stringify(payload, null, 2) };
    if (format === 'html') return { extension: 'html', mime: 'text/html;charset=utf-8', content: buildHtml(payload) };
    throw new Error('Unsupported export file type.');
  }

  function convertedBaseName(filename, payload) {
    const stem = String(filename || '').replace(/\.[^.]+$/, '');
    if (stem) return safeFilePart(stem);
    const now = new Date();
    const datePrefix = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    return `${datePrefix}-${safeFilePart(payload.username || userSlug || 'backloggd-user')}-backloggd-library`;
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
      }
    } catch (_) {
      // Ignore network/CORS failures; the exporter should load normally without the notice.
    }
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
        return csvEscape(item[h]);
      }).join(',')),
    ].join('\r\n');
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

  function coverImageToThumbnailDataUrl(image) {
    const canvas = document.createElement('canvas');
    canvas.width = OFFLINE_COVER_WIDTH;
    canvas.height = OFFLINE_COVER_HEIGHT;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const drawWidth = Math.ceil(image.naturalWidth * scale);
    const drawHeight = Math.ceil(image.naturalHeight * scale);
    const dx = Math.floor((canvas.width - drawWidth) / 2);
    const dy = Math.floor((canvas.height - drawHeight) / 2);
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
    return canvas.toDataURL('image/jpeg', OFFLINE_COVER_QUALITY);
  }

  async function buildOfflineCoverMap(items) {
    const coverEntries = items
      .map(item => item.cover_url)
      .filter(Boolean)
      .filter((url, index, arr) => arr.indexOf(url) === index);
    const coverByUrl = new Map();
    let failed = 0;

    for (let i = 0; i < coverEntries.length; i += 1) {
      const url = coverEntries[i];
      addLog(`Embedding offline covers ${i + 1} of ${coverEntries.length}`, 'info', 'offline-covers-progress');
      try {
        const blob = await fetchImageBlob(url);
        checkExportCancelled();
        await waitIfExportPaused();
        const image = await blobToImage(blob);
        coverByUrl.set(url, coverImageToThumbnailDataUrl(image));
      } catch (error) {
        if (isExportCancelledError(error)) throw error;
        failed += 1;
      }
    }

    removeLog('offline-covers-progress');
    addLog(`Offline covers embedded: ${coverByUrl.size} of ${coverEntries.length}${failed ? ` (${failed} failed)` : ''}`);
    return coverByUrl;
  }

  function payloadWithOfflineCovers(payload, coverByUrl) {
    return {
      ...payload,
      offline_covers: true,
      cover_thumbnail_size: {
        width: OFFLINE_COVER_WIDTH,
        height: OFFLINE_COVER_HEIGHT,
      },
      items: payload.items.map(item => {
        const embeddedCover = coverByUrl.get(item.cover_url);
        return embeddedCover ? { ...item, cover_url: embeddedCover, original_cover_url: item.cover_url } : item;
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
    .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    body.show-play-types .stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    /* -- Overflow-aware wrapping for status pills --- */
    /* Applied by JS when stat text overflows at current width */
    .stats.stats-wrap { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    body.show-play-types .stats.stats-wrap { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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
    .genre-substat-toggle input[type="checkbox"] { accent-color: #d63f8c; width: 13px; height: 13px; cursor: pointer; }
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
      /* JS sets --genre-rows and --genre-pill-fs. Each row height is fixed;
         grid clamps to that many rows via max-height and overflow:hidden. */
 --genre-row-h: 36px;
 --genre-rows: 3;
 --genre-pill-fs: 13px;
      max-height: calc(var(--genre-row-h) * var(--genre-rows));
      overflow: hidden;
      align-content: flex-start;
      /* No container border - each pill carries its own full border.
         Adjacent pill borders collapse via negative margins. */
      border-radius: 0;
    }
    body.show-genre-emojis .genre-pill-grid {
 --genre-row-h: 44px;
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
      height: var(--genre-row-h);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      position: relative;
      /* at least 2px between text/counter and the left/right border edges */
      padding: 0 10px;
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
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
    label.toggle input[type="checkbox"] { accent-color: #2f8df7; width: 15px; height: 15px; cursor: pointer; }
    .genre-substat-toggle-tb input[type="checkbox"] { accent-color: #d63f8c; }
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
    /* play_type pills in table rows only visible when feature is on */
    .pt-pill { display: none; }
    body.show-play-types .pt-pill { display: inline-flex; }
    /* hide the main "Played" status pill in rows when sub-statuses are shown */
    body.show-play-types .pill-played-main { display: none; }
    /* -- Played sub-status big pills --- */
    .stat-played-group {
      display: none;
      gap: 10px;
      grid-column: span 2;
    }
    body.show-play-types .stat-played-group { display: contents; }
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
    /* hide individual played stat when group is shown */
    body.show-play-types .stat[data-status-filter=\"played\"] { display: none; }
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
    }
    .col-picker-btn:hover { border-color: rgba(125,211,252,0.7); background: rgba(125,211,252,0.10); transform: translateY(-1px); }
    .col-picker-btn.open { border-color: rgba(47,141,247,0.7); background: rgba(47,141,247,0.10); color: #2f8df7; }
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
      accent-color: #7dd3fc;
      width: 13px;
      height: 13px;
      cursor: pointer;
      flex-shrink: 0;
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

  function buildViewerBodyHtml({ payload, generated, hasGenres, hasPlatforms, tableWidths, genreBarHtml, playTypeCounts, playedTotal, queueTotal }) {
    return `
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div class="head">
        <div>
          <h1>${escapeHtml(payload.username)}'s Backloggd Library</h1>
          <p class="sub">Generated ${generated}. Click a game to open it on Backloggd.</p>
        </div>
        <div class="head-actions">
          <label class="toggle genre-substat-toggle-tb"><input id="playSubStatuses" type="checkbox"> Played Sub-Statuses</label>
          <label class="toggle"><input id="statusFilterCounter" type="checkbox"> Filtered Status Counts</label>
          <label class="toggle"><input id="lightMode" type="checkbox"> Light Mode</label>
          <p class="sub" id="countLabel"></p>
        </div>
      </div>
      <div class="stats" id="stats">
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
        </div>
      </div>
      ${genreBarHtml}
      ${hasPlatforms ? `
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
      </div>` : ''}
      <div class="platform-filter-bar" id="platformFilterBar">
        <div class="platform-filter-bar-inner" id="platformFilterBarInner">
          <span class="platform-filter-bar-label">Filtered by platform:</span>
          <span id="platformFilterPills"></span>
          <button class="platform-filter-clear" type="button" id="platformFilterClear">Clear filter</button>
        </div>
      </div>
    </section>
    <section class="toolbar">
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
            <label class="col-picker-chk"><input type="checkbox" id="genreEmojis"> Emoji</label>
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
    </section>
    <section class="table-wrap" id="tableWrap" tabindex="0">
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
    </section>
  </main>
`;
  }

  function buildViewerScript({ payload, statusLabelsJson, playTypeLabelsJson, playTypeColorsJson, tableWidths, playTypeCounts, queueTotal }) {
    return `    const STATUS_LABELS = ${statusLabelsJson};
    const PLAY_TYPE_LABELS_MAP = ${playTypeLabelsJson};
    const PLAY_TYPE_COLORS_MAP = ${playTypeColorsJson};
    const TABLE_WIDTHS = ${escapeJsonForHtml(JSON.stringify(tableWidths))};
    const PLAY_TYPE_COUNTS_ORIG = ${escapeJsonForHtml(JSON.stringify(playTypeCounts))};
    const QUEUE_TOTAL_ORIG = ${queueTotal};
    const payload = JSON.parse(document.getElementById('payload').textContent);
    const rowsTbody = document.getElementById('rows');
    const tableWrap = document.getElementById('tableWrap');
    const empty = document.getElementById('empty');
    const search = document.getElementById('search');
    const coversChk = document.getElementById('covers');
    const lightMode = document.getElementById('lightMode');
    const genreEmojisChk = document.getElementById('genreEmojis');
    const countLabel = document.getElementById('countLabel');
    const genreBarBtns = [...document.querySelectorAll('.genre-btn')];
    const genreShowAllBtn = document.getElementById('genreShowAll');
    const genreMatchBtn = document.getElementById('genreMatchAll');
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
    const playSubStatusesChk = document.getElementById('playSubStatuses');
    const statusFilterCounterChk = document.getElementById('statusFilterCounter');
    const statPlayedGroup = document.getElementById('statPlayedGroup');
    const playedTotalBtn = document.getElementById('playedTotalBtn');
    const queueTotalBtn  = document.getElementById('queueTotalBtn');
    const statButtons = [...document.querySelectorAll('[data-status-filter]')];
    const playTypeButtons = [...document.querySelectorAll('[data-play-type]')];
    const thSorts = [...document.querySelectorAll('th[data-sort]')];
    const dfYear  = document.getElementById('dfYear');
    const dfMonth = document.getElementById('dfMonth');
    const dfDay   = document.getElementById('dfDay');
    const dfClear = document.getElementById('dfClear');
    const STATUS_PRIORITY = ${escapeJsonForHtml(JSON.stringify(STATUS_PRIORITY))};
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
    const ALL_KNOWN_PLATFORM_LABELS = ${JSON.stringify(
      (payload.include_platforms226 ? ALL_PLATFORM_SLUGS : PLATFORM_SLUGS).map(p => p.label)
    )};

    // -- Genre pill grid layout ---
    // Distributes visible genre pills across rows as a rectangle.
    //
    // Default (wide screen): always start at 3 rows, regardless of emoji mode.
    // As the container narrows, more rows are allowed (up to 6) so every pill
    // remains fully visible and readable. Font size also scales down (min 9px)
    // when the container is tight, so pills stay a comfortable size.
    //
    // Emoji mode: minPillW is raised to 108px (vs 68px without emojis) because
    // the emoji glyph itself occupies ~20px regardless of font size. The
    // comfortW threshold is also raised to 130px. If rows hits maxRows and
    // overflow persists, the post-layout check steps font size down (9px floor)
    // one px at a time until the emoji + label text fit.
    //
    // Minimum padding guarantee: each pill has padding: 0 10px, so there are at
    // least ~10px (well above 2px) between any text/counter and the left/right
    // border edges of its rectangle at all times.
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

      const emojisOn = document.body.classList.contains('show-genre-emojis');
      const baseRowH  = emojisOn ? 44 : 36;
      const containerW = grid.parentElement ? grid.parentElement.offsetWidth : 600;

      // Determine the ideal number of rows starting from 3 and expanding as
      // needed so that every pill is at least minPillW pixels wide.
      // No-emoji pills need a higher minimum because longer labels like
      // "Point & Click", "Visual Novel", "Quiz & Trivia" are wider than the
      // emoji variants (which use a short emoji + compact text).
      const minPillW = emojisOn ? 108 : 90;
      const maxRows  = 6;  // never use more than 6 rows
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

      // Scale font size down on narrow containers so text still fits inside
      // each rectangle. Floor at 9px (still readable) from the default 13px.
      // When emojis are on the comfortable threshold is higher because the
      // emoji glyph itself needs room regardless of font size.
      const pillW = containerW / pillsPerRow;
      // No-emoji needs a higher comfortW to avoid prematurely shrinking fonts
      // on labels that are just a bit longer than "RPG" or "Sport".
      const comfortW = emojisOn ? 130 : 110;
      // Minimum font: 9px with emojis, 10px without.
      const minFontPx = emojisOn ? 9 : 10;
      const maxFontPx = 13;
      let fontSize;
      if (pillW >= comfortW) {
        fontSize = maxFontPx;
      } else {
        // Linearly interpolate between minFontPx and maxFontPx
        const t = Math.max(0, Math.min(1, (pillW - minPillW) / (comfortW - minPillW)));
        fontSize = Math.round(minFontPx + t * (maxFontPx - minFontPx));
      }

      // Set CSS vars for max-height clamping and font size
      grid.style.setProperty('--genre-rows', rows);
      grid.style.setProperty('--genre-row-h', baseRowH + 'px');
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

      // Constrain the grid width when there are very few pills per row so that
      // the pills don't become disproportionately wide:
      //   4+ pills/row -> 100% (full width, default appearance)
      //   3  pills/row -> 50%  (half)
      //   2  pills/row -> 25%  (quarter)
      //   1  pill /row -> ~16.67% (one-third of half)
      // Last-row pills still expand to fill the (now narrower) grid, so the
      // overall pill block retains its rectangle shape.
      function gridWidthForPPR(ppr) {
        if (ppr >= 4) return '100%';
        if (ppr === 3) return '50%';
        if (ppr === 2) return '25%';
        return (100 / 6).toFixed(4) + '%'; // ~16.67%
      }
      grid.style.width = gridWidthForPPR(pillsPerRow);
      if (!checkOverflow) return pillsPerRow;

      // -- Post-layout overflow check ---
      // After applying the computed layout, verify that no visible pill has its
      // content clipped (scrollWidth > clientWidth). If any pill overflows we
      // apply two remedies in sequence, one rAF-pair per step so the browser
      // re-renders between measurements:
      //   Remedy 1 - add one more row (up to maxRows), widening every pill.
      //              Repeats until overflow clears or maxRows is reached.
      //   Remedy 2 - step font size down 1 px at a time (floor 9 px) once
      //              maxRows is hit and overflow still persists.
      // Both remedies apply equally whether emojis are on or off.
      function hasAnyOverflow() {
        let overflow = false;
        grid.querySelectorAll('.genre-btn').forEach(btn => {
          if (btn.style.display === 'none') return;
          if (btn.scrollWidth > btn.clientWidth + 1) overflow = true;
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
        grid.style.setProperty('--genre-row-h', baseRowH + 'px');
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
    let activeGenres = new Set();
    let matchAll = true;   // AND mode by default
    let query = '';
    let dateFilter = { year: null, month: null, day: null };
    let activePlatforms = new Set();  // supports multiple platform filters
    let platformMatchAll = false;  // false = OR (any), true = AND (all)
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
    const allKnownPlatformLabels = [...new Set([...ALL_KNOWN_PLATFORM_LABELS, ...exportedPlatformLabels])]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    let platformShowingAll = false;    // true while "Show All" pill grid is open
    let platformShowingEmpty = false;  // true while "Empty Platforms" pill grid is open
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
    function syncGenreUI() {
      genreBarBtns.forEach(btn => btn.classList.toggle('active', activeGenres.has(btn.dataset.genre)));
      document.querySelectorAll('.genre-tag').forEach(tag => tag.classList.toggle('active', activeGenres.has(tag.dataset.genre)));
      if (genreMatchBtn) genreMatchBtn.classList.toggle('active', matchAll);
    }

    function setGenreFilter(slug, on) {
      if (on) activeGenres.add(slug); else activeGenres.delete(slug);
      syncGenreUI();
      scheduleRender();
    }

    function clearGenres() {
      activeGenres.clear();
      syncGenreUI();
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
      const n = labels.length;
      const { cols } = computePillGridLayout(n);
      const basisPct = (100 / cols).toFixed(4) + '%';
      const lastRowCount = n % cols || cols;
      const lastBasisPct = (100 / lastRowCount).toFixed(4) + '%';
      const widthPct = pillGridWidthPct(cols);
      platformSearchResults.style.width = widthPct === 100 ? '' : widthPct.toFixed(4) + '%';
      labels.forEach((p, i) => {
        const flexBasis = i >= n - lastRowCount ? lastBasisPct : basisPct;
        platformSearchResults.appendChild(makePlatformButton(p, flexBasis, onAfterToggle));
      });
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
    }

    function clearPlayedAndQueueHighlights() {
      if (playedTotalBtn) playedTotalBtn.classList.remove('active');
      if (queueTotalBtn) queueTotalBtn.classList.remove('queue-active');
    }

    function clearNonStatusFilters() {
      activeGenres.clear();
      syncGenreUI();
      activePlatforms.clear();
      syncPlatformUI();
      clearDateFilter({ render: false });
      if (search) search.value = '';
      query = '';
      if (searchClearBtn) searchClearBtn.classList.remove('visible');
    }

    function setPlayTypeFilter(pt, { toggle = false, clearOtherFilters = false } = {}) {
      if (clearOtherFilters) clearNonStatusFilters();
      playTypeFilter = toggle && playTypeFilter === pt ? null : pt;
      statusFilter = playTypeFilter === null ? 'all' : 'played';
      clearPlayedAndQueueHighlights();
      syncStatusControls();
      scheduleRender();
    }

    function setStatusFilter(nextStatus, { toggle = false, resetTagsOnAll = false, clearOtherFilters = false } = {}) {
      if (clearOtherFilters) clearNonStatusFilters();
      statusFilter = toggle && statusFilter === nextStatus && playTypeFilter === null ? 'all' : nextStatus;
      if (statusFilter !== 'played') playTypeFilter = null;
      clearPlayedAndQueueHighlights();
      syncStatusControls();
      if (statusFilter === 'all' && resetTagsOnAll) {
        activeGenres.clear();
        syncGenreUI();
        activePlatforms.clear();
        syncPlatformUI();
        clearDateFilter({ render: false });
      }
      scheduleRender();
    }

    function setPlayedTotalFilter() {
      if (!statusFilterCounterMode) clearNonStatusFilters();
      statusFilter = 'played';
      playTypeFilter = null;
      syncStatusControls();
      if (queueTotalBtn) queueTotalBtn.classList.remove('queue-active');
      if (playedTotalBtn) playedTotalBtn.classList.add('active');
      scheduleRender();
    }

    function setQueueFilter() {
      if (!statusFilterCounterMode) clearNonStatusFilters();
      statusFilter = 'queue';
      playTypeFilter = null;
      statButtons.forEach(b => b.classList.remove('active'));
      playTypeButtons.forEach(b => b.classList.remove('active'));
      if (playedTotalBtn) playedTotalBtn.classList.remove('active');
      if (queueTotalBtn) queueTotalBtn.classList.add('queue-active');
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

    function matchesStatusFilter(item) {
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
    function createRow(item) {
        const tr = document.createElement('tr');
        const titleTd = document.createElement('td');
        titleTd.className = 'game-col';
        titleTd.tabIndex = 0;
        titleTd.setAttribute('role', 'link');
        titleTd.dataset.url = item.url;
        const game = document.createElement('div');
        game.className = 'game';
        const img = document.createElement('img');
        img.className = 'cover';
        img.alt = ''; img.loading = 'lazy'; img.src = item.cover_url || '';
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

        game.append(img, text);
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
        tr._bgdCoverImg = img;
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
      if (genreBarBtns.length) {
        const genrePool = (!matchAll && activeGenres.size > 0) ? preGenreVisible : visible;
        const genreCountMap = new Map();
        for (const item of genrePool) {
          for (const g of (item.genres || [])) {
            const slug = genreSlug(g);
            genreCountMap.set(slug, (genreCountMap.get(slug) || 0) + 1);
          }
        }
        let visibleSubPillCount = 0;
        genreBarBtns.forEach(btn => {
          const slug = btn.dataset.genre;
          const count = genreCountMap.get(slug) || 0;
          const countEl = btn.querySelector('.genre-count');
          if (countEl) countEl.textContent = count;
          const show = count > 0;
          btn.style.display = show ? '' : 'none';
          btn.style.flexBasis = show ? '' : '0'; // reset; updateGenrePillRows will set properly
          if (show) visibleSubPillCount++;
        });
        // Update pill grid layout
        const singlePill = document.getElementById('genreSinglePill');
        if (singlePill) {
          updateGenrePillRows(singlePill, visibleSubPillCount);
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
        { id: 'colUserRating',  cls: 'hide-col-user-rating',  def: true },
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
    applyCheckbox(genreEmojisChk, 'bgdGenreEmojis', false, on => {
      document.body.classList.toggle('show-genre-emojis', on);
      // Re-run render so pill grid recalculates rows + flex-basis for emoji/non-emoji mode
      scheduleRender();
    });

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
    if (genreShowAllBtn) genreShowAllBtn.addEventListener('click', clearGenres);

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
      platformShowEmptyBtn.addEventListener('click', () => {
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
        platformsDisplayedTotal.textContent = payload.include_platforms226 ? ${ALL_PLATFORM_SLUGS.length} : ${PLATFORM_SLUGS.length};
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

    // -- Play type buttons ---
    playTypeButtons.forEach(btn => btn.addEventListener('click', () => {
      setPlayTypeFilter(btn.dataset.playType, { toggle: statusFilterCounterMode && btn.classList.contains('active'), clearOtherFilters: !statusFilterCounterMode });
    }));

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
    if (genreGrid && typeof ResizeObserver !== 'undefined') {
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

  function buildHtml(payload) {
    // Build genre colour CSS rules embedded in the page
    const genreColorCss = Object.entries(GENRE_COLORS).map(([label, color]) => {
      const safe = label.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      return `.genre-tag[data-genre="${safe}"],.genre-btn[data-genre="${safe}"]{--gc:${color};}`;
    }).join('\n    ');

    const data = escapeJsonForHtml(JSON.stringify(payload));
    const generated = escapeHtml(new Date(payload.generated_at).toLocaleString());
    const hasGenres = payload.include_genres;
    const hasPlatforms = payload.include_platforms;
    const statusLabelsJson = escapeJsonForHtml(JSON.stringify(STATUS_LABELS));
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

    // Collect all genres present in the data (preserving definition order)
    const allGenres = GENRE_SLUGS.map(g => g.label).filter(label =>
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

    const genreBarHtml = hasGenres && allGenres.length ? `
      <div class="genre-bar" id="genreBar">
        <div class="genre-bar-controls">
          <span class="genre-bar-label">Genres</span>
          <button class="genre-show-all" type="button" id="genreShowAll">Show All</button>
          <button class="genre-match-btn active" type="button" id="genreMatchAll" title="When on: games must match ALL selected genres. When off: any one genre is enough."><span class="filter-vis-dot"></span>Match Selected</button>
          <span class="genre-spacer-pills" aria-hidden="true"></span>
          <span class="genre-counter-pill" id="gamesDisplayedPill" title="Games currently shown">
            <span class="genre-counter-pill-label">Games Displayed</span><span class="genre-counter-pill-num" id="gamesDisplayedNum">0</span>
          </span>
          <span class="genre-counter-pill" id="genresDisplayedPill" title="Active genre filters">
            <span class="genre-counter-pill-label">Genres Displayed</span><span class="genre-counter-pill-num" id="genresDisplayedNum">0</span><span class="genre-counter-pill-of">of</span><span class="genre-counter-pill-num">${GENRE_SLUGS.length}</span>
          </span>
          <span style="flex:1"></span>
        </div>
        <div class="genre-btn-wrap" id="genreBtnWrap">
          <div class="genre-pill-grid" id="genreSinglePill">
            ${allGenresSorted.map(g => {
              const safe = g.replace(/[^a-z0-9]/gi, '-').toLowerCase();
              const emoji = escapeHtml(GENRE_EMOJIS[g] || '');
              const count = genreCounts[g] || 0;
              return `<button class="genre-btn" type="button" data-genre="${safe}" data-genre-label="${escapeHtml(g)}" data-genre-emoji="${emoji}"><span class="genre-emoji">${emoji}</span><span class="genre-name">${escapeHtml(g)}</span><span class="genre-count">${count}</span></button>`;
            }).join('')}
          </div>
        </div>
      </div>` : ``;

    const viewerCss = buildViewerCss({ genreColorCss, tableWidths });
    const viewerBody = buildViewerBodyHtml({
      payload,
      generated,
      hasGenres,
      hasPlatforms,
      tableWidths,
      genreBarHtml,
      playTypeCounts,
      playedTotal,
      queueTotal,
    });
    const viewerScript = buildViewerScript({
      payload,
      statusLabelsJson,
      playTypeLabelsJson,
      playTypeColorsJson,
      tableWidths,
      playTypeCounts,
      queueTotal,
    });

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(payload.username)} Backloggd Library</title>
  <style>
${viewerCss}
  </style>${viewerBody}  <script id="payload" type="application/json">${data}</script>
  <script>
${viewerScript}  </script>
</body>
</html>`;

  }

  // ---------------------------------------------------------------------------
  // 10. Export orchestration
  // ---------------------------------------------------------------------------

  async function runExport({ includeGenres = false, includePlatforms = false, includePlatforms226 = false, includeOfflineCovers = false } = {}) {
    panel.classList.add('is-active');
    exportTargetSlug = userSlug;
    exportInProgress = true;
    exportCancelRequested = false;
    exportPauseRequested = false;
    exportPauseResolver = null;
    exportPausedStartedAt = 0;
    exportPausedTotalMs = 0;
    exportStopMessageShown = false;
    exportStartFileFormatSignature = getFileFormatSignature();
    updatePendingFileFormatNote();
    showRunControls();
    clearExportLog();
    setProgress(2);
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
          collectReleaseDates: countRowsNeedingListReleaseDates(deduped.rows, releaseByUrl) > 0,
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
        }
      } else {
        addLog('Played sub-status fallback skipped: data-status-title already complete');
      }

      if (includeGenres) {
        setProgress(42);
        const collectGenreReleaseDates = countRowsNeedingListReleaseDates(deduped.rows, releaseByUrl) > 0;
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
          collectReleaseDates: countRowsNeedingListReleaseDates(deduped.rows, releaseByUrl) > 0,
          knownUrls,
        });
        checkExportCancelled();
        platformsByUrl = platformData.platformsByUrl;
        addLog(`Platforms (226) complete: ${platformData.scannedCount}/${ALL_PLATFORM_SLUGS.length} checked; ${platformData.taggedUrlCount} games tagged; ${platformData.taggedCount} total platform tags`);
        if (platformData.releaseByUrl.size) {
          const added = mergeReleaseDates(releaseByUrl, platformData.releaseByUrl);
          addLog(`Release dates from platforms (226) pass: ${added} added`);
        }
        setProgress(82);
      } else if (includePlatforms) {
        setProgress(66);
        const platformData = await scrapePlatforms({
          collectReleaseDates: countRowsNeedingListReleaseDates(deduped.rows, releaseByUrl) > 0,
          knownUrls,
        });
        checkExportCancelled();
        platformsByUrl = platformData.platformsByUrl;
        addLog(`Platforms (50) complete: ${platformData.scannedCount}/${PLATFORM_SLUGS.length} checked; ${platformData.taggedUrlCount} games tagged; ${platformData.taggedCount} total platform tags`);
        if (platformData.releaseByUrl.size) {
          const added = mergeReleaseDates(releaseByUrl, platformData.releaseByUrl);
          addLog(`Release dates from platforms (50) pass: ${added} added`);
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

      const items = deduped.rows.map(row => {
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
          average_rating: row.average_rating,
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

      const payload = {
        username: targetSlug,
        source: `${location.origin}/u/${encodeURIComponent(targetSlug)}/games/`,
        generated_at: new Date().toISOString(),
        counts: dedupedCounts,
        raw_counts: counts,

        release_dates_missing: detailReleaseData.failures.length,
        include_genres: includeGenres,
        include_platforms: includePlatforms || includePlatforms226,
        include_platforms226: !!includePlatforms226,
        total: items.length,
        items,
      };

      const finalFormats = getSelectedFileFormats();
      const finalFormatLabels = getFileFormatLabels(finalFormats);
      if (!finalFormatLabels.length) {
        addLog('No file type selected at finish; nothing downloaded', 'error');
        setProgress(100);
        addLog(`Finished: ${items.length} games scraped`);
        addLog(`Export took ${formatExportElapsedTime(exportStartedAt)}`);
        return;
      }

      const htmlPayload = includeOfflineCovers && finalFormats.html
        ? payloadWithOfflineCovers(payload, await buildOfflineCoverMap(items))
        : payload;
      checkExportCancelled();

      const _formats = finalFormatLabels.join(', ');
      addLog(`Building ${_formats} file${finalFormatLabels.length > 1 ? 's' : ''}`);
      const _now = new Date();
      const _datePrefix = `${_now.getFullYear()}.${String(_now.getMonth() + 1).padStart(2, '0')}.${String(_now.getDate()).padStart(2, '0')}`;
      const baseName = `${_datePrefix}-${safeFilePart(targetSlug)}-backloggd-library`;
      if (finalFormats.json) downloadText(`${baseName}.json`, 'application/json;charset=utf-8', JSON.stringify(payload, null, 2));
      if (finalFormats.csv)  downloadText(`${baseName}.csv`,  'text/csv;charset=utf-8',         buildCsv(payload));
      if (finalFormats.html) downloadText(`${baseName}.html`, 'text/html;charset=utf-8',         buildHtml(htmlPayload));
      setProgress(100);
      addLog(`Finished: ${items.length} games exported`);
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
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export';
      hideRunControls();
    }
  }

  // Download only the selected file types
  async function runExportWithOptions() {
    const includeGenres      = chkGenres     && chkGenres.checked;
    const includeOfflineCovers = chkOfflineCovers && chkOfflineCovers.checked;
    const includePlatforms    = chkPlatforms    && chkPlatforms.checked;
    const includePlatforms226 = chkPlatforms226 && chkPlatforms226.checked;
    const startFormats = getSelectedFileFormats();
    if (!getFileFormatLabels(startFormats).length) {
      alert('Please select at least one file format (CSV, JSON, or HTML).');
      return;
    }
    await runExport({ includeGenres, includePlatforms, includePlatforms226, includeOfflineCovers });
  }

  exportBtn.addEventListener('click', runExportWithOptions);
  if (pauseExportBtn) pauseExportBtn.addEventListener('click', () => setExportPaused(!exportPauseRequested));
  if (stopExportBtn) stopExportBtn.addEventListener('click', requestExportCancel);
  } // end initPanel()
})();
