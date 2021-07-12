<img src="assets/readme/icon.png" align="left" style="margin-right: 1rem;">

## ッツ Ebook Reader

Source code for the Website [https://ttu-ebook.web.app](https://ttu-ebook.web.app), an online e-book reader that supports Yomichan.
<p style="margin-bottom: 3rem;"/>

# Features

- [x] Supports HTMLZ and EPUB Files
- [x] Vertical Reading Style
- [x] Local Book Library to access Novels without the need of reloading them every Time
- [x] Book Manager to quickly change between Novels or simply delete them
- [x] Experience Settings (Themes, Font Size, Image Blur, Furigana Settings)
- [x] Bookmark Functionality
- [x] Current Character and Progress Display
- [x] Installable as Application on supported Platforms

# Usage:

The first Time you enter the Page (or have no Books loaded yet) you need to select the Novels you intent to read. You can load a Single File by clicking/tapping on the Dropzone or select a whole Folder (Desktop Only) with right click. Alternatively simply drag&drop Files and Folders on the Element in case you are a Desktop User. After the successful Import of Books to your Library, the last Title you have loaded will be displayed and you are free to enjoy your Reading Time. On your next Visit the Page will automatically load the last Book you have read.

You can find following Control Elements in the upper right Corner of the Page:

Element | Description
--- | ---
<img src="assets/readme/control1.png"> | Allows you to load new Books to your Library
<img src="assets/readme/control2.png"> | Allows you to load new Books from a Folder to your Library (Desktop Only)
<img src="assets/readme/control3.png"> | Allows you to delete the current Book from your Library (Keybind x)
<img src="assets/readme/control4.png"> | Opens the Book Manager (Keybind m)
<img src="assets/readme/control5.png"> | Allows you to set a Bookmark at your current Location (Keybind b)
<img src="assets/readme/control6.png"> | Opens the Reader Settings

In the bottom right corner you will be able to see your current Reading Progress. <img src="assets/readme/progress.png" style="margin-left: 1rem"> 

You can toggle the visibility by clicking/tapping on it.

<p style="margin-bottom: 3rem;">An Update to the Page is indicated by the <img src="assets/readme/update.png" style="margin: 0rem 1rem;"> Symbol in the bottom left corner. After the next Page reload it will automatically be applied in case you are connected with the Internet.</p>

# Desktop Keybinds:

**Note:** The Keys are currencly bound to their Physical Location. 
Explanation from [MDN](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code):

> For example, the code returned is "KeyQ" for the Q key on a QWERTY layout keyboard, but the same code value also represents the ' key on Dvorak keyboards and the A key on AZERTY keyboards. 

Key Code | Description
--- | ---
<kbd>Escape</kbd> | Close Settings Dialog
<kbd>Space</kbd> | Toggle Auto-Scrolling
<kbd>A</kbd> / <kbd>D</kbd> | Increase / Decrease Auto-Scrolling Speed
<kbd>B</kbd> | Create Bookmark at current Position
<kbd>M</kbd> | Open Book Manager
<kbd>X</kbd> | Delete Current Book
<kbd>PageDown</kbd> / <kbd>PageUp</kbd> | Turn Pages

# Book Manager:

You can open the Book Manager by clicking/tapping on the respective Icon or pressing its Keybind (m) as Desktop User. You will presented with a List of Covers of all your imported Novels and their respective Title. You can easily navigate through them by swiping or using the Arrow Keys on Desktop. Clicking on a Book Title will update your current Reader Content. With double Click you can select a Novel for Deletion - highlighted by the red border. Alternatively you can also click on the + plus sign to select all Books or on the the - icon to deselect all Novels. Clicking on the Trashcan Icon will allow to delete all selected Books after your Confirmation. In Caset you set a Bookmark for the Novel it will additionally show the current Title Progress - otherwise the term "Unknown".

<div style="text-align: center"><img src="assets/readme/manager.png" style="width: 75vw;height: auto; margin-top: 1rem"></div>
