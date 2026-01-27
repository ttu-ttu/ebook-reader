package api

import (
	"net/http"
	"os"

	"github.com/gorilla/mux"
)

func (this *TsuApi) ReadFileData(w http.ResponseWriter, r *http.Request) {

	vars := mux.Vars(r)

	fileId, ok := vars["fileId"]

	if !ok {
		Done(w, http.StatusBadRequest, "file ID must be provided")
		return
	}

	this.Lock()
	defer this.Unlock()

	for _, file := range this.Files {

		if file.ID == fileId {

			if data, err := os.ReadFile(file.Path); err != nil {

				Done(w, http.StatusInternalServerError, "unknown error reading file")

			} else {

				w.Write(data)
			}

			return
		}
	}

	NotFound(w)
}

