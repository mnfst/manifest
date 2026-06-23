# Proxy recorder unicode fix

This branch fixes PostgreSQL `unsupported Unicode escape sequence` errors when recorder payloads contain null bytes or invalid UTF-16 surrogate pairs.
