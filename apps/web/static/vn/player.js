/**
 * Shell for the CONscripter web engine (conscripter.js, GPL-2.0, fetched by scripts/conscripter/),
 * loaded by the reader's /v page in a same-origin iframe. The engine calls the globals below
 * (g_onsyuri_*, fetch_file, flush_save, playVideo, scale_full, onsyuriText, onsyuriChoice,
 * onsyuriOverlay, onsyuriBacklog, onsyuriSprites, onsyuriVoice, onsyuriPosition, onsyuriMode) from its C code; they keep ONScripter-yuri's names, as does its
 * onsyuri() loader.
 * The page calls startGame() once the frame has loaded.
 */

var g_onsyuri_module = {};
var g_onsyuri_index = {};
var g_onsyuri_filemap = {};
var g_screen_width = 640;
var g_screen_height = 480;
var onsyuriText;
var textLines = function () {
  return [];
};
var onSave = function () {};
var textEncoding = 'shift_jis';

function mkdirs(FS, path) {
  var dir = '';

  path
    .split('/')
    .filter(Boolean)
    .forEach(function (part) {
      dir += '/' + part;
      try {
        FS.mkdir(dir);
      } catch (e) {
        // exists
      }
    });
}

function scale_full(canvas, ratio) {
  var w = window.innerWidth;
  var h = window.innerHeight;
  var overlay = document.getElementById('overlay');

  if (w / h > ratio) w = h * ratio;
  else h = w / ratio;
  canvas.style.width = overlay.style.width = w + 'px';
  canvas.style.height = overlay.style.height = h + 'px';
  // Overlay lines are laid out in screen pixels, scaled like the canvas.
  overlay.style.setProperty('--scale', w / g_screen_width);
}

function overlayLine(line) {
  var div = document.createElement('div');

  div.textContent = line.text;
  div.style.left = (100 * line.x) / g_screen_width + '%';
  div.style.top = (100 * line.y) / g_screen_height + '%';
  div.style.fontSize = 'calc(var(--scale) * ' + line.size + 'px)';
  div.style.letterSpacing = 'calc(var(--scale) * ' + (line.pitch - line.size) + 'px)';
  // Yomitan reads the writing mode to scan the column and place its popup beside it.
  if (line.vertical) div.style.writingMode = 'vertical-rl';
  return div;
}

/** lines: [{ text, x, y, size, pitch, vertical? }] in screen pixels (overlayLines in lib/data/vn.ts). */
function showText(lines) {
  document
    .getElementById('page-text')
    .replaceChildren.apply(document.getElementById('page-text'), lines.map(overlayLine));
}

/** A choice (or system menu item) drawn by the engine: its text in script bytes. */
function onsyuriChoice(bytes, x, y, size, pitch) {
  document
    .getElementById('choices')
    .appendChild(
      overlayLine({
        text: new TextDecoder(textEncoding).decode(bytes),
        x: x,
        y: y,
        size: size,
        pitch: pitch
      })
    );
}

var stashedChoices = [];
var stashedPage = [];
var inSystem = false;
var inBacklog = false;
var windowHidden = false;

function updateHidden() {
  document.getElementById('page-text').hidden = windowHidden || (inSystem && !inBacklog);
  document.getElementById('sprite-text').hidden = inSystem;
}

/**
 * The engine says when text leaves the screen, so the overlay never outlives it (clicks
 * elsewhere, e.g. to close Yomitan, leave it alone): 'page' (new page), 'hide'/'show' (text
 * window hidden and back with its page), 'choices' (buttons removed), 'enter'/'leave' (system
 * menu or backlog over the page and back), 'reset' (left the system menu elsewhere, e.g. a
 * loaded game).
 */
function onsyuriOverlay(event) {
  var page = document.getElementById('page-text');
  var choices = document.getElementById('choices');

  if (event === 'page') {
    page.textContent = '';
    lineVoice = null;
  }
  else if (event === 'choices') choices.textContent = '';
  else if (event === 'hide') windowHidden = true;
  else if (event === 'show') windowHidden = false;
  else if (event === 'enter') {
    stashedChoices = Array.prototype.slice.call(choices.children);
    stashedPage = Array.prototype.slice.call(page.children);
    choices.textContent = '';
    inSystem = true;
    inBacklog = false;
  } else if (event === 'leave') {
    choices.replaceChildren.apply(choices, stashedChoices);
    page.replaceChildren.apply(page, stashedPage);
    inSystem = false;
  } else if (event === 'reset') {
    page.textContent = choices.textContent = '';
    inSystem = windowHidden = false;
  }
  updateHidden();
}

