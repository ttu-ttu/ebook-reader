package main

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
)

type BookCardProps struct {
	ID                   int    `json:"id"`
	ImagePath            []byte `json:"imagePath"`
	Title                string `json:"title"`
	Characters           int64  `json:"characters"`
	LastBookModified     int64  `json:"lastBookModified"`
	LastBookOpen         int64  `json:"lastBookOpen"`
	Progress             int64  `json:"progress"`
	LastBookmarkModified int64  `json:"lastBookmarkModified"`
	IsPlaceholder        bool   `json:"isPlaceholder"`
}

type TsuFile struct {
	ID     string`json:"id"`
	Parent string`json:"parentId"`
	Name   string`json:"name"`
	Data   []byte`json:"-"`
	Card BookCardProps `json:"card"`
}
type Db struct {
	nu sync.Mutex
	Files []TsuFile
}

func (db *Db) Save() error {
	type tsuFileDisk struct {
	ID     string         `json:"id"`
	Parent string         `json:"parentId"`
	Name   string         `json:"name"`
	Data   json.RawMessage         `json:"data"`
	Card   BookCardProps `json:"card"`
}

	db.nu.Lock()
	defer db.nu.Unlock()

	files := make([]tsuFileDisk, 0, len(db.Files))
	for _, f := range db.Files {
		files = append(files, tsuFileDisk{
			ID:     f.ID,
			Parent: f.Parent,
			Name:   f.Name,
			Data:   f.Data,
			Card:   f.Card,
		})
	}

	disk := struct {
		Files []tsuFileDisk `json:"files"`
	}{
		Files: files,
	}

	data, err := json.MarshalIndent(disk, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile("db.json", data, 0644)
}

var db = Db{
	Files: make([]TsuFile, 0),
}


// ---------- Helper ----------
func logAndRespond(w http.ResponseWriter, endpoint string, data any, response any) {
	log.Printf("Endpoint called: %s, Data: %+v\n", endpoint, data)
	w.WriteHeader(200)
	if( response != nil ){
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
}

// ---------- Handlers ----------

type EnsureTitleResponse struct {
	ID string `json:"id"`
}
func ensureTitleHandler(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Name     string `json:"name"`
		Parent   string `json:"parent"`
		ReadOnly bool   `json:"readOnly"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		w.WriteHeader(400)
		return
	}

	db.nu.Lock()
	defer db.nu.Unlock()

	for _, file  := range db.Files {

		if file.Parent == payload.Parent && file.Name == payload.Name {

			logAndRespond(w, "ensureTitle", payload,EnsureTitleResponse{
				ID: file.ID,
			} )
			return
		}
	}

	var id [16]byte
	rand.Read(id[:])

	db.Files = append(db.Files, TsuFile{
		ID: hex.EncodeToString(id[:]),
		Parent: payload.Parent,
		Name: payload.Name,
	})

	logAndRespond(w, "ensureTitle", payload,EnsureTitleResponse{
		ID: hex.EncodeToString(id[:]),
	} )
}

func setRootFilesHandler(w http.ResponseWriter, r *http.Request) {
	logAndRespond(w, "setRootFiles", nil, map[string]string{"status": "ok"})
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Parent string
		Name   string
		Data   json.RawMessage
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		println("Failed to decode json", err.Error())
		w.WriteHeader(400)
		return
	}

	db.nu.Lock()
	defer db.nu.Unlock()

	for _, file := range db.Files {

		if file.Parent == payload.Parent && file.Name == payload.Name {
			
			file.Data = []byte(payload.Data)
			logAndRespond(w, "upload", payload, file )

			return
		}
	}

	var id [16]byte
	rand.Read(id[:])

	file := TsuFile{
		ID:     hex.EncodeToString(id[:]),
		Parent: payload.Parent,
		Name:   payload.Name,
		Data:   []byte(payload.Data),
	}
	db.Files = append(db.Files, file)

	logAndRespond(w, "upload", payload, file)
}

func executeDeleteHandler(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		ID string `json:"id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		w.WriteHeader(400)
		return
	}

	db.nu.Lock()
	defer db.nu.Unlock()

	for _, file  := range db.Files {

		if file.ID == payload.ID {

			file.ID = ""
			file.Data = []byte{}
			file.Name= ""
			file.Parent = ""
			logAndRespond(w, "ensureTitle", payload, nil )
			return
		}
	}

	logAndRespond(w, "ensureTitle", payload, nil )
}

func listFiles(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Parent string `json:"parent"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		w.WriteHeader(404)
		return
	}

	var files []TsuFile = []TsuFile{}

	db.nu.Lock()
	defer db.nu.Unlock()

	for _, file := range db.Files {
		if file.Parent == payload.Parent {

			files = append(files, file)
		}
	}

	logAndRespond(w, "listFiles", payload, files)
}

func readFileData(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		File string `json:"file"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		w.WriteHeader(404)
		return
	}

	db.nu.Lock()
	defer db.nu.Unlock()

	for _, file := range db.Files {
		if file.ID == payload.File {

			w.WriteHeader(200)
			w.Write(file.Data)
		}
	}
}

const useAuth =false


// BasicAuth returns a middleware that enforces HTTP Basic Authentication.
func BasicAuth(username, password, realm string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

			defer db.Save()
			println("doign basic auth", useAuth)

			u, p, ok := r.BasicAuth()
			if useAuth && (!ok ||
				subtle.ConstantTimeCompare([]byte(u), []byte(username)) != 1 ||
				subtle.ConstantTimeCompare([]byte(p), []byte(password)) != 1 ){

			println("Bad auth")
				w.Header().Set("WWW-Authenticate", `Basic realm="`+realm+`"`)
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			println("Ok auth")
			next.ServeHTTP(w, r)
		})
	}
}


// ---------- Main ----------
func main() {
	auth := BasicAuth("tsu", "tsu", "My App")

	http.Handle("/ensureTitle", auth(http.HandlerFunc(ensureTitleHandler)))
	http.Handle("/setRootFiles", auth(http.HandlerFunc(setRootFilesHandler)))
	http.Handle("/upload", auth(http.HandlerFunc(uploadHandler)))
	http.Handle("/executeDelete", auth(http.HandlerFunc(executeDeleteHandler)))
	http.Handle("/listFiles", auth(http.HandlerFunc(listFiles)))
	http.Handle("/readFileData", auth(http.HandlerFunc(readFileData)))

	port := 8080
	log.Printf("RemoteApiStorageHandler2 server listening on port %d", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", port), nil))
}
