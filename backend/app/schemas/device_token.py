from pydantic import BaseModel, Field


class DeviceTokenRegister(BaseModel):
    token: str = Field(min_length=10, max_length=255)
    platform: str = Field(default="android", max_length=20)


class DeviceTokenUnregister(BaseModel):
    token: str = Field(min_length=10, max_length=255)
