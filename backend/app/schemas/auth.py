from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    nickname: str = Field(min_length=1, max_length=50)
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)
