package api

import (
	"crypto/rand"
	"crypto/sha1"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"path"
	"strconv"
	"time"
	"ttsu-server/src/config"
	"ttsu-server/src/form"

	"github.com/rs/zerolog/log"
)

func (this *TsuApi) UploadFile(w http.ResponseWriter, r *http.Request) {

	r.Body = http.MaxBytesReader(w, r.Body, config.MaxUploadSize)
	rc := http.NewResponseController(w)

	contentLen, err := strconv.ParseInt(r.Header.Get("Content-Length"), 10, 64)

	if err != nil || contentLen <= 0 || contentLen >= config.MaxUploadSize || r.ContentLength >= config.MaxUploadSize {
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
				Done(w, http.StatusForbidden, "invalid file ID")
				return
			}

			fileId = idStr

		case "parent":

			parentStr, ok := form.ReadFormString(512, part)

			if !ok || parentStr == "" {
				Done(w, http.StatusForbidden, "invalid parent ID")
				return
			}

			folderId = parentStr

		case "name":

			filenameStr, ok := form.ReadFormString(512, part)

			if !ok || filenameStr == "" {
				Done(w, http.StatusForbidden, "invalid filename")
				return
			}

			fileName = filenameStr

		case "data":

			file, err := os.CreateTemp(config.TempFolder, "ttsu_tmp*")

			if err != nil {
				Done(w, http.StatusInternalServerError, "could not create temp file")
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

			filePath = path.Join(config.StorageFolder, hex.EncodeToString(sha1Hash.Sum(nil)))

			if err := os.Rename(file.Name(), filePath); err != nil {
				Done(w, http.StatusInternalServerError, "error persisting the file to disk")
				return
			}

			didFileUpload = true

		default:
			Donef(w, http.StatusBadRequest, "got unexpected form part")
			return
		}
	}

	doPatch := r.Method == "PATCH"

	if !didFileUpload && !doPatch {
		Done(w, http.StatusBadRequest, "unexpected EOF")
		return
	}

	stopTime := time.Now()

	log.Info().
		Str("took", stopTime.Sub(startTime).String()).
		Msg("upload success")

	this.Lock()
	defer this.Unlock()

	for _, file := range this.Files {

		if doPatch {

			if file.ID == fileId {
				file.Name = fileName
				WriteJson(w, file)
				return
			}

		} else if file.Parent == folderId && file.Name == fileName {

			if err := os.Remove(file.Path); err != nil {
				log.Error().Err(err).Msg("failed to delete file")
			}

			file.Path = filePath

			WriteJson(w, file)
			return
		}
	}

	if doPatch {
		Done(w, http.StatusBadRequest, "Cannot patch a file that does not exist")
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
	this.Files = append(this.Files, file)

	WriteJson(w, file)
}
