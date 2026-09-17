from pydantic import BaseModel, Field
from typing import List, Dict, Optional

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
    is_custom: bool = False
    inherited_from: Optional[str] = None

    class Config:
        populate_by_name = True

# ==========================================
# Permission Preset Schema (Department & Role Presets)
# ==========================================
class PermissionPresetBase(BaseModel):
    role: Optional[str] = "Employee"
    department: Optional[str] = None
    department_id: Optional[str] = None
    designation_id: Optional[str] = None
    module_permissions: Dict[str, PermissionFlags] = {}

class PermissionPresetCreate(BaseModel):
    role: Optional[str] = "Employee"
    department: Optional[str] = None
    department_id: Optional[str] = None
    designation_id: Optional[str] = None
    module_permissions: Dict[str, PermissionFlags] = {}

class PermissionPresetUpdate(BaseModel):
    module_permissions: Dict[str, PermissionFlags]

class PermissionPresetResponse(BaseModel):
    id: str = Field(alias="_id")
    role: Optional[str] = "Employee"
    department: Optional[str] = None
    department_id: Optional[str] = None
    designation_id: Optional[str] = None
    module_permissions: Dict[str, PermissionFlags] = {}

    class Config:
        populate_by_name = True
