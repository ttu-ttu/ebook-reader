/**
 * Shell for the ONScripter-yuri web engine (onsyuri.js, GPL-2.0, built by scripts/onsyuri/),
 * loaded by the reader's /v page in a same-origin iframe. The engine calls the globals below
 * (g_onsyuri_*, fetch_file, flush_save, playVideo, scale_full, onsyuriText) from its C code.
 * The page calls startGame() once the frame has loaded.
 */

var g_onsyuri_module = {};
var g_onsyuri_index = {};
var g_onsyuri_filemap = {};
var g_screen_width = 640;
var g_screen_height = 480;
var onsyuriText;
var onSave = function () {};

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

/** lines: [{ text, x, y, size, pitch }] in screen pixels (overlayLines in lib/data/vn.ts). */
function showText(lines) {
  var overlay = document.getElementById('overlay');

  overlay.textContent = '';
  lines.forEach(function (line) {
    var div = document.createElement('div');

    div.textContent = line.text;
    div.style.left = (100 * line.x) / g_screen_width + '%';
    div.style.top = (100 * line.y) / g_screen_height + '%';
    div.style.fontSize = 'calc(var(--scale) * ' + line.size + 'px)';
    div.style.letterSpacing = 'calc(var(--scale) * ' + (line.pitch - line.size) + 'px)';
    overlay.appendChild(div);
  });
}

// The text on screen changes once the game goes on: drop the overlay until the next page
// arrives. Modifier keys don't count (Yomitan's scan key is often Shift).
function clearText(event) {
  if (event.key && /^(Shift|Alt|Meta|Control|OS)$/.test(event.key)) return;
  document.getElementById('overlay').textContent = '';
}

['mousedown', 'wheel', 'touchstart'].forEach(function (type) {
  document.addEventListener(type, clearText, true);
});
document.addEventListener('keydown', clearText, true);

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

/** Lazy loading (fopen_ons): copies a game file into the engine's memory on first use. */
function fetch_file(FS, key, filemap) {
  var node = filemap[key];

  if (!node || node.loading) return;
  node.loading = true;
  fetch(node.url)
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.arrayBuffer();
    })
    .then(function (data) {
      FS.writeFile(node.path, new Uint8Array(data));
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
 * 'utf8'), saveDir (unique per game), saves (synced save files, written when newer than
 * this browser's), onText(bytes, skipped), onSave(saves), onExit(code).
 */
async function startGame(options) {
  var gameDir = '/game';
  var hasFont = Object.keys(options.files).some(function (path) {
    return path.toLowerCase() === 'default.ttf';
  });

  onsyuriText = options.onText;
  onSave = options.onSave || onSave;
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

  await loadScript('onsyuri.js');
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