/** A backlog page (between 'enter' and 'leave'): script bytes and boxes, as for onsyuriText. */
function onsyuriBacklog(bytes, boxes, voice) {
  backlogVoice = voice;
  showText(textLines(bytes, boxes));
  inBacklog = true;
  updateHidden();
}

/** The visible string sprites (strsp: script-drawn menus and backlogs) at each wait for input. */
function onsyuriSprites(bytes, boxes) {
  var layer = document.getElementById('sprite-text');

  layer.replaceChildren.apply(layer, textLines(bytes, boxes).map(overlayLine));
}

// The voice (dwave channel 0) of the page being read, and of the backlog page shown.
var lineVoice = null;
var backlogVoice = null;
// From onsyuriPosition: 1 if the engine has the text as read before, 0 if not, -1 unknown.
var textRead = -1;
var autoMode = false;

function onsyuriVoice(channel, file) {
  if (channel === 0) lineVoice = file;
}

function onsyuriPosition(offset, total, label, read) {
  textRead = read;
}

function onsyuriMode(auto) {
  autoMode = !!auto;
}

/** Calls one of the engine's _onsyuriSet* exports (CONscripter v0.19.0+), e.g. ('Ruby', 0). */
function engineSet(name, value) {
  var set = g_onsyuri_module['_onsyuriSet' + name];

  if (typeof set === 'function') set(value);
}

// Yomitan's scan keys stop auto mode, so the text doesn't move on during a lookup.
window.addEventListener(
  'keydown',
  function (event) {
    if (autoMode && /^(Shift|Control|Alt|Meta)$/.test(event.key)) engineSet('Auto', 0);
  },
  true
);

// Clicks on the overlay's text go to the game, as if the text weren't there.
[
  'mousedown',
  'mouseup',
  'mousemove',
  'click',
  'contextmenu',
  'wheel',
  'touchstart',
  'touchmove',
  'touchend'
].forEach(function (type) {
  document.getElementById('overlay').addEventListener(type, function (event) {
    var Copy = event.constructor;

    // Hover stays with the page (Yomitan scans on mousemove); the rest is the game's.
    if (type !== 'mousemove') event.preventDefault();
    try {
      document.getElementById('canvas').dispatchEvent(new Copy(type, event));
    } catch (error) {
      console.warn('Could not pass ' + type + ' to the game', error);
    }
  });
});

window.addEventListener('resize', function () {
  scale_full(document.getElementById('canvas'), g_screen_width / g_screen_height);
});

// Anki mining (lib/data/anki.ts): a screenshot, and the game's sound since the last click or key.
var soundTap;
var lineRecorder;
var lineAudio;
var recordLines = false;
var nativeConnect = AudioNode.prototype.connect;
var nativeGetContext = HTMLCanvasElement.prototype.getContext;

// Whatever the engine sends to the speakers is also sent to soundTap.
AudioNode.prototype.connect = function (target) {
  if (recordLines && target instanceof AudioDestinationNode) {
    if (!soundTap) {
      soundTap = this.context.createMediaStreamDestination();
      restartLineRecorder();
    }
    if (soundTap.context === this.context) nativeConnect.call(this, soundTap);
  }
  return nativeConnect.apply(this, arguments);
};

// Keeps the last frame readable after it is shown, for screenshots.
HTMLCanvasElement.prototype.getContext = function (type, attributes) {
  if (type === 'webgl' || type === 'webgl2') {
    attributes = Object.assign({}, attributes, { preserveDrawingBuffer: true });
  }
  return nativeGetContext.call(this, type, attributes);
};

function restartLineRecorder(event) {
  // Modifier keys are Yomitan's scan keys, not the game's.
  if (event && /^(Shift|Control|Alt|Meta)$/.test(event.key)) return;
  if (lineRecorder && lineRecorder.state !== 'inactive') lineRecorder.stop();
  lineAudio = undefined;
  if (!soundTap) return;

  var chunks = [];
  var recorder = new MediaRecorder(soundTap.stream);

  recorder.ondataavailable = function (e) {
    chunks.push(e.data);
  };
  recorder.stopped = new Promise(function (resolve) {
    recorder.onstop = function () {
      resolve(new Blob(chunks, { type: recorder.mimeType }));
    };
  });
  recorder.start();
  lineRecorder = recorder;
}

