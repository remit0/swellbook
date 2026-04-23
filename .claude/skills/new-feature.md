---
name: new-feature
description: Scaffold a complete new feature across both frontend and backend
---

When adding a new feature, follow this checklist in order.
Replace {feature_name} with lowercase snake_case and {FeatureName} with PascalCase.

## Backend

1. Create route file: backend/app/routes/{feature_name}.py
   - Define router with APIRouter()
   - Add at minimum one endpoint with Depends(get_current_user)

2. Create service file: backend/app/services/{feature_name}.py
   - All functions async
   - Business logic only — no HTTP concerns

3. Create models file: backend/app/models/{feature_name}.py
   - Pydantic BaseModel for every request and response shape

4. Register router in backend/app/main.py:
   ```python
   from app.routes import {feature_name}
   app.include_router({feature_name}.router, prefix="/api/{feature_name}")
   ```

5. Create test file: backend/tests/test_{feature_name}.py

## Frontend

6. Create feature directory: app/src/features/{feature_name}/

7. Create types file: app/src/features/{feature_name}/{feature_name}.types.ts
   - Define all TypeScript interfaces for this feature

8. Create API client: app/src/features/{feature_name}/{feature_name}Api.ts
   - Functions to call backend endpoints
   - Use EXPO_PUBLIC_API_URL as base

9. Create screen: app/src/features/{feature_name}/{FeatureName}Screen.tsx
   - Implement loading, error, and content states

10. Register screen in app/src/navigation/AppNavigator.tsx

## Verify

11. Backend: python -m pytest -v
12. Frontend: npx tsc --noEmit
13. Confirm endpoint visible in Swagger UI at /docs