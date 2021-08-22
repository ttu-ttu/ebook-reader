<img src="assets/readme/icon.png" align="left" style="margin-right: 1rem;">

## ッツ Ebook Reader

Source code for the Website [https://ttu-ebook.web.app](https://ttu-ebook.web.app), an online e-book reader that supports Yomichan.
<p style="margin-bottom: 3rem;"/>

# Features

- [x] Supports HTMLZ and EPUB Files
- [x] Vertical Reading Style
- [x] Local Book Library
- [x] Automatic load of the last opened Book
- [x] Auto Scrolling
- [x] Book Manager
- [x] Experience Settings (e. g. Themes, Font Size, Image Blur, Furigana Settings)
- [x] Bookmark Functionality
- [x] Current Character and Progress Display
- [x] Installable as Application on supported Platforms / Browsers

# Usage:

The first Time you enter the Page (or have no Files loaded yet) you need to select the Books you want to read from your Device. 
You can load a Single File by clicking/tapping on the Dropzone or select a whole Folder (Desktop only) with right click. 
Alternatively simply drag&drop Files and Folders on the Element in case you are a Desktop User. 

If you imported a single File this Title will be automatically be loaded into the Reader. In case of multiple Files the Manager
View will be opened on which you can decide which Book you want to open in the Reader. On your next Visit the Page will 
automatically load the last Book you have read.

You can find following Control Elements in the Reader:

Element | Description
--- | ---
<img src="assets/readme/control_fs.PNG"> | Allows you enter the Fullscreen Mode (Keybind F11)
<img src="assets/readme/control_file.png"> | Allows you to import new Books to your Library
<img src="assets/readme/control_folder.png"> | Allows you to import new Books from a Folder to your Library (Desktop Only)
<img src="assets/readme/control_manager.png"> | Opens the Book Manager (Keybind m)
<img src="assets/readme/control_bm.png"> | Allows you to set a Bookmark at your current Location (Keybind b)
<img src="assets/readme/control_settings.png"> | Opens the Reader Settings

In the bottom right corner you will be able to see your current Reading Progress. <img src="assets/readme/progress.png" style="margin-left: 1rem"> 

You can toggle the visibility by clicking/tapping on it.

<p style="margin-bottom: 3rem;">An Update to the Page is indicated by the <img src="assets/readme/update.png" style="margin: 0rem 1rem;">
 Symbol in the bottom left corner. After the next Page reload it will automatically be applied in case you are connected with the Internet.</p>

# Desktop Keybinds:

**Note:** The Keys are currencly bound to their Physical Location. 
Explanation from [MDN](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code):

> For example, the code returned is "KeyQ" for the Q key on a QWERTY layout keyboard, but the same code value also 
represents the ' key on Dvorak keyboards and the A key on AZERTY keyboards. 

Key Code | Description
--- | ---
<kbd>Escape</kbd> | Close Settings Dialog
<kbd>Space</kbd> | Toggle Auto-Scrolling
<kbd>a</kbd> / <kbd>d</kbd> | Increase / Decrease Auto-Scrolling Speed
<kbd>b</kbd> | Create Bookmark at your current Location
<kbd>m</kbd> | Open Book Manager
<kbd>PageDown</kbd> / <kbd>PageUp</kbd> | Turn Pages

# Book Manager:

You can open the Book Manager by clicking/tapping on the respective Icon or pressing its Keybind (m) as Desktop User. 
You will be presented with a List of Covers of all your imported Books and their respective Titles and Progress (available 
after re-setting a Bookmark). The current opened Book will be highlighted with a red glowing Border. 
To change your current Book you can click/tap on the Book Cover or Title. 

You can delete Books by clicking/tapping on their respective Checkbox and the trash can icon. After you confirmed the Deletion
all Data and respective Bookmarks will be removed from your Library. In Case you deleted the current opened Book you need to leave
the Manager by clicking on the Book you want to open next. Otherwise you can use the regular Exit Icon to reload the Reader Page.


In order to quickly select all Books you can click/tap on the centered List Icon. Vice Versa clicking/tapping on the X Icon
will deselect all Books.
