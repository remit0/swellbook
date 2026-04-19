# Python Code Style

- Always use async def for route handlers and service functions
- Always use type hints on function signatures
- Always use Pydantic models for request/response validation
- Never use print() — use logging module instead
- Never catch bare Exception — always catch specific exceptions
- Always include docstrings on public functions