## Database & Migrations
- **Immutable History:** Never modify existing files in `backend/migrations/`.
- **New Migrations:** When a schema change is requested, always generate a **new** migration script with a sequential prefix (e.g., `002_...`).
- **Apply Migrations:** The migrations will be manually applied by the user.