['mousedown', 'touchstart', 'keydown'].forEach(function (type) {
  window.addEventListener(type, restartLineRecorder, true);
});

var voiceTypes = { ogg: 'audio/ogg', wav: 'audio/wav', mp3: 'audio/mpeg' };

/** A voice file named by the script, if it is a plain game file (not in an archive). */
function voiceFile(file) {
  var node = file && g_onsyuri_filemap[('/game/' + file.replace(/\\/g, '/')).toLowerCase()];
  var type = file && voiceTypes[file.split('.').pop().toLowerCase()];

  if (!node || !type) return null;
  try {
    return new Blob([g_onsyuri_module.FS.readFile(node.path)], { type: type });
  } catch (error) {
    return null;
  }
}

/**
 * The line's voice file, else the sound since the last click or key (null without sound), the
 * same until the next one.
 */
function lineSound() {
  var voice = voiceFile(inSystem && inBacklog ? backlogVoice : lineVoice);

  if (voice) return Promise.resolve(voice);
  if (!lineAudio) {
    if (!lineRecorder || lineRecorder.state === 'inactive') return Promise.resolve(null);
    lineRecorder.stop();
    lineAudio = lineRecorder.stopped;
  }
  return lineAudio;
}

function screenshot() {
  return new Promise(function (resolve) {
    document.getElementById('canvas').toBlob(resolve, 'image/webp', 0.9);
  });
}

// Cache API cache of a server game the reader chose to keep in the browser (startGame's cacheName).
var fileCache;
var progress = { loaded: 0, total: 0 };

function showProgress() {
  var box = document.getElementById('progress');
  var mb = function (bytes) {
    return Math.round(bytes / 1048576);
  };

  box.hidden = progress.loaded >= progress.total;
  if (box.hidden) progress.loaded = progress.total = 0;
  box.querySelector('progress').max = progress.total;
  box.querySelector('progress').value = progress.loaded;
  box.querySelector('span').textContent =
    'Loading game files… ' + mb(progress.loaded) + ' / ' + mb(progress.total) + ' MB';
}

/** A response's bytes; files over 1 MB show in the progress bar while they load. */
async function readResponse(response) {
  var size = Number(response.headers.get('Content-Length')) || 0;

  if (!response.body || size < 1048576) return response.arrayBuffer();

  var data = new Uint8Array(size);
  var offset = 0;
  var reader = response.body.getReader();

  progress.total += size;
  showProgress();
  try {
    for (;;) {
      var chunk = await reader.read();

      if (chunk.done) break;
      data.set(chunk.value, offset);
      offset += chunk.value.length;
      progress.loaded += chunk.value.length;
      showProgress();
    }
    if (offset !== size) throw new Error('Truncated: ' + offset + ' of ' + size + ' bytes');
  } finally {
    // Failed reads leave the bar too.
    progress.loaded += size - offset;
    showProgress();
  }
  return data.buffer;
}

async function loadFile(url) {
  var cached = fileCache && (await fileCache.match(url));

  if (cached) return readResponse(cached);

  var response = await fetch(url);

  if (!response.ok) throw new Error('HTTP ' + response.status);
  if (fileCache) {
    fileCache.put(url, response.clone()).catch(function (error) {
      console.warn('Could not keep ' + url + ' in the browser', error);
    });
  }
  return readResponse(response);
}

/** Lazy loading (fopen_ons): copies a game file into the engine's memory on first use. */
function fetch_file(FS, key, filemap) {
  var node = filemap[key];

  if (!node || node.loading) return;
  node.loading = true;
  loadFile(node.url)
    .then(function (data) {
      // canOwn: the engine keeps this buffer instead of a copy, so a file sits in memory once.
      FS.writeFile(node.path, new Uint8Array(data), { canOwn: true });
    })
    .catch(function (error) {
      console.error('Could not load ' + node.path, error);
    })
    .finally(function () {
      // Also on failure: the engine waits for this, and then fails to open the file.
      node.loaded = true;
    });
}

function flush_save() {
  g_onsyuri_module.FS.syncfs(false, function (error) {
    if (error) console.error(error);
    else onSave(readSaves());
  });
}

