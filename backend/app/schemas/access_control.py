from pydantic import BaseModel, Field
from typing import List, Dict

class PermissionFlags(BaseModel):
    read: bool = False
    create: bool = False
    update: bool = False
    delete: bool = False
    all: bool = False

# ==========================================
# User Permission Schema (યુઝર વાઈઝ એક્સેસ)
# ==========================================
class UserAccessControlBase(BaseModel):
    employee_id: str
    # Dictionary where Key = Module ID / URL, Value = Permission Flags
    module_permissions: Dict[str, PermissionFlags] = {}

class UserAccessControlCreate(UserAccessControlBase):
    pass

class UserAccessControlUpdate(BaseModel):
    module_permissions: Dict[str, PermissionFlags]

class UserAccessControlResponse(UserAccessControlBase):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True

# ==========================================
# Permission Preset Schema (Department + Designation)
# ==========================================
class PermissionPresetBase(BaseModel):
    department_id: str
    designation_id: str
    module_permissions: Dict[str, PermissionFlags] = {}

class PermissionPresetCreate(PermissionPresetBase):
    pass

class PermissionPresetUpdate(BaseModel):
    module_permissions: Dict[str, PermissionFlags]

class PermissionPresetResponse(PermissionPresetBase):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True
