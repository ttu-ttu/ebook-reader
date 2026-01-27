package main

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"ttsu-server/src/api"
	"ttsu-server/src/config"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)


func main() {

	os.MkdirAll(config.StorageFolder, 0755)
	os.MkdirAll(config.TempFolder, 0755)

	port := 8080
	bindAddr := "0.0.0.0"

	var addr = fmt.Sprintf("%s:%d", bindAddr, port)

	r := mux.NewRouter()
	r.Use(api.Cors)
	r.Use(api.BasicAuth("tsu", "tsu", "Ttsu Sync Server"))

	srv := &http.Server{
		Handler: r,
		Addr:    addr,
		// Good practice: enforce timeouts for servers you create!
		WriteTimeout:   15 * time.Second,
		ReadTimeout:    15 * time.Second,
		MaxHeaderBytes: 2 * 1024,
	}

	tsu := &api.TsuApi{
		Files: make([]api.TsuFile, 0),
	}

	r.HandleFunc("/debug", tsu.Debug)
	r.HandleFunc("/file", tsu.UploadFile)
	r.HandleFunc("/file/{fileId}", tsu.ReadFileData)
	r.HandleFunc("/folder", tsu.CreateFolder)
	r.HandleFunc("/delete/{id}", tsu.DeletePath)
	r.HandleFunc("/list/{folderId}", tsu.ListDirectoryFiles)

	log.Info().Str("address", addr).Msg("Site is running")

	err := srv.ListenAndServe()

	log.Fatal().Err(err).Msg("done")

}
