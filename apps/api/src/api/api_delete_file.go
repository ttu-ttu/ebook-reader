package api

import (
	"net/http"

	"github.com/gorilla/mux"
)

func (this *TsuApi) DeletePath(w http.ResponseWriter, r *http.Request) {

	vars := mux.Vars(r)

	idToDelete, ok := vars["id"]

	if !ok {
		Done(w, http.StatusBadRequest, "no ID given")
		return
	}

	this.Lock()
	defer this.Unlock()

	for _, file := range this.Files {

		// TODO: actually delete from the array
		if file.ID == idToDelete {

			file.ID = ""
			file.Path = ""
			file.Name = ""
			file.Parent = ""

			break
		}
	}

	Ok(w)
}
