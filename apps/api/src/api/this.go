package api

import "sync"

type TsuFile struct {
	ID     string `json:"id"`
	Parent string `json:"parentId"`
	Name   string `json:"name"`
	Path   string `json:"path"`
}

type TsuApi struct {
	sync.Mutex
	Files []TsuFile
}
