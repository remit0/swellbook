# Security Rules

- Never hardcode API keys, tokens, or secrets in source code
- Always use environment variables via config.py
- Every route must include Depends(get_current_user)
- Never log request bodies that might contain tokens
- Never commit .env files