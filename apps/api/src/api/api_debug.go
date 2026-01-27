package api

import (
	"net/http"
)

func (this *TsuApi) Debug(w http.ResponseWriter, r *http.Request) {

	this.Lock()
	defer this.Unlock()

	WriteJson(w, this.Files)
}
