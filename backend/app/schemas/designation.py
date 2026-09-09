from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class DesignationCreate(BaseModel):
    name: str

class DesignationUpdate(BaseModel):
    name: Optional[str] = None

class DesignationOut(BaseModel):
    id: str = Field(..., alias="_id")
    name: str

    model_config = ConfigDict(populate_by_name=True)
