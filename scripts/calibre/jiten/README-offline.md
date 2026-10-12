# Difficulty estimates on another computer

On a small home server the first full run can take many hours. This runs the
same code on a faster computer that can read the Calibre library (e.g. over a
network share). The results are identical to running it on the server.

## 1. Get the scripts

Copy the `scripts/calibre/jiten/` folder of the repo to a local disk, and put Jiten's
frequency list (`jiten_freq_global.zip`, from jiten.moe/frequency-dictionaries) next to
it or pass it with `--dictionary`.
Don't create the virtual environment on the share: network mounts such as KDE's
kio-fuse can't hold its symlinks ("Inappropriate ioctl for device").

## 2. Install Python packages (once)

Python 3.11 or newer, 64-bit. In the copied `jiten` folder:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt          # Windows: .venv\Scripts\pip install -r requirements.txt
```

This downloads SudachiDict-full (about 1 GB unpacked) and onnxruntime.

## 3. Run it

Always run it with the virtual environment's Python (`.venv/bin/python`), not
the system `python`: it checks this at the start.

If reading the library through a desktop mount (kio-fuse, gvfs) is slow, a real
read-only SMB mount is much faster:
`sudo mount -t cifs //<nas>/<share> /mnt/media -o username=<user>,uid=$(id -u),ro`
(keep `--out` on a writable path).

Point `--library` at the Calibre library (the folder with `metadata.db`),
`--catalog` at the server's catalog and `--out` at the drop folder's `output`:

```sh
# Linux/macOS, share mounted at /mnt/media:
.venv/bin/python offline.py --library /mnt/media/Calibre \
    --catalog http://<server>/calibre/catalog.json \
    --out /mnt/media/ebook-reader-difficulty-import/output

# Windows, share as M:
.venv\Scripts\python offline.py --library M:\Calibre --catalog http://<server>/calibre/catalog.json --out M:\ebook-reader-difficulty-import\output
```

Options:

- `--dictionary FILE` Jiten's frequency list (default: `jiten_freq_global.zip` in the
  folder above the scripts, i.e. the drop folder).
- `--workers N` parallel processes (default: CPU cores - 1). Each needs about
  0.5 GB of RAM.
- `--limit 20` estimates only 20 books: a quick trial run to check the setup.
- `--work DIR` local working folder (default `~/.cache/ebook-reader-difficulty`).

Running it again resumes: it only estimates books without a current estimate.

It prints progress every 30 seconds. It needs the server for one thing only:
the catalog (`--catalog` also takes a downloaded copy).

## 4. Install the results on the server

When it finishes, `output/` contains `difficulty.json`.
On the server (in the container or machine running the difficulty service):

```sh
jiten-difficulty-import [output folder]
```

It checks the file, refuses while a difficulty job is running on the server,
and installs it. Reload the library: difficulty badges, sorting and filters
use the new estimates.
