package api

import (
	"crypto/subtle"
	"net/http"
	"ttsu-server/src/config"
)

func Cors(next http.Handler) http.Handler {

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func BasicAuth(username, password, realm string) func(http.Handler) http.Handler {

	return func(next http.Handler) http.Handler {

		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

			u, p, ok := r.BasicAuth()

			if config.RequireAuth {

				if !ok ||
					subtle.ConstantTimeCompare([]byte(u), []byte(username)) != 1 ||
					subtle.ConstantTimeCompare([]byte(p), []byte(password)) != 1 {
					w.Header().Set("WWW-Authenticate", `Basic realm="`+realm+`"`)
					Unauthorized(w)
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}
