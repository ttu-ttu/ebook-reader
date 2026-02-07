package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"

	"github.com/rs/zerolog/log"
)

type CreateFolderResponse struct {
	FolderID string `json:"id"`
}

func (this *TsuApi) CreateFolder(w http.ResponseWriter, r *http.Request) {

	var payload struct {
		Name     string `json:"name"`
		Parent   string `json:"parent"`
		ReadOnly bool   `json:"readOnly"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		Done(w, http.StatusBadRequest, "failed to decode json")
		log.Debug().Msg("failed to parse json")
		return
	}

	this.Lock()
	defer this.Unlock()

	for _, file := range this.Files {

		if file.Parent == payload.Parent && file.Name == payload.Name {

			WriteJson(w, CreateFolderResponse{
				FolderID: file.ID,
			})
			return
		}
	}

	var id [16]byte
	rand.Read(id[:])

	this.Files = append(this.Files, TsuFile{
		ID:     hex.EncodeToString(id[:]),
		Parent: payload.Parent,
		Name:   payload.Name,
	})

	WriteJson(w, CreateFolderResponse{
		FolderID: hex.EncodeToString(id[:]),
	})
}
