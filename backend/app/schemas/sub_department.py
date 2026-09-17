from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class SubDepartmentCreate(BaseModel):
    name: str
    department_id: str
    department_name: Optional[str] = None

class SubDepartmentUpdate(BaseModel):
    name: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None

class SubDepartmentOut(BaseModel):
    id: str = Field(..., alias="_id")
    name: str
    department_id: str
    department_name: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)
