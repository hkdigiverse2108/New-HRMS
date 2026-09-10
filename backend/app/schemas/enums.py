from enum import Enum

class SystemRole(str, Enum):
    ADMIN = "Admin"
    SUB_ADMIN = "Sub-Admin"
    EMPLOYEE = "Employee"

class GenderEnum(str, Enum):
    MALE = "Male"
    FEMALE = "Female"
    OTHER = "Other"

class RelationEnum(str, Enum):
    FATHER = "Father"
    MOTHER = "Mother"
    SPOUSE = "Spouse"
    SIBLING = "Sibling"
    OTHER = "Other"

class StatusEnum(str, Enum):
    ACTIVE = "Active"
    REMOTE = "Remote"
    INACTIVE = "Inactive"

class WorkModeEnum(str, Enum):
    WFO = "WFO"
    WFH = "WFH"
    HYBRID = "Hybrid"
