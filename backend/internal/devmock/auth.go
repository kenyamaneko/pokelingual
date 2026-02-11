package devmock

import (
	"github.com/gin-gonic/gin"
)

// DevAuth returns a Gin middleware that skips token verification
// and sets a fixed UID for local development.
func DevAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("uid", "dev-user")
		c.Next()
	}
}
