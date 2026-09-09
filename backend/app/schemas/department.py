from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class DepartmentCreate(BaseModel):
    name: str

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None

class DepartmentOut(BaseModel):
    id: str = Field(..., alias="_id")
    name: str

    model_config = ConfigDict(populate_by_name=True)
