package form

import (
	"io"
	"mime/multipart"
)

// ReadFormString reads a string of at most the given length from the [multipart.Part].
// If it reads a string longer than length or reads an error it returns false
func ReadFormString(length int, part *multipart.Part) (string, bool) {

	// +1 allows us to know if we read longer than the expected length
	var buf []byte = make([]byte, length+1)

	n, err := part.Read(buf[:])

	if n == 0 && err != nil {

		if err != io.EOF {
			return "", false
		}

		// allow empty string inputs
		return "", true
	}

	if n <= length {
		return string(buf[0:n]), true
	}

	return "", false
}