function playVideo(path, clickFlag, loopFlag) {
  var video = document.getElementById('video');
  var canvas = document.getElementById('canvas');
  var data = g_onsyuri_module.FS.readFile(path);

  function ended() {
    canvas.style.display = 'block';
    video.style.display = 'none';
    URL.revokeObjectURL(video.src);
    video.removeAttribute('src');
    g_onsyuri_module.wait_video = false;
  }

  g_onsyuri_module.wait_video = true;
  video.src = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
  video.loop = loopFlag;
  video.onended = ended;
  video.onerror = ended;
  video.onclick = clickFlag ? ended : null;
  canvas.style.display = 'none';
  video.style.display = 'block';
  video.play();
}

/** The save folder's files: name → { modified, bytes }. */
function readSaves() {
  var FS = g_onsyuri_module.FS;
  var dir = g_onsyuri_index.savedir;
  var saves = {};

  FS.readdir(dir).forEach(function (name) {
    var stat = FS.stat(dir + '/' + name);

    if (FS.isFile(stat.mode)) {
      saves[name] = { modified: stat.mtime.getTime(), bytes: FS.readFile(dir + '/' + name) };
    }
  });

  return saves;
}

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    var script = document.createElement('script');

    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

/**
 * options: files (path → Blob or URL, paths relative to the game folder), encoding ('sjis' |
 * 'utf8'), saveDir (unique per game), cacheName (Cache API cache keeping the fetched files, for
 * games served by URL), saves (synced save files, written when newer than
 * this browser's), recordLines (keep the sound of the current line for lineSound()),
 * onText(bytes, skipped, boxes, read), textLines(bytes, boxes) (overlay lines for backlog pages and sprites),
 * onSave(saves), onExit(code).
 */
async function startGame(options) {
  var gameDir = '/game';
  var hasFont = Object.keys(options.files).some(function (path) {
    return path.toLowerCase() === 'default.ttf';
  });

  // onText also gets whether the engine has the text as read before (onsyuriPosition).
  onsyuriText = function (bytes, skipped, boxes) {
    options.onText(bytes, skipped, boxes, textRead);
  };
  textLines = options.textLines || textLines;
  recordLines = !!options.recordLines && typeof MediaRecorder !== 'undefined';
  if (options.cacheName) fileCache = await caches.open(options.cacheName);
  onSave = options.onSave || onSave;
  textEncoding = options.encoding === 'utf8' ? 'utf-8' : 'shift_jis';
  g_onsyuri_index = { gamedir: gameDir, savedir: options.saveDir };
  Object.keys(options.files).forEach(function (path) {
    g_onsyuri_filemap[(gameDir + '/' + path).toLowerCase()] = {
      path: gameDir + '/' + path,
      url:
        typeof options.files[path] === 'string'
          ? options.files[path]
          : URL.createObjectURL(options.files[path]),
      loaded: false
    };
  });
  if (!hasFont) {
    g_onsyuri_filemap[gameDir + '/default.ttf'] = {
      path: gameDir + '/default.ttf',
      url: 'default.ttf',
      loaded: false
    };
  }

  g_onsyuri_module.canvas = document.getElementById('canvas');
  g_onsyuri_module.onExit = options.onExit;
  await loadScript('conscripter.js');
  // INVOKE_RUN=0: the runtime is ready here and main() waits for callMain.
  g_onsyuri_module = await onsyuri(g_onsyuri_module);

  var FS = g_onsyuri_module.FS;

  Object.keys(g_onsyuri_filemap).forEach(function (key) {
    var path = g_onsyuri_filemap[key].path;

    mkdirs(FS, path.slice(0, path.lastIndexOf('/')));
  });
  mkdirs(FS, options.saveDir);
  FS.mount(g_onsyuri_module.IDBFS, {}, options.saveDir);
  await new Promise(function (resolve) {
    FS.syncfs(true, function (error) {
      if (error) console.error(error);
      resolve();
    });
  });

  var local = readSaves();

  Object.keys(options.saves || {}).forEach(function (name) {
    var save = options.saves[name];
    var path = options.saveDir + '/' + name;

    if (!local[name] || local[name].modified < save.modified) {
      FS.writeFile(path, save.bytes);
      FS.utime(path, save.modified, save.modified);
    }
  });
  flush_save();

  document.getElementById('canvas').focus();
  g_onsyuri_module.callMain([
    '--root',
    gameDir,
    '--font',
    gameDir + '/default.ttf',
    '--save-dir',
    options.saveDir,
    '--enc:' + options.encoding
  ]);
}
