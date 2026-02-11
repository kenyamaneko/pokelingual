package middleware

import (
	"net/http"
	"strings"

	"firebase.google.com/go/v4/auth"
	"github.com/gin-gonic/gin"
)

// FirebaseAuth returns a Gin middleware that verifies Firebase ID tokens
// and optionally restricts access to a whitelist of email addresses.
func FirebaseAuth(authClient *auth.Client, allowedEmails []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		idToken := strings.TrimPrefix(authHeader, "Bearer ")
		if idToken == authHeader {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format"})
			return
		}

		token, err := authClient.VerifyIDToken(c.Request.Context(), idToken)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		if len(allowedEmails) > 0 {
			email, _ := token.Claims["email"].(string)
			if !contains(allowedEmails, email) {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "access denied"})
				return
			}
		}

		c.Set("uid", token.UID)
		c.Next()
	}
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}
