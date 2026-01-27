package main

import (
	"crypto/rand"
	"crypto/sha1"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"sort"
	"strconv"
	"sync"
	"time"

	"ttsu-server/src/api"
	"ttsu-server/src/form"

	"github.com/rs/zerolog/log"
)

const maxUpload = 1 << 31;
const rootFolder = "./data"
const tmpFolder  = "./tmp"


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
	ID     string        `json:"id"`
	Parent string        `json:"parentId"`
	Name   string        `json:"name"`
	Path   string        `json:"path"`
	Card   BookCardProps `json:"card"`
}

type Db struct {
	nu sync.Mutex
	Files []TsuFile
}

func (db *Db) Save() error {

	db.nu.Lock()
	defer db.nu.Unlock()

	data, err := json.MarshalIndent(db.Files, "", "  ")

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

	r.Body = http.MaxBytesReader(w, r.Body, maxUpload)
	rc:=http.NewResponseController(w)

	contentLen, err := strconv.ParseInt(r.Header.Get("Content-Length"), 10, 64)

	if err != nil || contentLen <= 0 || contentLen >= maxUpload || r.ContentLength >= maxUpload {
		http.Error(w, "content length is invalid, or larger than the allowed max upload size", http.StatusBadRequest)
		return
	}

	log.Info().
		Int64("content-length", contentLen).
		Msg("handling an upload request")

	multipartReader, err := r.MultipartReader()

	if err != nil {
		log.Error().Err(err).Msg("help")
		http.Error(w, "failed to get a multipart reader", http.StatusBadRequest)
		return
	}

	var fileId string
	var fileName string
	var folderId string
	var filePath string

	didFileUpload := false
	startTime := time.Now()
	sha1Hash := sha1.New()
	fileSize := int64(0)

	for {
		// Note that calling 'return' or 'break' in this loop will not close the part.
		// This is intentional because when the part is closed it will read and discard until the start of the next part.
		// If for example the user uploads a 50gb file in a field we expect a string.
		// If we read 50 bytes of that and then close it, it will read and discard the other 50gb.
		// Instead we abort the connection so the server can ignore the rest of the form.
		//
		// This sadly doesn't give the user any reason as to why their upload failed.
		// They just get a vague message about connection being reset, but this is better than allowing them to waste bandwidth.
		part, err := multipartReader.NextPart()

		if err != nil {
			if err == io.EOF {
				break
			}
			http.Error(w, "error getting a part", http.StatusBadRequest)
			return
		}

		switch part.FormName() {

		case "id":

			idStr, ok := form.ReadFormString(512, part)

			if !ok || idStr == "" {
				api.Done(w, http.StatusForbidden, "invalid file ID")
				return
			}

			fileId = idStr 

		case "parent":

			parentStr, ok := form.ReadFormString(512, part)

			if !ok || parentStr == "" {
				api.Done(w, http.StatusForbidden, "invalid parent ID")
				return
			}

			folderId = parentStr 

		case "name":

			filenameStr, ok := form.ReadFormString(512, part)

			if !ok || filenameStr == "" {
				api.Done(w, http.StatusForbidden, "invalid filename")
				return
			}

			fileName = filenameStr 

		case "data":

			file, err := os.CreateTemp(tmpFolder, "ttsu_tmp*")

			if err != nil {
				api.Done(w, http.StatusInternalServerError, "could not create temp file")
				return
			}
			defer file.Close()

			buffer := make([]byte, 4*1024)
			for {

				n, err := part.Read(buffer)

				if n > 0 {
					fileSize += int64(n)
					file.Write(buffer[0:n])
					sha1Hash.Write(buffer[0:n])

					// prevent upload from timing out
					deadline := time.Now().Add(time.Second * 60)
					rc.SetReadDeadline(deadline)
					rc.SetWriteDeadline(deadline)
				}

				if err != nil {

					if err == io.EOF {
						break
					}

					file.Close()
					os.Remove(file.Name())

					log.Info().Err(err).Msg("returning error from SaveFile")
					return
				}

				if n == 0 {
					break
				}
			}

			filePath = path.Join(rootFolder, hex.EncodeToString(sha1Hash.Sum(nil)))

			if err := os.Rename(file.Name(), filePath); err != nil {
				api.Done(w, http.StatusInternalServerError, "error persisting the file to disk")
				return
			}

			didFileUpload = true

		default:
			api.Donef(w, http.StatusBadRequest, "got unexpected form part")
			return
		}
	}

	doPatch := r.Method == "PATCH"

	if !didFileUpload && !doPatch {
		api.Done(w, http.StatusBadRequest, "unexpected EOF")
		return
	}

	stopTime := time.Now()

	log.Info().
		Str("took", stopTime.Sub(startTime).String()).
		Msg("upload success")


	db.nu.Lock()
	defer db.nu.Unlock()

	for _, file := range db.Files {

		if doPatch { 

			if file.ID == fileId {
				file.Name = fileName
				api.WriteJson(w, file)
				return
			}

		} else if file.Parent == folderId && file.Name == fileName {

			if err := os.Remove(file.Path); err != nil {
				log.Error().Err(err).Msg("failed to delete file")
			}

			file.Path = filePath

			api.WriteJson(w, file)
			return
		}
	}

	if doPatch {
		api.Done(w, http.StatusBadRequest, "Cannot patch a file that does not exist")
		return
	}

	var id [16]byte
	rand.Read(id[:])

	file := TsuFile{
		ID:     hex.EncodeToString(id[:]),
		Parent: folderId,
		Name:   fileName,
		Path:   filePath,
	}
	db.Files = append(db.Files, file)

	api.WriteJson(w, file)
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
			file.Path = ""
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
		api.Done(w, http.StatusBadRequest, "could not decode json")
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

	sort.Slice(files, func(i, j int) bool {
		return files[i].Name > files[j].Name 
	})

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

			if data, err := os.ReadFile(file.Path); err != nil {
				api.Done(w, http.StatusInternalServerError, "unknown error reading file")
				return
			} else {
				api.Ok(w)
				w.Write(data)
			}
		}
	}
}

const useAuth =false


// BasicAuth returns a middleware that enforces HTTP Basic Authentication.
func BasicAuth(username, password, realm string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

			defer db.Save()

			u, p, ok := r.BasicAuth()
			if useAuth && (!ok ||
				subtle.ConstantTimeCompare([]byte(u), []byte(username)) != 1 ||
				subtle.ConstantTimeCompare([]byte(p), []byte(password)) != 1 ){
				w.Header().Set("WWW-Authenticate", `Basic realm="`+realm+`"`)
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func main() {

	os.MkdirAll(rootFolder, 0777)
	os.MkdirAll(tmpFolder, 0777)

	auth := BasicAuth("tsu", "tsu", "My App")

	http.Handle("/ensureTitle", api.Cors(auth(http.HandlerFunc(ensureTitleHandler))))
	http.Handle("/setRootFiles", api.Cors(auth(http.HandlerFunc(setRootFilesHandler))))
	http.Handle("/upload", api.Cors(auth(http.HandlerFunc(uploadHandler))))
	http.Handle("/executeDelete", api.Cors(auth(http.HandlerFunc(executeDeleteHandler))))
	http.Handle("/listFiles", api.Cors(auth(http.HandlerFunc(listFiles))))
	http.Handle("/readFileData", api.Cors(auth(http.HandlerFunc(readFileData))))

	port := 8080
	log.Info().Int("port", port).Msg("Server is running")

	err := http.ListenAndServe(fmt.Sprintf(":%d", port), nil)
	log.Fatal().Err(err).Msg("server dead")
}
