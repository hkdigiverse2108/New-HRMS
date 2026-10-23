from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Optional, Any

class DesignationCreate(BaseModel):
    name: str

    @model_validator(mode="before")
    @classmethod
    def handle_title(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "name" not in data and "title" in data:
                data["name"] = data["title"]
        return data

class DesignationUpdate(BaseModel):
    name: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def handle_title(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "name" not in data and "title" in data:
                data["name"] = data["title"]
        return data

class DesignationOut(BaseModel):
    id: str = Field(..., alias="_id")
    name: str

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def handle_title(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("name") and data.get("title"):
                data["name"] = data["title"]
        return data
