package api

import (
	"net/http"
	"sort"

	"github.com/gorilla/mux"
)

func (this *TsuApi) ListDirectoryFiles(w http.ResponseWriter, r *http.Request) {

	vars := mux.Vars(r)

	folderId, ok := vars["folderId"]

	if !ok {
		Done(w, http.StatusBadRequest, "folder ID must be provided")
		return
	}

	files := []TsuFile{}

	this.Lock()
	defer this.Unlock()

	for _, file := range this.Files {

		if file.Parent == folderId {

			files = append(files, file)
		}
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].Name > files[j].Name
	})

	WriteJson(w, files)
}
