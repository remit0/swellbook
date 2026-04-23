---
name: new-endpoint
description: Create a new FastAPI endpoint with service layer and Pydantic models
---

When creating a new endpoint {METHOD} /api/{path}:

1. Define Pydantic models in backend/app/models/:

   ```python
   class {Name}Request(BaseModel):
       field: type = Field(..., description="...")

   class {Name}Response(BaseModel):
       field: type
   ```

2. Create async service function in backend/app/services/:

   ```python
   async def {function_name}(
       data: {Name}Request,
       user_id: str
   ) -> {Name}Response:
       # business logic here
       # raise HTTPException for error cases
   ```

3. Create route in backend/app/routes/:

   ```python
   @router.{method}("/{path}")
   async def {endpoint_name}(
       data: {Name}Request,
       user=Depends(get_current_user)
   ) -> {Name}Response:
       return await {function_name}(data, user.id)
   ```

4. Register router in backend/app/main.py if not already done

5. Verify endpoint appears in Swagger UI at /docs

6. Add test case in backend/tests/