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



class WorkModeEnum(str, Enum):
    WFO = "WFO"
    WFH = "WFH"
    HYBRID = "Hybrid"
