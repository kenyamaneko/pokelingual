package apperror

import "errors"

// ErrNotFound indicates that the requested resource was not found.
var ErrNotFound = errors.New("not found")

// ExternalServiceError indicates that an external API call failed.
type ExternalServiceError struct {
	Service string
	Err     error
}

func (e *ExternalServiceError) Error() string {
	return e.Service + ": " + e.Err.Error()
}

func (e *ExternalServiceError) Unwrap() error {
	return e.Err
}

// NewExternalServiceError creates a new ExternalServiceError for the given service.
func NewExternalServiceError(service string, err error) *ExternalServiceError {
	return &ExternalServiceError{Service: service, Err: err}
}
