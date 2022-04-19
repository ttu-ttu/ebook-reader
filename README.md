<img src="assets/readme/icon.png" align="left" style="margin-right: 1rem;" alt="">

## ッツ Ebook Reader

An online e-book reader that supports Yomichan, which is hosted on [https://reader.ttsu.app](https://reader.ttsu.app)

# Features

- [x] Supports HTMLZ and EPUB files
- [x] Vertical reading style
- [x] Local book library
- [x] Auto scroll
- [x] Book manager
- [x] Customizable environment (e. g. themes, font size, image blur, furigana Settings)
- [x] Bookmark functionality
- [x] Character count and progress display

# Usage

The first time you enter the page (or have no files loaded yet) you will need to select the books you want to read from your device.
You can load on file by clicking/tapping on the dropzone, or load on folder (desktop only) by right click.
Alternatively, you can also drag & drop files or folders on the reader if your device supports it.

You may find the following controls in the reader:

| Control                                          | Description                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| ![Icon](assets/readme/control-fullscreen.svg)    | Allows you to enter fullscreen mode                                                 |
| ![Icon](assets/readme/control-file-upload.svg)   | Allows you to import new books to the library                                       |
| ![Icon](assets/readme/control-folder-upload.svg) | Allows you to import new books from a folder to the library (desktop only)          |
| ![Icon](assets/readme/control-manager.svg)       | Opens book manager (keybind <kbd>M</kbd>)                                           |
| ![Icon](assets/readme/control-bookmark.svg)      | Allows you to create a bookmark at your current location (keybind <kbd>B</kbd>)     |
| ![Icon](assets/readme/control-settings.svg)      | Prompts settings dialog                                                             |
| ![Image](assets/readme/book-progress.png)        | Displays your reading progress, click/tap on it to hide                             |
| ![Image](assets/readme/control-update.svg)       | Indicates an update is available for the reader, and will be loaded on next refresh |

# Desktop Keybinds

**Note:** The keys are currently bound to their physical location.  
Explanation from [MDN](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code):

> For example, the code returned is "KeyQ" for the Q key on a QWERTY layout keyboard, but the same code value also
> represents the ' key on Dvorak keyboards and the A key on AZERTY keyboards.

| Key Code            | Description                              |
| ------------------- | ---------------------------------------- |
| <kbd>Escape</kbd>   | Close settings dialog                    |
| <kbd>Space</kbd>    | Toggle auto-scroll                       |
| <kbd>A</kbd>        | Increase auto-scroll speed               |
| <kbd>D</kbd>        | Decrease auto-scroll speed               |
| <kbd>B</kbd>        | Create bookmark at your current location |
| <kbd>R</kbd>        | Return to bookmark location              |
| <kbd>M</kbd>        | Open book manager                        |
| <kbd>PageDown</kbd> | Move to next page                        |
| <kbd>PageUp</kbd>   | Move to previous page                    |

# Book Manager

You can open the book manager by clicking/tapping on the respective icon or the keybinding <kbd>M</kbd> as a desktop user.
You will be presented with a list of covers for all the imported books with their respective titles and progress (determined
by bookmark location). The book currently opened will be highlighted with a red glowing border.

You may:

- Switch books by clicking/tapping on the book covers
- Delete books by clicking/tapping on their respective checkbox and trash can icon (**Warning:** Bookmark progress will also get removed along with the book)
- Click/tap on the centered list icon to select all books
- Click/tap on the X icon to deselect all books

# Self Host

If for some reason you want to host it yourself, you can use the following approach.

### Using Docker

1. Install and launch [Docker](https://docs.docker.com/get-docker/)
2. Run the commands below

```sh
docker build -t ebook-reader -f apps/web/Dockerfile .
docker run --name ebook-reader -d -p 8080:80 ebook-reader
```

3. Visit [http://localhost:8080](http://localhost:8080) to use the app

### Using HTTP Hosting App

1. Have [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/installation) installed
2. Run the commands below

```sh
cd apps/web
pnpm install --frozen-lockfile
pnpm build
```

3. Have your server (such as [http-server](https://www.npmjs.com/package/http-server)) point towards `apps/web/build`
